import { v4 as uuidv4 } from 'uuid'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import type { ConversationId, StorableConversationRecord } from './conversationTypes'
import type { ConversationHandle } from './conversationTypes/handle'
import { materializeConversationHandle, type ConversationMaterializeDeps } from './materializeConversationHandle'

/** Input for `registerConversation`: full storable row shape without generated id. */
export type RegisterConversationInput = Omit<StorableConversationRecord, 'conversationId'>

/**
 * Creates a new `conversationId`, stores the row on internalCache.Conversations, returns the id.
 */
export const registerConversation = async (
    input: RegisterConversationInput
): Promise<ConversationId> => {
    const conversationId = uuidv4()
    const record: StorableConversationRecord = {
        ...input,
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
