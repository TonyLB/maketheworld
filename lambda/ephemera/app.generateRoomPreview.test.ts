import { handler } from './app'
import * as renderCache from './renderCache'
import messageBus from './messageBus'
import internalCache from './internalCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

jest.mock('./renderCache')
jest.mock('./messageBus', () => ({
    __esModule: true,
    default: {
        clear: jest.fn(),
        send: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn(),
        publish: jest.fn()
    }
}))
jest.mock('./internalCache', () => ({
    __esModule: true,
    default: {
        clear: jest.fn(),
        Global: {
            set: jest.fn()
        },
        PreviewGenerationRequests: {
            registerPending: jest.fn()
        }
    }
}))
jest.mock('./returnValue', () => ({
    extractReturnValue: jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({})
    })
}))

describe('app handler - generateRoomPreview', () => {
    const connectionId = 'connection-123'

    const makeEvent = (body: any) => ({
        requestContext: {
            connectionId,
            routeKey: '$default'
        },
        body: JSON.stringify(body)
    })

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('calls generateRoomPreview and sends ReturnValue with result body', async () => {
        const generateRoomPreviewMock = renderCache.generateRoomPreview as jest.Mock
        generateRoomPreviewMock.mockResolvedValue({
            success: true,
            renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] }
        })

        const event = makeEvent({
            message: 'generateRoomPreview',
            RoomId: 'ROOM#test-room',
            markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
            assetStack: ['ASSET#one'],
            RequestId: 'request-123'
        })

        await handler(event as any, {} as any)

        const expectedPerspectiveId = computePerspectiveKey(['ASSET#one'] as any)
        expect(internalCache.PreviewGenerationRequests.registerPending).toHaveBeenCalledWith({
            roomId: 'ROOM#test-room',
            perspectiveId: expectedPerspectiveId,
            requestId: 'request-123'
        })
        expect(
            (internalCache.PreviewGenerationRequests.registerPending as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan(generateRoomPreviewMock.mock.invocationCallOrder[0])

        expect(generateRoomPreviewMock).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'ROOM#test-room',
                markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
                assetStack: ['ASSET#one']
            }),
            expect.objectContaining({
                publishPutCacheRecord: expect.any(Function)
            })
        )

        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'GenerateRoomPreview',
                generateRoomPreview: {
                    success: true,
                    renderedContent: { description: [{ type: 'Text', value: 'Preview content' }] }
                },
                RequestId: 'request-123'
            }
        })
    })

    it('passes generationContextWml to generateRoomPreview when present', async () => {
        const generateRoomPreviewMock = renderCache.generateRoomPreview as jest.Mock
        generateRoomPreviewMock.mockResolvedValue({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })

        const wml = '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>'
        const event = makeEvent({
            message: 'generateRoomPreview',
            RoomId: 'ROOM#test-room',
            markState: { markValue: [] },
            assetStack: ['ASSET#one'],
            generationContextWml: wml
        })

        await handler(event as any, {} as any)

        const expectedPerspectiveId = computePerspectiveKey(['ASSET#one'] as any)
        expect(internalCache.PreviewGenerationRequests.registerPending).toHaveBeenCalledWith({
            roomId: 'ROOM#test-room',
            perspectiveId: expectedPerspectiveId,
            requestId: undefined
        })

        expect(generateRoomPreviewMock).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'ROOM#test-room',
                markState: { markValue: [] },
                assetStack: ['ASSET#one'],
                generationContextWml: wml
            }),
            expect.objectContaining({
                publishPutCacheRecord: expect.any(Function)
            })
        )
    })
})

