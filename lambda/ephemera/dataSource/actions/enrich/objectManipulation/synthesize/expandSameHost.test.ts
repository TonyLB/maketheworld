import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { expandSameHost } from './expandSameHost'
import { lowerRelationalChain } from './buildCrossingLegs'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHARM_ID = 'OBJECT#Charm' as EphemeraObjectId
const NECKLACE_ID = 'OBJECT#Necklace' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

// `expandSameHost` returns the chain as a value; these cases assert its lowered kernel
// steps, exactly as they did before the chain and its lowering were split.
const expandAndLower = (...args: Parameters<typeof expandSameHost>) => {
    const result = expandSameHost(...args)
    return result.verdict === 'crossed'
        ? { verdict: 'crossed' as const, steps: lowerRelationalChain(result.chain, args[0].operationKind) }
        : result
}

describe('expandSameHost', () => {
    it('a peer relation between two objects that already share a host resolves as a crossing with one portless leg', () => {
        // Deletion of the old `satisfied` fast path means this shape now goes through
        // `findShardBoundary`/`buildCrossingLegs` like every other peer-kind candidate --- an
        // endpoint is its own zero-hop ancestor, so a shared host resolves to a
        // single leg with no port minted, not a boundary crossing.
        const getMembershipContainers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === TRAY_ID || id === TABLE_ID) return [ROOM_ID]
            return []
        }

        const result = expandAndLower(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'under', operationKind: 'establishRelation' },
            { getMembershipContainers }
        )

        expect(result).toEqual({
            verdict: 'crossed',
            steps: [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'under' }],
        })
    })

    it('errors rather than crossing on a hosting kind ("put tray on table") --- no branch on this route at all', () => {
        // this shape used to be the motivating case for `repaired` --- move the tray
        // onto the table's host and call the precondition fixed. A hosting relation is a
        // membership move, not a relational placement, so it gets no branch on this route at
        // all now --- not even a state lookup, since hosting kinds fail the peer-kind gate before
        // `findShardBoundary` is ever called. Unreachable live (the ingress lane defers `on` per
        // CD2); asserted so that making it reachable is a deliberate act with a branch built for
        // it, not a silent fall-through into peer-relation machinery.
        const result = expandAndLower({ subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'On', operationKind: 'establishRelation' })

        expect(result.verdict).toBe('error')
        if (result.verdict !== 'error') return
        expect(result.reason).toEqual(expect.stringContaining('On'))
    })

    it('defers on a Custom relation kind when no shared boundary is reachable', () => {
        const result = expandAndLower(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'establishRelation' },
            { getMembershipContainers: () => [] }
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('a violated Custom relation crosses the shard boundary instead of deferring, when one is found', () => {
        const getMembershipContainers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === NECKLACE_ID) return [ROOM_ID]
            if (id === CHARM_ID) return [TABLE_ID]
            if (id === TABLE_ID) return [ROOM_ID]
            return []
        }

        const result = expandAndLower(
            { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'establishRelation' },
            { getMembershipContainers }
        )

        expect(result.verdict).toBe('crossed')
        if (result.verdict !== 'crossed') return
        expect(result.steps).toEqual([
            { kind: 'addCrossingPort', hostId: TABLE_ID, port: expect.objectContaining({ fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }) },
            {
                kind: 'establishRelation',
                subjectId: expect.objectContaining({ owner: TABLE_ID }),
                targetId: CHARM_ID,
                hostId: TABLE_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
            {
                kind: 'establishRelation',
                subjectId: NECKLACE_ID,
                targetId: expect.objectContaining({ owner: TABLE_ID }),
                hostId: ROOM_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
        ])
    })

    it('falls back to defer when no crossing boundary is found (genuinely no shared ancestor)', () => {
        const result = expandAndLower(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'establishRelation' },
            { getMembershipContainers: () => [] }
        )

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('a Custom relation with no relationLabel is malformed input --- errors, and not in the LLM-defer\'s words', () => {
        // The label used to be missing from every live seed, and this shape fell through to the
        // BD-10 defer as though an LLM could resolve it. It cannot: a Custom relation *is* its
        // label, so with none there is no relation to reason about. The two must stay
        // distinguishable in wording: the reason string is what routes the follow-up.
        const unlabelled = expandAndLower(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', operationKind: 'establishRelation' },
            { getMembershipContainers: () => [] }
        )
        const labelled = expandAndLower(
            { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'establishRelation' },
            { getMembershipContainers: () => [] }
        )

        expect(unlabelled.verdict).toBe('error')
        if (unlabelled.verdict !== 'error') return
        expect(labelled.verdict).toBe('defer')
        if (labelled.verdict !== 'defer') return
        expect(unlabelled.reason).toEqual(expect.stringContaining('relationLabel'))
        expect(unlabelled.reason).not.toEqual(labelled.reason)
    })

    it('the malformed-input check precedes every state lookup --- it asks nothing about the world', () => {
        // Asserted rather than left to branch order: with no membership-container data available
        // at all, a label-less Custom still reports the label problem, not a boundary-lookup
        // failure. The guard has to survive the deletion of the host/graph lookups that
        // used to sit below it.
        const result = expandAndLower({ subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', operationKind: 'establishRelation' })

        expect(result.verdict).toBe('error')
        if (result.verdict !== 'error') return
        expect(result.reason).toEqual(expect.stringContaining('relationLabel'))
    })

    describe('dissolveRelation', () => {
        it('a portless dissolve (both endpoints already share a host) resolves to the same single dissolveRelation step as before --- no regression from routing away from findShardBoundary', () => {
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(TRAY_ID)
                .addObject(TABLE_ID)
                .addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'under' })

            const result = expandAndLower(
                { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'under', operationKind: 'dissolveRelation' },
                { getMembershipContainers: () => [], getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined), getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined) }
            )

            expect(result).toEqual({
                verdict: 'crossed',
                steps: [{ kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'under' }],
            })
        })

        it("a genuine crossing dissolve (the string-in-room / cup-on-table crossing chain, reversed) resolves via findRelationalChain", () => {
            const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(NECKLACE_ID)
                .addObject(TABLE_ID)
                .addRelationalEdge({ from: NECKLACE_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' })
            const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
                .addObject(CHARM_ID)
                .addPort(port)
                .addRelationalEdge({ from: { owner: TABLE_ID, port: 'port-1' }, to: CHARM_ID, kind: 'Custom', relationLabel: 'to' })

            const result = expandAndLower(
                { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'dissolveRelation' },
                {
                    getMembershipContainers: () => [],
                    getGraph: (hostId) => ({ [ROOM_ID]: roomGraph, [TABLE_ID]: tableGraph } as Record<string, EphemeraLudicGraph>)[hostId],
                    getCurrentHost: (id) => (id === NECKLACE_ID ? ROOM_ID : undefined),
                }
            )

            expect(result).toEqual({
                verdict: 'crossed',
                steps: [
                    {
                        kind: 'dissolveRelation',
                        subjectId: NECKLACE_ID,
                        targetId: { owner: TABLE_ID, port: 'port-1' },
                        hostId: ROOM_ID,
                        relationKind: 'Custom',
                        relationLabel: 'to',
                    },
                    { kind: 'removeCrossingPort', hostId: TABLE_ID, portId: 'port-1' },
                    {
                        kind: 'dissolveRelation',
                        subjectId: { owner: TABLE_ID, port: 'port-1' },
                        targetId: CHARM_ID,
                        hostId: TABLE_ID,
                        relationKind: 'Custom',
                        relationLabel: 'to',
                    },
                ],
            })
        })

        it('defers to the LLM validator (BD-10) when no matching chain is found to dissolve', () => {
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID).addObject(TABLE_ID)

            const result = expandAndLower(
                { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'under', operationKind: 'dissolveRelation' },
                { getMembershipContainers: () => [], getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined), getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined) }
            )

            expect(result.verdict).toBe('defer')
            if (result.verdict !== 'defer') return
            expect(result.reason).toEqual(expect.stringContaining('BD-10'))
        })

        it('defers rather than picking, when findRelationalChain finds more than one qualifying chain', () => {
            // Two structurally distinct edges both reach targetId from subjectId --- mirrors
            // `findRelationalChain.test.ts`'s own ambiguous fixture.
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(TRAY_ID)
                .addObject(TABLE_ID)
                .addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'under' })
                .addRelationalEdge({ from: TABLE_ID, to: TRAY_ID, kind: 'Custom', relationLabel: 'under' })

            const result = expandAndLower(
                { subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'under', operationKind: 'dissolveRelation' },
                { getMembershipContainers: () => [], getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined), getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined) }
            )

            expect(result.verdict).toBe('defer')
        })

    })
})
