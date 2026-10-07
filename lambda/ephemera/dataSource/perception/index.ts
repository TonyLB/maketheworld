/**
 * mtw.ephemera.perception DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera perception-thread ingress plus render /
 * affordance streams. See AGENT.md (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionSubscribedContent } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope } from './subscribedEvents'
import { isAffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { isPerceptionThreadRegisterCommand } from './localApiEvents'
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
        for (const event of events) {
            const raw = await event.getContent()
            if (isPerceptionThreadRegisterCommand(raw)) {
                internalCache.PerceptionThreads.register(raw)
                continue
            }
            if (isAffordancesPertainPayload(raw)) {
                await handleAffordancesPertain(raw, messageBus)
                continue
            }
            await orchestrateRoomDescriptionStreams(raw, messageBus)
        }
    },
})

ephemeraPerceptionDataSource.subscribe()

export default ephemeraPerceptionDataSource
