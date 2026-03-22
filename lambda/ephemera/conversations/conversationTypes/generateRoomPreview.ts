import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ConversationId, ConversationPayloadStub } from './baseClasses'
import type { ConversationRecord } from './index'

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
 * Additional `type` variants and `payload` shapes: section 4 (task list).
 */
export const CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW = 'generateRoomPreview' as const

export type ConversationRecordGenerateRoomPreview = {
    conversationId: ConversationId
    type: typeof CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW
    routing: GenerateRoomPreviewConversationRouting
    payload: ConversationPayloadStub
}

/**
 * Narrows `ConversationRecord` to the GenerateRoomPreview variant (`type` discriminant).
 * When the union gains more members, this remains the guard for this branch.
 */
export function isConversationRecordGenerateRoomPreview(
    record: ConversationRecord
): record is ConversationRecordGenerateRoomPreview {
    return record.type === CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW
}
