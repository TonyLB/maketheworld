import type { StorableConversationRecord } from './generateRoomPreview'

/**
 * Placeholder returned on `internalCache.Conversations.get` alongside `record`.
 * Not a live `ConversationHandle` (no real `sendMessage`); task 1 foundation only.
 * Task 2+ may replace with enriched runtime handle from the same read path.
 */
export type ConversationCompositeReadHandleStub = {
    readonly kind: 'conversationCompositeReadStub'
}

const conversationCompositeReadHandleStubSingleton: ConversationCompositeReadHandleStub = {
    kind: 'conversationCompositeReadStub',
}

/** Stable no-op stub for composite cache reads (task 1). */
export function createConversationCompositeReadHandleStub(): ConversationCompositeReadHandleStub {
    return conversationCompositeReadHandleStubSingleton
}

export type ConversationsCompositeGetResult = {
    record: StorableConversationRecord
    handle: ConversationCompositeReadHandleStub
}
