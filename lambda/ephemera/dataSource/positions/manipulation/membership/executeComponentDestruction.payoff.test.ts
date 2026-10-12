import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { objectNode } from '../../ludicGraph'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { executeComponentDestruction } from './executeComponentDestruction'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: { set: jest.fn(), invalidate: jest.fn(), setMembershipContainers: jest.fn(), getMembershipContainers: jest.fn() },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId

/** Runs the real commit against in-memory rows: the wrapper's reducer sees them, as it would the database's. */
const makeWorld = (graphs: Record<string, EphemeraLudicGraph>) => {
    const rows: Record<string, any> = {}
    Object.entries(graphs).forEach(([hostId, graph]) => {
        const dataCategory = hostId.startsWith('ROOM#') ? 'Meta::Room' : 'Meta::Object'
        rows[hostId] = { EphemeraId: hostId, DataCategory: dataCategory, ludicGraph: graph.toStored() }
    })
    const transactWrite: any = jest.fn(async (items: any[]) => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string }) => {
            draft[key.EphemeraId] = structuredClone(rows[key.EphemeraId])
        })
        multiKeyItem.reducer(draft)
        multiKeyItem.Keys.forEach((key: { EphemeraId: string }) => {
            if (draft[key.EphemeraId]) {
                rows[key.EphemeraId] = draft[key.EphemeraId]
            }
            else {
                delete rows[key.EphemeraId]
            }
        })
    })
    const getGraph = async (hostId: EphemeraMembershipHostId) => {
        const { EphemeraLudicGraph: Graph } = jest.requireActual('../../ludicGraph')
        return Graph.fromFieldPayload(hostId, rows[hostId].ludicGraph)
    }
    return { rows, transactWrite, getGraph }
}

describe('executeComponentDestruction (real commit, in-memory rows)', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('a remove is one transactWrite that deletes the Object\'s row and takes it out of the room', async () => {
        const world = makeWorld({
            [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [objectNode(CUP_ID), presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
            [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [presenceBindingNode('p1', ROOM_ID)] }),
        })

        const result = await executeComponentDestruction({
            objectId: CUP_ID,
            messageBus: messageBus as any,
            streamEvent,
            getMembershipContainers: async () => [ROOM_ID],
            getGraph: world.getGraph,
            transactWrite: world.transactWrite,
        })

        expect(result.ok).toBe(true)
        expect(world.transactWrite).toHaveBeenCalledTimes(1)
        expect(world.rows[CUP_ID]).toBeUndefined()
        expect(world.rows[ROOM_ID]).toBeDefined()
        expect(world.rows[ROOM_ID].ludicGraph.nodes.some((node: { universalKey: string }) => node.universalKey === CUP_ID)).toBe(false)
    })

    describe('a cup on a table', () => {
        const tableWorld = () => makeWorld({
            [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [objectNode(TABLE_ID), presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
            [TABLE_ID]: testLudicGraph(TABLE_ID, { nodes: [objectNode(CUP_ID), presenceBindingNode('pt', ROOM_ID)] }),
            [CUP_ID]: testLudicGraph(CUP_ID, { nodes: [presenceBindingNode('pc', TABLE_ID)] }),
        })
        const containers: Record<string, EphemeraMembershipHostId[]> = { [TABLE_ID]: [ROOM_ID], [CUP_ID]: [TABLE_ID] }
        const destroy = (world: ReturnType<typeof makeWorld>, objectId: EphemeraObjectId) => executeComponentDestruction({
            objectId,
            messageBus: messageBus as any,
            streamEvent,
            getMembershipContainers: async (id) => containers[id] ?? [],
            getGraph: world.getGraph,
            transactWrite: world.transactWrite,
        })

        it('is destroyed before its table', async () => {
            const world = tableWorld()

            expect((await destroy(world, CUP_ID)).ok).toBe(true)
            expect((await destroy(world, TABLE_ID)).ok).toBe(true)

            expect(world.rows[CUP_ID]).toBeUndefined()
            expect(world.rows[TABLE_ID]).toBeUndefined()
        })

        it('a deliberately reversed order fails without deleting the table', async () => {
            const world = tableWorld()
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            const result = await destroy(world, TABLE_ID)

            expect(result).toEqual(expect.objectContaining({ ok: false, errorMessage: expect.stringContaining('still holds') }))
            expect(world.rows[TABLE_ID]).toBeDefined()
            expect(world.rows[CUP_ID]).toBeDefined()
            consoleSpy.mockRestore()
        })
    })
})
