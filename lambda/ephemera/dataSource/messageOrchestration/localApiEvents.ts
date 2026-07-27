/**
 * Payload contracts for internal message-orchestration ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/messageOrchestration/AGENT.md.
 */
import type { PublishMessage, PublishTarget } from '../../messageBus/baseClasses'

/**
 * componentId/perspectiveKey/targets/threadKind are optional: only slots a render-completion
 * handler needs to self-match against (e.g. navigate's header slot) populate them. Slots
 * resolved by a producer that already knows its own bundleId/slotId statically (e.g. navigate's
 * leave/arrive slots, reported by publishMembershipPresentation.ts) leave these unset.
 */
export type MessageOrchestrationSlotSpec = {
    slotId: string;
    expectedPublishType: PublishMessage['displayProtocol'];
    componentId?: string;
    perspectiveKey?: string;
    targets?: PublishTarget[];
    threadKind?: string;
}

/** Declares a bundle's full, compiled-order slot list. Identity = bundleId. */
export type MessageBundleDeclareCommand = {
    bundleId: string;
    slots: MessageOrchestrationSlotSpec[];
}

/** Reports one slot's resolved content --- the eventual publishMessage payload, held until the bundle settles. */
export type MessageSlotReportCommand = {
    bundleId: string;
    slotId: string;
    message: PublishMessage;
}

const isMessageOrchestrationSlotSpec = (value: unknown): value is MessageOrchestrationSlotSpec => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.slotId !== 'string' || typeof v.expectedPublishType !== 'string') {
        return false
    }
    if (v.componentId !== undefined && typeof v.componentId !== 'string') {
        return false
    }
    if (v.perspectiveKey !== undefined && typeof v.perspectiveKey !== 'string') {
        return false
    }
    if (v.threadKind !== undefined && typeof v.threadKind !== 'string') {
        return false
    }
    if (v.targets !== undefined && !(Array.isArray(v.targets) && v.targets.every((target) => typeof target === 'string'))) {
        return false
    }
    return true
}

export const isMessageBundleDeclareCommand = (value: unknown): value is MessageBundleDeclareCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        typeof v.bundleId === 'string' &&
        Array.isArray(v.slots) &&
        v.slots.every(isMessageOrchestrationSlotSpec)
    )
}

export const isMessageSlotReportCommand = (value: unknown): value is MessageSlotReportCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        typeof v.bundleId === 'string' &&
        typeof v.slotId === 'string' &&
        typeof v.message === 'object' &&
        v.message !== null
    )
}
