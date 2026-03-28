import type { StorableConversationRecordGenerateRoomPreview } from './generateRoomPreview/baseClasses';
import { CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW } from './generateRoomPreview/baseClasses';
import type { StorableConversationRecordRoomStateRender } from './roomStateRender/baseClasses';
import { CONVERSATION_TYPE_ROOM_STATE_RENDER } from './roomStateRender/baseClasses';

/**
 * All persisted conversation row shapes (JSON-safe, no functions). Add members as new pipelines ship.
 */
export type StorableConversationRecord =
    | StorableConversationRecordGenerateRoomPreview
    | StorableConversationRecordRoomStateRender;

export type ConversationRecordType = StorableConversationRecord['type'];

export function isStorableConversationRecordGenerateRoomPreview(
    record: StorableConversationRecord
): record is StorableConversationRecordGenerateRoomPreview {
    return record.type === CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW;
}

export function isStorableConversationRecordRoomStateRender(
    record: StorableConversationRecord
): record is StorableConversationRecordRoomStateRender {
    return record.type === CONVERSATION_TYPE_ROOM_STATE_RENDER;
}
