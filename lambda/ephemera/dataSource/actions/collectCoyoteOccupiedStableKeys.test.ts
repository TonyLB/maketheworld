import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { collectCoyoteOccupiedStableKeys } from './collectCoyoteOccupiedStableKeys'

describe('collectCoyoteOccupiedStableKeys', () => {
    it('dedupes stableKeys across rooms and skips legacy rows', async () => {
        const metaByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoom>> = {
            'ROOM#A': {
                EphemeraId: 'ROOM#A',
                DataCategory: 'Meta::Room',
                objects: [
                    { uuid: 'OBJECT#1' as `OBJECT#${string}`, shortName: 'x', stableKey: 'rocket' },
                    { uuid: 'OBJECT#2' as `OBJECT#${string}`, shortName: 'y', stableKey: '  rocket  ' },
                    { uuid: 'OBJECT#3' as `OBJECT#${string}`, shortName: 'legacy' },
                ],
            },
            'ROOM#B': {
                EphemeraId: 'ROOM#B',
                DataCategory: 'Meta::Room',
                objects: [
                    { uuid: 'OBJECT#4' as `OBJECT#${string}`, shortName: 'z', stableKey: 'anvil' },
                ],
            },
        }

        const occupied = await collectCoyoteOccupiedStableKeys({
            getGameRooms: async () => ['A', 'B'],
            getRoomMeta: async (roomId) => metaByRoom[roomId],
        })

        expect([...occupied].sort()).toEqual(['anvil', 'rocket'])
    })

    it('returns empty set when no objects have stableKey', async () => {
        const occupied = await collectCoyoteOccupiedStableKeys({
            getGameRooms: async () => ['X'],
            getRoomMeta: async () => ({
                EphemeraId: 'ROOM#X',
                DataCategory: 'Meta::Room',
                objects: [{ uuid: 'OBJECT#1' as `OBJECT#${string}`, shortName: 'only' }],
            }),
        })
        expect(occupied.size).toBe(0)
    })
})
