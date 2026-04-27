/**
 * Shared primitives for conversation rows (routing + fragment staging).
 * See AGENT.planning.md and AGENT.planning.tasklist.md; expect iteration before stabilizing.
 */

/** Opaque id for a coordinated run (RFC 4122 UUID string). Server may generate with uuidv4(), or caller may supply at registration (not derived from domain keys). */
export type ConversationId = string

/**
 * Placeholder payload for the first union member only. Real fragment payloads land in task list section 5 (second-pass typing).
 */
export type ConversationPayloadStub = Record<string, never>

/** Use when registering a first-variant row until real fragment payloads exist. */
export const CONVERSATION_PAYLOAD_STUB: ConversationPayloadStub = {} as ConversationPayloadStub

