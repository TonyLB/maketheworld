import { handler } from './app'
import { generateRoomPreview } from './renderOrchestration/generateRoomPreview'
import messageBus from './messageBus'
import internalCache from './internalCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    getConversationHandle,
    registerConversation,
} from './conversations'

jest.mock('./renderOrchestration/generateRoomPreview')
jest.mock('./messageBus', () => ({
    __esModule: true,
    default: {
        clear: jest.fn(),
        send: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn(),
        publish: jest.fn(),
    },
}))
jest.mock('./internalCache', () => ({
    __esModule: true,
    default: {
        clear: jest.fn(),
        Global: {
            set: jest.fn(),
        },
    },
}))
jest.mock('./returnValue', () => ({
    extractReturnValue: jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({}),
    }),
}))

jest.mock('./conversations', () => {
    const actual = jest.requireActual('./conversations')
    return {
        ...actual,
        registerConversation: jest.fn(),
        getConversationHandle: jest.fn(),
    }
})

const registerConversationMock = registerConversation as jest.MockedFunction<typeof registerConversation>
const getConversationHandleMock = getConversationHandle as jest.MockedFunction<typeof getConversationHandle>

describe('app handler - generateRoomPreview', () => {
    const connectionId = 'connection-123'

    const makeEvent = (body: any) => ({
        requestContext: {
            connectionId,
            routeKey: '$default',
        },
        body: JSON.stringify(body),
    })

    beforeEach(() => {
        jest.clearAllMocks()
        registerConversationMock.mockResolvedValue('conv-test-id')
        let capturedRequestId: string | undefined
        registerConversationMock.mockImplementation(async (input) => {
            capturedRequestId = input.routing.requestId
            return 'conv-test-id'
        })
        getConversationHandleMock.mockImplementation(async (_id, deps) => {
            const mb = deps!.messageBus
            return {
                sendMessage: (result: unknown) => {
                    mb.send({
                        type: 'ReturnValue',
                        body: {
                            messageType: 'ConversationStep',
                            conversationId: 'conv-test-id',
                            pipeline: 'generateRoomPreview',
                            step: (result as { success: boolean }).success ? 'complete' : 'error',
                            generateRoomPreview: result,
                            ...(capturedRequestId !== undefined ? { RequestId: capturedRequestId } : {}),
                        },
                    })
                },
            } as Awaited<ReturnType<typeof getConversationHandle>>
        })
    })

    it('registers conversation, calls generateRoomPreview with conversationId, and sends ReturnValue with result body', async () => {
        ;(generateRoomPreview as jest.Mock).mockResolvedValue({
            success: true,
            renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] },
        })

        const event = makeEvent({
            message: 'generateRoomPreview',
            RoomId: 'ROOM#test-room',
            markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
            assetStack: ['ASSET#one'],
            RequestId: 'request-123',
        })

        await handler(event as any, {} as any)

        const expectedPerspectiveId = computePerspectiveKey(['ASSET#one'] as any)
        expect(registerConversationMock).toHaveBeenCalledWith({
            type: CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
            routing: {
                roomId: 'ROOM#test-room',
                perspectiveId: expectedPerspectiveId,
                requestId: 'request-123',
            },
            payload: expect.any(Object),
        })
        expect(
            (registerConversationMock as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan((generateRoomPreview as jest.Mock).mock.invocationCallOrder[0])

        expect(generateRoomPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'ROOM#test-room',
                markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
                assetStack: ['ASSET#one'],
            }),
            { conversationId: 'conv-test-id' }
        )

        expect(getConversationHandleMock).toHaveBeenCalledWith('conv-test-id', { messageBus })

        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'ConversationStep',
                conversationId: 'conv-test-id',
                pipeline: 'generateRoomPreview',
                step: 'complete',
                generateRoomPreview: {
                    success: true,
                    renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] },
                },
                RequestId: 'request-123',
            },
        })
    })

    it('passes generationContextWml to generateRoomPreview when present', async () => {
        ;(generateRoomPreview as jest.Mock).mockResolvedValue({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state',
        })

        const wml =
            '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>'
        const event = makeEvent({
            message: 'generateRoomPreview',
            RoomId: 'ROOM#test-room',
            markState: { markValue: [] },
            assetStack: ['ASSET#one'],
            generationContextWml: wml,
        })

        await handler(event as any, {} as any)

        const expectedPerspectiveId = computePerspectiveKey(['ASSET#one'] as any)
        expect(registerConversationMock).toHaveBeenCalledWith({
            type: CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
            routing: {
                roomId: 'ROOM#test-room',
                perspectiveId: expectedPerspectiveId,
            },
            payload: expect.any(Object),
        })

        expect(generateRoomPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'ROOM#test-room',
                markState: { markValue: [] },
                assetStack: ['ASSET#one'],
                generationContextWml: wml,
            }),
            { conversationId: 'conv-test-id' }
        )
    })
})
