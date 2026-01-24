import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { moveAsset } from './moveAsset'
import { applyEdit } from './applyEdit'
import { purgeAsset } from './purgeAsset'
import { CoordinationEventUpdate, isCoordinationEventUpdate, isCoordinationCanonizeEvent, isCoordinationDecanonizeEvent, isMoveAssetRequest, isApplyEditRequest, isCreateSnapshotRequest, isPurgeAssetRequest, MoveAssetRequest } from './coordinationSerializer'
import { DiagnosticsEventUpdate, isS3StructureFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isSchemaAssetUUID, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { initializePrimitives } from './initializePrimitives'
import { createManualSnapshot } from '../s3Storage/manifest/orchestration'
import AssetWorkspace from '../s3Storage/AssetWorkspace'
import { singleFlightFactory } from '@tonylb/mtw-lambda-patterns/ts/singleFlight'
import assetDB from '../utilities/mockableAssetDB'
import { ApplyEditResult } from './applyEdit'

// Single-flight factory for WML edits - ensures sequential processing per asset
const wmlEditSingleFlight = singleFlightFactory({
    primaryKey: 'AssetId',
    // Bind methods to preserve 'this' context when extracted
    optimisticUpdateFunction: assetDB.optimisticUpdate.bind(assetDB),
    getItemFunction: assetDB.getItem.bind(assetDB),
    mode: 'sequential', // Process edits sequentially, not concurrently
    timeoutMs: 10000 // 10 second timeout for WML edits
})

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = 
    | (StreamingEventPayload & {
        dataSourceKey: 'internal';
        streamKey: string;
        event: CoordinationEventUpdate;
    })
    | (StreamingEventPayload & {
        dataSourceKey: 'mtw.diagnostics';
        streamKey: string;
        event: DiagnosticsEventUpdate;
    })

//
// Non-replayable DataSource singleton for mtw.wml
// 
// This DataSource handles WML-specific events and provides serialization/deserialization
// between internal StandardForm objects and WML string format.
// 
// Key responsibilities:
// - Serialize StandardForm to WML format for EventBridge events
// - Deserialize incoming WML format events back to StandardForm for processing
// - Handle WML-specific event processing (currently stubbed)
// - Provide the foundation for future WML lambda refactoring
//
export const wmlDataSource = new WMLDataSource<{}, WMLEventUpdate, WMLSubscribedEvent, WMLEventExternal>({
    dataSourceKey: 'mtw.wml',
    replayable: false, // Non-replayable - focuses on event streaming and serialization
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is WMLSubscribedEvent => {
        // Subscribe to:
        // 1. Internal coordination events (direct API calls)
        // 2. mtw.diagnostics events (system health findings)
        return Boolean(
            (event.dataSourceKey === 'internal' &&
                (event as any).detailEnvelope &&
                typeof (event as any).detailEnvelope === 'object' &&
                isCoordinationEventUpdate((event as any).detailEnvelope as any)) ||
            (event.dataSourceKey === 'mtw.diagnostics' &&
                (event as any).detailEnvelope &&
                typeof (event as any).detailEnvelope === 'object')
        )
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal coordination events from direct API calls and EventBridge
        await Promise.all(events.map(async (event) => {
            const payload = (event as any).detailEnvelope as any
            
            // Handle Apply Edit events
            if (isApplyEditRequest(payload)) {
                // Validate AssetId for asset-specific operations
                const AssetId = event.streamKey
                if (!isSchemaAssetUUID(AssetId)) {
                    console.error(`Invalid AssetId format: ${AssetId}`)
                    return
                }
                try {
                    // Use singleFlight to ensure sequential processing per asset
                    const result = await wmlEditSingleFlight({
                        category: 'wml-edit',
                        argumentHash: AssetId, // Gate by AssetId so all edits on same asset are sequential
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
                        // Stream Content Update event
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Content Update',
                                    schema: result.schema
                                },
                                streamKey: AssetId
                            })
                        } catch (streamError) {
                            console.error(`Error streaming Content Update event for ${AssetId}:`, streamError)
                            // Don't fail the edit operation if streaming fails
                        }
                    } else {
                        // Stream Merge Conflict event for failed edits so client knows the edit failed
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Merge Conflict',
                                    error: result.error
                                },
                                streamKey: AssetId
                            })
                        } catch (streamError) {
                            console.error(`Error streaming Merge Conflict event for ${AssetId}:`, streamError)
                        }
                    }
                } catch (error) {
                    console.error(`Error processing applyEdit for ${AssetId}:`, error)
                }
            }
            
            // Handle Move Asset events
            if (isMoveAssetRequest(payload)) {
                // Validate AssetId for asset-specific operations
                const AssetId = event.streamKey
                if (!isSchemaAssetUUID(AssetId)) {
                    console.error(`Invalid AssetId format: ${AssetId}`)
                    return
                }
                try {
                    // Use singleFlight to ensure sequential processing per asset
                    // This prevents race conditions between moveAsset and applyEdit operations
                    const result = await wmlEditSingleFlight({
                        category: 'wml-edit',
                        argumentHash: AssetId, // Gate by AssetId so all operations on same asset are sequential
                        computation: async () => {
                            return await moveAsset(AssetId, payload)
                        }
                    }) as any // Type assertion for MoveAssetResponse
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    fromZone: payload.fromZone,
                                    toZone: payload.toZone,
                                    ...(payload.player ? { player: payload.player } : {}),
                                    ...(payload.subFolder ? { subFolder: payload.subFolder } : {})
                                },
                                streamKey: AssetId
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${AssetId}:`, streamError)
                            // Don't fail the move operation if streaming fails
                        }
                    }
                } catch (error) {
                    console.error(`Error processing moveAsset for ${AssetId}:`, error)
                }
            }
            
            // Process coordination events for canonization/decanonization
            if (isCoordinationCanonizeEvent(payload) || isCoordinationDecanonizeEvent(payload)) {
                // Validate AssetId for asset-specific operations
                const AssetId = event.streamKey
                if (!isSchemaAssetUUID(AssetId)) {
                    console.error(`Invalid AssetId format: ${AssetId}`)
                    return
                }
                try {
                    const coordinationEvent = payload
                    let moveRequest: MoveAssetRequest
                    
                    if (isCoordinationCanonizeEvent(coordinationEvent)) {
                        // Canonize: move from current zone to Canon
                        moveRequest = {
                            type: 'Move Asset',
                            fromZone: 'Library', // Default from zone for canonization
                            toZone: 'Canon'
                        }
                    } else if (isCoordinationDecanonizeEvent(coordinationEvent)) {
                        // Decanonize: move from Canon to Library
                        moveRequest = {
                            type: 'Move Asset',
                            fromZone: 'Canon',
                            toZone: 'Library'
                        }
                    } else {
                        console.error(`Unknown coordination event type: ${JSON.stringify(coordinationEvent)}`)
                        return
                    }
                    
                    const result = await moveAsset(AssetId, moveRequest)
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    fromZone: moveRequest.fromZone,
                                    toZone: moveRequest.toZone
                                },
                                streamKey: AssetId
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${AssetId}:`, streamError)
                            // Don't fail the move operation if streaming fails
                        }
                    }
                } catch (error) {
                    console.error(`Error processing coordination event:`, error)
                }
            }
            
            // Handle Create Snapshot events
            if (isCreateSnapshotRequest(payload)) {
                // Validate AssetId for asset-specific operations
                const AssetId = event.streamKey
                if (!isSchemaAssetUUID(AssetId)) {
                    console.error(`Invalid AssetId format: ${AssetId}`)
                    return
                }
                try {
                    // Load AssetWorkspace to get zone
                    const assetWorkspace = await AssetWorkspace.fromUUID(AssetId)
                    
                    if (!assetWorkspace) {
                        console.error(`Error creating snapshot: Asset ${AssetId} not found`)
                        return
                    }
                    
                    // Get asset key (without ASSET# prefix) for prefixes
                    const assetKey = AssetId.replace('ASSET#', '')
                    
                    // Create snapshot for content
                    const contentResult = await createManualSnapshot({
                        prefix: `${assetKey}.wml/`,
                        zone: assetWorkspace.zone
                    })
                    
                    // Create snapshot for authorization
                    const authResult = await createManualSnapshot({
                        prefix: `${assetKey}.auth.wml/`,
                        zone: assetWorkspace.zone
                    })
                    
                    // Stream Snapshot Created event
                    try {
                        await streamEvent({
                            update: {
                                type: 'Snapshot Created',
                                chunksBeforeSnapshot: contentResult.chunksBeforeSnapshot,
                                snapshotSize: contentResult.snapshotReference.snapshotSize + authResult.snapshotReference.snapshotSize
                            },
                            streamKey: AssetId
                        })
                    } catch (streamError) {
                        console.error(`Error streaming Snapshot Created event for ${AssetId}:`, streamError)
                        // Don't fail the snapshot operation if streaming fails
                    }
                } catch (error) {
                    console.error(`Error creating snapshot for ${AssetId}:`, error)
                }
            }
            
            // Handle Purge Asset events
            if (isPurgeAssetRequest(payload)) {
                // Validate AssetId for asset-specific operations
                const AssetId = event.streamKey
                if (!isSchemaAssetUUID(AssetId)) {
                    console.error(`Invalid AssetId format: ${AssetId}`)
                    return
                }
                try {
                    // Get player from S3 metadata (via AssetWorkspace) BEFORE purging
                    // (files will be deleted during purge, so we need to fetch metadata first)
                    let player: string | undefined
                    if (payload.expectedZone === 'Draft') {
                        const workspace = await AssetWorkspace.fromUUID(AssetId, { preferDynamo: false, allowS3Fallback: true })
                        player = workspace?.player
                    }
                    
                    const result = await purgeAsset(AssetId, {
                        expectedZone: payload.expectedZone,
                        requireExists: payload.requireExists
                    })
                    
                    // Stream Asset Purged event if purge was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Asset Purged',
                                    zone: payload.expectedZone,
                                    objectsDeleted: result.objectsDeleted ?? 0,
                                    ...(player ? { player } : {})
                                },
                                streamKey: AssetId
                            })
                        } catch (streamError) {
                            console.error(`Error streaming Asset Purged event for ${AssetId}:`, streamError)
                            // Don't fail the purge operation if streaming fails
                        }
                    } else {
                        console.log(`Purge failed for ${AssetId}: ${result.message}`)
                    }
                } catch (error) {
                    console.error(`Error purging asset ${AssetId}:`, error)
                }
            }
            
            // Handle mtw.diagnostics S3 Structure Finding events
            if (isS3StructureFindingEvent(payload)) {
                // Respond to missing primitives.wml
                if (payload.source === 'primitives.wml' && payload.status === 'missing') {
                    try {
                        const result = await initializePrimitives()
                    } catch (error) {
                        console.error(`WML DataSource: Error initializing primitives:`, error)
                    }
                }
                // Future: Handle other S3 Structure Finding events here
            }
        }))
    },
    eventSerializer: new WMLEventSerializer()
})

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe()

export default wmlDataSource
