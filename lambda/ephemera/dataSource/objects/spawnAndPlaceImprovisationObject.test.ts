jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getPositionGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
            invalidate: jest.fn(),
        },
        ImprovisationComponentData: { set: jest.fn() },
        ObjectEphemeraMeta: { set: jest.fn() },
    },
}))

jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../internalCache'
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

describe('spawnAndPlaceImprovisationObject', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it('transacts pair, meta, graph, and adjacency in one bundle', async () => {
        const result = await spawnAndPlaceImprovisationObject(
            {
                objectId: OBJECT_ID,
                shortName: 'Skates',
                stableKey: 'skates',
                targetRoomId: ROOM_ID,
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(4)
        expect(items[0].Put).toEqual(expect.objectContaining({
            EphemeraId: OBJECT_ID,
            DataCategory: IMPROVISATION_ASSET_ID,
            shortName: 'Skates',
        }))
        expect(items[1].Put).toEqual(expect.objectContaining({
            EphemeraId: OBJECT_ID,
            DataCategory: 'Meta::Object',
            stableKey: 'skates',
        }))
        expect(items[2].Update.Key.EphemeraId).toBe(ROOM_ID)
        expect(items[3].Put).toEqual({
            EphemeraId: OBJECT_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_ID),
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            streamKey: OBJECT_ID,
            header: { type: 'Object Moved' },
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [],
                to: ROOM_ID,
            }),
        }))
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith(ROOM_ID)
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [ROOM_ID],
        })
    })
})
