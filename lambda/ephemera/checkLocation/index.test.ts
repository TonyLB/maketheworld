import { jest, expect } from '@jest/globals'
import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../internalCache')
import internalCache from '../internalCache'

import { MessageBus } from '../messageBus/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/dist/types'
import { RoomStackItem } from '../moveCharacter'
import checkLocation from '.'

const internalCacheMock = jest.mocked(internalCache, true)
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const wrapMocks = (fromRoomStack: RoomStackItem[], assets: string[]): void => {
    const characterMetaMock = {
        EphemeraId: 'CHARACTER#Test' as const,
        RoomId: RoomKey(fromRoomStack.slice(-1)[0]?.RoomId || ''),
        RoomStack: fromRoomStack,
        Name: 'Test',
        HomeId: 'ROOM#VORTEX' as const,
        assets,
        Pronouns: {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            adjective: 'theirs',
            reflexive: 'themself'
        }
    }
    internalCacheMock.CharacterMeta.get.mockResolvedValue(characterMetaMock)
    ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ Key, updateReducer, successCallback }) => {
        const returnValue = produce(characterMetaMock, updateReducer)
        successCallback?.(returnValue, characterMetaMock)
        return returnValue
    })
}

describe('checkLocation', () => {
    const messageBusMock = { send: jest.fn() } as unknown as jest.Mocked<MessageBus>
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
    })

    it('should no-op when room is still valid', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            ['draftOne', 'draftTwo']
        )
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(0)
    })

    it('should return character to first available history room', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            []
        )
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
            updateKeys: ['RoomId', 'RoomStack'],
            updateReducer: expect.any(Function),
            successCallback: expect.any(Function),
        })
        expect(produce(
                {
                    RoomStack: [
                        { asset: 'primitives', RoomId: 'VORTEX' },
                        { asset: 'TownCenter', RoomId: 'TownSquare' },
                        { asset: 'draftOne', RoomId: 'Laboratory' },
                        { asset: 'draftTwo', RoomId: 'Oubliette' }
                    ]
                },
                ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer
            )).toEqual({
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TownSquare' }
                ]
            })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'MoveCharacter',
            characterId: 'CHARACTER#Test',
            roomId: 'ROOM#TownSquare',
            suppressSelfMessage: true
        })
    })

    it('should update RoomStack without moving when room remains valid', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            ['draftTwo']
        )
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
            updateKeys: ['RoomId', 'RoomStack'],
            updateReducer: expect.any(Function),
            successCallback: expect.any(Function),
        })
        expect(produce(
                {
                    RoomStack: [
                        { asset: 'primitives', RoomId: 'VORTEX' },
                        { asset: 'TownCenter', RoomId: 'TownSquare' },
                        { asset: 'draftOne', RoomId: 'Laboratory' },
                        { asset: 'draftTwo', RoomId: 'Oubliette' }
                    ]
                },
                ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer
            )).toEqual({
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TownSquare' },
                    { asset: 'draftTwo', RoomId: 'Oubliette' }
                ]
            })
        expect(messageBusMock.send).toHaveBeenCalledTimes(0)
    })

    it('should move on forceMove even when stack remains valid', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            ['draftOne', 'draftTwo']
        )
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test', forceMove: true }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
            updateKeys: ['RoomId', 'RoomStack'],
            updateReducer: expect.any(Function),
            successCallback: expect.any(Function),
            succeedAll: true
        })
        expect(produce(
                {
                    RoomStack: [
                        { asset: 'primitives', RoomId: 'VORTEX' },
                        { asset: 'TownCenter', RoomId: 'TownSquare' },
                        { asset: 'draftOne', RoomId: 'Laboratory' },
                        { asset: 'draftTwo', RoomId: 'Oubliette' }
                    ]
                },
                ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer
            )).toEqual({
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TownSquare' },
                    { asset: 'draftOne', RoomId: 'Laboratory' },
                    { asset: 'draftTwo', RoomId: 'Oubliette' }
                ]
            })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'MoveCharacter',
            characterId: 'CHARACTER#Test',
            roomId: 'ROOM#Oubliette',
            suppressSelfMessage: true
        })
    })

    it('should convey arriveMessage and leaveMessage', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            ['draftOne', 'draftTwo']
        )
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test', forceMove: true, leaveMessage: ' has vanished.', arriveMessage: ' has appeared.' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
            updateKeys: ['RoomId', 'RoomStack'],
            updateReducer: expect.any(Function),
            successCallback: expect.any(Function),
            succeedAll: true
        })
        expect(produce(
                {
                    RoomStack: [
                        { asset: 'primitives', RoomId: 'VORTEX' },
                        { asset: 'TownCenter', RoomId: 'TownSquare' },
                        { asset: 'draftOne', RoomId: 'Laboratory' },
                        { asset: 'draftTwo', RoomId: 'Oubliette' }
                    ]
                },
                ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer
            )).toEqual({
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TownSquare' },
                    { asset: 'draftOne', RoomId: 'Laboratory' },
                    { asset: 'draftTwo', RoomId: 'Oubliette' }
                ]
            })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'MoveCharacter',
            characterId: 'CHARACTER#Test',
            roomId: 'ROOM#Oubliette',
            leaveMessage: ' has vanished.',
            arriveMessage: ' has appeared.',
            suppressSelfMessage: true
        })
    })

    it('should update characters in room when roomId passed', async () => {
        wrapMocks(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
                { asset: 'draftTwo', RoomId: 'Oubliette' }
            ],
            ['draftOne']
        )
        internalCacheMock.RoomCharacterList.get.mockResolvedValue([{ EphemeraId: 'CHARACTER#Test', Name: 'Test', ConnectionIds: [] }])
        await checkLocation({
            payloads: [{ type: 'CheckLocation', roomId: 'ROOM#Oubliette', leaveMessage: ' has vanished.', arriveMessage: ' has appeared.' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
            updateKeys: ['RoomId', 'RoomStack'],
            updateReducer: expect.any(Function),
            successCallback: expect.any(Function)
        })
        expect(produce(
                {
                    RoomStack: [
                        { asset: 'primitives', RoomId: 'VORTEX' },
                        { asset: 'TownCenter', RoomId: 'TownSquare' },
                        { asset: 'draftOne', RoomId: 'Laboratory' },
                        { asset: 'draftTwo', RoomId: 'Oubliette' }
                    ]
                },
                ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer
            )).toEqual({
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TownSquare' },
                    { asset: 'draftOne', RoomId: 'Laboratory' }
                ]
            })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'MoveCharacter',
            characterId: 'CHARACTER#Test',
            roomId: 'ROOM#Laboratory',
            leaveMessage: ' has vanished.',
            arriveMessage: ' has appeared.',
            suppressSelfMessage: true
        })
    })
})