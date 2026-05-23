import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import { defaultResolveRoomLensMarkDefaults } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import {
    classifyAuthoredCatalogDrift,
    perspectiveKeyFromCatalogDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import type { EphemeraCacheCatalogRow } from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import {
    DiagnosticsEphemeraRenderCacheFindingEvent,
    DiagnosticsEventSerializer,
    RenderCacheTargetCatalog,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'

import internalCache from '../internalCache'

export type RenderCacheDriftSweepResult = {
    emittedCount: number
    roomIds: EphemeraRoomId[]
    catalogsChecked: number
    driftedCatalogs: RenderCacheTargetCatalog[]
}

const normalizeRoomIds = (roomIds: string[] | undefined): EphemeraRoomId[] => {
    if (!Array.isArray(roomIds)) {
        return []
    }
    const seen = new Set<EphemeraRoomId>()
    const normalized: EphemeraRoomId[] = []
    for (const id of roomIds) {
        if (typeof id !== 'string' || !isEphemeraRoomId(id) || seen.has(id)) {
            continue
        }
        seen.add(id)
        normalized.push(id)
    }
    return normalized.sort()
}

const emitRenderCacheFinding = async (args: {
    status: 'missing' | 'corrupted'
    targetCatalogs: RenderCacheTargetCatalog[]
    diagnosticRunId: string
    nowMs: number
    eventBusName: string
}): Promise<void> => {
    const { status, targetCatalogs, diagnosticRunId, nowMs, eventBusName } = args
    if (!targetCatalogs.length) {
        return
    }

    const internalEvent: DiagnosticsEphemeraRenderCacheFindingEvent = {
        type: 'Ephemera RenderCache Finding',
        targetCatalogs,
        status,
        diagnosticRunId,
        timestamp: new Date(nowMs).toISOString(),
    }

    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: nowMs,
        type: 'Ephemera RenderCache Finding' as const,
    }

    const { eventBridgeEvent } = publishStreamEvent({
        header,
        content: internalEvent,
        serializer: serializer as StreamEventPublisherSerializer<typeof header>,
    })

    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    await ebClient.send(
        new PutEventsCommand({
            Entries: [
                {
                    Source: eventBridgeEvent.Source,
                    DetailType: eventBridgeEvent.DetailType,
                    EventBusName: eventBusName,
                    Detail: JSON.stringify(eventBridgeEvent.Detail),
                },
            ],
        })
    )
}

/**
 * Read-only diagnostics sweep: compare blueprint authored slices to materialized CACHE# rows
 * for caller-supplied rooms (existing Cache:: catalog rows only).
 */
export const renderCacheDriftSweep = async (params?: {
    roomIds?: string[]
    diagnosticRunId?: string
    nowMs?: number
}): Promise<RenderCacheDriftSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('renderCacheDriftSweep requires EVENT_BUS_NAME')
    }

    const roomIds = normalizeRoomIds(params?.roomIds)
    if (!roomIds.length) {
        return { emittedCount: 0, roomIds: [], catalogsChecked: 0, driftedCatalogs: [] }
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()

    const missingTargets: RenderCacheTargetCatalog[] = []
    const corruptedTargets: RenderCacheTargetCatalog[] = []
    let catalogsChecked = 0

    for (const roomId of roomIds) {
        const catalogRows = await internalCache.RenderCache.getCatalogRows(roomId)
        if (!catalogRows.length) {
            continue
        }

        const materializedRows = await internalCache.RenderCache.getCacheRows(roomId)

        await Promise.all(
            catalogRows.map(async (catalogRow: EphemeraCacheCatalogRow) => {
                const perspectiveKey = perspectiveKeyFromCatalogDataCategory(catalogRow.DataCategory)
                if (!perspectiveKey) {
                    return
                }

                catalogsChecked += 1

                const perspective: Perspective = { assetStack: catalogRow.assetStack }
                const desiredSet = await internalCache.ComponentExamples.get({
                    hostUniversalKey: roomId,
                    mergeParticipationOrder: catalogRow.assetStack,
                    options: {
                        resolveRoomLensMarkDefaults: defaultResolveRoomLensMarkDefaults(roomId),
                    },
                })

                const drift = classifyAuthoredCatalogDrift({
                    catalogRow,
                    desiredSet,
                    materializedRows,
                    perspective,
                })

                if (drift.status === 'aligned') {
                    return
                }

                const target: RenderCacheTargetCatalog = {
                    ephemeraId: roomId,
                    perspectiveKey,
                }

                if (drift.status === 'missing') {
                    missingTargets.push(target)
                }
                else {
                    corruptedTargets.push(target)
                }
            })
        )
    }

    const driftedCatalogs = [...missingTargets, ...corruptedTargets]
    let emittedCount = 0

    if (missingTargets.length) {
        await emitRenderCacheFinding({
            status: 'missing',
            targetCatalogs: missingTargets,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
        emittedCount += 1
    }

    if (corruptedTargets.length) {
        await emitRenderCacheFinding({
            status: 'corrupted',
            targetCatalogs: corruptedTargets,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
        emittedCount += 1
    }

    return {
        emittedCount,
        roomIds,
        catalogsChecked,
        driftedCatalogs,
    }
}
