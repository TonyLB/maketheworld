/**
 * mtw.ephemera.perception DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera Character perception ingress. See AGENT.md
 * (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionSubscribedContent } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope, toMembershipPresentationLeg } from './subscribedEvents'
import { isAffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { isCharacterPerceptionRequestedCommand, isPerceptionThreadRegisterCommand } from './localApiEvents'
import { handleCharacterPerceptionRequested } from './characterPerception'
import { handleAffordancesPertain } from './handleAffordancesPertain'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import {
    createMembershipFanInHandlerContext,
    createMembershipPresentationFanInStore,
} from './membershipPresentationFanIn'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'

const membershipPresentationFanInStore = createMembershipPresentationFanInStore()
messageBus.registerDeferral('fanIn-mtw.ephemera.perception', {
    onClear: () => membershipPresentationFanInStore.clear(),
    afterSettled: async () => {
        if (membershipPresentationFanInStore.getOpenPartialCount() === 0) {
            return
        }
        await membershipPresentationFanInStore.settleDeferrals()
    },
})

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
        const fanInCtx = createMembershipFanInHandlerContext(messageBus)
        membershipPresentationFanInStore.setHandlerContext(fanInCtx)

        for (const event of events) {
            const leg = await toMembershipPresentationLeg(event)
            if (leg) {
                await membershipPresentationFanInStore.route(leg)
                continue
            }

            const raw = await event.getContent()
            if (isCharacterPerceptionRequestedCommand(raw)) {
                await handleCharacterPerceptionRequested(raw, messageBus)
                continue
            }
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
