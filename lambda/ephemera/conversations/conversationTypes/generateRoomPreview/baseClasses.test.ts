import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CONVERSATION_PAYLOAD_STUB } from '../baseClasses'
import {
    isStorableConversationRecordGenerateRoomPreview,
    type StorableConversationRecord,
    type StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'

const roomId = 'ROOM#guard-test' as EphemeraRoomId

const previewRow: StorableConversationRecordGenerateRoomPreview = {
    conversationId: 'conv-1',
    type: 'generateRoomPreview',
    routing: { roomId, perspectiveId: 'P#1' },
    payload: CONVERSATION_PAYLOAD_STUB,
}

describe('isStorableConversationRecordGenerateRoomPreview', () => {
    it('narrows StorableConversationRecord to the generateRoomPreview variant', () => {
        const record: StorableConversationRecord = previewRow
        expect(isStorableConversationRecordGenerateRoomPreview(record)).toBe(true)
        if (isStorableConversationRecordGenerateRoomPreview(record)) {
            expect(record.routing.roomId).toBe(roomId)
        }
    })
})
