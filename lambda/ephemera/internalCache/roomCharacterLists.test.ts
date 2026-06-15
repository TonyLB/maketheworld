import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionRoomRosterEntry } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import CacheRoomCharacterListsData from './roomCharacterLists'

const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('CacheRoomCharacterListsData', () => {
    const rosterEntry: PlayPositionRoomRosterEntry = {
        EphemeraId: CHARACTER_ID,
        DisplayName: 'Alpha',
        SessionIds: ['sess-1'],
        Color: 'blue',
        fileURL: 'https://example.com/alpha.png',
    }

    it('delegates get to injected getRoomRoster and maps entries', async () => {
        const getRoomRoster = jest.fn().mockResolvedValue([rosterEntry])
        const cache = new CacheRoomCharacterListsData(getRoomRoster)

        await expect(cache.get(ROOM_ID)).resolves.toEqual([{
            EphemeraId: CHARACTER_ID,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
            Color: 'blue',
            fileURL: 'https://example.com/alpha.png',
        }])
        expect(getRoomRoster).toHaveBeenCalledTimes(1)
        expect(getRoomRoster).toHaveBeenCalledWith(ROOM_ID)
    })

    it('memoizes get results per room', async () => {
        const getRoomRoster = jest.fn().mockResolvedValue([rosterEntry])
        const cache = new CacheRoomCharacterListsData(getRoomRoster)

        await cache.get(ROOM_ID)
        await cache.get(ROOM_ID)

        expect(getRoomRoster).toHaveBeenCalledTimes(1)
    })

    it('set bypasses getRoomRoster on subsequent get', async () => {
        const getRoomRoster = jest.fn().mockResolvedValue([rosterEntry])
        const cache = new CacheRoomCharacterListsData(getRoomRoster)
        const memoed = [{
            EphemeraId: CHARACTER_ID,
            DisplayName: 'Memo',
            SessionIds: ['sess-2'],
        }]

        cache.set({ key: ROOM_ID, value: memoed })

        await expect(cache.get(ROOM_ID)).resolves.toEqual(memoed)
        expect(getRoomRoster).not.toHaveBeenCalled()
    })

    it('invalidate forces a fresh getRoomRoster read', async () => {
        const getRoomRoster = jest.fn().mockResolvedValue([rosterEntry])
        const cache = new CacheRoomCharacterListsData(getRoomRoster)

        await cache.get(ROOM_ID)
        cache.invalidate(ROOM_ID)
        await cache.get(ROOM_ID)

        expect(getRoomRoster).toHaveBeenCalledTimes(2)
    })
})
