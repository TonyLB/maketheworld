/**
 * mtw.ephemera.renderOrchestration DataSource (evolving).
 *
 * Ingress is normalized here first; orchestration may consolidate into this package over time.
 * See ./AGENT.md: "transitional" means immature contracts, not "keep this file minimal forever."
 *
 * Current facts: internal-only, non-replayable, envelope subscription to api.ephemera and
 * mtw.ephemera.state (`State Changed` passive fan-out).
 * Outbound / replay semantics are TBD until graduation criteria in AGENT.md are met.
 */
import EphemeraDataSource from '../abstract'
import {
    isEphemeraStateStateChangedEnvelope,
    isStateChangedPayload,
} from '../state/events'
import {
    isRenderOrchestrationIngressEnvelope,
    isRenderOrchestrationSubscribedEnvelope,
    isRenderPreviewRequestedIngressEnvelope,
    isRenderRequestedIngressEnvelope,
    type RenderOrchestrationIngressEvent,
    type RenderOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isRenderPreviewRequestedCommand, isRenderRequestedCommand } from './localApiEvents'
import { orchestrateRenderRequest } from './orchestrationHandler'
import { fanOutStateChangedToPassiveRenders } from './fanOutStateChangedToPassiveRenders'
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

// Subscribes to api.ephemera render requests and mtw.ephemera.state State Changed (fan-out to passive render).
export const renderOrchestrationDataSource = new EphemeraDataSource<never, never, RenderOrchestrationSubscribedContent>({
    dataSourceKey: 'mtw.ephemera.renderOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isRenderOrchestrationSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            if (isEphemeraStateStateChangedEnvelope(event)) {
                const raw = await event.getContent()
                if (!isStateChangedPayload(raw)) {
                    return
                }
                await fanOutStateChangedToPassiveRenders({ stateChanged: raw, messageBus })
                return
            }
            if (!isRenderOrchestrationIngressEnvelope(event)) {
                return
            }
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
