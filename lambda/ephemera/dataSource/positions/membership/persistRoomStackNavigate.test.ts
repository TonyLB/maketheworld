import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { set: jest.fn() },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { persistRoomStackNavigate } from './persistRoomStackNavigate'
import type { RoomStackItem } from './types'

const optimisticUpdateMock = ephemeraDB.optimisticUpdate as jest.Mock
const characterMetaSetMock = internalCache.CharacterMeta.set as jest.Mock

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const ROOM_ONE = 'ROOM#TestOne' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId
const ROOM_D = 'ROOM#TestFour' as EphemeraRoomId
const BEAT_ANCHOR_TIME = 1_700_000_000_000

const roomAssetsForLadder = async (roomId: EphemeraRoomId): Promise<string[]> => {
    switch (roomId) {
        case ROOM_ONE:
            return ['ASSET#primitives', 'ASSET#TownCenter']
        case ROOM_B:
            return ['ASSET#TownCenter']
        case ROOM_C:
            return ['ASSET#TownCenter', 'ASSET#draftOne']
        case ROOM_D:
            return ['ASSET#draftOne']
        default:
            return ['ASSET#primitives', 'ASSET#TownCenter', 'ASSET#Dockside']
    }
}

const runReducer = async ({
    priorRoomStack,
    targetRoomId,
    characterAssets = ['primitives', 'TownCenter'],
    beatAnchorTime = BEAT_ANCHOR_TIME,
}: {
    priorRoomStack: RoomStackItem[];
    targetRoomId: EphemeraRoomId;
    characterAssets?: string[];
    beatAnchorTime?: number;
}): Promise<RoomStackItem[]> => {
    optimisticUpdateMock.mockImplementation(async ({ updateReducer }) => {
        const prior = { RoomStack: priorRoomStack }
        return produce(prior, updateReducer)
    })

    const roomAssets = await roomAssetsForLadder(targetRoomId)
    await persistRoomStackNavigate({
        characterId: CHARACTER_ID,
        targetRoomId,
        beatAnchorTime,
        characterAssets,
        roomAssets,
        canonAssets: ['primitives', 'TownCenter'],
    }, { optimisticUpdate: optimisticUpdateMock })

    const { updateReducer } = optimisticUpdateMock.mock.calls[0][0]
    return produce({ RoomStack: priorRoomStack }, updateReducer).RoomStack
}

describe('persistRoomStackNavigate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('stamps timeWritten from beatAnchorTime on updated frames', async () => {
        const result = await runReducer({
            priorRoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            targetRoomId: ROOM_B,
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: BEAT_ANCHOR_TIME },
            { asset: 'TownCenter', RoomId: 'TestTwo', timeWritten: BEAT_ANCHOR_TIME },
        ])
    })

    it('replaces same-asset tail when navigating within an asset chain', async () => {
        const result = await runReducer({
            priorRoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
            ],
            targetRoomId: ROOM_C,
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: BEAT_ANCHOR_TIME },
            { asset: 'TownCenter', RoomId: 'TestThree', timeWritten: BEAT_ANCHOR_TIME },
        ])
    })

    it('extends RoomStack when navigating into a child asset', async () => {
        const result = await runReducer({
            priorRoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
            ],
            targetRoomId: ROOM_D,
            characterAssets: ['primitives', 'TownCenter', 'draftOne'],
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: BEAT_ANCHOR_TIME },
            { asset: 'TownCenter', RoomId: 'TestTwo', timeWritten: BEAT_ANCHOR_TIME },
            { asset: 'draftOne', RoomId: 'TestFour', timeWritten: BEAT_ANCHOR_TIME },
        ])
    })

    it('truncates RoomStack when navigating back to a parent asset', async () => {
        const result = await runReducer({
            priorRoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
                { asset: 'draftOne', RoomId: 'TestFour' },
            ],
            targetRoomId: ROOM_ONE,
            characterAssets: ['primitives', 'TownCenter', 'draftOne'],
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'TestOne', timeWritten: BEAT_ANCHOR_TIME },
        ])
    })

    it('merge prevents stale write from regressing newer timeWritten frames', async () => {
        const T_NEW = 2_000
        const T_STALE = 1_000

        optimisticUpdateMock.mockImplementation(async ({ updateReducer }) => {
            const prior = {
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T_NEW },
                    { asset: 'TownCenter', RoomId: 'TestThree', timeWritten: T_NEW },
                ],
            }
            return produce(prior, updateReducer)
        })

        await persistRoomStackNavigate({
            characterId: CHARACTER_ID,
            targetRoomId: ROOM_B,
            beatAnchorTime: T_STALE,
            characterAssets: ['primitives', 'TownCenter'],
            roomAssets: ['ASSET#TownCenter'],
            canonAssets: ['primitives', 'TownCenter'],
        }, { optimisticUpdate: optimisticUpdateMock })

        const { updateReducer } = optimisticUpdateMock.mock.calls[0][0]
        const merged = produce(
            {
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T_NEW },
                    { asset: 'TownCenter', RoomId: 'TestThree', timeWritten: T_NEW },
                ],
            },
            updateReducer
        ).RoomStack

        expect(merged).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T_NEW },
            { asset: 'TownCenter', RoomId: 'TestThree', timeWritten: T_NEW },
        ])
    })

    it('updates CharacterMeta cache on success', async () => {
        optimisticUpdateMock.mockImplementation(async ({ updateReducer, successCallback }) => {
            const prior = { RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] }
            const next = produce(prior, updateReducer)
            successCallback?.(next, prior)
            return next
        })

        await persistRoomStackNavigate({
            characterId: CHARACTER_ID,
            targetRoomId: ROOM_B,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            characterAssets: ['primitives', 'TownCenter'],
            roomAssets: ['ASSET#TownCenter'],
            canonAssets: ['primitives', 'TownCenter'],
        }, { optimisticUpdate: optimisticUpdateMock })

        expect(characterMetaSetMock).toHaveBeenCalledWith(expect.objectContaining({
            EphemeraId: CHARACTER_ID,
            RoomStack: expect.arrayContaining([
                expect.objectContaining({ asset: 'TownCenter', RoomId: 'TestTwo' }),
            ]),
        }))
    })

    it('logs and resolves without throwing when optimisticUpdate fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        optimisticUpdateMock.mockRejectedValue(new Error('ConditionalCheckFailedException'))

        await expect(persistRoomStackNavigate({
            characterId: CHARACTER_ID,
            targetRoomId: ROOM_B,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            characterAssets: ['primitives'],
            roomAssets: ['ASSET#TownCenter'],
            canonAssets: ['primitives'],
        }, { optimisticUpdate: optimisticUpdateMock })).resolves.toBeUndefined()

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[mtw.ephemera.positions] persistRoomStackNavigate failed:')
        )
        consoleSpy.mockRestore()
    })
})
