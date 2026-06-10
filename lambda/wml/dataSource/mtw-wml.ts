import { WMLDataSource } from './abstract'
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { moveAsset } from './moveAsset'
import { applyEdit } from './applyEdit'
import { purgeAsset } from './purgeAsset'
import { CoordinationEventUpdate, isCoordinationCanonizeEvent, isCoordinationDecanonizeEvent, MoveAssetRequest, ApplyEditRequest, CreateSnapshotRequest, PurgeAssetRequest } from './localApiEvents'
import { DiagnosticsEventUpdate, isS3StructureFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isSchemaAssetUUID, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { initializePrimitives } from './initializePrimitives'
import { createManualSnapshot } from '../s3Storage/manifest/orchestration'
import AssetWorkspace from '../s3Storage/AssetWorkspace'
import { generateWmlSnapshotContent } from './snapshotContent'
import { singleFlightFactory } from '@tonylb/mtw-lambda-patterns/ts/singleFlight'
import assetDB from '../utilities/mockableAssetDB'
import { ApplyEditResult } from './applyEdit'
import {
    WMLSubscribedPayload,
    isWMLSubscribedEnvelope,
    isApplyEditEnvelope,
    isMoveAssetEnvelope,
    isCanonizeOrDecanonizeEnvelope,
    isCreateSnapshotEnvelope,
    isPurgeAssetEnvelope,
    isDiagnosticsEnvelope,
} from './subscribedEvents'

export type WmlStreamEventFn = (params: {
    update: WMLEventUpdate
    streamKey: string
    header: { type: string; RequestIds?: string[] }
}) => Promise<void>

// Single-flight factory for WML edits - ensures sequential processing per asset
const wmlEditSingleFlight = singleFlightFactory({
    primaryKey: 'AssetId',
    // Bind methods to preserve 'this' context when extracted
    optimisticUpdateFunction: assetDB.optimisticUpdate.bind(assetDB),
    getItemFunction: assetDB.getItem.bind(assetDB),
    mode: 'sequential', // Process edits sequentially, not concurrently
    timeoutMs: 10000 // 10 second timeout for WML edits
})

export const coordinateMoveAsset = async (
    AssetId: AssetUUID,
    payload: MoveAssetRequest,
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    try {
        const result = await wmlEditSingleFlight({
            category: 'wml-edit',
            argumentHash: AssetId,
            computation: async () => {
                return await moveAsset(AssetId, payload)
            }
        }) as { success: boolean }
        if (result.success) {
            try {
                await streamEvent({
                    update: {
                        fromZone: payload.fromZone,
                        toZone: payload.toZone,
                        ...(payload.player ? { player: payload.player } : {}),
                        ...(payload.subFolder ? { subFolder: payload.subFolder } : {})
                    },
                    streamKey: AssetId,
                    header: { type: 'Zone Changed' }
                })
            } catch (streamError) {
                console.error(`Error streaming zone changed event for ${AssetId}:`, streamError)
            }
        }
    } catch (error) {
        console.error(`Error processing moveAsset for ${AssetId}:`, error)
    }
}

export const coordinateCanonizeAsset = async (
    AssetId: AssetUUID,
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    const moveRequest: MoveAssetRequest = { fromZone: 'Library', toZone: 'Canon' }
    try {
        const result = await wmlEditSingleFlight({
            category: 'wml-edit',
            argumentHash: AssetId,
            computation: async () => {
                return await moveAsset(AssetId, moveRequest)
            }
        }) as { success: boolean }
        if (result.success) {
            try {
                await streamEvent({
                    update: { fromZone: moveRequest.fromZone, toZone: moveRequest.toZone },
                    streamKey: AssetId,
                    header: { type: 'Zone Changed' }
                })
            } catch (streamError) {
                console.error(`Error streaming zone changed event for ${AssetId}:`, streamError)
            }
        }
    } catch (error) {
        console.error(`Error processing canonize for ${AssetId}:`, error)
    }
}

const processApplyEdit = async (
    event: StreamingEventEnvelope<ApplyEditRequest> & { header: StreamingEventHeader & { streamKey: string } },
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const payload = await event.getContent()
    if (!payload) return
    const AssetId = event.header.streamKey
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    try {
        const result = await wmlEditSingleFlight({
            category: 'wml-edit',
            argumentHash: AssetId,
            computation: async (): Promise<ApplyEditResult> => {
                return await applyEdit({
                    AssetId,
                    RequestId: payload.RequestId,
                    schema: payload.schema,
                    createIfNeeded: payload.createIfNeeded,
                    zone: payload.zone
                })
            }
        }) as ApplyEditResult
        if (result.success) {
            try {
                await streamEvent({
                    update: { schema: new StandardForm(payload.schema) },
                    streamKey: AssetId,
                    header: { type: 'Content Update', RequestIds: payload.RequestId != null ? [payload.RequestId] : [] }
                })
            } catch (streamError) {
                console.error(`Error streaming Content Update event for ${AssetId}:`, streamError)
            }
        } else {
            try {
                await streamEvent({
                    update: { error: result.error },
                    streamKey: AssetId,
                    header: { type: 'Merge Conflict', RequestIds: payload.RequestId != null ? [payload.RequestId] : [] }
                })
            } catch (streamError) {
                console.error(`Error streaming Merge Conflict event for ${AssetId}:`, streamError)
            }
        }
    } catch (error) {
        console.error(`Error processing applyEdit for ${AssetId}:`, error)
        try {
            await streamEvent({
                update: { error: error instanceof Error ? error.message : String(error) },
                streamKey: AssetId,
                header: { type: 'Merge Conflict', RequestIds: payload.RequestId != null ? [payload.RequestId] : [] }
            })
        } catch (streamError) {
            console.error(`Error streaming Merge Conflict after applyEdit failure for ${AssetId}:`, streamError)
        }
    }
}

const processMoveAsset = async (
    event: StreamingEventEnvelope<MoveAssetRequest> & { header: StreamingEventHeader & { streamKey: string } },
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const payload = await event.getContent()
    if (!payload) return
    await coordinateMoveAsset(event.header.streamKey as AssetUUID, payload, streamEvent)
}

const processCanonizeDecanonize = async (
    event: StreamingEventEnvelope<CoordinationEventUpdate> & { header: StreamingEventHeader & { streamKey: string } },
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const payload = await event.getContent()
    if (!payload) return
    const AssetId = event.header.streamKey
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    try {
        let moveRequest: MoveAssetRequest
        if (isCoordinationCanonizeEvent(payload)) {
            await coordinateCanonizeAsset(AssetId, streamEvent)
            return
        } else if (isCoordinationDecanonizeEvent(payload)) {
            moveRequest = { fromZone: 'Canon', toZone: 'Library' }
        } else {
            console.error(`Unknown coordination event type: ${JSON.stringify(payload)}`)
            return
        }
        const result = await wmlEditSingleFlight({
            category: 'wml-edit',
            argumentHash: AssetId,
            computation: async () => {
                return await moveAsset(AssetId, moveRequest)
            }
        }) as { success: boolean }
        if (result.success) {
            try {
                await streamEvent({
                    update: { fromZone: moveRequest.fromZone, toZone: moveRequest.toZone },
                    streamKey: AssetId,
                    header: { type: 'Zone Changed' }
                })
            } catch (streamError) {
                console.error(`Error streaming zone changed event for ${AssetId}:`, streamError)
            }
        }
    } catch (error) {
        console.error(`Error processing coordination event:`, error)
    }
}

const processCreateSnapshot = async (
    event: StreamingEventEnvelope<CreateSnapshotRequest> & { header: StreamingEventHeader & { streamKey: string } },
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const AssetId = event.header.streamKey
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    try {
        const assetWorkspace = await AssetWorkspace.fromUUID(AssetId)
        if (!assetWorkspace) {
            console.error(`Error creating snapshot: Asset ${AssetId} not found`)
            return
        }
        const assetKey = AssetId.replace('ASSET#', '')
        const contentResult = await createManualSnapshot({
            prefix: `${assetKey}.wml/`,
            zone: assetWorkspace.zone
        })
        const authResult = await createManualSnapshot({
            prefix: `${assetKey}.auth.wml/`,
            zone: assetWorkspace.zone
        })
        try {
            await streamEvent({
                update: {
                    chunksBeforeSnapshot: contentResult.chunksBeforeSnapshot,
                    snapshotSize: contentResult.snapshotReference.snapshotSize + authResult.snapshotReference.snapshotSize
                },
                streamKey: AssetId,
                header: { type: 'Snapshot Created' }
            })
        } catch (streamError) {
            console.error(`Error streaming Snapshot Created event for ${AssetId}:`, streamError)
        }
    } catch (error) {
        console.error(`Error creating snapshot for ${AssetId}:`, error)
    }
}

const processPurgeAsset = async (
    event: StreamingEventEnvelope<PurgeAssetRequest> & { header: StreamingEventHeader & { streamKey: string } },
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const payload = await event.getContent()
    if (!payload) return
    const AssetId = event.header.streamKey
    if (!isSchemaAssetUUID(AssetId)) {
        console.error(`Invalid AssetId format: ${AssetId}`)
        return
    }
    try {
        let player: string | undefined
        if (payload.expectedZone === 'Draft') {
            const workspace = await AssetWorkspace.fromUUID(AssetId, { preferDynamo: false, allowS3Fallback: true })
            player = workspace?.player
        }
        const result = await purgeAsset(AssetId, {
            expectedZone: payload.expectedZone,
            requireExists: payload.requireExists
        })
        if (result.success) {
            try {
                await streamEvent({
                    update: {
                        zone: payload.expectedZone,
                        objectsDeleted: result.objectsDeleted ?? 0,
                        ...(player ? { player } : {})
                    },
                    streamKey: AssetId,
                    header: { type: 'Asset Purged' }
                })
            } catch (streamError) {
                console.error(`Error streaming Asset Purged event for ${AssetId}:`, streamError)
            }
        } else {
            console.log(`Purge failed for ${AssetId}: ${result.message}`)
        }
    } catch (error) {
        console.error(`Error purging asset ${AssetId}:`, error)
    }
}

const PRIMITIVES_ASSET_ID = 'ASSET#primitives'

const processS3StructureFinding = async (
    event: StreamingEventEnvelope<DiagnosticsEventUpdate>,
    streamEvent: WmlStreamEventFn
): Promise<void> => {
    const payload = await event.getContent()
    if (!payload || !isS3StructureFindingEvent(payload)) return
    if (payload.source === 'primitives.wml' && payload.status === 'missing') {
        try {
            const result = await initializePrimitives()
            if (result.success && (result.action === 'created' || result.action === 'repaired') && result.schema) {
                try {
                    await streamEvent({
                        update: { schema: result.schema },
                        streamKey: PRIMITIVES_ASSET_ID,
                        header: { type: 'Content Update', RequestIds: [] }
                    })
                } catch (streamError) {
                    console.error(`WML DataSource: Error streaming Content Update for primitives:`, streamError)
                }
            }
        } catch (error) {
            console.error(`WML DataSource: Error initializing primitives:`, error)
        }
    }
}

//
// mtw.wml DataSource: snapshot-on-subscribe via S3 sidecar, then Content Update / Merge Conflict events.
//
// On subscribe, initializeSubscription delivers a Snapshot with sidecarUrl (presigned GET for
// immutable snapshot or materialized view). Client fetches URL and applies result as initial view.
// replayable: true is required so the DataSource subscribes to Initialize Subscription events;
// getRecentEvents returns [] (no Dynamo event store for WML).
//
// SubscribedContent = coordination + diagnostics (what we subscribe to). UpdatePayload = WMLEventUpdate (what we publish).
export const wmlDataSource = new WMLDataSource<{}, WMLEventUpdate, CoordinationEventUpdate | DiagnosticsEventUpdate, WMLEventExternal>({
    dataSourceKey: 'mtw.wml',
    replayable: true, // Required for initializeSubscription (sidecar snapshot on subscribe)
    outboundBusDelivery: 'publish',
    snapshotContentGenerator: async (streamKey: string) => generateWmlSnapshotContent(streamKey as AssetUUID),
    subscribedEventTypeGuard: isWMLSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        await Promise.all(events.map(async (event) => {
            if (isApplyEditEnvelope(event)) {
                await processApplyEdit(event, streamEvent)
                return
            }
            if (isMoveAssetEnvelope(event)) {
                await processMoveAsset(event, streamEvent)
                return
            }
            if (isCanonizeOrDecanonizeEnvelope(event)) {
                await processCanonizeDecanonize(event, streamEvent)
                return
            }
            if (isCreateSnapshotEnvelope(event)) {
                await processCreateSnapshot(event, streamEvent)
                return
            }
            if (isPurgeAssetEnvelope(event)) {
                await processPurgeAsset(event, streamEvent)
                return
            }
            if (isDiagnosticsEnvelope(event)) {
                await processS3StructureFinding(event, streamEvent)
            }
        }))
    },
    eventSerializer: new WMLEventSerializer(createNodeDataSourceEnvironment())
})

export default wmlDataSource
