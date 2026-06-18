import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { countCoyotePlacedObjectsAcrossRooms } from './countCoyotePlacedObjectsAcrossRooms'

describe('countCoyotePlacedObjectsAcrossRooms', () => {
    it('sums object counts across game rooms', async () => {
        const objectsByRoom: Partial<Record<EphemeraRoomId, EphemeraObjectId[]>> = {
            'ROOM#A': ['OBJECT#1', 'OBJECT#2', 'OBJECT#3'],
            'ROOM#B': ['OBJECT#4'],
            'ROOM#C': [],
        }

        const total = await countCoyotePlacedObjectsAcrossRooms({
            getGameRooms: async () => ['A', 'B', 'C'],
            getObjectIdsInRoom: async (roomId) => objectsByRoom[roomId] ?? [],
        })

        expect(total).toBe(4)
    })

    it('returns zero when no objects in graphs', async () => {
        const total = await countCoyotePlacedObjectsAcrossRooms({
            getGameRooms: async () => ['X'],
            getObjectIdsInRoom: async () => [],
        })
        expect(total).toBe(0)
    })
})
