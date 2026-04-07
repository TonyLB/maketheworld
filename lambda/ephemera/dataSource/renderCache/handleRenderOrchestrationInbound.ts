/**
 * Pass-through from mtw.ephemera.renderOrchestration stream events.
 * Generate path (durable write + emits) lives in
 * taskPlanning/.../renderCache/AGENT.passThrough.planning.md (Generate path).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCacheComponentId } from '../../renderCache/baseClasses'
import internalCache from '../../internalCache'
import type {
    RenderOrchestrationCurrentCacheValidPayload,
    RenderOrchestrationExactMatchFoundPayload,
    RenderOrchestrationPublishedPayload,
} from '../renderOrchestration/publishedEvents'
import type { RenderCacheUpdatePayload } from './baseClasses'

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
            // TODO: Generate path -- durable write + Render Pertains / Cache Updated (Cache-OI-1).
            return
        case 'Generation Started':
            // Contract: no Render Pertains / Cache Updated from renderCache for this outbound (Cache-OI-2).
            return
        case 'Orchestration Error':
            // No cache readiness signal on orchestration failure.
            return
        case 'Generation Deferred':
            // No cache row writes here; meta pointers are currentCachePointers.
            return
        default: {
            const _exhaustive: never = params.content
            return _exhaustive
        }
    }
}
