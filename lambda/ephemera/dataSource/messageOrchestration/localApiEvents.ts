/**
 * Payload contracts for internal message-orchestration ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/messageOrchestration/AGENT.md.
 */
import type { PublishMessage } from '../../messageBus/baseClasses'

export type MessageOrchestrationSlotSpec = {
    slotId: string;
    expectedPublishType: PublishMessage['displayProtocol'];
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
    return typeof v.slotId === 'string' && typeof v.expectedPublishType === 'string'
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
