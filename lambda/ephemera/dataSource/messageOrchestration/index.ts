/**
 * mtw.ephemera.messageOrchestration DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera bundle-declare / slot-report ingress.
 * See AGENT.md (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import messageBus from '../../messageBus'
import type { MessageOrchestrationPublishedPayload } from './publishedEvents'
import {
    isMessageOrchestrationSubscribedEnvelope,
    type MessageOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isMessageBundleDeclareCommand, isMessageSlotReportCommand } from './localApiEvents'
import {
    createMessageOrchestrationFanInHandlerContext,
    createMessageOrchestrationFanInStore,
} from './messageOrchestrationFanIn'

const messageOrchestrationFanInStore = createMessageOrchestrationFanInStore()
messageBus.registerDeferral('fanIn-mtw.ephemera.messageOrchestration', {
    onClear: () => {
        messageOrchestrationFanInStore.clear()
    },
    afterSettled: async () => {
        if (messageOrchestrationFanInStore.getOpenPartialCount() > 0) {
            await messageOrchestrationFanInStore.settleDeferrals()
        }
    },
})

export const ephemeraMessageOrchestrationDataSource = new EphemeraDataSource<
    never,
    MessageOrchestrationPublishedPayload,
    MessageOrchestrationSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.messageOrchestration',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isMessageOrchestrationSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        const ctx = createMessageOrchestrationFanInHandlerContext(messageBus)
        messageOrchestrationFanInStore.setHandlerContext(ctx)
        for (const event of events) {
            const raw = await event.getContent()
            if (isMessageBundleDeclareCommand(raw)) {
                await messageOrchestrationFanInStore.route({
                    kind: 'bundle-declare',
                    bundleId: raw.bundleId,
                    slots: raw.slots,
                })
                continue
            }
            if (isMessageSlotReportCommand(raw)) {
                await messageOrchestrationFanInStore.route({
                    kind: 'slot-report',
                    bundleId: raw.bundleId,
                    slotId: raw.slotId,
                    message: raw.message,
                })
            }
        }
    },
})

ephemeraMessageOrchestrationDataSource.subscribe()

export default ephemeraMessageOrchestrationDataSource
