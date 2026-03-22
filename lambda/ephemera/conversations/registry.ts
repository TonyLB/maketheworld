import { v4 as uuidv4 } from 'uuid'
import internalCache from '../internalCache'
import type { ConversationId, ConversationRecord } from './baseClasses'

/** Input for `registerConversation`: full record shape without generated id. */
export type RegisterConversationInput = Omit<ConversationRecord, 'conversationId'>

/**
 * Creates a new `conversationId`, stores the row on internalCache.Conversations, returns the id.
 */
export const registerConversation = async (
    input: RegisterConversationInput
): Promise<ConversationId> => {
    const conversationId = uuidv4()
    const record: ConversationRecord = {
        ...input,
        conversationId,
    }
    internalCache.Conversations.set(record)
    return Promise.resolve(conversationId)
}

/**
 * Async facade over internalCache.Conversations (v1 is in-memory; signatures stay Dynamo-ready).
 */
export const getConversationRecord = async (
    conversationId: ConversationId
): Promise<ConversationRecord | undefined> => {
    return Promise.resolve(internalCache.Conversations.get(conversationId))
}

export const deleteConversationRecord = async (conversationId: ConversationId): Promise<boolean> => {
    return Promise.resolve(internalCache.Conversations.delete(conversationId))
}
