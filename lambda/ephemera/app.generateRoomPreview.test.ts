import { handler } from './app'
import { generateRoomPreview } from './renderOrchestration/generateRoomPreview'
import internalCache from './internalCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
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
        Conversations: {
            get: jest.fn(),
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
    }
})

const registerConversationMock = registerConversation as jest.MockedFunction<typeof registerConversation>

describe('app handler - generateRoomPreview', () => {
    const connectionId = 'connection-123'
    let handleSendMessageMock: jest.Mock

    const makeEvent = (body: any) => ({
        requestContext: {
            connectionId,
            routeKey: '$default',
        },
        body: JSON.stringify(body),
    })

    beforeEach(() => {
        jest.clearAllMocks()
        handleSendMessageMock = jest.fn().mockResolvedValue(undefined)
        registerConversationMock.mockResolvedValue('conv-test-id')

        const conversationsGetMock = internalCache.Conversations.get as unknown as jest.Mock
        conversationsGetMock.mockImplementation((_id) => ({
            record: {} as never,
            handle: {
                kind: 'conversationCompositeReadGenerateRoomPreview',
                sendMessage: handleSendMessageMock,
            },
        }))
    })

    it('registers conversation, calls generateRoomPreview with onGenerating, and sends generating then terminal step', async () => {
        ;(generateRoomPreview as jest.Mock).mockResolvedValue({
            success: true,
            renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] },
        })

        ;(generateRoomPreview as jest.Mock).mockImplementation(async (input, options) => {
            await options?.onGenerating?.()
            return {
                success: true,
                renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] },
            }
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
            expect.objectContaining({
                conversationId: 'conv-test-id',
                onGenerating: expect.any(Function),
            })
        )

        const conversationsGetMock = internalCache.Conversations.get as unknown as jest.Mock
        expect(conversationsGetMock).toHaveBeenCalledWith('conv-test-id')

        expect(handleSendMessageMock).toHaveBeenCalledTimes(2)
        expect(handleSendMessageMock.mock.calls[0]?.[0]).toBe('generating')
        expect(handleSendMessageMock.mock.calls[1]?.[0]).toEqual({
            success: true,
            renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] },
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
            expect.objectContaining({
                conversationId: 'conv-test-id',
                onGenerating: expect.any(Function),
            })
        )
    })
})
