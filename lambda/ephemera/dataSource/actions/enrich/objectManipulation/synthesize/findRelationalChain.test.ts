import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { findRelationalChain, findRelationalChainFromLeg } from './findRelationalChain'

const ROOM_ID = 'ROOM#Vortex' as EphemeraRoomId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const STRING_ID = 'OBJECT#String' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId

const envFrom = (
    graphs: Record<string, EphemeraLudicGraph>,
    currentHosts: Record<string, EphemeraMembershipHostId>
) => ({
    getGraph: (hostId: EphemeraMembershipHostId): EphemeraLudicGraph | undefined => graphs[hostId],
    getCurrentHost: (id: EphemeraObjectId): EphemeraMembershipHostId | undefined => currentHosts[id],
})

describe('findRelationalChain', () => {
    it('is the degenerate zero-hop case: a single portless edge in the subject\'s own current host', () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(CUP_ID)
            .addRelationalEdge({ from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })

        const env = envFrom({ [ROOM_ID]: roomGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({
            verdict: 'found',
            steps: [
                { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' } },
            ],
        })
    })

    it("finds the string-in-room / cup-on-table crossing chain: one crossing port on the table (interior) side", () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' })
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
            .addObject(CUP_ID)
            .addPort(port)
            .addRelationalEdge({ from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })

        const env = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({
            verdict: 'found',
            steps: [
                {
                    type: 'edge',
                    hostId: ROOM_ID,
                    edge: { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' },
                },
                { type: 'port', hostId: TABLE_ID, port },
                {
                    type: 'edge',
                    hostId: TABLE_ID,
                    edge: { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' },
                },
            ],
        })
    })

    it('declines (notFound) when no edge touching the subject matches the relation at all', () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addObject(CUP_ID)
        const env = envFrom({ [ROOM_ID]: roomGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({ verdict: 'notFound' })
    })

    it('declines (notFound) when an edge touches the subject but its kind/label does not match', () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(CUP_ID)
            .addRelationalEdge({ from: STRING_ID, to: CUP_ID, kind: 'Under' })

        const env = envFrom({ [ROOM_ID]: roomGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({ verdict: 'notFound' })
    })

    it('finds the one matching chain and ignores a non-matching edge between the same two endpoints', () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(CUP_ID)
            .addRelationalEdge({ from: STRING_ID, to: CUP_ID, kind: 'Under' })
            .addRelationalEdge({ from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })

        const env = envFrom({ [ROOM_ID]: roomGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({
            verdict: 'found',
            steps: [
                { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' } },
            ],
        })
    })

    it('declines (ambiguous) when two structurally distinct edges both satisfy the same kind/label between subject and target', () => {
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID)
            .addObject(CUP_ID)
            .addRelationalEdge({ from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' })
            .addRelationalEdge({ from: CUP_ID, to: STRING_ID, kind: 'Custom', relationLabel: 'to' })

        const env = envFrom({ [ROOM_ID]: roomGraph }, { [STRING_ID]: ROOM_ID })

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({ verdict: 'ambiguous', chainCount: 2 })
    })

    it('declines (notFound) when the subject has no current host at all', () => {
        const env = envFrom({}, {})

        const result = findRelationalChain(
            { subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            env
        )

        expect(result).toEqual({ verdict: 'notFound' })
    })
})

describe('findRelationalChainFromLeg', () => {
    it('resolves a degenerate portless edge to its own two (already primitive) endpoints', () => {
        const edge = { from: STRING_ID, to: CUP_ID, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addObject(CUP_ID).addRelationalEdge(edge)

        const result = findRelationalChainFromLeg({ hostId: ROOM_ID, edge }, { getGraph: envFrom({ [ROOM_ID]: roomGraph }, {}).getGraph })

        expect(result).toEqual({
            verdict: 'found',
            endpoints: [STRING_ID, CUP_ID],
            steps: [{ type: 'edge', hostId: ROOM_ID, edge }],
        })
    })

    it("resolves the string-in-room / cup-on-table crossing chain seeded from the exterior (room-side) leg", () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const exteriorEdge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const interiorEdge = { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addObject(TABLE_ID).addRelationalEdge(exteriorEdge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addObject(CUP_ID).addPort(port).addRelationalEdge(interiorEdge)
        const { getGraph } = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, {})

        const result = findRelationalChainFromLeg({ hostId: ROOM_ID, edge: exteriorEdge }, { getGraph })

        expect(result).toEqual({
            verdict: 'found',
            endpoints: [STRING_ID, CUP_ID],
            steps: [
                { type: 'edge', hostId: ROOM_ID, edge: exteriorEdge },
                { type: 'port', hostId: TABLE_ID, port },
                { type: 'edge', hostId: TABLE_ID, edge: interiorEdge },
            ],
        })
    })

    it("resolves the same chain seeded from the interior (table-side) leg --- the directional-bug fix, never exercised before this row", () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const exteriorEdge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const interiorEdge = { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addObject(TABLE_ID).addRelationalEdge(exteriorEdge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addObject(CUP_ID).addPort(port).addRelationalEdge(interiorEdge)
        const { getGraph } = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, {})

        // Seeded from the *interior* edge this time --- the old walk would have recursed
        // back into table's own graph looking for the continuing edge and wrongly declined, since
        // the exterior edge lives in the room's graph, not table's.
        const result = findRelationalChainFromLeg({ hostId: TABLE_ID, edge: interiorEdge }, { getGraph })

        // `interiorEdge.from` is the port address (needs the full walk, resolving to String) and
        // `interiorEdge.to` is already primitive (Cup, trivially) --- endpoints/steps therefore
        // come out in the same canonical String->Cup order as the exterior-seeded test above,
        // which is this fixture's own shape, not a general ordering guarantee.
        expect(result).toEqual({
            verdict: 'found',
            endpoints: [STRING_ID, CUP_ID],
            steps: [
                { type: 'edge', hostId: ROOM_ID, edge: exteriorEdge },
                { type: 'port', hostId: TABLE_ID, port },
                { type: 'edge', hostId: TABLE_ID, edge: interiorEdge },
            ],
        })
    })

    it('declines when a port address has no backing crossing-port record', () => {
        const edge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'missing-port' }, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addRelationalEdge(edge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addObject(CUP_ID)
        const { getGraph } = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, {})

        const result = findRelationalChainFromLeg({ hostId: ROOM_ID, edge }, { getGraph })

        expect(result.verdict).toEqual('declined')
    })

    // presenceNodes Slice 3 (PN-4/PN-5): a qualified terminal naming a presence binding resolves
    // to its presence NODE (the binding's own exterior address form, clause 1) rather than
    // declining as "no backing crossing-port record" -- the wrong verdict for the wrong reason,
    // since it isn't dangling, it's in the other collection. Zero further steps: the presence
    // node is the resolved endpoint itself, nothing continues past it. **No port record involved
    // at all as of Slice 7a (PN-14/PN-23)** -- the presence node is looked up directly, so this
    // fixture mints only the node, never a port.
    it("resolves a qualified terminal naming a presence binding to its presence node, rather than declining", () => {
        const presenceNode: EphemeraLudicGraphStructureNode = {
            tag: 'Presence',
            universalKey: 'PRESENCE#presence-1' as EphemeraPresenceNodeId,
            fromHostId: ROOM_ID,
            cover: { tag: 'Full' },
        }
        const edge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'presence-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addRelationalEdge(edge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID).addPresenceNode(presenceNode)
        const { getGraph } = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, {})

        const result = findRelationalChainFromLeg({ hostId: ROOM_ID, edge }, { getGraph })

        expect(result).toEqual({
            verdict: 'found',
            endpoints: [STRING_ID, presenceNode.universalKey],
            steps: [{ type: 'edge', hostId: ROOM_ID, edge }],
        })
    })

    // `'declines when a presence port has no backing presence node (mint-time integrity break)'`
    // deleted at Slice 7a: a presence port record no longer exists to construct that fixture
    // from, so a dangling reference here now falls straight into the ordinary
    // "no backing crossing-port or presence-node record" decline exercised above.
    it('declines when a qualified terminal names neither a presence node nor a crossing-port record', () => {
        const edge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'presence-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(STRING_ID).addRelationalEdge(edge)
        const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
        const { getGraph } = envFrom({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph }, {})

        const result = findRelationalChainFromLeg({ hostId: ROOM_ID, edge }, { getGraph })

        expect(result.verdict).toEqual('declined')
    })
})
