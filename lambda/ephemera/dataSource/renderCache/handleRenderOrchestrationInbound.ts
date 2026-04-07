/**
 * Pass-through from mtw.ephemera.renderOrchestration stream events (subscribe slice: stubs only).
 * Render Pertains, Cache Updated, refetch, and durable writes on Render Generated are implemented in follow-on tasks.
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
        case 'Exact Match Found':
        case 'Generation Started':
        case 'Render Generated':
        case 'Orchestration Error':
        case 'Generation Deferred':
            return
        default: {
            const _exhaustive: never = params.content
            return _exhaustive
        }
    }
}
