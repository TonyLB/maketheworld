export type { ConversationId, ConversationPayloadStub } from './baseClasses'
export { CONVERSATION_PAYLOAD_STUB } from './baseClasses'
export type {
    ConversationHandleGenerateRoomPreview,
    GenerateRoomPreviewConversationRouting,
    GenerateRoomPreviewFailure,
    GenerateRoomPreviewResult,
    GenerateRoomPreviewSuccess,
    StorableConversationRecord,
    StorableConversationRecordGenerateRoomPreview,
} from './generateRoomPreview'
export {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    isStorableConversationRecordGenerateRoomPreview,
} from './generateRoomPreview'
export type { ConversationHandle } from './handle'

import type { StorableConversationRecord } from './generateRoomPreview'

/** Discriminant tag on stored rows (aligned with `ConversationHandle['type']`). */
export type ConversationRecordType = StorableConversationRecord['type']
