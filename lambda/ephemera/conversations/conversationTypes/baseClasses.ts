/**
 * Shared primitives for conversation rows (routing + fragment staging).
 * See AGENT.planning.md and AGENT.planning.tasklist.md; expect iteration before stabilizing.
 */

/** Opaque id for a coordinated run; generate with uuidv4() at registration (not derived from domain keys). */
export type ConversationId = string

/**
 * Placeholder payload for the first union member only. Real fragment payloads land in section 4 (task list).
 */
export type ConversationPayloadStub = Record<string, never>

/** Use when registering a first-variant row until real fragment payloads exist. */
export const CONVERSATION_PAYLOAD_STUB: ConversationPayloadStub = {} as ConversationPayloadStub
