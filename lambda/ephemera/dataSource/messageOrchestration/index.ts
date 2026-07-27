/**
 * mtw.ephemera.messageOrchestration DataSource.
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera bundle-declare / slot-report ingress.
 * See AGENT.md (normative decisions, obligations, verification).
 */
import EphemeraDataSource from '../abstract'
import messageBus from '../../messageBus'
import getCurrentTimestamp from '../../internalUtils/dateUtil'
import type { MessageBus, PublishMessage } from '../../messageBus/baseClasses'
import type { MessageOrchestrationPublishedPayload } from './publishedEvents'
import {
    isMessageOrchestrationSubscribedEnvelope,
    sendMessageSlotReported,
    type MessageOrchestrationSubscribedContent,
} from './subscribedEvents'
import { isMessageBundleDeclareCommand, isMessageSlotReportCommand, type MessageOrchestrationSlotSpec } from './localApiEvents'
import {
    createMessageOrchestrationFanInHandlerContext,
    createMessageOrchestrationFanInStore,
} from './messageOrchestrationFanIn'
import { SlotMatchIndex, type SlotMatchEntry } from './slotMatchIndex'
import { DeliveredSlotIndex } from './deliveredSlotIndex'
import { ContentIngressIndex, type RenderContent } from './contentIngress'

const messageOrchestrationFanInStore = createMessageOrchestrationFanInStore()
const slotMatchIndex = new SlotMatchIndex()
const deliveredSlotIndex = new DeliveredSlotIndex()
const contentIngressIndex = new ContentIngressIndex()

/** Packages one listener's addressed envelope from shared content and reports it as a slot. */
function deliverListenerContent(
    bus: MessageBus,
    bundleId: string,
    spec: MessageOrchestrationSlotSpec,
    content: RenderContent
): void {
    sendMessageSlotReported(bus, bundleId, {
        bundleId,
        slotId: spec.slotId,
        message: { ...content, targets: spec.targets ?? [] } as PublishMessage,
    })
}

/**
 * Registers a listener for (componentId, perspectiveKey, threadKind) content --- single-flights
 * kickoff (only the first same-invocation registration for a key triggers it) and replays past
 * content to a late registrant instead. See MO-10.
 */
export async function registerIngressSlot(
    bus: MessageBus,
    bundleId: string,
    spec: MessageOrchestrationSlotSpec,
    kickoff?: () => void | Promise<void>
): Promise<void> {
    const result = contentIngressIndex.registerSlot(bundleId, spec)
    if (result.shouldKickoff) {
        await kickoff?.()
        return
    }
    for (const content of result.replay) {
        deliverListenerContent(bus, bundleId, spec, content)
    }
}

/**
 * Reports resolved content once; fans it out to every slot currently registered for
 * (componentId, perspectiveKey, threadKind), each building its own addressed envelope. Returns
 * the number of listeners delivered to. See MO-10.
 */
export function reportIngressContent(
    bus: MessageBus,
    componentId: string,
    perspectiveKey: string,
    threadKind: string,
    content: RenderContent
): number {
    const listeners = contentIngressIndex.reportContent(componentId, perspectiveKey, threadKind, content)
    for (const { bundleId, spec } of listeners) {
        deliverListenerContent(bus, bundleId, spec, content)
    }
    return listeners.length
}

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
        deliveredSlotIndex.clear()
        contentIngressIndex.clear()
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
        const ctx = createMessageOrchestrationFanInHandlerContext(messageBus, deliveredSlotIndex)
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
                const already = deliveredSlotIndex.find(raw.bundleId, raw.slotId)
                if (already) {
                    messageBus.publish({
                        ...raw.message,
                        targets: already.targets,
                        ...(already.messageId !== undefined ? { messageId: already.messageId } : {}),
                        createdTime: getCurrentTimestamp(),
                    } as PublishMessage)
                    continue
                }
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
