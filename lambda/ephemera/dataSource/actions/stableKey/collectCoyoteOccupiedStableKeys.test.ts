import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { collectCoyoteOccupiedStableKeys } from './collectCoyoteOccupiedStableKeys'

describe('collectCoyoteOccupiedStableKeys', () => {
    it('dedupes stableKeys across rooms from Meta::Object', async () => {
        const metaByObject: Partial<Record<EphemeraObjectId, EphemeraMetaObject>> = {
            'OBJECT#1': { EphemeraId: 'OBJECT#1', DataCategory: 'Meta::Object', stableKey: 'rocket' },
            'OBJECT#2': { EphemeraId: 'OBJECT#2', DataCategory: 'Meta::Object', stableKey: '  rocket  ' },
            'OBJECT#3': { EphemeraId: 'OBJECT#3', DataCategory: 'Meta::Object', stableKey: 'legacy' },
            'OBJECT#4': { EphemeraId: 'OBJECT#4', DataCategory: 'Meta::Object', stableKey: 'anvil' },
        }
        const objectsByRoom: Partial<Record<EphemeraRoomId, EphemeraObjectId[]>> = {
            'ROOM#A': ['OBJECT#1', 'OBJECT#2', 'OBJECT#3'],
            'ROOM#B': ['OBJECT#4'],
        }

        const occupied = await collectCoyoteOccupiedStableKeys({
            getGameRooms: async () => ['A', 'B'],
            getObjectIdsInRoom: async (roomId) => objectsByRoom[roomId] ?? [],
            getObjectMeta: async (objectId) => metaByObject[objectId],
        })

        expect([...occupied].sort()).toEqual(['anvil', 'legacy', 'rocket'])
    })

    it('returns empty set when meta rows omit stableKey', async () => {
        const occupied = await collectCoyoteOccupiedStableKeys({
            getGameRooms: async () => ['X'],
            getObjectIdsInRoom: async () => ['OBJECT#1' as EphemeraObjectId],
            getObjectMeta: async () => ({
                EphemeraId: 'OBJECT#1',
                DataCategory: 'Meta::Object',
                stableKey: '',
            } as EphemeraMetaObject),
        })
        expect(occupied.size).toBe(0)
    })
})
