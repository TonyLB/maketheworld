/**
 * Ingress side of the MO-10 Ingress/Delivery seam: content resolution, kickoff single-flight,
 * and replay --- deliberately ignorant of addressed envelopes (targets/messageId) and of
 * messageBus. Bucket-per-(componentId, perspectiveKey, contentStream) (MO-11, Phase 6.5: keyed by
 * content identity, not the finer threadKind), never draining listeners on content arrival ---
 * both a placeholder wave and a later terminal wave broadcast to the same, still-full listener
 * list. See AGENT.md's "Content ingress / delivery seam (MO-10)" and "Ingress key:
 * contentStream/format, not threadKind (MO-11)" sections.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PublishMessage } from '../../messageBus/baseClasses'
import type { EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import type { MessageOrchestrationSlotSpec } from './localApiEvents'

/**
 * A plain `Omit` over the `PublishMessage` union isn't distributive (it collapses to only the
 * fields common to every variant, via `keyof` on a union) --- this distributes `Omit` over each
 * member instead, via the standard naked-type-parameter conditional idiom, otherwise
 * variant-specific fields like `wmlContent`/`metaData` disappear from the resulting type.
 */
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

/**
 * Shared content, before any listener's own targets/messageId is baked in (MO-10), and --- per
 * MO-11's content-vs-envelope split --- before format-specific projection is applied (Phase 6.5):
 * 'literal' content is already fully built WML with no cache record behind it, in a shape that
 * does not vary by format (feature/knowledge/object placeholders and errors --- these kinds have
 * only one possible listener format today) and is delivered as-is; 'roomRender' content is the
 * raw cache record, projected into header/full WML per-listener; 'roomPlaceholder' content is an
 * un-formatted placeholder/error body for a room, projected into header- or full-shaped WML
 * per-listener the same way (Phase 7: once roomDescription (`format:'full'`) shares a bucket with
 * characterMove/sessionOrientationRender (`format:'header'`), the room's Generating/Error
 * placeholder needs the same per-listener projection its terminal content already gets). All
 * projection happens in deliverListenerContent (index.ts).
 */
export type RenderContent =
    | { kind: 'literal'; message: DistributiveOmit<PublishMessage, 'targets' | 'messageId'> }
    | { kind: 'roomRender'; componentId: EphemeraRoomId; renderedContent: EphemeraCacheRenderedContent }
    | { kind: 'roomPlaceholder'; componentId: EphemeraRoomId; bodyText: string; status?: 'generating' }

export type IngressListener = {
    bundleId: string;
    spec: MessageOrchestrationSlotSpec;
}

export type RegisterSlotResult =
    | { shouldKickoff: true }
    | { shouldKickoff: false; replay: RenderContent[] }

type IngressBucket = {
    live: boolean;
    events: RenderContent[];
    listeners: IngressListener[];
}

export class ContentIngressIndex {
    private buckets: Record<string, IngressBucket> = {}

    private static makeKey(componentId: string, perspectiveKey: string, contentStream: string): string {
        return `${componentId}::${perspectiveKey}::${contentStream}`
    }

    /**
     * Registers a listener against a stream. The first registration against a not-yet-live
     * stream returns { shouldKickoff: true } --- the caller is responsible for invoking its own
     * kickoff. Every later registration against the same still-live stream returns
     * { shouldKickoff: false, replay }, where replay is every event recorded so far, for the
     * caller to deliver to this one new listener without re-triggering resolution. Listeners are
     * never removed by this method or by reportContent --- draining is a Delivery-side concern
     * (see deliveredSlotIndex.ts), not an Ingress one.
     */
    registerSlot(bundleId: string, spec: MessageOrchestrationSlotSpec): RegisterSlotResult {
        if (!spec.componentId || !spec.perspectiveKey || !spec.contentStream) {
            return { shouldKickoff: false, replay: [] }
        }
        const key = ContentIngressIndex.makeKey(spec.componentId, spec.perspectiveKey, spec.contentStream)
        const bucket = this.buckets[key]
        if (!bucket) {
            this.buckets[key] = { live: true, events: [], listeners: [{ bundleId, spec }] }
            return { shouldKickoff: true }
        }
        bucket.listeners = [...bucket.listeners, { bundleId, spec }]
        return { shouldKickoff: false, replay: [...bucket.events] }
    }

    /**
     * Records the event (for replay to any future late registrant) and returns every listener
     * currently registered for this key, for the caller to deliver to. Does not clear or shrink
     * the listener list --- a placeholder wave and a later terminal wave for the same key both
     * see the full, unchanged listener set.
     */
    reportContent(componentId: string, perspectiveKey: string, contentStream: string, content: RenderContent): IngressListener[] {
        const key = ContentIngressIndex.makeKey(componentId, perspectiveKey, contentStream)
        const bucket = this.buckets[key]
        if (!bucket) {
            return []
        }
        bucket.events = [...bucket.events, content]
        return bucket.listeners
    }

    clear(): void {
        this.buckets = {}
    }
}
