import { jest, expect } from '@jest/globals'
import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../internalCache')
import internalCache from '../internalCache'

import moveCharacter, { RoomStackItem } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { EphemeraId, EphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/dist/types'

const internalCacheMock = jest.mocked(internalCache, true)
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

//
// TODO: Parameterize testEphemeraRecord to accept a roomStack for the character's
// current location, and to adjust roomEphemera activeCharacterList items accordingly
//
const testEphemeraRecord = (fromRoomStack: RoomStackItem[], toRoomId: EphemeraRoomId) => (ephemeraId: EphemeraId) => {
    const fromRoomId = RoomKey(fromRoomStack.slice(-1)[0]?.RoomId)
    switch(ephemeraId) {
        case toRoomId:
            return {
                EphemeraId: toRoomId,
                DataCategory: 'Meta::Room',
                activeCharacters: [{ 'CHARACTER#TestTwo': { EphemeraId: 'CHARACTER#TestTwo', Name: 'TestTwo', Connections: ['zyxwvut'] } }]
            }
        case fromRoomId:
            return {
                EphemeraId: fromRoomId,
                DataCategory: 'Meta::Room',
                activeCharacters: [{ 'CHARACTER#Test': { EphemeraId: 'CHARACTER#Test', Name: 'Test', Connections: ['abcdef'] } }]
            }
        case 'CHARACTER#Test':
            return {
                EphemeraId: 'CHARACTER#Test',
                DataCategory: 'Meta::Character',
                RoomId: fromRoomId,
                RoomStack: fromRoomStack
            }
    }
    throw new Error('Misuse of testEphemeraRecord utility')
}

const wrapMocks = (fromRoomStack: RoomStackItem[], toRoomId: EphemeraRoomId, assets: string[]): void => {
    ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ Key, updateReducer, successCallback }) => {
        const returnValue = produce(testEphemeraRecord(fromRoomStack, toRoomId)(Key.EphemeraId as EphemeraId), updateReducer)
        successCallback?.(returnValue)
        return returnValue
    })
    internalCacheMock.CharacterMeta.get.mockResolvedValue({
        EphemeraId: 'CHARACTER#Test',
        RoomId: RoomKey(fromRoomStack.slice(-1)[0]?.RoomId || ''),
        Name: 'Test',
        HomeId: 'ROOM#VORTEX',
        assets,
        Pronouns: {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            adjective: 'theirs',
            reflexive: 'themself'
        }
    })
}

describe('moveCharacter', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
        internalCacheMock.CharacterConnections.get.mockResolvedValue(['abcdef'])

        internalCacheMock.RoomAssets.get.mockImplementation(async (roomId) => {
            switch(roomId) {
                case 'ROOM#TestOne':
                    return ['ASSET#primitives', 'ASSET#TownCenter']
                case 'ROOM#TestTwo':
                    return ['ASSET#TownCenter']
                case 'ROOM#TestThree':
                    return ['ASSET#TownCenter', 'ASSET#draftOne']
                case 'ROOM#TestFour':
                    return ['ASSET#draftOne']
                case 'ROOM#TestFive':
                    return ['ASSET#draftTwo']
                default:
                    return ['ASSET#primitives', 'ASSET#TownCenter', 'ASSET#Dockside']
            }
        })
    })

    it('should change rooms appropriately', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#TestTwo',
            ['draftOne', 'draftTwo']
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestTwo' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            Update: {
                Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
                updateKeys: ['RoomId', 'RoomStack'],
                updateReducer: expect.any(Function)
            }
        },
        {
            Update: {
                Key: { EphemeraId: 'ROOM#VORTEX', DataCategory: 'Meta::Room' },
                updateKeys: ['activeCharacters'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        },
        {
            Update: {
                Key: { EphemeraId: 'ROOM#TestTwo', DataCategory: 'Meta::Room' },
                updateKeys: ['activeCharacters'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        }])
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#VORTEX', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestTwo',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestTwo' }
                ]
            })
        }
    })

    it('should replace items in RoomStack when moved in same asset', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }],
            'ROOM#TestThree',
            ['draftOne', 'draftTwo']
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestThree' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestTwo', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestThree',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestThree' }
                ]
            })
        }
    })

    it('should add items to RoomStack when moved into a child asset', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }],
            'ROOM#TestThree',
            ['draftOne', 'draftTwo']
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestFour' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestTwo', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestFour',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestTwo' },
                    { asset: 'draftOne', RoomId: 'TestFour' }
                ]
            })
        }
    })

    it('should remove items from RoomStack when moved back to a parent asset', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }, { asset: 'draftOne', RoomId: 'TestFour' }],
            'ROOM#TestFour',
            ['draftOne', 'draftTwo']
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestOne' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestFour', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }, { asset: 'draftOne', RoomId: 'TestFour' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestOne',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'TestOne' }
                ]
            })
        }
    })

})