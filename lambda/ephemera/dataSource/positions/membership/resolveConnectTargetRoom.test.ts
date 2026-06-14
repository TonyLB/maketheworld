import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn(), set: jest.fn() },
        Global: { get: jest.fn() },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { resolveConnectTargetRoom } from './resolveConnectTargetRoom'
import type { RoomStackItem } from './types'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const optimisticUpdateMock = ephemeraDB.optimisticUpdate as jest.Mock

const CHARACTER_ID = 'CHARACTER#alpha' as const

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    Name: 'Alpha',
    RoomId: 'ROOM#VORTEX' as const,
    RoomStack: [
        { asset: 'primitives', RoomId: 'VORTEX' },
        { asset: 'TownCenter', RoomId: 'TownSquare' },
    ] as RoomStackItem[],
    HomeId: 'ROOM#VORTEX' as const,
    assets: ['draftOne'],
    Pronouns: 'they/them',
}

describe('resolveConnectTargetRoom', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCacheMock.CharacterMeta.get.mockResolvedValue(characterMeta)
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
    })

    it('returns the top trimmed frame as the connect target room', async () => {
        const result = await resolveConnectTargetRoom(CHARACTER_ID, {
            getCharacterMeta: internalCacheMock.CharacterMeta.get,
            getCanonAssets: async () => ['primitives', 'TownCenter'],
            optimisticUpdate: optimisticUpdateMock,
        })

        expect(result.targetRoomId).toBe('ROOM#TownSquare')
        expect(result.trimmedRoomStack).toEqual(characterMeta.RoomStack)
        expect(optimisticUpdateMock).not.toHaveBeenCalled()
    })

    it('persists trim-only when inaccessible overlay frames are removed', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'Suburbs' },
                { asset: 'circusEvent', RoomId: 'BigTop' },
            ],
        })
        optimisticUpdateMock.mockImplementation(async ({ updateReducer, successCallback }) => {
            const prior = {
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'Suburbs' },
                    { asset: 'circusEvent', RoomId: 'BigTop' },
                ],
            }
            const next = produce(prior, updateReducer)
            successCallback?.(next, prior)
            return next
        })

        const result = await resolveConnectTargetRoom(CHARACTER_ID, {
            getCharacterMeta: internalCacheMock.CharacterMeta.get,
            getCanonAssets: async () => ['primitives', 'TownCenter'],
            optimisticUpdate: optimisticUpdateMock,
        })

        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            updateKeys: ['RoomStack'],
        }))
        expect(result.trimmedRoomStack).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
        ])
        expect(result.targetRoomId).toBe('ROOM#Suburbs')
        expect(internalCacheMock.CharacterMeta.set).toHaveBeenCalled()
    })

    it('defaults to VORTEX when the ladder is empty after trim', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: [{ asset: 'circusEvent', RoomId: 'BigTop' }],
        })

        const result = await resolveConnectTargetRoom(CHARACTER_ID, {
            getCharacterMeta: internalCacheMock.CharacterMeta.get,
            getCanonAssets: async () => ['primitives', 'TownCenter'],
            optimisticUpdate: optimisticUpdateMock,
        })

        expect(result.trimmedRoomStack).toEqual([])
        expect(result.targetRoomId).toBe('ROOM#VORTEX')
    })
})
