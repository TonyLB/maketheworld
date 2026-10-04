import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { graphNodeRef } from '../plan/planStep'
import type { DissolveRelationChange, GroundedReferent } from '../plan/planStep'
import { runExecutor, seedFromGroundedSteps } from './executor'
import type { ExpansionEnvironment, WorklistInstruction } from './executorTypes'

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const SAUCER_ID = 'OBJECT#Saucer' as EphemeraObjectId
const WEIRD_ID = 'OBJECT#Weird' as EphemeraObjectId

describe('runExecutor', () => {
    // The former "BD-13: carries a connected object..." test is retired 2026-08-22 (Channel D,
    // CD2, reduced scope): its whole point was `On`'s carry absorption (cup On tray pulling cup
    // into the transfer set), which is now dead -- `On` joined `In`/`PartOf`'s hosting-kind
    // throw, and `carry` is unreachable from any relation kind. Real shard-based hosting (CD2h)
    // is what would eventually carry the cup along again, by construction.

    it('a relational pair that already shares a host retires as a one-leg chain, from the Change alone', () => {
        // `satisfied` (deleted 2026-09-01) used to retire a matching sameHost assertion with no
        // children, relying on a sibling establishRelation instruction (seeded alongside it) to
        // retire unmodified as the actual edge. That sibling is gone --- an endpoint is its own
        // zero-hop ancestor, so `findShardBoundary`/`buildCrossingLegs` resolve an
        // already-shared host to a single portless leg, which is now the *only* source of the
        // establishRelation step. The grounded `Change` itself seeds directly: it
        // carries no host, and command-expansion dispatches on its primitive to find the chain,
        // which retires as one output, still a value.
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(SAUCER_ID).addObject(CUP_ID)

        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            getCurrentHost: (id) => ((id === SAUCER_ID || id === CUP_ID) ? ROOM_ID : undefined),
            getMembershipContainers: (id) => ((id === SAUCER_ID || id === CUP_ID) ? [ROOM_ID] : []),
        }

        const seed: WorklistInstruction[] = [
            {
                id: 'relation',
                step: {
                    kind: 'change',
                    primitive: 'establishRelation',
                    subject: graphNodeRef(SAUCER_ID),
                    target: graphNodeRef(CUP_ID),
                    relationKind: 'Under',
                },
            },
        ]

        const result = runExecutor(seed, env)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [{
                kind: 'relationalChain',
                operationKind: 'establishRelation',
                steps: [{ type: 'edge', hostId: ROOM_ID, edge: { from: SAUCER_ID, to: CUP_ID, kind: 'Under' } }],
            }],
        })
    })

    it("a relational Change that crosses a shard boundary retires as one chain: the port and both legs, in order", () => {
        const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(ROPE_ID).addObject(TABLE_ID)

        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            getCurrentHost: (id) => (id === ROPE_ID ? ROOM_ID : TABLE_ID),
            getMembershipContainers: (id) => {
                if (id === ROPE_ID) return [ROOM_ID]
                if (id === CUP_ID) return [TABLE_ID]
                if (id === TABLE_ID) return [ROOM_ID]
                return []
            },
        }

        // Only the grounded Change is seeded --- there is no sibling establishRelation
        // instruction at all any more (the seed is collapsed). A direct rope->cup edge is
        // never valid once the relation crosses a boundary (they never come to share a host), so
        // the crossing legs below are the Change's own chain, same as the one-leg same-host case
        // above. The port rides inside the chain: no side channel.
        const seed: WorklistInstruction[] = [
            {
                id: 'relation',
                step: {
                    kind: 'change',
                    primitive: 'establishRelation',
                    subject: graphNodeRef(ROPE_ID),
                    target: graphNodeRef(CUP_ID),
                    relationKind: 'Custom',
                    relationLabel: 'to',
                },
            },
        ]

        const result = runExecutor(seed, env)

        expect(result.verdict).toBe('legal')
        if (result.verdict !== 'legal') return
        expect(result.steps).toEqual([{
            kind: 'relationalChain',
            operationKind: 'establishRelation',
            steps: [
                { type: 'port', hostId: TABLE_ID, port: expect.objectContaining({ fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }) },
                {
                    type: 'edge',
                    hostId: TABLE_ID,
                    edge: { from: expect.objectContaining({ owner: TABLE_ID }), to: CUP_ID, kind: 'Custom', relationLabel: 'to' },
                },
                {
                    type: 'edge',
                    hostId: ROOM_ID,
                    edge: { from: ROPE_ID, to: expect.objectContaining({ owner: TABLE_ID }), kind: 'Custom', relationLabel: 'to' },
                },
            ],
        }])
    })

    // The former "errors if a carry-classified edge survives to command-expansion time" test is
    // retired 2026-08-22 (Channel D, CD2, reduced scope): the guard it exercised only fires for
    // a 'carry' outcome surviving unexpectedly, and `carry` is now unreachable from any relation
    // kind -- `On` (its only producer) joined `In`/`PartOf`'s hosting-kind throw. Reaching this
    // scenario today throws AB-54's invariant error instead, at `boundaryEdgeOutcomes` itself.

    it('runs a fully-grounded seed', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID)
        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? graph : undefined),
            getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined),
            getMembershipContainers: () => [],
        }

        const seed: WorklistInstruction[] = [
            { id: 'transfer', step: { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID } },
        ]

        const result = runExecutor(seed, env)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
            ],
        })
    })
})

describe('seedFromGroundedSteps', () => {
    it('seeds a fully grounded relational Change as-is, for command-expansion to find its chain', () => {
        const dissolve: DissolveRelationChange<GroundedReferent> = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(CUP_ID),
            target: graphNodeRef(SAUCER_ID),
            relationKind: 'Custom',
            relationLabel: 'is glued to',
        }
        const [instruction] = seedFromGroundedSteps([dissolve])

        expect(instruction).toEqual({
            id: expect.any(String),
            step: dissolve,
        })
    })

    it('lowers a grounded transferMembership', () => {
        const [instruction] = seedFromGroundedSteps([{
            kind: 'change',
            primitive: 'transferMembership',
            object: graphNodeRef(TRAY_ID),
            from: graphNodeRef(ROOM_ID),
            to: graphNodeRef(CHARACTER_ID),
        }])

        expect(instruction?.step).toEqual({
            kind: 'transferMembership',
            objectIds: new Set([TRAY_ID]),
            fromHostId: ROOM_ID,
            toHostId: CHARACTER_ID,
        })
    })

    it('admits Object, Feature and Area hosts when lowering a grounded transferMembership (Grounding attaches ids; lowering types them)', () => {
        const NICHE_ID = 'FEATURE#Niche' as EphemeraFeatureId
        const DOWNTOWN_ID = 'AREA#Downtown' as EphemeraAreaId
        const [toFeature, toArea] = seedFromGroundedSteps([
            { kind: 'change', primitive: 'transferMembership', object: graphNodeRef(TRAY_ID), from: graphNodeRef(TABLE_ID), to: graphNodeRef(NICHE_ID) },
            { kind: 'change', primitive: 'transferMembership', object: graphNodeRef(TRAY_ID), from: graphNodeRef(TABLE_ID), to: graphNodeRef(DOWNTOWN_ID) },
        ])

        expect(toFeature?.step).toEqual({ kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: TABLE_ID, toHostId: NICHE_ID })
        expect(toArea?.step).toEqual({ kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: TABLE_ID, toHostId: DOWNTOWN_ID })
    })

    it('throws on an ill-typed grounded id', () => {
        expect(() => seedFromGroundedSteps([{
            kind: 'change',
            primitive: 'transferMembership',
            object: graphNodeRef(ROOM_ID),
            from: graphNodeRef(ROOM_ID),
            to: graphNodeRef(CHARACTER_ID),
        }])).toThrow('ill-typed')
    })
})
