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
})
