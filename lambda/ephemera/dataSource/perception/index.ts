/**
 * mtw.ephemera.perception DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera Character perception ingress. See AGENT.md
 * (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionSubscribedContent } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope, toMembershipPresentationLeg, toObjectManipulationPresentationLeg } from './subscribedEvents'
import { isAffordancesPertainPayload } from '../affordanceCache/publishedEvents'
import { isCharacterPerceptionRequestedCommand, isPerceptionThreadRegisterCommand } from './localApiEvents'
import { handleCharacterPerceptionRequested } from './characterPerception'
import { handleAffordancesPertain } from './handleAffordancesPertain'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import {
    createMembershipFanInHandlerContext,
    createMembershipPresentationFanInStore,
} from './membershipPresentationFanIn'
import {
    createObjectManipulationFanInHandlerContext,
    createObjectManipulationPresentationFanInStore,
} from './objectManipulationPresentationFanIn'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'

const membershipPresentationFanInStore = createMembershipPresentationFanInStore()
const objectManipulationPresentationFanInStore = createObjectManipulationPresentationFanInStore()
messageBus.registerDeferral('fanIn-mtw.ephemera.perception', {
    onClear: () => {
        membershipPresentationFanInStore.clear()
        objectManipulationPresentationFanInStore.clear()
    },
    afterSettled: async () => {
        const membershipOpen = membershipPresentationFanInStore.getOpenPartialCount()
        const objectManipulationOpen = objectManipulationPresentationFanInStore.getOpenPartialCount()
        if (membershipOpen > 0) {
            await membershipPresentationFanInStore.settleDeferrals()
        }
        if (objectManipulationOpen > 0) {
            await objectManipulationPresentationFanInStore.settleDeferrals()
        }
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
        const membershipFanInCtx = createMembershipFanInHandlerContext(messageBus)
        const objectManipulationFanInCtx = createObjectManipulationFanInHandlerContext(messageBus)
        membershipPresentationFanInStore.setHandlerContext(membershipFanInCtx)
        objectManipulationPresentationFanInStore.setHandlerContext(objectManipulationFanInCtx)

        for (const event of events) {
            const membershipLeg = await toMembershipPresentationLeg(event)
            if (membershipLeg) {
                await membershipPresentationFanInStore.route(membershipLeg)
                continue
            }

            const objectManipulationLegs = await toObjectManipulationPresentationLeg(event)
            if (objectManipulationLegs.length > 0) {
                for (const leg of objectManipulationLegs) {
                    await objectManipulationPresentationFanInStore.route(leg)
                }
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
