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
import { SlotMatchIndex, type SlotMatchEntry } from './slotMatchIndex'

const messageOrchestrationFanInStore = createMessageOrchestrationFanInStore()
const slotMatchIndex = new SlotMatchIndex()

/** Pull-model query for a render-completion handler to self-match against a declared bundle slot (see MO-9). Iteration-1 bridge; not a subscription (MO-5). */
export function findDeclaredSlotMatch(componentId: string, perspectiveKey: string, threadKind: string): SlotMatchEntry[] {
    return slotMatchIndex.findDeclaredSlotMatch(componentId, perspectiveKey, threadKind)
}

/** Consumes a matched slot once its render completion has been reported, so a later event for the same key can't re-match it. */
export function consumeSlotMatch(componentId: string, perspectiveKey: string, bundleId: string, slotId: string): void {
    slotMatchIndex.consumeMatch(componentId, perspectiveKey, bundleId, slotId)
}

messageBus.registerDeferral('fanIn-mtw.ephemera.messageOrchestration', {
    onClear: () => {
        messageOrchestrationFanInStore.clear()
        slotMatchIndex.clear()
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
                for (const slot of raw.slots) {
                    slotMatchIndex.registerSlot(raw.bundleId, slot)
                }
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
