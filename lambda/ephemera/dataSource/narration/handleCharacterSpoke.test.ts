import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterSpokePublishedPayload } from '../actions/publishedEvents'
import { handleCharacterSpoke } from './handleCharacterSpoke'

jest.mock('../../messageBus', () => ({
    __esModule: true,
    default: {
        publish: jest.fn(),
    },
}))
jest.mock('../../internalCache')
jest.mock('../../lib/characterColor', () => ({
    defaultColorFromCharacterId: jest.fn(() => 'blue'),
}))

const MockMessageBus = messageBus as jest.Mocked<typeof messageBus>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

const basePayload = (
    overrides: Partial<CharacterSpokePublishedPayload> = {}
): CharacterSpokePublishedPayload => ({
    type: 'Character Spoke',
    characterId: 'CHARACTER#123' as EphemeraCharacterId,
    message: 'Hello, world!',
    displayProtocol: 'SayMessage',
    ...overrides,
})

describe('handleCharacterSpoke', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        MockMessageBus.publish.mockClear()
        internalCacheMock.CharacterMeta.get.mockClear()
    })

    it('publishes SayMessage to the character room', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: 'ROOM#456' as EphemeraRoomId,
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#HOME',
            assets: ['Personal'],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload())

        expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#123')
        expect(MockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#456'],
            displayProtocol: 'SayMessage',
            message: ['Hello, world!'],
            characterId: 'CHARACTER#123',
            name: 'TestCharacter',
            color: 'blue',
        })
        expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'ReturnValue' })
        )
    })

    it('publishes NarrateMessage with correct displayProtocol', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: 'ROOM#456' as EphemeraRoomId,
            RoomStack: [],
            HomeId: 'ROOM#HOME',
            assets: [],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload({
            message: 'The character waves hello.',
            displayProtocol: 'NarrateMessage',
        }))

        expect(MockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#456'],
            displayProtocol: 'NarrateMessage',
            message: ['The character waves hello.'],
            characterId: 'CHARACTER#123',
            name: 'TestCharacter',
            color: 'blue',
        })
    })

    it('publishes OOCMessage with correct displayProtocol', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: 'ROOM#456' as EphemeraRoomId,
            RoomStack: [],
            HomeId: 'ROOM#HOME',
            assets: [],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload({
            message: 'This is out of character',
            displayProtocol: 'OOCMessage',
        }))

        expect(MockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#456'],
            displayProtocol: 'OOCMessage',
            message: ['This is out of character'],
            characterId: 'CHARACTER#123',
            name: 'TestCharacter',
            color: 'blue',
        })
    })

    it('does not publish when character has no RoomId', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: undefined as any,
            RoomStack: [],
            HomeId: undefined as any,
            assets: [],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload({ message: 'Hello' }))

        expect(MockMessageBus.publish).not.toHaveBeenCalled()
    })

    it('publishes correlated ReturnValue when requestId is set', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: 'ROOM#456' as EphemeraRoomId,
            RoomStack: [],
            HomeId: 'ROOM#HOME',
            assets: [],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload({ requestId: 'req-1' }))

        expect(MockMessageBus.publish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Success',
                RequestId: 'req-1',
                message: 'character_spoke_handled',
            },
        })
    })
})
