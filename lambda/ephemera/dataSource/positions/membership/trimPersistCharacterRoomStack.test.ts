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
import { mergeRoomStack } from './mergeRoomStack'
import { trimPersistCharacterRoomStack } from './trimPersistCharacterRoomStack'
import { trimRoomStackToAccessibleAssets } from './trimEvictionLadder'
import type { RoomStackItem } from './types'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const optimisticUpdateMock = ephemeraDB.optimisticUpdate as jest.Mock

const CHARACTER_ID = 'CHARACTER#Test' as const
const T0 = 1000
const T1 = 2000
const T2 = 3000

const accessibleAssets = ['primitives', 'TownCenter', 'draftOne']

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: 'ROOM#Suburbs' as const,
    HomeId: 'ROOM#VORTEX' as const,
    assets: ['draftOne'],
    Pronouns: 'they/them',
}

const stackWithTimestamps: RoomStackItem[] = [
    { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T0 },
    { asset: 'TownCenter', RoomId: 'Suburbs', timeWritten: T1 },
    { asset: 'circusEvent', RoomId: 'BigTop', timeWritten: T2 },
]

describe('trimPersistCharacterRoomStack', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
    })

    it('preserves timeWritten on surviving frames when trim removes outer frames', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: stackWithTimestamps,
        })
        optimisticUpdateMock.mockImplementation(async ({ updateReducer, successCallback }) => {
            const prior = { RoomStack: stackWithTimestamps }
            const next = produce(prior, updateReducer)
            successCallback?.(next, prior)
            return next
        })

        const result = await trimPersistCharacterRoomStack(CHARACTER_ID)

        expect(result.trimmedRoomStack).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T0 },
            { asset: 'TownCenter', RoomId: 'Suburbs', timeWritten: T1 },
        ])
        expect(result.ladderChanged).toBe(true)
        expect(optimisticUpdateMock).toHaveBeenCalled()
    })

    it('filter-only reducer: no timeWritten added to survivors', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: stackWithTimestamps,
        })
        let capturedReducer: ((draft: { RoomStack: RoomStackItem[] }) => void) | undefined
        optimisticUpdateMock.mockImplementation(async ({ updateReducer }) => {
            capturedReducer = updateReducer
            return {}
        })

        await trimPersistCharacterRoomStack(CHARACTER_ID)

        expect(capturedReducer).toBeDefined()
        const draft = { RoomStack: stackWithTimestamps }
        capturedReducer!(draft)
        expect(draft.RoomStack).toEqual(trimRoomStackToAccessibleAssets(stackWithTimestamps, accessibleAssets))
        expect(draft.RoomStack.every((frame, index) => (
            frame.timeWritten === stackWithTimestamps[index]?.timeWritten
        ))).toBe(true)
    })

    it('filters draft.RoomStack at write time when draft differs from cache snapshot', async () => {
        const draftStack: RoomStackItem[] = [
            ...stackWithTimestamps,
            { asset: 'draftOne', RoomId: 'Laboratory', timeWritten: T2 + 1 },
        ]
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: stackWithTimestamps,
        })
        let capturedReducer: ((draft: { RoomStack: RoomStackItem[] }) => void) | undefined
        optimisticUpdateMock.mockImplementation(async ({ updateReducer }) => {
            capturedReducer = updateReducer
            return {}
        })

        await trimPersistCharacterRoomStack(CHARACTER_ID)

        expect(capturedReducer).toBeDefined()
        const draft = { RoomStack: draftStack }
        capturedReducer!(draft)
        const expectedFromDraft = trimRoomStackToAccessibleAssets(draftStack, accessibleAssets)
        const expectedFromCache = trimRoomStackToAccessibleAssets(stackWithTimestamps, accessibleAssets)
        expect(draft.RoomStack).toEqual(expectedFromDraft)
        expect(draft.RoomStack).not.toEqual(expectedFromCache)
        expect(draft.RoomStack).toHaveLength(3)
        expect(draft.RoomStack[2]).toEqual({ asset: 'draftOne', RoomId: 'Laboratory', timeWritten: T2 + 1 })
    })

    it('no-ops when all ladder assets remain accessible even with timeWritten on frames', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T0 },
                { asset: 'TownCenter', RoomId: 'Suburbs', timeWritten: T1 },
            ],
        })

        const result = await trimPersistCharacterRoomStack(CHARACTER_ID)

        expect(result.ladderChanged).toBe(false)
        expect(optimisticUpdateMock).not.toHaveBeenCalled()
    })

    it('persists trim-only with updateKeys RoomStack and updates CharacterMeta cache', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            RoomStack: stackWithTimestamps,
        })
        optimisticUpdateMock.mockImplementation(async ({ updateReducer, successCallback }) => {
            const prior = { RoomStack: stackWithTimestamps }
            const next = produce(prior, updateReducer)
            successCallback?.(next, prior)
            return next
        })

        await trimPersistCharacterRoomStack(CHARACTER_ID)

        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            updateKeys: ['RoomStack'],
        }))
        expect(internalCacheMock.CharacterMeta.set).toHaveBeenCalledWith(expect.objectContaining({
            EphemeraId: CHARACTER_ID,
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T0 },
                { asset: 'TownCenter', RoomId: 'Suburbs', timeWritten: T1 },
            ],
        }))
    })

    it('stale navigate merge cannot overwrite inner frames after trim leaves survivor timestamps', () => {
        const afterTrim: RoomStackItem[] = [
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: T0 },
            { asset: 'TownCenter', RoomId: 'Suburbs', timeWritten: T1 },
        ]
        const staleProposed: RoomStackItem[] = [
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'TownSquare' },
        ]
        const merged = mergeRoomStack(afterTrim, staleProposed, T0)
        expect(merged).toEqual(afterTrim)
    })
})
