import type { ConversationHandleRoomStateRender } from './roomStateRender/baseClasses';
import type { StorableConversationRecord } from './storableConversationRecord';

/**
 * Placeholder on `internalCache.Conversations.get` when the row `type` has no composite enrichment yet.
 */
export type ConversationCompositeReadHandleStub = {
    readonly kind: 'conversationCompositeReadStub';
};

/**
 * Live composite handle for `roomStateRender` (passive Meta-aligned resolve path).
 */
export type ConversationCompositeReadHandleRoomStateRender = {
    readonly kind: 'conversationCompositeReadRoomStateRender';
    sendMessage: ConversationHandleRoomStateRender['sendMessage'];
};

export type ConversationCompositeReadHandle =
    | ConversationCompositeReadHandleStub
    | ConversationCompositeReadHandleRoomStateRender;

const conversationCompositeReadHandleStubSingleton: ConversationCompositeReadHandleStub = {
    kind: 'conversationCompositeReadStub',
};

/** Stable stub for composite cache reads when no per-type enrichment exists. */
export function createConversationCompositeReadHandleStub(): ConversationCompositeReadHandleStub {
    return conversationCompositeReadHandleStubSingleton;
}

export function isConversationCompositeReadHandleStub(
    handle: ConversationCompositeReadHandle
): handle is ConversationCompositeReadHandleStub {
    return handle.kind === 'conversationCompositeReadStub';
}

export function isConversationCompositeReadHandleRoomStateRender(
    handle: ConversationCompositeReadHandle
): handle is ConversationCompositeReadHandleRoomStateRender {
    return handle.kind === 'conversationCompositeReadRoomStateRender';
}

export type ConversationsCompositeGetResult = {
    record: StorableConversationRecord;
    handle: ConversationCompositeReadHandle;
};
