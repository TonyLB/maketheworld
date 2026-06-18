import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterSpokePublishedPayload } from '../actions/publishedEvents'
import { handleCharacterSpoke } from './handleCharacterSpoke'
import { resolveCharacterRoomId } from '../positions/membership/resolveCharacterRoomId'

jest.mock('../../messageBus', () => ({
    __esModule: true,
    default: {
        publish: jest.fn(),
    },
}))
jest.mock('../../internalCache')
jest.mock('../positions/membership/resolveCharacterRoomId', () => ({
    resolveCharacterRoomId: jest.fn(),
}))
jest.mock('../../lib/characterColor', () => ({
    defaultColorFromCharacterId: jest.fn(() => 'blue'),
}))

const MockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const resolveCharacterRoomIdMock = resolveCharacterRoomId as jest.MockedFunction<typeof resolveCharacterRoomId>
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
        resolveCharacterRoomIdMock.mockResolvedValue('ROOM#456' as EphemeraRoomId)
    })

    it('publishes SayMessage to the character room', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#123',
            Name: 'TestCharacter',
            RoomId: 'ROOM#legacy' as EphemeraRoomId,
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#HOME',
            assets: ['Personal'],
            Color: 'blue',
        })

        await handleCharacterSpoke(MockMessageBus, basePayload())

        expect(resolveCharacterRoomIdMock).toHaveBeenCalledWith('CHARACTER#123')
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
})
