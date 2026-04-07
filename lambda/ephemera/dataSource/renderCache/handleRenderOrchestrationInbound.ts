/**
 * Pass-through from mtw.ephemera.renderOrchestration stream events.
 * Hit path (refetch + Render Pertains) and generate path (durable write + emits) live in
 * taskPlanning/.../renderCache/AGENT.passThrough.planning.md (Hit path / Generate path).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { RenderOrchestrationPublishedPayload } from '../renderOrchestration/publishedEvents'
import type { RenderCacheUpdatePayload } from './baseClasses'

export async function handleRenderOrchestrationInbound(params: {
    content: RenderOrchestrationPublishedPayload;
    streamEvent: StreamEventFunction<RenderCacheUpdatePayload>;
}): Promise<void> {
    void params.streamEvent
    switch (params.content.type) {
        case 'Current Cache Valid':
            // TODO: Hit path -- refetch + Render Pertains (AGENT.passThrough.planning.md Hit path).
            return
        case 'Exact Match Found':
            // TODO: Hit path -- refetch + Render Pertains (AGENT.passThrough.planning.md Hit path).
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
