import { executeAction } from './executeAction'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId, EphemeraRoomId, EphemeraFeatureId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { sendPerceptionThreadRegistered } from '../dataSource/perception/subscribedEvents'
import { sendRenderRequested } from '../dataSource/renderOrchestration/subscribedEvents'
import { sendCharacterHome } from '../dataSource/actions/sendPublishedEvents'
import { sendActionAssessed } from '../dataSource/apiEphemera'

// Mock dependencies
jest.mock('../messageBus', () => ({
    __esModule: true,
    default: {
        publish: jest.fn(),
    },
}))
jest.mock('../internalCache')
jest.mock('../lib/characterColor', () => ({
    defaultColorFromCharacterId: jest.fn(() => 'blue')
}))
jest.mock('@tonylb/mtw-wml/ts/schema', () => ({
    schemaToWML: jest.fn(() => '<Asset />'),
}))
jest.mock('../dataSource/perception/subscribedEvents', () => {
    const actual = jest.requireActual('../dataSource/perception/subscribedEvents') as object
    return {
        ...actual,
        sendPerceptionThreadRegistered: jest.fn(),
    }
})
jest.mock('../dataSource/renderOrchestration/subscribedEvents', () => {
    const actual = jest.requireActual('../dataSource/renderOrchestration/subscribedEvents') as object
    return {
        ...actual,
        sendRenderRequested: jest.fn(),
    }
})
jest.mock('../dataSource/actions/sendPublishedEvents', () => {
    const actual = jest.requireActual('../dataSource/actions/sendPublishedEvents') as object
    return {
        ...actual,
        sendCharacterHome: jest.fn(),
    }
})
jest.mock('../dataSource/apiEphemera', () => {
    const actual = jest.requireActual('../dataSource/apiEphemera') as object
    return {
        ...actual,
        sendActionAssessed: jest.fn(),
    }
})

const MockMessageBus = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const mockSendPerceptionThreadRegistered = sendPerceptionThreadRegistered as jest.MockedFunction<typeof sendPerceptionThreadRegistered>
const mockSendRenderRequested = sendRenderRequested as jest.MockedFunction<typeof sendRenderRequested>
const mockSendCharacterHome = sendCharacterHome as jest.MockedFunction<typeof sendCharacterHome>
const mockSendActionAssessed = sendActionAssessed as jest.MockedFunction<typeof sendActionAssessed>

describe('executeAction', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        MockMessageBus.publish.mockClear()
        internalCacheMock.CharacterMeta.get.mockClear()
        mockSendPerceptionThreadRegistered.mockClear()
        mockSendRenderRequested.mockClear()
        mockSendCharacterHome.mockClear()
        mockSendActionAssessed.mockClear()
        internalCacheMock.RoomAssets = { get: jest.fn().mockResolvedValue([]) } as any
        internalCacheMock.AssetMetaData = { get: jest.fn().mockResolvedValue([]) } as any
        internalCacheMock.ComponentRender = {
            get: jest.fn().mockResolvedValue({ schema: {} }),
        } as any
    })

    describe('look action', () => {
        it('should register room perception thread and send render request for room look', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME' as EphemeraRoomId,
                assets: ['ASSET#one'],
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    EphemeraId: 'ROOM#456' as EphemeraRoomId
                }
            }

            await executeAction(MockMessageBus, request)

            expect(mockSendPerceptionThreadRegistered).toHaveBeenCalledWith(
                MockMessageBus,
                'ROOM#456',
                expect.objectContaining({
                    threadKind: 'roomDescription',
                    componentId: 'ROOM#456',
                    characterId: 'CHARACTER#123',
                })
            )
            expect(mockSendRenderRequested).toHaveBeenCalledWith(
                MockMessageBus,
                'ROOM#456',
                expect.objectContaining({
                    componentId: 'ROOM#456',
                    characterId: 'CHARACTER#123',
                    perspective: expect.objectContaining({ assetStack: [] }),
                })
            )
            const renderCommand = mockSendRenderRequested.mock.calls[0][2] as Record<string, unknown>
            expect(renderCommand.generationContextWml).toBeUndefined()
            expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'Perception' })
            )
        })

        it('should handle look action with feature ID', async () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    EphemeraId: 'FEATURE#789' as EphemeraFeatureId
                }
            }

            await executeAction(MockMessageBus, request)

            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'Perception',
                characterId: 'CHARACTER#123',
                ephemeraId: 'FEATURE#789'
            })
        })
    })

    describe('move action', () => {
        it('should send Action Assessed Navigation for move action', async () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    RoomId: 'ROOM#789' as EphemeraRoomId,
                    ExitName: 'north'
                }
            }

            await executeAction(MockMessageBus, request)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'Navigation',
                        targetId: 'ROOM#789',
                        exitName: 'north',
                        confidence: 1,
                    },
                    source: 'uiExit',
                }
            )
            expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'MoveCharacter' })
            )
        })

        it('should send Action Assessed Navigation for move action without exit name', async () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    RoomId: 'ROOM#789' as EphemeraRoomId
                }
            }

            await executeAction(MockMessageBus, request)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'Navigation',
                        targetId: 'ROOM#789',
                        confidence: 1,
                    },
                    source: 'uiExit',
                }
            )
            expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'MoveCharacter' })
            )
        })
    })

    describe('home action', () => {
        it('should send Character Home stream and MoveCharacter for home action', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME' as EphemeraRoomId,
                assets: ['Personal']
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'home',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId
                }
            }

            await executeAction(MockMessageBus, request)

            expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
            expect(mockSendCharacterHome).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    type: 'Character Home',
                    characterId: 'CHARACTER#123',
                    fromRoomId: 'ROOM#456',
                    toRoomId: 'ROOM#HOME',
                }
            )
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'MoveCharacter',
                characterId: 'CHARACTER#123',
                roomId: 'ROOM#HOME',
            })
        })

        it('should not send Character Home stream when character has no home', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: undefined as any,
                RoomStack: [],
                HomeId: undefined as any,
                assets: []
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'home',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId
                }
            }

            await executeAction(MockMessageBus, request)

            expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
            expect(mockSendCharacterHome).not.toHaveBeenCalled()
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'MoveCharacter',
                characterId: 'CHARACTER#123',
                roomId: undefined,
            })
        })
    })

    describe('SayMessage action', () => {
        it('should send PublishMessage for SayMessage action', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME',
                assets: ['Personal'],
                Color: 'blue'
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'SayMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'Hello, world!'
                }
            }

            await executeAction(MockMessageBus, request)

            expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#456'],
                displayProtocol: 'SayMessage',
                message: ['Hello, world!'],
                characterId: 'CHARACTER#123',
                name: 'TestCharacter',
                color: 'blue'
            })
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: { messageType: 'Success' }
            })
        })
    })

    describe('NarrateMessage action', () => {
        it('should send PublishMessage for NarrateMessage action', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME',
                assets: ['Personal'],
                Color: 'blue'
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'NarrateMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'The character waves hello.'
                }
            }

            await executeAction(MockMessageBus, request)

            expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#456'],
                displayProtocol: 'NarrateMessage',
                message: ['The character waves hello.'],
                characterId: 'CHARACTER#123',
                name: 'TestCharacter',
                color: 'blue'
            })
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: { messageType: 'Success' }
            })
        })
    })

    describe('OOCMessage action', () => {
        it('should send PublishMessage for OOCMessage action', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME',
                assets: ['Personal'],
                Color: 'blue'
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'OOCMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'This is out of character'
                }
            }

            await executeAction(MockMessageBus, request)

            expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#456'],
                displayProtocol: 'OOCMessage',
                message: ['This is out of character'],
                characterId: 'CHARACTER#123',
                name: 'TestCharacter',
                color: 'blue'
            })
            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: { messageType: 'Success' }
            })
        })
    })

    describe('communication actions', () => {
        beforeEach(() => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: 'ROOM#456' as EphemeraRoomId,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#HOME',
                assets: ['Personal'],
                Color: 'blue'
            })
        })

        it('should handle communication action when character is in a room', async () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'SayMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'Hello'
                }
            }

            await executeAction(MockMessageBus, request)

            expect(MockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#456'],
                displayProtocol: 'SayMessage',
                message: ['Hello'],
                characterId: 'CHARACTER#123',
                name: 'TestCharacter',
                color: 'blue'
            })
        })

        it('should handle communication action when character is not in a room', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: undefined as any,
                RoomStack: [],
                HomeId: undefined as any,
                assets: [],
                Color: 'blue'
            })

            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'SayMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'Hello'
                }
            }

            await executeAction(MockMessageBus, request)

            // The current implementation only sends messages when RoomId exists
            // When RoomId is undefined, no messages are sent
            expect(MockMessageBus.publish).not.toHaveBeenCalled()
        })
    })

    describe('unknown action types', () => {
        it('should handle unknown action types gracefully', async () => {
            const request = {
                message: 'action',
                actionType: 'unknownAction',
                payload: {}
            } as any

            // Should not throw
            await expect(executeAction(MockMessageBus, request)).resolves.not.toThrow()
            
            // Should not send any messages
            expect(MockMessageBus.publish).not.toHaveBeenCalled()
        })
    })
})
