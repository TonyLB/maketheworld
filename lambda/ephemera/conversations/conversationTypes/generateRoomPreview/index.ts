export type {
    ConversationHandleGenerateRoomPreview,
    GenerateRoomPreviewConversationRouting,
    GenerateRoomPreviewFailure,
    GenerateRoomPreviewResult,
    GenerateRoomPreviewSuccess,
    StorableConversationRecord,
    StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'
export {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    isStorableConversationRecordGenerateRoomPreview,
} from './baseClasses'
export { materializeGenerateRoomPreview } from './materialize'
export type { MaterializeGenerateRoomPreviewDeps } from './materialize'
