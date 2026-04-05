import { v4 as uuidv4 } from 'uuid'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CONVERSATION_PAYLOAD_STUB, CONVERSATION_TYPE_ROOM_STATE_RENDER } from './conversationTypes'
import {
    deleteConversationRecord,
    registerConversation,
} from './registry'

jest.mock('uuid', () => {
    const actual = jest.requireActual<typeof import('uuid')>('uuid')
    return {
        ...actual,
        v4: jest.fn(),
    }
})

const uuidv4Mock = uuidv4 as jest.Mock

const CLIENT_SUPPLIED_CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000'

const roomId = 'ROOM#registry-test' as EphemeraRoomId

describe('conversations registry', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        uuidv4Mock.mockReturnValue('fixed-uuid-1234')
    })

    it('registerConversation returns new id and stores a storable row', async () => {
        const id = await registerConversation({
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: roomId,
                perspectiveId: 'PERSPECTIVE#p1',
                requestId: 'ws-req-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(id).toBe('fixed-uuid-1234')
        expect(uuidv4Mock).toHaveBeenCalledTimes(1)

        const row = internalCache.Conversations.get(id)?.record
        expect(row).toEqual({
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: roomId,
                perspectiveId: 'PERSPECTIVE#p1',
                requestId: 'ws-req-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
    })

    it('registerConversation yields distinct ids for successive calls', async () => {
        uuidv4Mock.mockReturnValueOnce('id-a').mockReturnValueOnce('id-b')

        const a = await registerConversation({
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'P1' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        const b = await registerConversation({
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'P2' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })

        expect(a).toBe('id-a')
        expect(b).toBe('id-b')
        expect(internalCache.Conversations.get(a)?.record).toMatchObject({ conversationId: a, type: CONVERSATION_TYPE_ROOM_STATE_RENDER })
        expect(internalCache.Conversations.get(b)?.record).toMatchObject({ conversationId: b, type: CONVERSATION_TYPE_ROOM_STATE_RENDER })
    })

    it('deleteConversationRecord removes the row', async () => {
        const id = await registerConversation({
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'PX' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(await deleteConversationRecord(id)).toBe(true)
        expect(internalCache.Conversations.get(id)?.record).toBeUndefined()
    })

    it('deleteConversationRecord returns false for unknown id', async () => {
        expect(await deleteConversationRecord('unknown-id')).toBe(false)
    })

    it('registerConversation uses caller-supplied conversationId without calling uuidv4', async () => {
        const id = await registerConversation({
            conversationId: CLIENT_SUPPLIED_CONVERSATION_ID,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'P-client' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
        expect(id).toBe(CLIENT_SUPPLIED_CONVERSATION_ID)
        expect(uuidv4Mock).not.toHaveBeenCalled()

        const row = internalCache.Conversations.get(id)?.record
        expect(row).toEqual({
            conversationId: CLIENT_SUPPLIED_CONVERSATION_ID,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'P-client' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })
    })

    it('registerConversation throws when conversationId is not a valid UUID', async () => {
        await expect(
            registerConversation({
                conversationId: 'not-a-uuid',
                type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
                routing: { componentId: roomId, perspectiveId: 'P1' },
                payload: CONVERSATION_PAYLOAD_STUB,
            })
        ).rejects.toThrow('Conversation id must be a valid UUID')

        expect(internalCache.Conversations.get('not-a-uuid' as any)?.record).toBeUndefined()
    })

    it('registerConversation throws when conversationId is already registered', async () => {
        await registerConversation({
            conversationId: CLIENT_SUPPLIED_CONVERSATION_ID,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: roomId, perspectiveId: 'first' },
            payload: CONVERSATION_PAYLOAD_STUB,
        })

        await expect(
            registerConversation({
                conversationId: CLIENT_SUPPLIED_CONVERSATION_ID,
                type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
                routing: { componentId: roomId, perspectiveId: 'second' },
                payload: CONVERSATION_PAYLOAD_STUB,
            })
        ).rejects.toThrow('Conversation id already registered')

        const row = internalCache.Conversations.get(CLIENT_SUPPLIED_CONVERSATION_ID as any)?.record
        expect(row?.routing).toEqual(
            expect.objectContaining({ perspectiveId: 'first' })
        )
    })
})
