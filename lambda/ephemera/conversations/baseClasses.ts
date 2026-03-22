/**
 * Prototype base types for the conversations registry (routing + fragment staging).
 * See AGENT.planning.md; expect iteration before stabilizing.
 */

/** Opaque id for a coordinated run; generate with uuidv4() at registration (not derived from domain keys). */
export type ConversationId = string

/**
 * Invocation-scoped row stored on internalCache.Conversations.
 * Fragment and routing fields will be added when wiring the first pipeline.
 */
export type ConversationRecord = {
    conversationId: ConversationId
}
