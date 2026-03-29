export type {
    ConversationHandleRoomStateRender,
    RoomStateRenderConversationRouting,
    RoomStateRenderPassiveBusDeliveryFields,
    StorableConversationRecordRoomStateRender,
} from './baseClasses';
export { CONVERSATION_TYPE_ROOM_STATE_RENDER } from './baseClasses';
export { materializeRoomStateRender } from './materialize';
export type { MaterializeRoomStateRenderDeps } from './materialize';
export {
    deliverRenderResolveForPassive,
    RENDER_ERROR_CODE_NOT_ROOM,
} from './deliverRenderResolveForPassive';
