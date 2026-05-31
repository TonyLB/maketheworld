/**
 * mtw.ephemera.affordanceOrchestration DataSource.
 *
 * Canonical home for affordance-channel orchestration (Area topology exits, M4).
 * See ./AGENT.md for semantics and constraints.
 *
 * Ingress: api.ephemera Affordances Requested; mtw.ephemera.objects Objects Changed (fan-out).
 * Outbounds: five-type stream on this DataSource via streamEvent (v1-active: Slice Ready, Orchestration Error).
 * replayable: false.
 */
import EphemeraDataSource from '../abstract'
import {
    isAffordanceOrchestrationIngressEnvelope,
    isAffordanceOrchestrationSubscribedEnvelope,
    isAffordancesRequestedIngressEnvelope,
    type AffordanceOrchestrationIngressEvent,
    type AffordanceOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isAffordancesRequestedCommand } from './localApiEvents'
import { orchestrateAffordanceRequest } from './orchestrationHandler'
import { fanOutAffordanceRefreshForRoom } from './fanOutAffordanceRefreshForRoom'
import { isEphemeraObjectsObjectsChangedEnvelope, isObjectsChangedPayload } from '../objects/events'
import type { AffordanceOrchestrationPublishedPayload } from './publishedEvents'
import messageBus from '../../messageBus'

const toLegacyPayload = async (event: AffordanceOrchestrationIngressEvent) => {
    const content = await event.getContent()
    if (!isAffordancesRequestedIngressEnvelope(event)) {
        return undefined
    }
    if (!isAffordancesRequestedCommand(content)) {
        return undefined
    }
    return {
        type: 'AffordancesRequested' as const,
        ...content,
    }
}

export const affordanceOrchestrationDataSource = new EphemeraDataSource<
    never,
    AffordanceOrchestrationPublishedPayload,
    AffordanceOrchestrationSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.affordanceOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isAffordanceOrchestrationSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            if (isEphemeraObjectsObjectsChangedEnvelope(event)) {
                const raw = await event.getContent()
                if (!isObjectsChangedPayload(raw)) {
                    return
                }
                await fanOutAffordanceRefreshForRoom({
                    roomId: raw.componentId,
                    reason: 'objects',
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (!isAffordanceOrchestrationIngressEnvelope(event)) {
                return
            }
            const payload = await toLegacyPayload(event as AffordanceOrchestrationIngressEvent)
            if (!payload) {
                return
            }
            await orchestrateAffordanceRequest({
                payload,
                messageBus,
                streamEvent,
            })
        }))
    },
})

affordanceOrchestrationDataSource.subscribe()

export default affordanceOrchestrationDataSource
