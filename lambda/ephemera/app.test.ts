jest.mock('@aws-sdk/client-sfn')
jest.mock('./fetchEphemera', () => ({
    fetchEphemeraForCharacter: jest.fn(),
    fetchPlayerEphemera: jest.fn(),
}))
import { handler } from './app'
import messageBus from './messageBus'
import internalCache from './internalCache'
import { fetchEphemeraForCharacter } from './fetchEphemera'
import { collectReturnValues, collectErrors, resetReturnValueCollector } from './returnValue/collector'

// Mock dependencies
jest.mock('./messageBus')
jest.mock('./internalCache')

const mockFetchEphemeraForCharacter = fetchEphemeraForCharacter as jest.MockedFunction<typeof fetchEphemeraForCharacter>

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
let mockThinkingResultsGet: jest.Mock

describe('app handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetReturnValueCollector()
        mockMessageBus.clear.mockReturnValue(undefined)
        mockMessageBus.settle.mockResolvedValue(false)
        mockMessageBus.flushAndSettle.mockResolvedValue(undefined)
        mockMessageBus.publish.mockImplementation((payload) => {
            if (payload?.type === 'ReturnValue') {
                collectReturnValues([payload])
            }
            if (payload?.type === 'Error') {
                collectErrors([payload])
            }
        })
        mockThinkingResultsGet = jest.fn()
        ;(internalCache as unknown as { ThinkingResults: { get: jest.Mock } }).ThinkingResults = {
            get: mockThinkingResultsGet,
        }
    })

    describe('action message handling', () => {
        it('should route action messages to messageBus.publish with ExecuteActionMessage', async () => {
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: actionMessage
            })
            expect(mockMessageBus.flushAndSettle).toHaveBeenCalled()
        })

        it('should route move action messages to messageBus.publish with ExecuteActionMessage', async () => {
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: actionMessage
            })
        })

        it('should route look action messages to messageBus.publish with ExecuteActionMessage', async () => {
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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

            const parseRequestedCall = mockMessageBus.publish.mock.calls.find(
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
            expect(mockMessageBus.flushAndSettle).toHaveBeenCalled()
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

            const parseRequestedCall = mockMessageBus.publish.mock.calls.find(
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

    describe('WebSocket wire routes', () => {
        it('does not route unregistercharacter on ephemera ingress', async () => {
            const response = await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'unregistercharacter',
                        CharacterId: 'CHARACTER#abc',
                    }),
                },
                {}
            )

            const unregisterCall = mockMessageBus.publish.mock.calls.find(
                ([payload]) => (payload as { type?: string })?.type === 'UnregisterCharacter'
            )
            expect(unregisterCall).toBeUndefined()
            expect(response).toEqual(expect.objectContaining({ statusCode: 400 }))
            expect(mockMessageBus.flushAndSettle).not.toHaveBeenCalled()
        })

        it('returns fetchEphemera snapshot via ReturnValue publish and extractReturnValue', async () => {
            const ephemeraSnapshot = { CharacterId: 'CHARACTER#abc', Name: 'Test' }
            mockFetchEphemeraForCharacter.mockResolvedValue(
                ephemeraSnapshot as unknown as Awaited<ReturnType<typeof fetchEphemeraForCharacter>>
            )

            const response = await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'fetchEphemera',
                        CharacterId: 'CHARACTER#abc',
                    }),
                },
                {}
            )

            expect(mockFetchEphemeraForCharacter).toHaveBeenCalledWith({ CharacterId: 'CHARACTER#abc' })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: ephemeraSnapshot,
            })
            expect(response).toBeDefined()
            expect(JSON.parse(response!.body)).toEqual(ephemeraSnapshot)
        })

        it('routes link to Perception publish for feature targets', async () => {
            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'link',
                        CharacterId: 'CHARACTER#abc',
                        to: 'FEATURE#door',
                    }),
                },
                {}
            )

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'Perception',
                characterId: 'CHARACTER#abc',
                ephemeraId: 'FEATURE#door',
            })
        })

        it('routes mapSubscribe to SubscribeToMaps publish', async () => {
            await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'subscribeToMaps',
                        CharacterId: 'CHARACTER#abc',
                    }),
                },
                {}
            )

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'SubscribeToMaps',
                characterId: 'CHARACTER#abc',
            })
        })
    })

    describe('EventBridge messages (single path: fromEventBridgeFormat -> deserialize)', () => {
        it('should use fromEventBridgeFormat and pass coreFormat.update + header to deserialize, then publish StreamingEvent', async () => {
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith(
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
            const streamingEventCall = mockMessageBus.publish.mock.calls.find(
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.diagnostics',
                    header: expect.objectContaining({
                        type: 'Room Occupancy Drift Finding'
                    })
                })
            )
        })

        it('should publish Initialize Subscription events from mtw.subscriptions', async () => {
            const event = {
                source: 'mtw.subscriptions',
                'detail-type': 'Initialize Subscription - mtw.ephemera.thinking.scheduling',
                detail: {
                    streamKey: 'global',
                    sessionId: 'SESSION#abc',
                    requestId: 'req-init-1',
                },
            }

            await handler(event, {})

            expect(mockMessageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.subscriptions',
                    streamKey: 'global',
                    header: expect.objectContaining({
                        type: 'Initialize Subscription - mtw.ephemera.thinking.scheduling',
                    }),
                })
            )
            const initCall = mockMessageBus.publish.mock.calls.find(
                ([payload]) => (payload as { dataSourceKey?: string }).dataSourceKey === 'mtw.subscriptions'
            )
            expect(initCall).toBeDefined()
            const payload = initCall![0] as { getContent: () => Promise<unknown> }
            const content = await payload.getContent()
            expect(content).toEqual({
                sessionId: 'SESSION#abc',
                requestId: 'req-init-1',
            })
            expect(mockMessageBus.flushAndSettle).toHaveBeenCalled()
        })

        it('should route mtw.connections Character Registered to StreamingEvent', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
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

            expect(logSpy).toHaveBeenCalledWith(
                '[mtw.ephemera] EventBridge ingest',
                expect.objectContaining({
                    source: 'mtw.connections',
                    detailType: 'Character Registered',
                    streamKey: 'CHARACTER#abc',
                    characterId: 'CHARACTER#abc',
                    sessionId: 'session-1',
                })
            )
            logSpy.mockRestore()

            expect(mockMessageBus.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.connections',
                    streamKey: 'CHARACTER#abc',
                    header: expect.objectContaining({
                        type: 'Character Registered'
                    })
                })
            )
            const streamingEventCall = mockMessageBus.publish.mock.calls.find(
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

        it('returns extractReturnValue error when EventBridge source has no deserializer', async () => {
            const event = {
                source: 'mtw.unknown',
                'detail-type': 'Some Event',
                detail: {},
            }

            const response = await handler(event, {})

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'Error',
                body: {
                    error: 'No deserializer available for data source: mtw.unknown',
                },
            })
            expect(mockMessageBus.flushAndSettle).toHaveBeenCalled()
            expect(response).toEqual({
                statusCode: 400,
                body: JSON.stringify({
                    error: 'No deserializer available for data source: mtw.unknown',
                }),
            })
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
            expect(mockMessageBus.publish).toHaveBeenCalledWith(
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
            expect(mockMessageBus.flushAndSettle).toHaveBeenCalled()
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
            const streamingEventCall = mockMessageBus.publish.mock.calls.find(
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
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'ThinkingResult',
                    RequestId: 'req-tr',
                    result,
                },
            })
        })

        it('returns 400 for ephemeraStateChange with invalid wire markState', async () => {
            const response = await handler(
                {
                    requestContext: { connectionId: 'test-connection' },
                    body: JSON.stringify({
                        message: 'ephemeraStateChange',
                        RequestId: 'req-invalid',
                        componentId: 'ROOM#x',
                        markState: {},
                    }),
                },
                {}
            )

            expect(response).toEqual(expect.objectContaining({ statusCode: 400 }))
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'ReturnValue' })
            )
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
