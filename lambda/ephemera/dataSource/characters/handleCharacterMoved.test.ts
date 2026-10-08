import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn(), set: jest.fn() },
        RoomAssets: { get: jest.fn() },
        Global: { get: jest.fn() },
    },
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'
import { handleCharacterMoved } from './handleCharacterMoved'
import { persistRoomStackNavigate } from './roomStack/persistRoomStackNavigate'
import type { RoomStackItem } from './roomStack/types'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#Dockside' as EphemeraRoomId
const BEAT_ANCHOR_TIME = 1_700_000_000_000

const characterMeta: CharacterMetaItem = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    HomeId: FROM_ROOM,
    assets: ['overlay'],
}

const navigateFact: CharacterMovedPublishedPayload = {
    type: 'Character Moved',
    characterId: CHARACTER_ID,
    froms: [FROM_ROOM],
    to: TO_ROOM,
    beatAnchorTime: BEAT_ANCHOR_TIME,
}

const cacheDeps = {
    getCharacterMeta: jest.fn(async () => characterMeta),
    getRoomAssets: jest.fn(async () => ['ASSET#overlay']),
    getCanonAssets: jest.fn(async () => ['primitives']),
}

describe('handleCharacterMoved', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('persists the navigate ladder at the fact beatAnchorTime with cache-read assets', async () => {
        const persist = jest.fn().mockResolvedValue(undefined)

        await handleCharacterMoved(navigateFact, { ...cacheDeps, persist })

        expect(cacheDeps.getRoomAssets).toHaveBeenCalledWith(TO_ROOM)
        expect(persist).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            characterAssets: ['overlay'],
            roomAssets: ['ASSET#overlay'],
            canonAssets: ['primitives'],
        })
    })

    it('does not write the ladder when the character leaves play (to: null)', async () => {
        const persist = jest.fn()

        await handleCharacterMoved({ ...navigateFact, to: null }, { ...cacheDeps, persist })

        expect(persist).not.toHaveBeenCalled()
        expect(cacheDeps.getCharacterMeta).not.toHaveBeenCalled()
    })

    it('logs and does not throw when the persist rejects', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const persist = jest.fn().mockRejectedValue(new Error('persist boom'))

        await expect(handleCharacterMoved(navigateFact, { ...cacheDeps, persist })).resolves.toBeUndefined()

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[mtw.ephemera.characters]'))
        consoleSpy.mockRestore()
    })

    it('logs and does not throw when a cache read fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const persist = jest.fn()

        await expect(handleCharacterMoved(navigateFact, {
            ...cacheDeps,
            getRoomAssets: jest.fn().mockRejectedValue(new Error('cache boom')),
            persist,
        })).resolves.toBeUndefined()

        expect(persist).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('cache boom'))
        consoleSpy.mockRestore()
    })

    it('duplicate delivery of the same fact leaves the same ladder', async () => {
        let stored: { RoomStack: RoomStackItem[] } = { RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] }
        const optimisticUpdate = jest.fn(async ({ updateReducer }) => {
            stored = produce(stored, updateReducer)
            return stored
        }) as any
        const persist: typeof persistRoomStackNavigate = (args) => persistRoomStackNavigate(args, { optimisticUpdate })

        await handleCharacterMoved(navigateFact, { ...cacheDeps, persist })
        const afterFirst = stored.RoomStack
        await handleCharacterMoved(navigateFact, { ...cacheDeps, persist })

        expect(afterFirst).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX', timeWritten: BEAT_ANCHOR_TIME },
            { asset: 'overlay', RoomId: 'Dockside', timeWritten: BEAT_ANCHOR_TIME },
        ])
        expect(stored.RoomStack).toEqual(afterFirst)
    })
})
