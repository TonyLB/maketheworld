import { v4 as uuidv4 } from 'uuid'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CONVERSATION_PAYLOAD_STUB } from './conversationTypes'
import {
    deleteConversationRecord,
    getConversationHandle,
    getStorableConversationRecord,
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

    it('registerConversation returns new id and getStorableConversationRecord round-trips', async () => {
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

        const row = await getStorableConversationRecord(id)
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
        expect(await getStorableConversationRecord(a)).toMatchObject({ conversationId: a, type: 'generateRoomPreview' })
        expect(await getStorableConversationRecord(b)).toMatchObject({ conversationId: b, type: 'generateRoomPreview' })
    })

    it('deleteConversationRecord removes the row', async () => {
        const id = await registerConversation({
            type: 'generateRoomPreview',
            routing: { roomId, perspectiveId: 'PX' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(await deleteConversationRecord(id)).toBe(true)
        expect(await getStorableConversationRecord(id)).toBeUndefined()
    })

    it('deleteConversationRecord returns false for unknown id', async () => {
        expect(await deleteConversationRecord('unknown-id')).toBe(false)
    })

    it('getConversationHandle attaches sendMessage that delegates to injected messageBus', async () => {
        const send = jest.fn()
        const id = await registerConversation({
            type: 'generateRoomPreview',
            routing: { roomId, perspectiveId: 'PH', requestId: 'rid-1' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        const handle = await getConversationHandle(id, { messageBus: { send } as never })
        expect(handle).toBeDefined()
        if (!handle) {
            throw new Error('expected handle')
        }
        expect(handle.sendMessage).toEqual(expect.any(Function))

        handle.sendMessage({ success: true, renderedContent: {} as never })
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'ReturnValue',
                body: expect.objectContaining({
                    messageType: 'GenerateRoomPreview',
                    RequestId: 'rid-1',
                }),
            })
        )
    })
})
