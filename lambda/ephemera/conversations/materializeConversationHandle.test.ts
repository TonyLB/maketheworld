import type { MessageBus } from '../messageBus/baseClasses'
import { CONVERSATION_PAYLOAD_STUB } from './conversationTypes/baseClasses'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    type StorableConversationRecordGenerateRoomPreview,
} from './conversationTypes/generateRoomPreview'
import { materializeConversationHandle } from './materializeConversationHandle'

import internalCache from '../internalCache'
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        Global: {
            get: jest.fn(),
        },
    },
}))

jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient', () => ({
    apiClient: {
        send: jest.fn(),
    },
}))

describe('materializeConversationHandle', () => {
    const makeRecord = (): StorableConversationRecordGenerateRoomPreview => ({
        conversationId: 'conv-x',
        type: CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
        routing: {
            roomId: 'ROOM#r1',
            perspectiveId: 'P#1',
            requestId: 'req-abc',
        },
        payload: CONVERSATION_PAYLOAD_STUB,
    })

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('sendMessage emits ConversationStep generating with RequestId', async () => {
        const send = jest.fn()
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('connection-1')
        const messageBus = { send } as unknown as MessageBus
        const handle = materializeConversationHandle(makeRecord(), { messageBus })

        await handle.sendMessage('generating')

        expect(send).not.toHaveBeenCalled()
        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: 'conv-x',
                pipeline: 'generateRoomPreview',
                step: 'generating',
                RequestId: 'req-abc',
            }),
        })
    })

    it('sendMessage emits ConversationStep complete with generateRoomPreview and RequestId', async () => {
        const send = jest.fn()
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('connection-1')
        const messageBus = { send } as unknown as MessageBus
        const handle = materializeConversationHandle(makeRecord(), { messageBus })

        await handle.sendMessage({
            success: true,
            renderedContent: { test: true } as never,
        })

        expect(send).not.toHaveBeenCalled()
        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: 'conv-x',
                pipeline: 'generateRoomPreview',
                step: 'complete',
                generateRoomPreview: { success: true, renderedContent: { test: true } },
                RequestId: 'req-abc',
            }),
        })
    })

    it('omits RequestId when routing has no requestId', async () => {
        const send = jest.fn()
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('connection-1')
        const messageBus = { send } as unknown as MessageBus
        const record = makeRecord()
        record.routing = { roomId: 'ROOM#r1', perspectiveId: 'P#1' }
        const handle = materializeConversationHandle(record, { messageBus })

        await handle.sendMessage({ success: false, errorCode: 'CONTEXT_REQUIRED', errorMessage: 'need context' })

        expect(send).not.toHaveBeenCalled()
        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            ConnectionId: 'connection-1',
            Data: JSON.stringify({
                messageType: 'ConversationStep',
                conversationId: 'conv-x',
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
