import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { streamEventSnsMessageToWebSocketData, handler } from './app'

const mockSend = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
const mockResolve = jest.fn<(targets: unknown) => Promise<string[]>>()

jest.mock('./clients', () => ({
    apiClient: {
        send: (...args: unknown[]) => mockSend(...args)
    }
}))

jest.mock('@tonylb/mtw-sessions/ts/targetResolver', () => ({
    isResolvableTarget: (target: unknown) =>
        typeof target === 'string' && (target.startsWith('CONNECTION#') || target.startsWith('SESSION#')),
    TargetResolver: jest.fn().mockImplementation(() => ({
        resolve: (targets: unknown) => mockResolve(targets)
    }))
}))

jest.mock('./internalCache', () => ({
    default: {}
}))

describe('streamEventSnsMessageToWebSocketData', () => {
    it('flattens nested extendedHeader RequestIds to top-level WebSocket fields', () => {
        const snsMessage = JSON.stringify({
            messageType: 'StreamEvent',
            eventType: 'Content Update',
            dataSourceKey: 'mtw.wml',
            streamKey: 'ASSET#test',
            timestamp: 1234567890,
            update: { wml: '<Asset />' },
            extendedHeader: { RequestIds: ['req-replay-1'] }
        })

        const ws = JSON.parse(streamEventSnsMessageToWebSocketData(snsMessage))

        expect(ws.messageType).toBe('StreamEvent')
        expect(ws.eventType).toBe('Content Update')
        expect(ws.RequestIds).toEqual(['req-replay-1'])
        expect(ws).not.toHaveProperty('extendedHeader')
    })

    it('flattens nested extendedHeader replayAt for Snapshot replay', () => {
        const snsMessage = JSON.stringify({
            messageType: 'StreamEvent',
            eventType: 'Snapshot',
            dataSourceKey: 'mtw.wml',
            streamKey: 'ASSET#test',
            timestamp: 1000,
            update: { wml: { sidecarUrl: 'https://example.com/s' } },
            extendedHeader: { replayAt: 150 }
        })

        const ws = JSON.parse(streamEventSnsMessageToWebSocketData(snsMessage))

        expect(ws.replayAt).toBe(150)
        expect(ws).not.toHaveProperty('extendedHeader')
    })
})

describe('handler', () => {
    beforeEach(() => {
        mockSend.mockClear()
        mockResolve.mockReset()
        mockResolve.mockResolvedValue(['CONNECTION#conn-1'])
    })

    const snsRecord = (overrides: {
        messageType: 'StreamEvent' | 'Success' | 'Error'
        message: Record<string, unknown>
        requestId?: string
        error?: string
    }) => ({
        Sns: {
            Message: JSON.stringify(overrides.message),
            MessageAttributes: {
                Targets: {
                    Type: 'String',
                    Value: JSON.stringify(['CONNECTION#conn-1'])
                },
                Type: {
                    Type: 'String',
                    Value: overrides.messageType
                },
                ...(overrides.requestId
                    ? { RequestId: { Type: 'String', Value: overrides.requestId } }
                    : {}),
                ...(overrides.error
                    ? { Error: { Type: 'String', Value: overrides.error } }
                    : {})
            }
        }
    })

    it('transforms StreamEvent SNS body to flat WebSocket before send', async () => {
        await handler({
            Records: [
                snsRecord({
                    messageType: 'StreamEvent',
                    message: {
                        messageType: 'StreamEvent',
                        eventType: 'Content Update',
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test',
                        timestamp: 999,
                        update: { wml: '<Asset />' },
                        extendedHeader: { RequestIds: ['req-a'] }
                    }
                })
            ]
        })

        expect(mockSend).toHaveBeenCalledTimes(1)
        const sent = JSON.parse((mockSend.mock.calls[0][0] as { Data: string }).Data)
        expect(sent.RequestIds).toEqual(['req-a'])
        expect(sent).not.toHaveProperty('extendedHeader')
    })

    it('passes Success messages through with RequestId merged', async () => {
        await handler({
            Records: [
                snsRecord({
                    messageType: 'Success',
                    requestId: 'req-success',
                    message: { messageType: 'MetaData', AssetId: 'ASSET#x', zone: 'Canon' }
                })
            ]
        })

        expect(mockSend).toHaveBeenCalledTimes(1)
        const sent = JSON.parse((mockSend.mock.calls[0][0] as { Data: string }).Data)
        expect(sent).toMatchObject({
            messageType: 'MetaData',
            AssetId: 'ASSET#x',
            RequestId: 'req-success'
        })
    })

    it('builds Error WebSocket messages from attributes', async () => {
        await handler({
            Records: [
                snsRecord({
                    messageType: 'Error',
                    requestId: 'req-err',
                    error: 'Something failed',
                    message: {}
                })
            ]
        })

        expect(mockSend).toHaveBeenCalledTimes(1)
        const sent = JSON.parse((mockSend.mock.calls[0][0] as { Data: string }).Data)
        expect(sent).toEqual({
            messageType: 'Error',
            error: 'Something failed',
            RequestId: 'req-err'
        })
    })
})
