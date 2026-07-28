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
import { DeliveredSlotIndex } from './deliveredSlotIndex'
import { ContentIngressIndex, type RenderContent } from './contentIngress'
import { roomHeaderWmlFromCacheRecord, roomRenderWmlFromCacheRecord } from '../perception/roomRenderWmlFromCacheRecord'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from '../perception/roomHeaderPlaceholderWml'
import { placeholderRoomFullWml } from '../perception/roomFullPlaceholderWml'

const messageOrchestrationFanInStore = createMessageOrchestrationFanInStore()
const deliveredSlotIndex = new DeliveredSlotIndex()
const contentIngressIndex = new ContentIngressIndex()

/**
 * Packages one listener's addressed envelope from shared content and reports it as a slot.
 * 'literal' content (a placeholder/error message with no cache record behind it, in a shape that
 * does not vary by format) is delivered as-is; 'roomRender' content (a raw cache record) and
 * 'roomPlaceholder' content (an un-formatted room placeholder/error body) are each projected into
 * header/full WML per the listener's own spec.format --- the MO-11 content-vs-envelope split
 * (Phase 6.5), extended to room placeholders (Phase 7) once roomDescription (`format:'full'`)
 * started sharing a bucket with characterMove/sessionOrientationRender (`format:'header'`).
 */
function deliverListenerContent(
    bus: MessageBus,
    bundleId: string,
    spec: MessageOrchestrationSlotSpec,
    content: RenderContent
): void {
    let message: PublishMessage
    if (content.kind === 'literal') {
        message = { ...content.message, targets: spec.targets ?? [] } as PublishMessage
    }
    else if (content.kind === 'roomRender') {
        message = {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            targets: spec.targets ?? [],
            wmlContent: spec.format === 'full'
                ? roomRenderWmlFromCacheRecord(content.componentId, content.renderedContent)
                : roomHeaderWmlFromCacheRecord(content.componentId, content.renderedContent),
            metaData: {
                componentUUID: content.componentId,
                displayMode: spec.format === 'full' ? 'full' : 'header',
                roomChannel: 'render',
            },
        }
    }
    else {
        message = {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            targets: spec.targets ?? [],
            wmlContent: spec.format === 'full'
                ? placeholderRoomFullWml(content.componentId, content.bodyText)
                : (content.status === 'generating'
                    ? roomHeaderGeneratingPlaceholderWml(content.componentId)
                    : roomHeaderErrorPlaceholderWml(content.componentId)),
            metaData: {
                componentUUID: content.componentId,
                displayMode: spec.format === 'full' ? 'full' : 'header',
                ...(content.status === 'generating' ? { status: 'generating' as const } : {}),
                roomChannel: 'render',
            },
        }
    }
    sendMessageSlotReported(bus, bundleId, {
        bundleId,
        slotId: spec.slotId,
        message,
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
 * (componentId, perspectiveKey, contentStream), each building its own addressed envelope.
 * Returns the number of listeners delivered to. See MO-10/MO-11.
 */
export function reportIngressContent(
    bus: MessageBus,
    componentId: string,
    perspectiveKey: string,
    contentStream: 'render' | 'affordances',
    content: RenderContent
): number {
    const listeners = contentIngressIndex.reportContent(componentId, perspectiveKey, contentStream, content)
    for (const { bundleId, spec } of listeners) {
        deliverListenerContent(bus, bundleId, spec, content)
    }
    return listeners.length
}

messageBus.registerDeferral('fanIn-mtw.ephemera.messageOrchestration', {
    onClear: () => {
        messageOrchestrationFanInStore.clear()
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
                        createdTime: Math.max(already.createdTime + 1, getCurrentTimestamp()),
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
