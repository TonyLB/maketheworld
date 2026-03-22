import { v4 as uuidv4 } from 'uuid'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CONVERSATION_PAYLOAD_STUB } from './baseClasses'
import {
    deleteConversationRecord,
    getConversationRecord,
    registerConversation,
} from './registry'

jest.mock('uuid', () => ({
    v4: jest.fn(),
}))

const uuidv4Mock = uuidv4 as jest.Mock

const roomId = 'ROOM#registry-test' as EphemeraRoomId

describe('conversations registry', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        uuidv4Mock.mockReturnValue('fixed-uuid-1234')
    })

    it('registerConversation returns new id and getConversationRecord round-trips', async () => {
        const id = await registerConversation({
            type: 'generateRoomPreview',
            routing: {
                roomId,
                perspectiveId: 'PERSPECTIVE#p1',
                requestId: 'ws-req-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(id).toBe('fixed-uuid-1234')
        expect(uuidv4Mock).toHaveBeenCalledTimes(1)

        const row = await getConversationRecord(id)
        expect(row).toEqual({
            conversationId: id,
            type: 'generateRoomPreview',
            routing: {
                roomId,
                perspectiveId: 'PERSPECTIVE#p1',
                requestId: 'ws-req-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
    })

    it('registerConversation yields distinct ids for successive calls', async () => {
        uuidv4Mock.mockReturnValueOnce('id-a').mockReturnValueOnce('id-b')

        const a = await registerConversation({
            type: 'generateRoomPreview',
            routing: { roomId, perspectiveId: 'P1' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        const b = await registerConversation({
            type: 'generateRoomPreview',
            routing: { roomId, perspectiveId: 'P2' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })

        expect(a).toBe('id-a')
        expect(b).toBe('id-b')
        expect(await getConversationRecord(a)).toMatchObject({ conversationId: a, type: 'generateRoomPreview' })
        expect(await getConversationRecord(b)).toMatchObject({ conversationId: b, type: 'generateRoomPreview' })
    })

    it('deleteConversationRecord removes the row', async () => {
        const id = await registerConversation({
            type: 'generateRoomPreview',
            routing: { roomId, perspectiveId: 'PX' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(await deleteConversationRecord(id)).toBe(true)
        expect(await getConversationRecord(id)).toBeUndefined()
    })

    it('deleteConversationRecord returns false for unknown id', async () => {
        expect(await deleteConversationRecord('unknown-id')).toBe(false)
    })
})
