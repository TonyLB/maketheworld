import type {
    ConversationHandleGenerateRoomPreview,
    StorableConversationRecord,
} from './generateRoomPreview/baseClasses'

/**
 * Placeholder on `internalCache.Conversations.get` when the row `type` has no composite enrichment yet.
 */
export type ConversationCompositeReadHandleStub = {
    readonly kind: 'conversationCompositeReadStub'
}

/**
 * Live composite handle for `generateRoomPreview`: same `sendMessage` contract as materialized handle,
 * wrapped with a `kind` discriminant for narrowing at call sites.
 */
export type ConversationCompositeReadHandleGenerateRoomPreview = {
    readonly kind: 'conversationCompositeReadGenerateRoomPreview'
    sendMessage: ConversationHandleGenerateRoomPreview['sendMessage']
}

export type ConversationCompositeReadHandle =
    | ConversationCompositeReadHandleStub
    | ConversationCompositeReadHandleGenerateRoomPreview

const conversationCompositeReadHandleStubSingleton: ConversationCompositeReadHandleStub = {
    kind: 'conversationCompositeReadStub',
}

/** Stable stub for composite cache reads when no per-type enrichment exists. */
export function createConversationCompositeReadHandleStub(): ConversationCompositeReadHandleStub {
    return conversationCompositeReadHandleStubSingleton
}

export function isConversationCompositeReadHandleStub(
    handle: ConversationCompositeReadHandle
): handle is ConversationCompositeReadHandleStub {
    return handle.kind === 'conversationCompositeReadStub'
}

export function isConversationCompositeReadHandleGenerateRoomPreview(
    handle: ConversationCompositeReadHandle
): handle is ConversationCompositeReadHandleGenerateRoomPreview {
    return handle.kind === 'conversationCompositeReadGenerateRoomPreview'
}

export type ConversationsCompositeGetResult = {
    record: StorableConversationRecord
    handle: ConversationCompositeReadHandle
}
