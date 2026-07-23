import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => { await fn() }),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
            getPositionGraph: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'
import { executeObjectDrop } from './executeObjectDrop'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

const wireTransactWrite = (graphsByHost: Record<string, EphemeraPositionGraph>) => {
    (ephemeraDB.transactWrite as jest.Mock).mockImplementation(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = graphsByHost[key.EphemeraId]
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                positionGraph: graph.toStored(),
            }
        })
        multiKeyItem.reducer(draft)
    })
}

describe('executeObjectDrop', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('re-derives the carry closure fresh and commits via the general kernel', async () => {
        const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === ROOM_ID ? emptyRoomGraph : characterGraph
        )
        wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph })

        await executeObjectDrop({
            characterId: CHARACTER_ID,
            objectIds: [TRAY_ID],
            roomId: ROOM_ID,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(ephemeraDB.transactWrite).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
        }))
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: TRAY_ID,
            containers: [ROOM_ID],
        })
    })

    it('BD-28: dropping the tray severs tray-table (tray stays boundary-clean, table stays held) and streams the fact', async () => {
        const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })
        const characterGraph = testPositionGraph(CHARACTER_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [
                // tray On table: tray is the subject (`from`) role --- dropping the tray alone
                // dissolves this boundary edge rather than carrying the table along.
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
            ],
        })
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === ROOM_ID ? emptyRoomGraph : characterGraph
        )
        wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph })

        await executeObjectDrop({
            characterId: CHARACTER_ID,
            objectIds: [TRAY_ID],
            roomId: ROOM_ID,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                type: 'Object Relation Changed',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
            }),
        }))
    })

    it('no-ops when objectIds is empty', async () => {
        await executeObjectDrop({
            characterId: CHARACTER_ID,
            objectIds: [],
            roomId: ROOM_ID,
            messageBus: messageBus as any,
            streamEvent,
        })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
    })
})
