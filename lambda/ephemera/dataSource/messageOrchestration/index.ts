/**
 * Content ingress: a plain module, not a DataSource (it subscribes to no events). Producers
 * register listeners that own their transcript position; render-completion handlers report
 * shared content once, and each listener publishes its own addressed envelope.
 * See AGENT.md (normative decisions, obligations, verification).
 */
import { v4 as uuidv4 } from 'uuid'
import messageBus from '../../messageBus'
import getCurrentTimestamp from '../../internalUtils/dateUtil'
import type { MessageBus, PublishMessage } from '../../messageBus/baseClasses'
import { ContentIngressIndex, type IngressAddress, type IngressListenerSpec, type RenderContent } from './contentIngress'
import { roomHeaderWmlFromCacheRecord, roomRenderWmlFromCacheRecord } from '../perception/roomRenderWmlFromCacheRecord'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from '../perception/roomHeaderPlaceholderWml'
import { placeholderRoomFullWml } from '../perception/roomFullPlaceholderWml'

const contentIngressIndex = new ContentIngressIndex()

/**
 * Mints the delivery address of a listener that owns its own transcript position: its first
 * wave is published at `createdTime`, under `messageId`, and later waves keep that `messageId`
 * at strictly greater times.
 */
export const newDirectIngressAddress = (): IngressAddress => ({
    createdTime: getCurrentTimestamp(),
    messageId: `MESSAGE#${uuidv4()}`,
})

/**
 * Packages one listener's addressed envelope from shared content.
 * 'literal' content (a placeholder/error message with no cache record behind it, in a shape that
 * does not vary by format) is delivered as-is; 'roomRender' content (a raw cache record) and
 * 'roomPlaceholder' content (an un-formatted room placeholder/error body) are each projected into
 * header/full WML per the listener's own spec.format, since roomDescription (`format:'full'`)
 * shares a bucket with characterMove/sessionOrientationRender (`format:'header'`).
 */
function buildListenerMessage(spec: IngressListenerSpec, content: RenderContent): PublishMessage {
    let message: PublishMessage
    if (content.kind === 'literal') {
        message = { ...content.message, targets: spec.targets } as PublishMessage
    }
    else if (content.kind === 'roomRender') {
        message = {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            targets: spec.targets,
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
            targets: spec.targets,
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
    return message
}

/** Publishes a listener's wave under its own MessageId, strictly after anything it sent before. */
function publishWave(bus: MessageBus, spec: IngressListenerSpec, address: IngressAddress, content: RenderContent): void {
    const createdTime = address.lastPublished === undefined
        ? address.createdTime
        : Math.max(address.lastPublished + 1, getCurrentTimestamp())
    address.lastPublished = createdTime
    bus.publish({ ...buildListenerMessage(spec, content), messageId: address.messageId, createdTime } as PublishMessage)
}

/**
 * Registers a listener for (componentId, perspectiveKey, contentStream) content --- single-flights
 * kickoff (only the first same-invocation registration for a key triggers it) and replays past
 * content to a late registrant instead.
 */
export async function registerIngressSlot(
    bus: MessageBus,
    address: IngressAddress,
    spec: IngressListenerSpec,
    kickoff?: () => void | Promise<void>
): Promise<void> {
    // Copied so the listener's lastPublished is tracked on state this call owns.
    const listenerAddress = { ...address }
    const result = contentIngressIndex.registerSlot(listenerAddress, spec)
    if (result.shouldKickoff) {
        await kickoff?.()
        return
    }
    // A late registrant's replay collapses to the latest event: one message, one revision.
    const latest = result.replay[result.replay.length - 1]
    if (latest !== undefined) {
        publishWave(bus, spec, listenerAddress, latest)
    }
}

/**
 * Reports resolved content once; fans it out to every listener currently registered for
 * (componentId, perspectiveKey, contentStream), each building its own addressed envelope.
 * Returns the number of listeners delivered to.
 */
export function reportIngressContent(
    bus: MessageBus,
    componentId: string,
    perspectiveKey: string,
    contentStream: 'render' | 'affordances',
    content: RenderContent
): number {
    const listeners = contentIngressIndex.reportContent(componentId, perspectiveKey, contentStream, content)
    for (const { spec, address } of listeners) {
        publishWave(bus, spec, address, content)
    }
    return listeners.length
}

// Ingress state is per-invocation: listeners and recorded content never outlive one lambda run.
messageBus.registerDeferral('mtw.ephemera.contentIngress', {
    onClear: () => {
        contentIngressIndex.clear()
    },
    afterSettled: async () => {},
})
