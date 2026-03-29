import { validate, v4 as uuidv4 } from 'uuid'
import internalCache from '../internalCache'
import type { ConversationId, StorableConversationRecord } from './conversationTypes'

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
        if (internalCache.Conversations.get(requestedConversationId) !== undefined) {
            throw new Error('Conversation id already registered')
        }
        conversationId = requestedConversationId
    }
    else {
        conversationId = uuidv4()
    }

    // Spread + `conversationId` widens `type`/`routing` correlation; input is already a valid variant.
    const record = {
        ...rowFields,
        conversationId,
    } as StorableConversationRecord
    internalCache.Conversations.set(record)
    return Promise.resolve(conversationId)
}

export const deleteConversationRecord = async (conversationId: ConversationId): Promise<boolean> => {
    return Promise.resolve(internalCache.Conversations.delete(conversationId))
}
