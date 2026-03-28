import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CONVERSATION_PAYLOAD_STUB } from '../baseClasses'
import type { StorableConversationRecord } from '../storableConversationRecord'
import {
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    type StorableConversationRecordRoomStateRender,
} from './baseClasses'
import { isStorableConversationRecordRoomStateRender } from '../storableConversationRecord'

const roomId = 'ROOM#guard-test' as EphemeraRoomId;

const roomStateRow: StorableConversationRecordRoomStateRender = {
    conversationId: 'conv-rsr-1',
    type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
    routing: { roomId, perspectiveId: 'P#1' },
    payload: CONVERSATION_PAYLOAD_STUB,
};

describe('isStorableConversationRecordRoomStateRender', () => {
    it('narrows StorableConversationRecord to the roomStateRender variant', () => {
        const record: StorableConversationRecord = roomStateRow;
        expect(isStorableConversationRecordRoomStateRender(record)).toBe(true);
        if (isStorableConversationRecordRoomStateRender(record)) {
            expect(record.routing.roomId).toBe(roomId);
        }
    });
});
