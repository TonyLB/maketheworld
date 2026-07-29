/**
 * Payload contracts for internal message-orchestration ingress events (api.ephemera).
 *
 * In-process only (dataSourceKey: 'api.ephemera'). See dataSource/messageOrchestration/AGENT.md.
 */
import type { PublishMessage, PublishTarget } from '../../messageBus/baseClasses'

/**
 * componentId/perspectiveKey/targets/contentStream are optional: only slots a render-completion
 * handler needs to self-match against (e.g. navigate's header slot) populate them. Slots
 * resolved by a producer that already knows its own bundleId/slotId statically (e.g. navigate's
 * leave/arrive slots, reported by publishMembershipPresentation.ts) leave these unset.
 *
 * contentStream/format (MO-11, Phase 6.5) replace the earlier threadKind field: contentStream is
 * content identity (which pipeline/cache a listener wants --- 'render' | 'affordances', exactly
 * the normative roomChannel binary), format is an envelope property of one listener (header vs
 * full projection of the same shared content), not part of the ingress key. See
 * dataSource/messageOrchestration/AGENT.md.
 */
export type MessageOrchestrationSlotSpec = {
    slotId: string;
    expectedPublishType: PublishMessage['displayProtocol'];
    componentId?: string;
    perspectiveKey?: string;
    targets?: PublishTarget[];
} & (
    | { contentStream: 'render'; format: 'header' | 'full' }
    | { contentStream: 'affordances'; format: 'default' }
    | { contentStream?: undefined; format?: undefined }
)

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
    if (v.contentStream !== undefined) {
        if (v.contentStream !== 'render' && v.contentStream !== 'affordances') {
            return false
        }
        if (typeof v.format !== 'string') {
            return false
        }
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
