/**
 * mtw.ephemera.renderOrchestration DataSource.
 *
 * Canonical home for passive render orchestration. See ./AGENT.md for semantics and constraints.
 *
 * Ingress: api.ephemera envelopes, `mtw.ephemera.actions` `Look Command Requested` (room look), and `State Changed` (passive fan-out).
 * Outbounds: six-type stream on this DataSource via streamEvent (pass-through migration complete).
 * replayable: false today; replay is not a planned follow-up unless product asks (AGENT.md).
 */
import EphemeraDataSource from '../abstract'
import {
    isEphemeraStateStateChangedEnvelope,
    isStateChangedPayload,
} from '../state/events'
import { isLookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import {
    isLookCommandRequestedActionsEnvelope,
    isRenderOrchestrationIngressEnvelope,
    isRenderOrchestrationSubscribedEnvelope,
    isRenderRequestedIngressEnvelope,
    type RenderOrchestrationIngressEvent,
    type RenderOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isRenderRequestedCommand } from './localApiEvents'
import { handleLookCommandRequestedForRenderOrchestration } from './handleLookCommandRequestedForRenderOrchestration'
import { orchestrateRenderRequest } from './orchestrationHandler'
import { fanOutStateChangedToPassiveRenders } from './fanOutStateChangedToPassiveRenders'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import messageBus from '../../messageBus'

const toLegacyPayload = async (event: RenderOrchestrationIngressEvent) => {
    const content = await event.getContent()
    if (!isRenderRequestedIngressEnvelope(event)) {
        return undefined
    }
    if (!isRenderRequestedCommand(content)) {
        return undefined
    }
    return {
        type: 'RenderRequested' as const,
        ...content,
    }
}

// Subscribes to api.ephemera render requests and mtw.ephemera.state State Changed (fan-out to passive render).
export const renderOrchestrationDataSource = new EphemeraDataSource<never, RenderOrchestrationPublishedPayload, RenderOrchestrationSubscribedContent>({
    dataSourceKey: 'mtw.ephemera.renderOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isRenderOrchestrationSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            if (isEphemeraStateStateChangedEnvelope(event)) {
                const raw = await event.getContent()
                if (!isStateChangedPayload(raw)) {
                    return
                }
                await fanOutStateChangedToPassiveRenders({ stateChanged: raw, messageBus, streamEvent })
                return
            }
            if (isLookCommandRequestedActionsEnvelope(event)) {
                const lookPayload = await event.getContent()
                if (!isLookCommandRequestedPublishedPayload(lookPayload)) {
                    return
                }
                await handleLookCommandRequestedForRenderOrchestration(messageBus, lookPayload)
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
                streamEvent,
            })
        }))
    },
})

renderOrchestrationDataSource.subscribe()

export default renderOrchestrationDataSource
