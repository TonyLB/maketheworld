import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../ludicGraph'
import { fetchRelationalReachability, findRelationalChainsTouching } from './findRelationalChainsForRemoval'

const ROOM_ID = 'ROOM#Vortex' as EphemeraRoomId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const STRING_ID = 'OBJECT#String' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const BROOM_ID = 'OBJECT#Broom' as EphemeraObjectId
const HOOK_ID = 'OBJECT#Hook' as EphemeraObjectId

describe('fetchRelationalReachability', () => {
    it("fetches a removal-set member's own container graph and its own owned graph", async () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TABLE_ID)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addObject(CUP_ID)
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => {
            if (hostId === ROOM_ID) return roomGraph
            if (hostId === TABLE_ID) return tableGraph
            return EphemeraLudicGraph.empty(hostId)
        })
        const getMembershipContainers = jest.fn(async (id: EphemeraObjectId | EphemeraCharacterId) => (id === TABLE_ID ? [ROOM_ID] : []))

        const result = await fetchRelationalReachability(new Set([TABLE_ID]), getMembershipContainers, getGraph)

        expect(result.get(ROOM_ID)).toBe(roomGraph)
        expect(result.get(TABLE_ID)).toBe(tableGraph)
    })

    it('follows a port address terminal found in a fetched graph to the port-owning graph', async () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' })
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
            .addObject(CUP_ID)
            .addPort(port)
            .addRelationalEdge({ from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => {
            if (hostId === ROOM_ID) return roomGraph
            if (hostId === TABLE_ID) return tableGraph
            return EphemeraLudicGraph.empty(hostId)
        })
        const getMembershipContainers = jest.fn(async (id: EphemeraObjectId | EphemeraCharacterId) => (id === STRING_ID ? [ROOM_ID] : []))

        // Seeded from `string`, whose own container is the room --- table is only discoverable by
        // following the port-address terminal on the room's own edge, not by membership at all.
        const result = await fetchRelationalReachability(new Set([STRING_ID]), getMembershipContainers, getGraph)

        expect(result.has(TABLE_ID)).toBe(true)
    })

    it('follows a port record\'s fromHostId to the exterior graph, discovering it from the interior side', async () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' })
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
            .addObject(CUP_ID)
            .addPort(port)
            .addRelationalEdge({ from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => {
            if (hostId === ROOM_ID) return roomGraph
            if (hostId === TABLE_ID) return tableGraph
            return EphemeraLudicGraph.empty(hostId)
        })

        // Seeded from `cup`, whose own owned-graph lookup is irrelevant --- cup is a plain member
        // of table's graph, reached via `getMembershipContainers`. From table's graph, the port's
        // own `fromHostId` (the room) must be discovered even though nothing in table's own graph
        // is a port-address terminal pointing at the room directly.
        const getMembershipContainers = jest.fn(async (id: EphemeraObjectId | EphemeraCharacterId) => (id === CUP_ID ? [TABLE_ID] : []))
        const result = await fetchRelationalReachability(new Set([CUP_ID]), getMembershipContainers, getGraph)

        expect(result.has(ROOM_ID)).toBe(true)
    })
})

describe('findRelationalChainsTouching', () => {
    it('finds a portless edge touching a removal-set member', () => {
        const edge = { from: BROOM_ID, to: HOOK_ID, kind: 'Under' as const }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(BROOM_ID).addObject(HOOK_ID).addRelationalEdge(edge)

        const chains = findRelationalChainsTouching(new Set([BROOM_ID]), new Map([[ROOM_ID, roomGraph]]))

        expect(chains).toEqual([[{ type: 'edge', hostId: ROOM_ID, edge }]])
    })

    it('finds the full crossing chain regardless of which side is in the removal set, and dedupes when both sides are', () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const exteriorEdge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const interiorEdge = { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addObject(TABLE_ID).addRelationalEdge(exteriorEdge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addObject(CUP_ID).addPort(port).addRelationalEdge(interiorEdge)
        const graphs = new Map([[ROOM_ID, roomGraph], [TABLE_ID, tableGraph]])

        const fromCup = findRelationalChainsTouching(new Set([CUP_ID]), graphs)
        expect(fromCup).toHaveLength(1)
        expect(fromCup[0]).toEqual([
            { type: 'edge', hostId: ROOM_ID, edge: exteriorEdge },
            { type: 'port', hostId: TABLE_ID, port },
            { type: 'edge', hostId: TABLE_ID, edge: interiorEdge },
        ])

        // Both string and cup in the removal set at once --- the same chain is reachable from
        // either end, and must be reported exactly once, not twice.
        const fromBoth = findRelationalChainsTouching(new Set([STRING_ID, CUP_ID]), graphs)
        expect(fromBoth).toHaveLength(1)
    })

    it('ignores an edge that touches no removal-set member', () => {
        const edge = { from: BROOM_ID, to: HOOK_ID, kind: 'Under' as const }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(BROOM_ID).addObject(HOOK_ID).addRelationalEdge(edge)

        const chains = findRelationalChainsTouching(new Set([STRING_ID]), new Map([[ROOM_ID, roomGraph]]))

        expect(chains).toEqual([])
    })
})
