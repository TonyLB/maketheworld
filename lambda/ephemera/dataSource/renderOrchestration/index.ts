/**
 * Transitional ingress-only render orchestration DataSource adapter.
 *
 * IMPORTANT:
 * - This module is intentionally temporary.
 * - It is internal-only and non-replayable.
 * - It exists to normalize ingress into envelope-based subscriptions.
 * - It does NOT define a canonical outbound DataSource streaming contract.
 * - Do not copy this module as precedent for full DataSource implementations.
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

// Ingress-only adapter: subscribes to api.ephemera render request envelopes and delegates to legacy orchestration.
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
