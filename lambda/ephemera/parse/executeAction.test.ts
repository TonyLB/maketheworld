import { executeAction } from './executeAction'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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

const MockMessageBus = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('executeAction', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        MockMessageBus.publish.mockClear()
        internalCacheMock.CharacterMeta.get.mockClear()
        internalCacheMock.RoomAssets = { get: jest.fn().mockResolvedValue([]) } as any
        internalCacheMock.AssetMetaData = { get: jest.fn().mockResolvedValue([]) } as any
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

            await expect(executeAction(MockMessageBus, request)).resolves.not.toThrow()
            expect(MockMessageBus.publish).not.toHaveBeenCalled()
        })
    })
})
