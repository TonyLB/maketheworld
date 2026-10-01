import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { graphNodeRef, objectSpanRef } from '../plan/planStep'
import type { DissolveRelationChange, GroundedReferent } from '../plan/planStep'
import type { GroundingContext } from './groundReferent'
import { runExecutor, seedFromGroundedSteps, seedFromUngroundedSteps } from './executor'
import type { ExpansionEnvironment, WorklistInstruction } from './executorTypes'

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const SAUCER_ID = 'OBJECT#Saucer' as EphemeraObjectId
const WEIRD_ID = 'OBJECT#Weird' as EphemeraObjectId

const emptyGroundingContext: GroundingContext = {
    actingCharacterId: CHARACTER_ID,
    resolvedSpans: new Map(),
    getCurrentHost: () => undefined,
}

describe('runExecutor', () => {
    // The former "BD-13: carries a connected object..." test is retired 2026-08-22 (Channel D,
    // CD2, reduced scope): its whole point was `On`'s carry absorption (cup On tray pulling cup
    // into the transfer set), which is now dead -- `On` joined `In`/`PartOf`'s hosting-kind
    // throw, and `carry` is unreachable from any relation kind. Real shard-based hosting (CD2h)
    // is what would eventually carry the cup along again, by construction.

    it('a sameHost pair that already shares a host retires as a single portless leg, from the assertion alone', () => {
        // `satisfied` (deleted 2026-09-01) used to retire a matching sameHost assertion with no
        // children, relying on a sibling establishRelation instruction (seeded alongside it) to
        // retire unmodified as the actual edge. That sibling is gone --- an endpoint is its own
        // zero-hop ancestor, so `findShardBoundary`/`buildCrossingLegs` resolve an
        // already-shared host to a single portless leg, which is now the *only* source of the
        // establishRelation step.
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(SAUCER_ID).addObject(CUP_ID)

        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            getCurrentHost: (id) => ((id === SAUCER_ID || id === CUP_ID) ? ROOM_ID : undefined),
            getMembershipContainers: (id) => ((id === SAUCER_ID || id === CUP_ID) ? [ROOM_ID] : []),
        }

        const seed: WorklistInstruction[] = [
            {
                id: 'sameHost',
                tag: 'grounded',
                step: {
                    kind: 'assertion',
                    predicate: 'sameHost',
                    subjectId: SAUCER_ID,
                    objectId: CUP_ID,
                    relationKind: 'Under',
                    operationKind: 'establishRelation',
                },
            },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [{ kind: 'establishRelation', subjectId: SAUCER_ID, targetId: CUP_ID, hostId: ROOM_ID, relationKind: 'Under' }],
        })
    })

    it("a sameHost violation that crosses a shard boundary mints crossing legs as steps and the port record as extraKernelSteps", () => {
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

        // Only the sameHost assertion is seeded --- there is no sibling establishRelation
        // instruction at all any more (the seed is collapsed). A direct rope->cup edge is
        // never valid once the relation crosses a boundary (they never come to share a host), so
        // the crossing legs below are the assertion's own children, same as the portless-leg
        // same-host case above --- a caller wiring this route for real must seed accordingly (see
        // `compileRelationalFromSkeleton.ts`'s own seed-construction comment).
        const seed: WorklistInstruction[] = [
            {
                id: 'sameHost',
                tag: 'grounded',
                step: {
                    kind: 'assertion',
                    predicate: 'sameHost',
                    subjectId: ROPE_ID,
                    objectId: CUP_ID,
                    relationKind: 'Custom',
                    relationLabel: 'to',
                    operationKind: 'establishRelation',
                },
            },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result.verdict).toBe('legal')
        if (result.verdict !== 'legal') return
        expect(result.steps).toEqual([
            {
                kind: 'establishRelation',
                subjectId: expect.objectContaining({ owner: TABLE_ID }),
                targetId: CUP_ID,
                hostId: TABLE_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
            {
                kind: 'establishRelation',
                subjectId: ROPE_ID,
                targetId: expect.objectContaining({ owner: TABLE_ID }),
                hostId: ROOM_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
        ])
        expect(result.extraKernelSteps).toEqual([
            { kind: 'addCrossingPort', hostId: TABLE_ID, port: expect.objectContaining({ fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }) },
        ])
    })

    // The former "errors if a carry-classified edge survives to command-expansion time" test is
    // retired 2026-08-22 (Channel D, CD2, reduced scope): the guard it exercised only fires for
    // a 'carry' outcome surviving unexpectedly, and `carry` is now unreachable from any relation
    // kind -- `On` (its only producer) joined `In`/`PartOf`'s hosting-kind throw. Reaching this
    // scenario today throws AB-54's invariant error instead, at `boundaryEdgeOutcomes` itself.

    it('runs a fully-grounded seed with no GroundingContext supplied', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID)
        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? graph : undefined),
            getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined),
            getMembershipContainers: () => [],
        }

        const seed: WorklistInstruction[] = [
            { id: 'transfer', tag: 'grounded', step: { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID } },
        ]

        const result = runExecutor(seed, env)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
            ],
        })
    })

    it('errors rather than throwing when an ungrounded instruction is seeded with no GroundingContext', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID)
        const env: ExpansionEnvironment = {
            getGraph: (hostId) => (hostId === ROOM_ID ? graph : undefined),
            getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : undefined),
            getMembershipContainers: () => [],
        }

        const result = runExecutor(
            seedFromUngroundedSteps([{
                kind: 'change',
                primitive: 'transferMembership',
                object: objectSpanRef('object', 'tray'),
                from: objectSpanRef('from', 'room'),
                to: objectSpanRef('to', 'character'),
            }]),
            env
        )

        expect(result).toEqual({ verdict: 'error', reason: expect.stringContaining('GroundingContext') })
    })
})

describe('seedFromGroundedSteps', () => {
    const lashedDissolve = (hostId: EphemeraRoomId | EphemeraCharacterId): DissolveRelationChange<GroundedReferent> => ({
        kind: 'change',
        primitive: 'dissolveRelation',
        subject: graphNodeRef(CUP_ID),
        target: graphNodeRef(SAUCER_ID),
        host: graphNodeRef(hostId),
        relationKind: 'Custom',
        relationLabel: 'is glued to',
    })

    it('seeds a fully grounded relational step as a grounded instruction, reading each groundedId', () => {
        const [instruction] = seedFromGroundedSteps([lashedDissolve(ROOM_ID)])

        expect(instruction).toEqual({
            id: expect.any(String),
            tag: 'grounded',
            step: {
                kind: 'dissolveRelation',
                subjectId: CUP_ID,
                targetId: SAUCER_ID,
                hostId: ROOM_ID,
                relationKind: 'Custom',
                relationLabel: 'is glued to',
            },
        })
    })

    it('keeps a non-Room host, which groundChange\'s derived-host filter would drop', () => {
        const [instruction] = seedFromGroundedSteps([lashedDissolve(CHARACTER_ID)])

        expect(instruction?.step).toEqual(expect.objectContaining({ hostId: CHARACTER_ID }))
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
