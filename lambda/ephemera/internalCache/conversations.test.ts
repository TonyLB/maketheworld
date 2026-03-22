import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    CONVERSATION_PAYLOAD_STUB,
    type StorableConversationRecord,
} from '../conversations/conversationTypes'
import ConversationsData from './conversations'

const testRoomId = 'ROOM#test-room' as EphemeraRoomId

const makeRecord = (conversationId: string): StorableConversationRecord => ({
    conversationId,
    type: 'generateRoomPreview',
    routing: {
        roomId: testRoomId,
        perspectiveId: 'PERSPECTIVE#stub',
        requestId: 'req-1',
    },
    payload: CONVERSATION_PAYLOAD_STUB,
})

describe('ConversationsData', () => {
    it('set and get round-trip', () => {
        const cache = new ConversationsData()
        const id = 'conv-001'
        const record = makeRecord(id)
        cache.set(record)
        expect(cache.get(id)).toEqual(record)
    })

    it('get returns undefined for unknown id', () => {
        const cache = new ConversationsData()
        expect(cache.get('missing')).toBeUndefined()
    })

    it('set replaces existing record', () => {
        const cache = new ConversationsData()
        const id = 'conv-002'
        const first = makeRecord(id)
        const second: StorableConversationRecord = {
            ...first,
            routing: { ...first.routing, requestId: 'req-2' },
        }
        cache.set(first)
        cache.set(second)
        expect(cache.get(id)).toEqual(second)
    })

    it('delete removes a record', () => {
        const cache = new ConversationsData()
        const id = 'conv-003'
        cache.set(makeRecord(id))
        expect(cache.delete(id)).toBe(true)
        expect(cache.get(id)).toBeUndefined()
    })

    it('delete returns false for unknown id', () => {
        const cache = new ConversationsData()
        expect(cache.delete('nope')).toBe(false)
    })

    it('clear removes all records', () => {
        const cache = new ConversationsData()
        cache.set(makeRecord('a'))
        cache.set(makeRecord('b'))
        cache.clear()
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
    })
})
