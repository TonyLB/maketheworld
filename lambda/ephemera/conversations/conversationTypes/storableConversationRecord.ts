import type { StorableConversationRecordRoomStateRender } from './roomStateRender/baseClasses';
import { CONVERSATION_TYPE_ROOM_STATE_RENDER } from './roomStateRender/baseClasses';

/**
 * All persisted conversation row shapes (JSON-safe, no functions). Add members as new pipelines ship.
 */
export type StorableConversationRecord = StorableConversationRecordRoomStateRender;

export type ConversationRecordType = StorableConversationRecord['type'];

export function isStorableConversationRecordRoomStateRender(
    record: StorableConversationRecord
): record is StorableConversationRecordRoomStateRender {
    return record.type === CONVERSATION_TYPE_ROOM_STATE_RENDER;
}
