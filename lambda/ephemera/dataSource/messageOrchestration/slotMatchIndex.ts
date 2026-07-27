/**
 * Bucket-per-(componentId, perspectiveKey) index, mirroring internalCache/perceptionThreads.ts's
 * own bucket shape: a render-completion handler queries by (componentId, perspectiveKey,
 * threadKind) and disambiguates further itself (by targets) when more than one candidate comes
 * back, rather than this index picking on the caller's behalf. See dataSource/messageOrchestration/AGENT.md
 * and MO-9 in taskPlanning/lambda/ephemera/AGENT.messageOrchestrationConsolidation.planning.md.
 */
import type { MessageOrchestrationSlotSpec } from './localApiEvents'

export type SlotMatchEntry = {
    bundleId: string;
    spec: MessageOrchestrationSlotSpec;
}

export class SlotMatchIndex {
    private buckets: Record<string, SlotMatchEntry[]> = {}

    private static makeKey(componentId: string, perspectiveKey: string): string {
        return `${componentId}::${perspectiveKey}`
    }

    /** Called once per slot in a routed bundle-declare leg; no-ops unless componentId/perspectiveKey/threadKind are all present. */
    registerSlot(bundleId: string, spec: MessageOrchestrationSlotSpec): void {
        if (!spec.componentId || !spec.perspectiveKey || !spec.threadKind) {
            return
        }
        const key = SlotMatchIndex.makeKey(spec.componentId, spec.perspectiveKey)
        this.buckets[key] = [...(this.buckets[key] ?? []), { bundleId, spec }]
    }

    /** Bucket of candidates, filtered by threadKind; caller disambiguates further via entry.spec.targets. */
    findDeclaredSlotMatch(componentId: string, perspectiveKey: string, threadKind: string): SlotMatchEntry[] {
        const key = SlotMatchIndex.makeKey(componentId, perspectiveKey)
        return (this.buckets[key] ?? []).filter((entry) => entry.spec.threadKind === threadKind)
    }

    /** Removes a matched entry once its slot has been reported, so a later render event for the same key can't re-match an already-resolved slot. */
    consumeMatch(componentId: string, perspectiveKey: string, bundleId: string, slotId: string): void {
        const key = SlotMatchIndex.makeKey(componentId, perspectiveKey)
        const bucket = this.buckets[key]
        if (!bucket) {
            return
        }
        this.buckets[key] = bucket.filter((entry) => !(entry.bundleId === bundleId && entry.spec.slotId === slotId))
    }

    clear(): void {
        this.buckets = {}
    }
}
