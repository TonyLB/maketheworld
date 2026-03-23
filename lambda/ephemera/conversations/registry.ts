import { validate, v4 as uuidv4 } from 'uuid'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import type { ConversationId, StorableConversationRecord } from './conversationTypes'
import type { ConversationHandle } from './conversationTypes/handle'
import { materializeConversationHandle, type ConversationMaterializeDeps } from './materializeConversationHandle'

/** Input for `registerConversation`: storable fields plus optional caller-supplied `conversationId`. */
export type RegisterConversationInput = Omit<StorableConversationRecord, 'conversationId'> & {
    conversationId?: ConversationId;
}

/**
 * Stores a conversation row on internalCache.Conversations and returns its `conversationId`.
 *
 * If **`conversationId`** is omitted, generates one with **`uuidv4()`** (legacy behavior).
 * If provided, must be a **valid UUID** (RFC 4122); throws if invalid or if that id is **already registered** in this invocation.
 */
export const registerConversation = async (
    input: RegisterConversationInput
): Promise<ConversationId> => {
    const { conversationId: requestedConversationId, ...rowFields } = input

    let conversationId: ConversationId
    if (requestedConversationId !== undefined) {
        if (!validate(requestedConversationId)) {
            throw new Error('Conversation id must be a valid UUID')
        }
        if (internalCache.Conversations.get(requestedConversationId)) {
            throw new Error('Conversation id already registered')
        }
        conversationId = requestedConversationId
    }
    else {
        conversationId = uuidv4()
    }

    const record: StorableConversationRecord = {
        ...rowFields,
        conversationId,
    }
    internalCache.Conversations.set(record)
    return Promise.resolve(conversationId)
}

/**
 * Async facade over internalCache.Conversations (v1 is in-memory; signatures stay Dynamo-ready).
 * Returns JSON-safe rows only.
 */
export const getStorableConversationRecord = async (
    conversationId: ConversationId
): Promise<StorableConversationRecord | undefined> => {
    return Promise.resolve(internalCache.Conversations.get(conversationId))
}

export const deleteConversationRecord = async (conversationId: ConversationId): Promise<boolean> => {
    return Promise.resolve(internalCache.Conversations.delete(conversationId))
}

/**
 * Storable row plus materialized `sendMessage` (and future runtime methods). Not persisted.
 */
export const getConversationHandle = async (
    conversationId: ConversationId,
    deps: ConversationMaterializeDeps = { messageBus }
): Promise<ConversationHandle | undefined> => {
    const record = internalCache.Conversations.get(conversationId)
    if (record === undefined) {
        return Promise.resolve(undefined)
    }
    return Promise.resolve(materializeConversationHandle(record, deps))
}
