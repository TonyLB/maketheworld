/**
 * Delivery side of the MO-10 Ingress/Delivery seam: a small side-table recording, per bundle
 * slot, the targets/messageId a bundle flush already delivered against. FanInClusterStore
 * permanently drops a cluster once completed (see fanInClusterStore.ts's completeReadyPartials),
 * so a slot-report leg arriving after flush (the terminal, once the placeholder already
 * completed the bundle) has nothing left to standalone against without this --- populated by
 * MessageOrchestrationFanInCluster.handler() at the moment it flushes. See AGENT.md's
 * "Content ingress / delivery seam (MO-10)" section.
 */
import type { PublishTarget } from '../../messageBus/baseClasses'

export type DeliveredSlotRecord = {
    targets: PublishTarget[];
    messageId?: string;
    createdTime: number;
}

export type DeliveredSlotInput = {
    slotId: string;
    targets: PublishTarget[];
    messageId?: string;
    createdTime: number;
}

export class DeliveredSlotIndex {
    private records: Record<string, Record<string, DeliveredSlotRecord>> = {}

    /** Records every slot that was actually part of a bundle's flush --- a slot that never resolved by flush time is not passed in, and has no record here. */
    record(bundleId: string, slots: DeliveredSlotInput[]): void {
        const bundleRecords = { ...(this.records[bundleId] ?? {}) }
        for (const slot of slots) {
            bundleRecords[slot.slotId] = { targets: slot.targets, messageId: slot.messageId, createdTime: slot.createdTime }
        }
        this.records = { ...this.records, [bundleId]: bundleRecords }
    }

    find(bundleId: string, slotId: string): DeliveredSlotRecord | undefined {
        return this.records[bundleId]?.[slotId]
    }

    clear(): void {
        this.records = {}
    }
}
