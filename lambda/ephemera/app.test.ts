jest.mock('@aws-sdk/client-sfn')
import { handler } from './app'
import messageBus from './messageBus'

// Mock dependencies
jest.mock('./messageBus')
jest.mock('./internalCache')
jest.mock('./parse', () => ({
    parseCommand: jest.fn()
}))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const mockParseCommand = require('./parse').parseCommand as jest.MockedFunction<typeof import('./parse').parseCommand>

describe('app handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.clear.mockReturnValue(undefined)
        mockMessageBus.flush.mockResolvedValue(undefined)
        mockMessageBus.send.mockReturnValue(undefined)
        mockParseCommand.mockResolvedValue(undefined)
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
        it('should route command messages to messageBus.send with ExecuteActionMessage when parsed', async () => {
            const mockParsedAction: import('@tonylb/mtw-interfaces/ts/ephemera').ActionAPIMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123',
                    EphemeraId: 'ROOM#456'
                }
            }
            
            mockParseCommand.mockResolvedValue(mockParsedAction)

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

            // The command should be parsed and then sent to messageBus
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ExecuteAction',
                action: mockParsedAction
            })
        })

        it('should not send to messageBus when command parsing returns undefined', async () => {
            mockParseCommand.mockResolvedValue(undefined)

            const commandMessage = {
                message: 'command',
                CharacterId: 'CHARACTER#123',
                command: 'invalid command'
            }

            const event = {
                requestContext: {
                    connectionId: 'test-connection'
                },
                body: JSON.stringify(commandMessage)
            }

            await handler(event, {})

            expect(mockMessageBus.send).not.toHaveBeenCalled()
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
    })
})
