import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { findRelationalChain } from './findRelationalChain'

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

    it("finds PV1-0's own readout chain: string in room, cup on table, one crossing port on the table (interior) side", () => {
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
