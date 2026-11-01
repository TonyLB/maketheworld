import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { expandSameHost } from './expandSameHost'
import { lowerRelationalChain } from './buildCrossingLegs'
import { relationsCacheOfGraphs } from '../../../objectCatalogTestSupport'

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

    it('errors rather than crossing on ConnectedTo --- topology is written by extend, with no sameHost branch on this route', () => {
        const result = expandAndLower({ subjectId: TRAY_ID, objectId: TABLE_ID, relationKind: 'ConnectedTo', operationKind: 'establishRelation' })

        expect(result.verdict).toBe('error')
        if (result.verdict !== 'error') return
        expect(result.reason).toEqual(expect.stringContaining('ConnectedTo'))
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

    // A duplicate establish is refused, not re-built: the graph patch would be idempotent for
    // a same-host edge, but the attempt would still narrate a relation that did not newly form;
    // and a crossing's legs carry freshly minted port ids, so a second one would commit a
    // parallel chain (and a later dissolve would find two).
    describe('establishRelation when the relation already holds', () => {
        const containers = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] => {
            if (id === NECKLACE_ID || id === TABLE_ID) return [ROOM_ID]
            if (id === CHARM_ID) return [TABLE_ID]
            return []
        }
        const crossingShards = () => {
            const port: EphemeraCrossingPort = { portId: 'PORT-port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
            return {
                [ROOM_ID]: EphemeraLudicGraph.empty(ROOM_ID)
                    .addObject(NECKLACE_ID, 'In')
                    .addObject(TABLE_ID, 'In')
                    .addRelationalEdge({ from: NECKLACE_ID, to: { owner: TABLE_ID, port: 'PORT-port-1' }, kind: 'Custom', relationLabel: 'to' }),
                [TABLE_ID]: EphemeraLudicGraph.empty(TABLE_ID)
                    .addObject(CHARM_ID, 'In')
                    .addPort(port)
                    .addRelationalEdge({ from: { owner: TABLE_ID, port: 'PORT-port-1' }, to: CHARM_ID, kind: 'Custom', relationLabel: 'to' }),
            } as Record<string, EphemeraLudicGraph>
        }
        const envOver = (graphs: Record<string, EphemeraLudicGraph>) => ({
            getMembershipContainers: containers,
            getGraph: (hostId: EphemeraMembershipHostId) => graphs[hostId],
            getCurrentHost: (id: EphemeraObjectId) => containers(id)[0],
        })

        it('errors on a same-host duplicate', () => {
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(NECKLACE_ID, 'In')
                .addObject(TABLE_ID, 'In')
                .addRelationalEdge({ from: NECKLACE_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'under' })

            const result = expandSameHost(
                { subjectId: NECKLACE_ID, objectId: TABLE_ID, relationKind: 'Custom', relationLabel: 'under', operationKind: 'establishRelation' },
                envOver({ [ROOM_ID]: roomGraph })
            )

            expect(result).toEqual({ verdict: 'error', reason: expect.stringContaining('is already present') })
        })

        it('errors on a duplicate crossing', () => {
            const result = expandSameHost(
                { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', relationLabel: 'to', operationKind: 'establishRelation' },
                envOver(crossingShards())
            )

            expect(result).toEqual({ verdict: 'error', reason: expect.stringContaining('is already present') })
        })

        it('still builds a crossing under a different label', () => {
            const result = expandAndLower(
                { subjectId: NECKLACE_ID, objectId: CHARM_ID, relationKind: 'Custom', relationLabel: 'around', operationKind: 'establishRelation' },
                envOver(crossingShards())
            )

            expect(result.verdict).toBe('crossed')
        })
    })

    describe('dissolveRelation', () => {
        it('a portless dissolve (both endpoints already share a host) resolves to the same single dissolveRelation step as before --- no regression from routing away from findShardBoundary', () => {
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(TRAY_ID, 'In')
                .addObject(TABLE_ID, 'In')
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
            const port: EphemeraCrossingPort = { portId: 'PORT-port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
                .addObject(NECKLACE_ID, 'In')
                .addObject(TABLE_ID, 'In')
                .addRelationalEdge({ from: NECKLACE_ID, to: { owner: TABLE_ID, port: 'PORT-port-1' }, kind: 'Custom', relationLabel: 'to' })
            const tableGraph = EphemeraLudicGraph.empty(TABLE_ID)
                .addObject(CHARM_ID, 'In')
                .addPort(port)
                .addRelationalEdge({ from: { owner: TABLE_ID, port: 'PORT-port-1' }, to: CHARM_ID, kind: 'Custom', relationLabel: 'to' })

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
                        targetId: { owner: TABLE_ID, port: 'PORT-port-1' },
                        hostId: ROOM_ID,
                        relationKind: 'Custom',
                        relationLabel: 'to',
                    },
                    { kind: 'removeCrossingPort', hostId: TABLE_ID, portId: 'PORT-port-1' },
                    {
                        kind: 'dissolveRelation',
                        subjectId: { owner: TABLE_ID, port: 'PORT-port-1' },
                        targetId: CHARM_ID,
                        hostId: TABLE_ID,
                        relationKind: 'Custom',
                        relationLabel: 'to',
                    },
                ],
            })
        })

        it('defers to the LLM validator (BD-10) when no matching chain is found to dissolve', () => {
            const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID, 'In').addObject(TABLE_ID, 'In')

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
                .addObject(TRAY_ID, 'In')
                .addObject(TABLE_ID, 'In')
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

describe('expandSameHost: planning asks the actor\'s cache', () => {
    const STRING_ID = 'OBJECT#String' as EphemeraObjectId
    const HOOK_ID = 'OBJECT#Hook' as EphemeraObjectId
    const WALL_ID = 'OBJECT#Wall' as EphemeraObjectId
    const portAddress = { owner: WALL_ID, port: 'PORT-wall' as const }
    const port: EphemeraCrossingPort = { portId: 'PORT-wall', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'is tied to' }
    // The string in the room is tied, through a port on the wall, to a hook the wall holds.
    const roomGraph = EphemeraLudicGraph.empty(ROOM_ID)
        .addObject(STRING_ID, 'In')
        .addObject(WALL_ID, 'In')
        .addRelationalEdge({ from: STRING_ID, to: portAddress, kind: 'Custom', relationLabel: 'is tied to' })
    const wallGraph = EphemeraLudicGraph.empty(WALL_ID)
        .addObject(HOOK_ID, 'In')
        .addPort(port)
        .addRelationalEdge({ from: portAddress, to: HOOK_ID, kind: 'Custom', relationLabel: 'is tied to' })
    const graphs: Record<string, EphemeraLudicGraph> = { [ROOM_ID]: roomGraph, [WALL_ID]: wallGraph }
    const dissolve = { subjectId: STRING_ID, objectId: HOOK_ID, relationKind: 'Custom' as const, relationLabel: 'is tied to', operationKind: 'dissolveRelation' as const }
    // Neither the subject's nor the target's host is known: a graph walk would find nothing, so a hit is the cache's.
    const noHosts = { getCurrentHost: () => undefined, getMembershipContainers: () => [] }

    it('finds a joined crossing as its one edge, reading no graph', () => {
        const getGraph = jest.fn((hostId: EphemeraMembershipHostId) => graphs[hostId])

        const result = expandSameHost(dissolve, { ...noHosts, getGraph, relations: relationsCacheOfGraphs([roomGraph, wallGraph]) })

        expect(result).toEqual({ verdict: 'found', edge: { from: STRING_ID, to: HOOK_ID, kind: 'Custom', relationLabel: 'is tied to' } })
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('follows an open leg through its own legs (the bounded read) to the far end', () => {
        const result = expandSameHost(dissolve, { ...noHosts, getGraph: (hostId) => graphs[hostId], relations: relationsCacheOfGraphs([roomGraph]) })

        expect(result.verdict).toBe('crossed')
        expect(result.verdict === 'crossed' && result.chain.filter((step) => step.type === 'edge').map((step) => step.type === 'edge' && step.hostId)).toEqual([ROOM_ID, WALL_ID])
    })

    it('defers when the cache holds no such relation, or the open leg cannot be walked', () => {
        const noRelation = expandSameHost({ ...dissolve, relationLabel: 'is glued to' }, { ...noHosts, getGraph: (hostId) => graphs[hostId], relations: relationsCacheOfGraphs([roomGraph, wallGraph]) })
        const unwalkable = expandSameHost(dissolve, { ...noHosts, getGraph: () => undefined, relations: relationsCacheOfGraphs([roomGraph]) })

        expect(noRelation.verdict).toBe('defer')
        expect(unwalkable.verdict).toBe('defer')
    })

    it('defers when two chains carry the relation: ambiguous, as the graph walk is', () => {
        const twice = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(STRING_ID, 'In')
            .addObject(HOOK_ID, 'In')
            .addRelationalEdge({ from: STRING_ID, to: HOOK_ID, kind: 'Custom', relationLabel: 'is tied to', chainId: 'c1' })
            .addRelationalEdge({ from: HOOK_ID, to: STRING_ID, kind: 'Custom', relationLabel: 'is tied to', chainId: 'c2' })

        expect(expandSameHost(dissolve, { ...noHosts, relations: relationsCacheOfGraphs([twice]) }).verdict).toBe('defer')
    })

    it('refuses to establish a relation the cache already holds', () => {
        const result = expandSameHost(
            { ...dissolve, operationKind: 'establishRelation' },
            { ...noHosts, relations: relationsCacheOfGraphs([roomGraph, wallGraph]) }
        )

        expect(result).toEqual(expect.objectContaining({ verdict: 'error', reason: expect.stringContaining('already present') }))
    })
})
