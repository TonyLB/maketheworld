/**
 * Pass-through from mtw.ephemera.renderOrchestration stream events.
 * Generate path: durable write on Render Generated, then Render Pertains then Cache Updated (Cache-OI-1).
 * Hit and generate paths also set the `currentCacheId` catalog-row pointer (best-effort, CP-4 seam).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from './baseClasses'
import internalCache from '../../internalCache'
import type {
    RenderOrchestrationCurrentCacheValidPayload,
    RenderOrchestrationExactMatchFoundPayload,
    RenderOrchestrationPublishedPayload,
    RenderOrchestrationRenderGeneratedPayload,
} from '../renderOrchestration/publishedEvents'
import type { PutCacheRecordInput } from './putCacheRecord'
import { putCacheRecord } from './putCacheRecord'
import { setPerspectivePointer } from './perspectivePointer'
import type { RenderCacheUpdatePayload } from './baseClasses'

async function setPerspectivePointerBestEffort(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string,
    cacheId: EphemeraCacheId
): Promise<void> {
    try {
        await setPerspectivePointer(componentId, perspectiveKey, cacheId)
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[mtw.ephemera.renderCache] Perspective pointer set failed (best-effort)', {
            componentId,
            perspectiveKey,
            cacheId,
            errorMessage,
        })
    }
}

function dynamoItemToPutInput(record: EphemeraCacheDynamoItem): PutCacheRecordInput {
    return {
        markState: record.markState,
        renderedContent: record.renderedContent,
        provenance: record.provenance,
        perspectiveId: record.perspectiveId,
        perspectiveMatcher: record.perspectiveMatcher,
        ...(record.situationId !== undefined ? { situationId: record.situationId } : {}),
    }
}

async function handleOrchestrationHitPath(params: {
    content: RenderOrchestrationCurrentCacheValidPayload | RenderOrchestrationExactMatchFoundPayload;
    streamEvent: StreamEventFunction<RenderCacheUpdatePayload>;
}): Promise<void> {
    const { content, streamEvent } = params
    const componentId = content.componentId as EphemeraCacheComponentId
    const rows = await internalCache.RenderCache.get(componentId)
    const row = rows.find((r) => r.DataCategory === content.cacheId)
    if (row === undefined) {
        console.error('[mtw.ephemera.renderCache] Hit path refetch miss after orchestration outbound', {
            outboundType: content.type,
            componentId: content.componentId,
            cacheId: content.cacheId,
        })
        return
    }
    await setPerspectivePointerBestEffort(componentId, content.perspectiveKey, content.cacheId)
    await streamEvent({
        streamKey: componentId,
        header: { type: 'Render Pertains' },
        update: {
            type: 'Render Pertains',
            componentId,
            perspectiveKey: content.perspectiveKey,
            cacheId: content.cacheId,
            cacheRecord: row,
        },
    })
}

async function handleOrchestrationGeneratePath(params: {
    content: RenderOrchestrationRenderGeneratedPayload;
    streamEvent: StreamEventFunction<RenderCacheUpdatePayload>;
}): Promise<void> {
    const { content, streamEvent } = params
    const componentId = content.componentId as EphemeraCacheComponentId
    const perspectiveId = content.cacheRecord.perspectiveId

    if (content.cacheRecord.EphemeraId !== content.componentId) {
        console.error('[mtw.ephemera.renderCache] Render Generated cacheRecord.EphemeraId does not match componentId', {
            componentId: content.componentId,
            ephemeraId: content.cacheRecord.EphemeraId,
        })
        return
    }

    try {
        const record = dynamoItemToPutInput(content.cacheRecord)
        const dataCategory = await putCacheRecord(componentId, record, content.cacheId)
        internalCache.RenderCache.set({
            componentId,
            markState: record.markState,
            cacheId: dataCategory,
            renderedContent: record.renderedContent,
            provenance: record.provenance,
            perspectiveId: record.perspectiveId,
            perspectiveMatcher: record.perspectiveMatcher,
            ...(record.situationId !== undefined ? { situationId: record.situationId } : {}),
        })
        const cacheRecord: EphemeraCacheDynamoItem = {
            ...content.cacheRecord,
            EphemeraId: componentId,
            DataCategory: dataCategory,
        }
        await setPerspectivePointerBestEffort(componentId, content.perspectiveKey, dataCategory as EphemeraCacheId)
        await streamEvent({
            streamKey: componentId,
            header: { type: 'Render Pertains' },
            update: {
                type: 'Render Pertains',
                componentId,
                perspectiveKey: content.perspectiveKey,
                cacheId: content.cacheId,
                cacheRecord,
            },
        })
        await streamEvent({
            streamKey: componentId,
            header: { type: 'Cache Updated' },
            update: {
                type: 'Cache Updated',
                componentId,
                dataCategory,
                perspectiveId: record.perspectiveId,
            },
        })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[mtw.ephemera.renderCache] Cache Error', {
            componentId,
            errorCode: 'PUT_FAILED',
            errorMessage,
            perspectiveId,
        })
        await streamEvent({
            streamKey: componentId,
            header: { type: 'Cache Error' },
            update: {
                type: 'Cache Error',
                componentId,
                errorCode: 'PUT_FAILED',
                errorMessage,
                perspectiveId,
            },
        })
    }
}

export async function handleRenderOrchestrationInbound(params: {
    content: RenderOrchestrationPublishedPayload;
    streamEvent: StreamEventFunction<RenderCacheUpdatePayload>;
}): Promise<void> {
    switch (params.content.type) {
        case 'Current Cache Valid':
            await handleOrchestrationHitPath({
                content: params.content,
                streamEvent: params.streamEvent,
            })
            return
        case 'Exact Match Found':
            await handleOrchestrationHitPath({
                content: params.content,
                streamEvent: params.streamEvent,
            })
            return
        case 'Render Generated':
            await handleOrchestrationGeneratePath({
                content: params.content,
                streamEvent: params.streamEvent,
            })
            return
        case 'Generation Started':
            // Contract: no Render Pertains / Cache Updated from renderCache for this outbound (Cache-OI-2).
            return
        case 'Orchestration Error':
            // No cache readiness signal on orchestration failure.
            return
        case 'Generation Deferred':
            // No cache row writes here; the pointer self-invalidates on next read when markState no longer matches (see perspectivePointer.ts).
            return
        default: {
            const _exhaustive: never = params.content
            return _exhaustive
        }
    }
}
