jest.mock('@aws-sdk/client-sfn')
import { handler } from './app'
import messageBus from './messageBus'
import internalCache from './internalCache'

// Mock dependencies
jest.mock('./messageBus')
jest.mock('./internalCache')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
let mockThinkingResultsGet: jest.Mock

describe('app handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.clear.mockReturnValue(undefined)
        mockMessageBus.flush.mockResolvedValue(undefined)
        mockMessageBus.send.mockReturnValue(undefined)
        mockThinkingResultsGet = jest.fn()
        ;(internalCache as unknown as { ThinkingResults: { get: jest.Mock } }).ThinkingResults = {
            get: mockThinkingResultsGet,
        }
    })

    describe('action message handling', () => {
        it('should route action messages to messageBus.send with ExecuteActionMessage', async () => {
            const actionMessage = {
                message: 'action',
                actionType: 'SayMessage',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    Message: 'Hello world'
                }
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(actionMessage)
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: actionMessage
            })
        })

        it('should route move action messages to messageBus.send with ExecuteActionMessage', async () => {
            const actionMessage = {
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    ExitName: 'north',
                    RoomId: 'ROOM#456'
                }
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(actionMessage)
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: actionMessage
            })
        })

        it('should route look action messages to messageBus.send with ExecuteActionMessage', async () => {
            const actionMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(actionMessage)
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: actionMessage
            })
        })
    })

    describe('command message handling', () => {
        it('should route command messages to api.ephemera Parse Requested synthetic event', async () => {
            const commandMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123',
                command: 'look'
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(commandMessage)
            }

            await handler(event, {})

            const parseRequestedCall = mockMessageBus.send.mock.calls.find(
                ([payload]) => payload?.type === 'StreamingEvent'
                    && payload?.dataSourceKey === 'api.ephemera'
                    && payload?.header?.type === 'Parse Requested'
            )
            expect(parseRequestedCall).toBeDefined()
            const parsePayload = parseRequestedCall![0] as { getContent: () => Promise<unknown> }
            const content = await parsePayload.getContent()
            expect(content).toEqual({
                characterId: 'CHARACTER#123',
                command: 'look',
            })
        })

        it('includes requestId in Parse Requested synthetic payload when present on wire request', async () => {
            const commandMessage = {
                message: 'command',
                RequestId: 'req-parse-1',
                CharacterId: 'CHARACTER#123',
                command: 'look'
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(commandMessage)
            }

            await handler(event, {})

            const parseRequestedCall = mockMessageBus.send.mock.calls.find(
                ([payload]) => payload?.type === 'StreamingEvent'
                    && payload?.dataSourceKey === 'api.ephemera'
                    && payload?.header?.type === 'Parse Requested'
            )
            expect(parseRequestedCall).toBeDefined()
            const parsePayload = parseRequestedCall![0] as { getContent: () => Promise<unknown> }
            const content = await parsePayload.getContent()
            expect(content).toEqual({
                characterId: 'CHARACTER#123',
                command: 'look',
                requestId: 'req-parse-1',
            })
        })
    })

    describe('EventBridge messages (single path: fromEventBridgeFormat -> deserialize)', () => {
        it('should use fromEventBridgeFormat and pass coreFormat.update + header to deserialize, then send StreamingEvent', async () => {
            const event = {
                source: 'mtw.assets',
                'detail-type': 'Asset Decached',
                detail: {
                    streamKey: 'ASSET#test-asset',
                    timestamp: 1600000000000
                },
                time: '2020-09-13T12:00:00.000Z'
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test-asset',
                    header: expect.objectContaining({
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#test-asset',
                        type: 'Asset Decached'
                    })
                })
            )
            const streamingEventCall = mockMessageBus.send.mock.calls.find(
                (c) => c[0]?.type === 'StreamingEvent'
            )
            expect(streamingEventCall).toBeDefined()
            const payload = streamingEventCall![0] as { type: 'StreamingEvent'; getContent: () => Promise<unknown> }
            expect(payload.type).toBe('StreamingEvent')
            expect(payload.getContent).toBeDefined()
            const content = await payload.getContent()
            expect(content).toEqual({})
        })

        it('should route mtw.diagnostics Room Occupancy Drift Finding to StreamingEvent', async () => {
            const event = {
                source: 'mtw.diagnostics',
                'detail-type': 'Room Occupancy Drift Finding',
                detail: {
                    roomId: 'ROOM#alpha',
                    diagnosticRunId: 'diag-1',
                    timestamp: '2026-04-21T12:00:00.000Z',
                },
                time: '2026-04-21T12:00:00.000Z'
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.diagnostics',
                    header: expect.objectContaining({
                        type: 'Room Occupancy Drift Finding'
                    })
                })
            )
        })

        it('should route mtw.connections Character Registered to StreamingEvent', async () => {
            const event = {
                source: 'mtw.connections',
                'detail-type': 'Character Registered',
                detail: {
                    streamKey: 'CHARACTER#abc',
                    timestamp: 1600000000000,
                    type: 'Character Registered',
                    characterId: 'CHARACTER#abc',
                    sessionId: 'session-1',
                },
                time: '2026-06-08T12:00:00.000Z'
            }

            await handler(event, {})

            expect(mockMessageBus.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.connections',
                    streamKey: 'CHARACTER#abc',
                    header: expect.objectContaining({
                        type: 'Character Registered'
                    })
                })
            )
            const streamingEventCall = mockMessageBus.send.mock.calls.find(
                (c) => c[0]?.type === 'StreamingEvent' && c[0]?.dataSourceKey === 'mtw.connections'
            )
            expect(streamingEventCall).toBeDefined()
            const payload = streamingEventCall![0] as { getContent: () => Promise<unknown> }
            const content = await payload.getContent()
            expect(content).toMatchObject({
                type: 'Character Registered',
                characterId: 'CHARACTER#abc',
                sessionId: 'session-1',
            })
            expect(content).not.toHaveProperty('isFirstSessionForCharacter')
            expect(typeof (content as { timestamp?: string }).timestamp).toBe('string')
        })
    })

    describe('ephemera API wire messages (api.ephemera)', () => {
        it('routes ephemeraStateChange to a StreamingEvent on api.ephemera', async () => {
            const body = {
                message: 'ephemeraStateChange' as const,
                componentId: 'ROOM#x',
                markState: { markValue: [{ mark: 'm', value: 'v' }] },
            }
            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify(body),
                },
                {}
            )
            expect(mockMessageBus.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#x',
                    header: expect.objectContaining({
                        type: 'State Change',
                        dataSourceKey: 'api.ephemera',
                    }),
                })
            )
        })

        it('includes requestId on State Change command content when RequestId is on the wire', async () => {
            const body = {
                message: 'ephemeraStateChange' as const,
                RequestId: 'req-a',
                componentId: 'ROOM#x',
                markState: { markValue: [{ mark: 'm', value: 'v' }] },
            }
            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify(body),
                },
                {}
            )
            const streamingEventCall = mockMessageBus.send.mock.calls.find(
                (c) => c[0]?.type === 'StreamingEvent' && c[0]?.dataSourceKey === 'api.ephemera'
            )
            expect(streamingEventCall).toBeDefined()
            const payload = streamingEventCall![0] as { getContent: () => Promise<unknown> }
            const content = await payload.getContent()
            expect(content).toEqual(
                expect.objectContaining({
                    componentId: 'ROOM#x',
                    requestId: 'req-a',
                })
            )
        })

        it('returns ThinkingResult for fetchThinkingResult', async () => {
            const result = {
                schemaVersion: 1,
                generationId: 'gen-1',
                workItemId: 'work-1',
                segment: 'candidates' as const,
                ok: true,
                completedAt: '2026-05-14T13:00:00.000Z',
            }
            mockThinkingResultsGet.mockResolvedValue(result)

            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'fetchThinkingResult',
                        workItemId: 'work-1',
                        RequestId: 'req-tr',
                    }),
                },
                {}
            )

            expect(mockThinkingResultsGet).toHaveBeenCalledWith('work-1')
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'ThinkingResult',
                    RequestId: 'req-tr',
                    result,
                },
            })
        })

        it('returns Error when fetchThinkingResult has no stored row', async () => {
            mockThinkingResultsGet.mockResolvedValue(null)

            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'fetchThinkingResult',
                        workItemId: 'work-missing',
                        RequestId: 'req-miss',
                    }),
                },
                {}
            )

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error',
                    RequestId: 'req-miss',
                    message: 'No thinking result for workItemId work-missing',
                    error: 'THINKING_RESULT_NOT_FOUND',
                },
            })
        })

        it('returns Error for fetchThinkingResult without RequestId', async () => {
            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'fetchThinkingResult',
                        workItemId: 'work-1',
                    }),
                },
                {}
            )

            expect(mockThinkingResultsGet).not.toHaveBeenCalled()
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error',
                    message: 'RequestId is required for fetchThinkingResult',
                    error: 'THINKING_RESULT_MISSING_REQUEST_ID',
                },
            })
        })
    })
})
