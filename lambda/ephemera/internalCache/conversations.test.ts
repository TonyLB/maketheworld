import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { MessageBus } from '../messageBus/baseClasses'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    isConversationCompositeReadHandleRoomStateRender,
    type StorableConversationRecord,
} from '../conversations/conversationTypes'
import ConversationsData from './conversations'

const testRoomId = 'ROOM#test-room' as EphemeraRoomId

const previewTerminalCacheId = 'CACHE#00000000-0000-4000-8000-000000000001' as EphemeraCacheId
const previewTerminalCacheRecord: EphemeraCacheDynamoItem = {
    EphemeraId: testRoomId,
    DataCategory: previewTerminalCacheId,
    markState: { markValue: [] },
    renderedContent: { description: ['x'] },
    provenance: { type: 'generated' },
    perspectiveId: 'PERSPECTIVE#stub',
    perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
}

const makeGlobals = () => ({
    get: async (_key: any) => 'connection-1',
})

describe('ConversationsData', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('set and get round-trip returns live composite handle for roomStateRender', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-rsr-001'
        const record: StorableConversationRecord = {
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: testRoomId,
                perspectiveId: 'PERSPECTIVE#stub',
                requestId: 'req-rsr-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(record)
        const got = cache.get(id)
        expect(got).toMatchObject({
            record,
            handle: {
                kind: 'conversationCompositeReadRoomStateRender',
                sendMessage: expect.any(Function),
            },
        })
        expect(isConversationCompositeReadHandleRoomStateRender(got!.handle)).toBe(true)
    })

    it('roomStateRender sendMessage publishes RenderReady via passiveBusDelivery and get() messageBus override', async () => {
        const send = jest.fn()
        const bus = { send } as unknown as MessageBus
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send: jest.fn() } as unknown as MessageBus
        )
        const id = 'conv-rsr-002'
        const record: StorableConversationRecord = {
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: testRoomId,
                perspectiveId: 'PERSPECTIVE#stub',
                passiveBusDelivery: {
                    perspective: { assetStack: ['ASSET#x'] },
                },
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(record)
        const got = cache.get(id, { messageBus: bus })
        if (!got || !isConversationCompositeReadHandleRoomStateRender(got.handle)) {
            throw new Error('expected room state render composite handle')
        }
        await got.handle.sendMessage({
            type: 'resolved',
            renderedContent: previewTerminalCacheRecord.renderedContent,
            cacheId: previewTerminalCacheId,
            cacheRecord: previewTerminalCacheRecord,
        })
        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: previewTerminalCacheId,
        }))
    })

    it('get returns undefined for unknown id', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        expect(cache.get('missing')).toBeUndefined()
    })

    it('set replaces existing record', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-002'
        const first: StorableConversationRecord = {
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: testRoomId,
                perspectiveId: 'PERSPECTIVE#stub',
                requestId: 'req-1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        const second: StorableConversationRecord = {
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: testRoomId,
                perspectiveId: 'PERSPECTIVE#stub',
                requestId: 'req-2',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(first)
        cache.set(second)
        expect(cache.get(id)).toMatchObject({
            record: second,
            handle: {
                kind: 'conversationCompositeReadRoomStateRender',
                sendMessage: expect.any(Function),
            },
        })
    })

    it('delete removes a record', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-003'
        const record: StorableConversationRecord = {
            conversationId: id,
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: {
                componentId: testRoomId,
                perspectiveId: 'P#1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(record)
        expect(cache.delete(id)).toBe(true)
        expect(cache.get(id)).toBeUndefined()
    })

    it('delete returns false for unknown id', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        expect(cache.delete('nope')).toBe(false)
    })

    it('clear removes all records', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const a: StorableConversationRecord = {
            conversationId: 'a',
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: testRoomId, perspectiveId: 'P#1' },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        const b: StorableConversationRecord = {
            conversationId: 'b',
            type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
            routing: { componentId: testRoomId, perspectiveId: 'P#2' },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(a)
        cache.set(b)
        cache.clear()
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
    })
})
