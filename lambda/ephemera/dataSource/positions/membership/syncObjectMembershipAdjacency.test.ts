jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: { transactWrite: jest.fn() },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../../internalCache'
import { syncObjectMembershipAdjacencyToRoom } from './syncObjectMembershipAdjacency'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_A = 'ROOM#A' as EphemeraRoomId
const ROOM_B = 'ROOM#B' as EphemeraRoomId

describe('syncObjectMembershipAdjacencyToRoom', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const getMembershipContainers = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it('returns synced false when adjacency already matches room', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        const result = await syncObjectMembershipAdjacencyToRoom(
            { objectId: OBJECT_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({ synced: false })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('puts adjacency row when index lags graph', async () => {
        getMembershipContainers.mockResolvedValue([])

        const result = await syncObjectMembershipAdjacencyToRoom(
            { objectId: OBJECT_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({ synced: true })
        expect(transactWrite).toHaveBeenCalledWith([{
            Put: {
                EphemeraId: OBJECT_ID,
                DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
            },
        }])
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [ROOM_A],
        })
    })

    it('deletes stale adjacency rows when normalizing to one room', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_B])

        await syncObjectMembershipAdjacencyToRoom(
            { objectId: OBJECT_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(transactWrite).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: OBJECT_ID,
                    DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
                },
            },
            {
                Delete: {
                    EphemeraId: OBJECT_ID,
                    DataCategory: buildPositionAdjacencyDataCategory(ROOM_B),
                },
            },
        ])
    })
})
