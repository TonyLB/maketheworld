import type { MessageBus } from '../messageBus/baseClasses'
import { CONVERSATION_PAYLOAD_STUB } from './conversationTypes/baseClasses'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    type StorableConversationRecordGenerateRoomPreview,
} from './conversationTypes/generateRoomPreview'
import { materializeConversationHandle } from './materializeConversationHandle'

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

    it('sendMessage enqueues ReturnValue with GenerateRoomPreview body and RequestId', () => {
        const send = jest.fn()
        const messageBus = { send } as unknown as MessageBus
        const handle = materializeConversationHandle(makeRecord(), { messageBus })

        handle.sendMessage({
            success: true,
            renderedContent: { test: true } as never,
        })

        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'GenerateRoomPreview',
                generateRoomPreview: { success: true, renderedContent: { test: true } },
                RequestId: 'req-abc',
            },
        })
    })

    it('omits RequestId when routing has no requestId', () => {
        const send = jest.fn()
        const messageBus = { send } as unknown as MessageBus
        const record = makeRecord()
        record.routing = { roomId: 'ROOM#r1', perspectiveId: 'P#1' }
        const handle = materializeConversationHandle(record, { messageBus })

        handle.sendMessage({ success: false, errorCode: 'CONTEXT_REQUIRED', errorMessage: 'need context' })

        expect(send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'GenerateRoomPreview',
                generateRoomPreview: {
                    success: false,
                    errorCode: 'CONTEXT_REQUIRED',
                    errorMessage: 'need context',
                },
            },
        })
    })
})
