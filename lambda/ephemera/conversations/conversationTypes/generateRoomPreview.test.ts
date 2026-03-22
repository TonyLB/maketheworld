import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CONVERSATION_PAYLOAD_STUB } from './baseClasses'
import {
    isConversationRecordGenerateRoomPreview,
    type ConversationRecordGenerateRoomPreview,
} from './generateRoomPreview'
import type { ConversationRecord } from './index'

const roomId = 'ROOM#guard-test' as EphemeraRoomId

const previewRow: ConversationRecordGenerateRoomPreview = {
    conversationId: 'conv-1',
    type: 'generateRoomPreview',
    routing: { roomId, perspectiveId: 'P#1' },
    payload: CONVERSATION_PAYLOAD_STUB,
}

describe('isConversationRecordGenerateRoomPreview', () => {
    it('narrows ConversationRecord to the generateRoomPreview variant', () => {
        const record: ConversationRecord = previewRow
        expect(isConversationRecordGenerateRoomPreview(record)).toBe(true)
        if (isConversationRecordGenerateRoomPreview(record)) {
            expect(record.routing.roomId).toBe(roomId)
        }
    })
})
