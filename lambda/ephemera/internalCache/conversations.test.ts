import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
import type { MessageBus } from '../messageBus/baseClasses'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    isConversationCompositeReadHandleGenerateRoomPreview,
    isConversationCompositeReadHandleRoomStateRender,
    type StorableConversationRecord,
} from '../conversations/conversationTypes'
import ConversationsData from './conversations'

jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient', () => ({
    apiClient: {
        send: jest.fn(),
    },
}))

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
                roomId: testRoomId,
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

    it('set and get round-trip returns live composite handle for generateRoomPreview', () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-001'
        const record = makeRecord(id)
        cache.set(record)
        const got = cache.get(id)
        expect(got).toMatchObject({
            record,
            handle: {
                kind: 'conversationCompositeReadGenerateRoomPreview',
                sendMessage: expect.any(Function),
            },
        })
        expect(isConversationCompositeReadHandleGenerateRoomPreview(got!.handle)).toBe(true)
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
        const first = makeRecord(id)
        const second: StorableConversationRecord = {
            ...first,
            routing: { ...first.routing, requestId: 'req-2' },
        }
        cache.set(first)
        cache.set(second)
        expect(cache.get(id)).toMatchObject({
            record: second,
            handle: {
                kind: 'conversationCompositeReadGenerateRoomPreview',
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
        cache.set(makeRecord(id))
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
        cache.set(makeRecord('a'))
        cache.set(makeRecord('b'))
        cache.clear()
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
    })

    it('composite handle sendMessage emits ConversationStep generating with RequestId', async () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-004'
        cache.set(makeRecord(id))
        const got = cache.get(id)
        expect(got).toBeDefined()
        const handle = got!.handle
        if (!isConversationCompositeReadHandleGenerateRoomPreview(handle)) {
            throw new Error('expected live generateRoomPreview composite handle')
        }
        await handle.sendMessage('generating')

        expect(send).not.toHaveBeenCalled()
        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: id,
                pipeline: 'generateRoomPreview',
                step: 'generating',
                RequestId: 'req-1',
            }),
        })
    })

    it('composite handle sendMessage emits ConversationStep complete with generateRoomPreview and RequestId', async () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-005'
        cache.set(makeRecord(id))
        const got = cache.get(id)!
        const handle = got.handle
        if (!isConversationCompositeReadHandleGenerateRoomPreview(handle)) {
            throw new Error('expected live generateRoomPreview composite handle')
        }
        await handle.sendMessage({
            success: true,
            renderedContent: { description: ['x'] },
            cacheId: previewTerminalCacheId,
            cacheRecord: previewTerminalCacheRecord,
        })

        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: id,
                pipeline: 'generateRoomPreview',
                step: 'complete',
                generateRoomPreview: {
                    success: true,
                    renderedContent: { description: ['x'] },
                    cacheId: previewTerminalCacheId,
                    cacheRecord: previewTerminalCacheRecord,
                },
                RequestId: 'req-1',
            }),
        })
    })

    it('composite handle sendMessage omits RequestId when routing has no requestId', async () => {
        const send = jest.fn()
        const cache = new ConversationsData(
            makeGlobals() as unknown as any,
            { send } as unknown as MessageBus
        )
        const id = 'conv-006'
        const record: StorableConversationRecord = {
            conversationId: id,
            type: 'generateRoomPreview',
            routing: { roomId: testRoomId, perspectiveId: 'P#1' },
            payload: CONVERSATION_PAYLOAD_STUB,
        }
        cache.set(record)
        const got = cache.get(id)!
        const handle = got.handle
        if (!isConversationCompositeReadHandleGenerateRoomPreview(handle)) {
            throw new Error('expected live generateRoomPreview composite handle')
        }
        await handle.sendMessage({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'need context',
        })

        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: id,
                pipeline: 'generateRoomPreview',
                step: 'error',
                generateRoomPreview: {
                    success: false,
                    errorCode: 'CONTEXT_REQUIRED',
                    errorMessage: 'need context',
                },
            }),
        })
    })
})
