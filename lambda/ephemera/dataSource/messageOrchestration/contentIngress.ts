/**
 * Ingress side of the MO-10 Ingress/Delivery seam: content resolution, kickoff single-flight,
 * and replay --- deliberately ignorant of addressed envelopes (targets/messageId) and of
 * messageBus. Bucket-per-(componentId, perspectiveKey, contentStream) (MO-11, Phase 6.5: keyed by
 * content identity, not the finer threadKind), never draining listeners on content arrival ---
 * both a placeholder wave and a later terminal wave broadcast to the same, still-full listener
 * list. See AGENT.md and MO-10/MO-11 in
 * taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md.
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
 * 'literal' content is already fully built WML with no cache record behind it (a placeholder or
 * error message) and is delivered as-is regardless of listener format; 'roomRender' content is
 * the raw cache record, projected into header/full WML per-listener in deliverListenerContent
 * (index.ts).
 */
export type RenderContent =
    | { kind: 'literal'; message: DistributiveOmit<PublishMessage, 'targets' | 'messageId'> }
    | { kind: 'roomRender'; componentId: EphemeraRoomId; renderedContent: EphemeraCacheRenderedContent }

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
