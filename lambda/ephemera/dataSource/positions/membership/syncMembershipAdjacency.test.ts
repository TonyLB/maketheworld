jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId

describe('syncMembershipAdjacencyToRoom', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const getMembershipContainers = jest.fn()
    const setMembershipContainers = internalCache.Positions.setMembershipContainers as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it('returns synced false without transact when adjacency already matches roomId', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        const result = await syncMembershipAdjacencyToRoom(
            { characterId: CHARACTER_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({ synced: false })
        expect(transactWrite).not.toHaveBeenCalled()
        expect(setMembershipContainers).not.toHaveBeenCalled()
    })

    it('puts target adjacency and deletes orphan host rows', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_B])

        const result = await syncMembershipAdjacencyToRoom(
            { characterId: CHARACTER_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({ synced: true })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(2)
        expect(items[0].Put).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
        expect(items[1].Delete).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_B),
        })
        expect(setMembershipContainers).toHaveBeenCalledWith({
            componentId: CHARACTER_ID,
            containers: [ROOM_A],
        })
    })

    it('puts target adjacency when containers are empty', async () => {
        getMembershipContainers.mockResolvedValue([])

        const result = await syncMembershipAdjacencyToRoom(
            { characterId: CHARACTER_ID, roomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({ synced: true })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(1)
        expect(items[0].Put).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
    })
})
