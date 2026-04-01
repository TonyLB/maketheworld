/**
 * mtw.ephemera.renderOrchestration DataSource (evolving).
 *
 * Ingress is normalized here first; orchestration may consolidate into this package over time.
 * See ./AGENT.md: "transitional" means immature contracts, not "keep this file minimal forever."
 *
 * Current facts: internal-only, non-replayable, envelope subscription to api.ephemera.
 * Outbound / replay semantics are TBD until graduation criteria in AGENT.md are met.
 */
import EphemeraDataSource from '../abstract'
import {
    isRenderOrchestrationIngressEnvelope,
    isRenderPreviewRequestedIngressEnvelope,
    isRenderRequestedIngressEnvelope,
    type RenderOrchestrationIngressEvent,
} from './subscribedEvents'
import type { RenderOrchestrationIngressCommand } from './localApiEvents'
import { isRenderPreviewRequestedCommand, isRenderRequestedCommand } from './localApiEvents'
import { orchestrateRenderRequest } from '../../renderOrchestration/orchestrationHandler'
import messageBus from '../../messageBus'

const toLegacyPayload = async (event: RenderOrchestrationIngressEvent) => {
    const content = await event.getContent()
    if (isRenderRequestedIngressEnvelope(event)) {
        if (!isRenderRequestedCommand(content)) {
            return undefined
        }
        return {
            type: 'RenderRequested' as const,
            ...content,
        }
    }
    if (isRenderPreviewRequestedIngressEnvelope(event)) {
        if (!isRenderPreviewRequestedCommand(content)) {
            return undefined
        }
        return {
            type: 'RenderPreviewRequested' as const,
            ...content,
        }
    }
    return undefined
}

// Subscribes to api.ephemera render request envelopes; delegates orchestration to renderOrchestration/ until consolidated.
export const renderOrchestrationDataSource = new EphemeraDataSource<never, never, RenderOrchestrationIngressCommand>({
    dataSourceKey: 'mtw.ephemera.renderOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isRenderOrchestrationIngressEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const payload = await toLegacyPayload(event as RenderOrchestrationIngressEvent)
            if (!payload) {
                return
            }
            await orchestrateRenderRequest({
                payload,
                messageBus,
            })
        }))
    },
})

renderOrchestrationDataSource.subscribe()

export default renderOrchestrationDataSource
