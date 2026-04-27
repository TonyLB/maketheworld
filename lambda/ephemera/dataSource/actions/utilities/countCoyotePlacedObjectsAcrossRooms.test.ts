import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { countCoyotePlacedObjectsAcrossRooms } from './countCoyotePlacedObjectsAcrossRooms'

describe('countCoyotePlacedObjectsAcrossRooms', () => {
    it('sums Meta::Room.objects row counts across rooms (placement rows, not stableKey occupancy)', async () => {
        const metaByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoom>> = {
            'ROOM#A': {
                EphemeraId: 'ROOM#A',
                DataCategory: 'Meta::Room',
                objects: [
                    { uuid: 'OBJECT#1' as `OBJECT#${string}`, shortName: 'x', stableKey: 'rocket' },
                    { uuid: 'OBJECT#2' as `OBJECT#${string}`, shortName: 'y', stableKey: 'legacy-crate' },
                    // Legacy row with no stableKey still occupies a placement slot (contrast: collectCoyoteOccupiedStableKeys skips these for occupancy sets).
                    { uuid: 'OBJECT#3' as `OBJECT#${string}`, shortName: 'legacy' } as unknown as EphemeraMetaRoomObject,
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

        const total = await countCoyotePlacedObjectsAcrossRooms({
            getGameRooms: async () => ['A', 'B'],
            getRoomMeta: async (roomId) => metaByRoom[roomId],
        })

        expect(total).toBe(4)
    })

    it('counts objects missing stableKey toward total', async () => {
        const total = await countCoyotePlacedObjectsAcrossRooms({
            getGameRooms: async () => ['X'],
            getRoomMeta: async () => ({
                EphemeraId: 'ROOM#X',
                DataCategory: 'Meta::Room',
                objects: [{ uuid: 'OBJECT#1' as `OBJECT#${string}`, shortName: 'only' }],
            }) as unknown as EphemeraMetaRoom,
        })
        expect(total).toBe(1)
    })

    it('treats missing meta or objects as zero', async () => {
        const metaByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoom>> = {
            'ROOM#Y': {
                EphemeraId: 'ROOM#Y',
                DataCategory: 'Meta::Room',
                objects: [],
            },
        }

        const total = await countCoyotePlacedObjectsAcrossRooms({
            getGameRooms: async () => ['Y', 'Z'],
            getRoomMeta: async (roomId) => metaByRoom[roomId],
        })

        expect(total).toBe(0)
    })
})
