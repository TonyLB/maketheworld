import { CONVERSATION_PAYLOAD_STUB } from '../baseClasses'
import type { RenderComponentId } from '../../../dataSource/renderOrchestration/events'
import type { StorableConversationRecord } from '../storableConversationRecord'
import {
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    type StorableConversationRecordRoomStateRender,
} from './baseClasses'
import { isStorableConversationRecordRoomStateRender } from '../storableConversationRecord'

const componentId = 'ROOM#guard-test' as RenderComponentId;

const roomStateRow: StorableConversationRecordRoomStateRender = {
    conversationId: 'conv-rsr-1',
    type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
    routing: { componentId, perspectiveId: 'P#1' },
    payload: CONVERSATION_PAYLOAD_STUB,
};

describe('isStorableConversationRecordRoomStateRender', () => {
    it('narrows StorableConversationRecord to the roomStateRender variant', () => {
        const record: StorableConversationRecord = roomStateRow;
        expect(isStorableConversationRecordRoomStateRender(record)).toBe(true);
        if (isStorableConversationRecordRoomStateRender(record)) {
            expect(record.routing.componentId).toBe(componentId);
        }
    });
});
