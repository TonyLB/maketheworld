import { FanInCluster, FanInHandlerOptions } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInCluster'
import { FanInClusterStore } from '@tonylb/mtw-lambda-patterns/ts/dataSource/fanInClusterStore'
import getCurrentTimestamp from '../../internalUtils/dateUtil'
import type { MessageBus, PublishMessage } from '../../messageBus/baseClasses'
import type { MessageOrchestrationSlotSpec } from './localApiEvents'
import { DeliveredSlotIndex } from './deliveredSlotIndex'

export type MessageOrchestrationBundleDeclareLeg = {
    kind: 'bundle-declare';
    bundleId: string;
    slots: MessageOrchestrationSlotSpec[];
}

export type MessageOrchestrationSlotReportLeg = {
    kind: 'slot-report';
    bundleId: string;
    slotId: string;
    message: PublishMessage;
}

export type MessageOrchestrationLeg = MessageOrchestrationBundleDeclareLeg | MessageOrchestrationSlotReportLeg

export type MessageOrchestrationFanInHandlerContext = {
    messageBus: MessageBus;
    deliveredSlotIndex: DeliveredSlotIndex;
}

/**
 * Bundle-declare seeds the ordered slot list (compiled order); each slot-report is a leg
 * (`registerLeg`). Unlike membership presentation's provisional/unify case, identity (bundleId)
 * is known on *every* leg --- so either leg kind may seed the cluster. This means a slot-report
 * that happens to arrive before its bundle-declare still joins the same cluster instead of being
 * silently dropped.
 */
export class MessageOrchestrationFanInCluster extends FanInCluster<
    MessageOrchestrationLeg,
    MessageOrchestrationFanInHandlerContext
> {
    readonly bundleId: string
    private declaredSlots: MessageOrchestrationSlotSpec[] | null = null
    private readonly reports: Map<string, PublishMessage> = new Map()

    constructor(bundleId: string) {
        super()
        this.bundleId = bundleId
    }

    canAcceptLeg(leg: MessageOrchestrationLeg): boolean {
        if (leg.bundleId !== this.bundleId) {
            return false
        }
        if (leg.kind === 'bundle-declare') {
            return this.declaredSlots === null
        }
        return true
    }

    canUnifyWith(other: FanInCluster<MessageOrchestrationLeg, MessageOrchestrationFanInHandlerContext>): boolean {
        return other instanceof MessageOrchestrationFanInCluster && other.bundleId === this.bundleId
    }

    unifyWith(other: FanInCluster<MessageOrchestrationLeg, MessageOrchestrationFanInHandlerContext>): void {
        if (!(other instanceof MessageOrchestrationFanInCluster)) {
            return
        }
        if (this.declaredSlots === null && other.declaredSlots !== null) {
            this.declaredSlots = other.declaredSlots
        }
        for (const [slotId, message] of other.reports) {
            if (!this.reports.has(slotId)) {
                this.reports.set(slotId, message)
            }
        }
    }

    registerLeg(leg: MessageOrchestrationLeg): void {
        if (leg.kind === 'bundle-declare') {
            this.declaredSlots = leg.slots
            return
        }
        this.reports.set(leg.slotId, leg.message)
    }

    clusterIdentity(): string | null {
        return this.bundleId
    }

    get completed(): boolean {
        if (this.declaredSlots === null) {
            return false
        }
        return this.declaredSlots.every((slot) => this.reports.has(slot.slotId))
    }

    /**
     * The bundle is the single place that knows the full ordered, resolved slot set --- so it
     * assigns each message's CreatedTime here, sequential in declared order (1ms apart), rather
     * than requiring every producer to compute a mutually-consistent time independently (which
     * degenerates into beat-anchor/clamp arithmetic that's easy to get wrong). Whatever
     * CreatedTime a slot's message arrived with is overwritten at flush.
     */
    async handler(ctx: MessageOrchestrationFanInHandlerContext, _options: FanInHandlerOptions): Promise<void> {
        if (this.declaredSlots === null) {
            return
        }
        const baseTime = getCurrentTimestamp()
        let offset = 0
        const deliveredSlots: { slotId: string; targets: PublishMessage['targets']; messageId?: string }[] = []
        for (const slot of this.declaredSlots) {
            const message = this.reports.get(slot.slotId)
            if (message) {
                const published = { ...message, createdTime: baseTime + offset } as PublishMessage
                ctx.messageBus.publish(published)
                deliveredSlots.push({
                    slotId: slot.slotId,
                    targets: published.targets,
                    messageId: 'messageId' in published ? published.messageId : undefined,
                })
                offset += 1
            }
        }
        // A slot that never resolved by flush time (tolerantly failed) has nothing to standalone
        // against later, so it is deliberately not recorded here.
        ctx.deliveredSlotIndex.record(this.bundleId, deliveredSlots)
    }
}

export const messageOrchestrationClusterFromLeg = (
    leg: MessageOrchestrationLeg
): MessageOrchestrationFanInCluster => (
    new MessageOrchestrationFanInCluster(leg.bundleId)
)

export const createMessageOrchestrationFanInStore = () => new FanInClusterStore<
    MessageOrchestrationLeg,
    MessageOrchestrationFanInHandlerContext,
    MessageOrchestrationFanInCluster
>([
    messageOrchestrationClusterFromLeg,
])

export const createMessageOrchestrationFanInHandlerContext = (
    messageBus: MessageBus,
    deliveredSlotIndex: DeliveredSlotIndex
): MessageOrchestrationFanInHandlerContext => ({
    messageBus,
    deliveredSlotIndex,
})
