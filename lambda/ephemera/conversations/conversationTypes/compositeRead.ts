import type { ConversationHandleGenerateRoomPreview } from './generateRoomPreview/baseClasses';
import type { ConversationHandleRoomStateRender } from './roomStateRender/baseClasses';
import type { StorableConversationRecord } from './storableConversationRecord';

/**
 * Placeholder on `internalCache.Conversations.get` when the row `type` has no composite enrichment yet.
 */
export type ConversationCompositeReadHandleStub = {
    readonly kind: 'conversationCompositeReadStub';
};

/**
 * Live composite handle for `generateRoomPreview`: same `sendMessage` contract as materialized handle,
 * wrapped with a `kind` discriminant for narrowing at call sites.
 */
export type ConversationCompositeReadHandleGenerateRoomPreview = {
    readonly kind: 'conversationCompositeReadGenerateRoomPreview';
    sendMessage: ConversationHandleGenerateRoomPreview['sendMessage'];
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
    | ConversationCompositeReadHandleGenerateRoomPreview
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

export function isConversationCompositeReadHandleGenerateRoomPreview(
    handle: ConversationCompositeReadHandle
): handle is ConversationCompositeReadHandleGenerateRoomPreview {
    return handle.kind === 'conversationCompositeReadGenerateRoomPreview';
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
