/**
 * mtw.ephemera.perception DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera Character perception ingress. See AGENT.md
 * (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionSubscribedContent } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope } from './subscribedEvents'
import { isAffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { isCharacterPerceptionRequestedCommand, isPerceptionThreadRegisterCommand } from './localApiEvents'
import { handleCharacterPerceptionRequested } from './characterPerception'
import { handleAffordancesPertain } from './handleAffordancesPertain'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'

export const ephemeraPerceptionDataSource = new EphemeraDataSource<
    never,
    PerceptionStubPublishedPayload,
    PerceptionSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.perception',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isPerceptionSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const raw = await event.getContent()
            if (isCharacterPerceptionRequestedCommand(raw)) {
                await handleCharacterPerceptionRequested(raw, messageBus)
                return
            }
            if (isPerceptionThreadRegisterCommand(raw)) {
                internalCache.PerceptionThreads.register(raw)
                return
            }
            if (isAffordancesPertainPayload(raw)) {
                await handleAffordancesPertain(raw, messageBus)
                return
            }
            await orchestrateRoomDescriptionStreams(raw, messageBus)
        }))
    },
})

ephemeraPerceptionDataSource.subscribe()

export default ephemeraPerceptionDataSource
