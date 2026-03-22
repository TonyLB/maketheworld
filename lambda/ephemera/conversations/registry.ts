import internalCache from '../internalCache'
import type { ConversationId, ConversationRecord } from './baseClasses'

/**
 * Async facade over internalCache.Conversations (v1 is in-memory; signatures stay Dynamo-ready).
 */
export const getConversationRecord = async (
    conversationId: ConversationId
): Promise<ConversationRecord | undefined> => {
    return Promise.resolve(internalCache.Conversations.get(conversationId))
}

export const saveConversationRecord = async (record: ConversationRecord): Promise<void> => {
    internalCache.Conversations.set(record)
    return Promise.resolve()
}

export const deleteConversationRecord = async (conversationId: ConversationId): Promise<boolean> => {
    return Promise.resolve(internalCache.Conversations.delete(conversationId))
}
