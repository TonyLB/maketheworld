export type { ConversationId, ConversationPayloadStub } from './baseClasses'
export { CONVERSATION_PAYLOAD_STUB } from './baseClasses'
export type {
    ConversationRecordGenerateRoomPreview,
    GenerateRoomPreviewConversationRouting,
} from './generateRoomPreview'
export {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    isConversationRecordGenerateRoomPreview,
} from './generateRoomPreview'

import type { ConversationRecordGenerateRoomPreview } from './generateRoomPreview'

export type ConversationRecord = ConversationRecordGenerateRoomPreview

/** Discriminant tag on stored rows (grows with section 4 union members). */
export type ConversationRecordType = ConversationRecord['type']
