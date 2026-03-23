import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraCacheRenderedContent } from '../../../renderCache/baseClasses'

import type { ConversationId, ConversationPayloadStub } from '../baseClasses'

/**
 * Serializable routing for GenerateRoomPreview (API / direct preview path).
 * Aligns with registration-time fields described in AGENT.planning.md.
 */
export type GenerateRoomPreviewConversationRouting = {
    roomId: EphemeraRoomId
    perspectiveId: string
    requestId?: string
}

/**
 * First union member: full-record discriminant; `routing` and `payload` narrow together.
 * Additional `type` variants and `payload` shapes: task list section 5 (second-pass typing).
 */
export const CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW = 'generateRoomPreview' as const

/** Storable (JSON-safe) row for the generateRoomPreview conversation path. */
export type StorableConversationRecordGenerateRoomPreview = {
    conversationId: ConversationId
    type: typeof CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW
    routing: GenerateRoomPreviewConversationRouting
    payload: ConversationPayloadStub
}

/** API / wire result for GenerateRoomPreview (orchestration implements this contract). */
export type GenerateRoomPreviewSuccess = {
    success: true
    renderedContent: EphemeraCacheRenderedContent
}

export type GenerateRoomPreviewFailure =
    | { success: false; errorCode: 'NO_EXACT_MATCH'; errorMessage: string }
    | { success: false; errorCode: 'CONTEXT_REQUIRED'; errorMessage: string }
    | { success: false; errorCode: 'GENERATION_FAILED'; errorMessage: string }

export type GenerateRoomPreviewResult = GenerateRoomPreviewSuccess | GenerateRoomPreviewFailure

/**
 * Live handle: storable fields plus `sendMessage` (not persisted).
 * v1: completion-only `ReturnValue` to match app.ts GenerateRoomPreview path.
 * Future: extend `sendMessage` args to a discriminated union (progress vs completion) for streaming.
 */
export type ConversationHandleGenerateRoomPreview = StorableConversationRecordGenerateRoomPreview & {
    /**
     * MVP send contract:
     * - Progress uses local simplified `'generating'` marker.
     * - Terminal uses the domain `GenerateRoomPreviewResult`.
     *
     * `materialize` enriches this into the shared `ConversationStep` wire shape.
     */
    sendMessage: (arg: 'generating' | GenerateRoomPreviewResult) => Promise<void>
}

/**
 * Serializable conversation rows only (no functions). Persisted / in-cache shape.
 * Section 4: add further `| StorableConversationRecord...` members.
 */
export type StorableConversationRecord = StorableConversationRecordGenerateRoomPreview

/**
 * Narrows `StorableConversationRecord` to the generateRoomPreview variant (`type` discriminant).
 */
export function isStorableConversationRecordGenerateRoomPreview(
    record: StorableConversationRecord
): record is StorableConversationRecordGenerateRoomPreview {
    return record.type === CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW
}
