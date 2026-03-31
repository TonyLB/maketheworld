import { handler } from './app'
import messageBus from './messageBus'

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
jest.mock('./returnValue', () => ({
    extractReturnValue: jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({}),
    }),
}))

const messageBusMock = messageBus as unknown as {
    send: jest.Mock;
    clear: jest.Mock;
    flush: jest.Mock;
}

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
    })

    it('publishes RenderPreviewRequested without conversationId (orchestration registers)', async () => {
        const event = makeEvent({
            message: 'generateRoomPreview',
            RoomId: 'ROOM#test-room',
            markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
            assetStack: ['ASSET#one'],
            RequestId: 'request-123',
        })

        await handler(event as any, {} as any)

        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'RenderPreviewRequested',
            componentId: 'ROOM#test-room',
            perspective: { assetStack: ['ASSET#one'] },
            markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
            requestId: 'request-123',
        })
    })

    it('includes generationContextWml on RenderPreviewRequested when present', async () => {
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

        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'RenderPreviewRequested',
            componentId: 'ROOM#test-room',
            perspective: { assetStack: ['ASSET#one'] },
            markState: { markValue: [] },
            generationContextWml: wml,
        })
    })
})
