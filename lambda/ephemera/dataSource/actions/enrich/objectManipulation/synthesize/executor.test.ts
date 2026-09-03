import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { objectSpanRef } from '../plan/ungroundedPrimitive'
import type { TransferMembershipChange } from '../plan/ungroundedPrimitive'
import type { GroundingContext } from './groundReferent'
import { createExpansionEnvironment } from './expansionEnvironment'
import { seedGroundedTransferMembership, runExecutor, seedTransferMembership } from './executor'
import type { WorklistInstruction } from './executorTypes'

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

    it('LP4g: dissolves a boundary edge to a non-Object (Character) endpoint, no throw', () => {
        const COMPANION_ID = 'CHARACTER#Companion' as EphemeraCharacterId
        const graph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addCharacter(COMPANION_ID)
            .addRelationalEdge({ from: TRAY_ID, to: COMPANION_ID, kind: 'Against' })

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => ([TRAY_ID, COMPANION_ID].includes(id) ? ROOM_ID : undefined)
        )

        const seed: WorklistInstruction[] = [
            { id: 'isolated', tag: 'grounded', step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([TRAY_ID]) } },
            { id: 'transfer', tag: 'grounded', step: { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID } },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: COMPANION_ID, hostId: ROOM_ID, relationKind: 'Against' },
                { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
            ],
        })
    })

    it('seedTransferMembership always pairs a transferMembership Change with isolatedFromRelations, isolatedFromRelations first', () => {
        const change: TransferMembershipChange = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: objectSpanRef('tray', 'trayRef'),
            to: objectSpanRef('tray', 'trayRef'),
        }

        const seeded = seedTransferMembership(change)

        expect(seeded).toHaveLength(2)
        expect(seeded[0]!.tag).toBe('ungrounded')
        expect(seeded[0]!.step).toEqual({ kind: 'assertion', predicate: 'isolatedFromRelations', object: change.object })
        expect(seeded[1]!.step).toBe(change)
    })

    it('PV1-3b-4: a sameHost pair that already shares a host retires as a single portless leg, from the assertion alone', () => {
        // `satisfied` (deleted 2026-09-01) used to retire a matching sameHost assertion with no
        // children, relying on a sibling establishRelation instruction (seeded alongside it) to
        // retire unmodified as the actual edge. That sibling is gone --- an endpoint is its own
        // zero-hop ancestor (PV1-3b-8), so `findShardBoundary`/`buildCrossingLegs` resolve an
        // already-shared host to a single portless leg, which is now the *only* source of the
        // establishRelation step.
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(SAUCER_ID).addObject(CUP_ID)

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            (id) => ((id === SAUCER_ID || id === CUP_ID) ? ROOM_ID : undefined),
            (id) => ((id === SAUCER_ID || id === CUP_ID) ? [ROOM_ID] : [])
        )

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

    it("PV1-3: a sameHost violation that crosses a shard boundary mints crossing legs as steps and the port record as extraKernelSteps", () => {
        const ROPE_ID = 'OBJECT#Rope' as EphemeraObjectId
        const roomGraph = EphemeraLudicGraph.empty(ROOM_ID).addObject(ROPE_ID).addObject(TABLE_ID)

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            (id) => (id === ROPE_ID ? ROOM_ID : TABLE_ID),
            (id) => {
                if (id === ROPE_ID) return [ROOM_ID]
                if (id === CUP_ID) return [TABLE_ID]
                if (id === TABLE_ID) return [ROOM_ID]
                return []
            }
        )

        // Only the sameHost assertion is seeded --- there is no sibling establishRelation
        // instruction at all any more (PV1-3b-4 collapsed the seed). A direct rope->cup edge is
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

    it('BD-28: a lone isolatedFromRelations (no paired transfer) mints its DissolveRelationSteps directly', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'Against' })

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => ([TRAY_ID, TABLE_ID].includes(id) ? ROOM_ID : undefined)
        )

        const seed: WorklistInstruction[] = [
            { id: 'isolated', tag: 'grounded', step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([TRAY_ID]) } },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [{ kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'Against' }],
        })
    })

    // The former "errors if a carry-classified edge survives to command-expansion time" test is
    // retired 2026-08-22 (Channel D, CD2, reduced scope): the guard it exercised only fires for
    // a 'carry' outcome surviving unexpectedly, and `carry` is now unreachable from any relation
    // kind -- `On` (its only producer) joined `In`/`PartOf`'s hosting-kind throw. Reaching this
    // scenario today throws AB-54's invariant error instead, at `boundaryEdgeOutcomes` itself.

    it('defers the whole run on a Custom-kind boundary edge, not a partial result', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addObject(WEIRD_ID)
            .addRelationalEdge({ from: TRAY_ID, to: WEIRD_ID, kind: 'Custom', relationLabel: 'tangled up with' })

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => ([TRAY_ID, WEIRD_ID].includes(id) ? ROOM_ID : undefined)
        )

        const seed: WorklistInstruction[] = [
            { id: 'isolated', tag: 'grounded', step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([TRAY_ID]) } },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({ verdict: 'defer', decidable: false, reason: expect.any(String) })
    })

    it('seedGroundedTransferMembership always pairs, isolatedFromRelations first', () => {
        const paired = seedGroundedTransferMembership({
            kind: 'transferMembership',
            objectIds: new Set([SAUCER_ID]),
            fromHostId: CHARACTER_ID,
            toHostId: ROOM_ID,
        })

        expect(paired).toHaveLength(2)
        expect(paired[0]!.step).toEqual({ kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([SAUCER_ID]) })
        expect(paired[1]!.step).toEqual({ kind: 'transferMembership', objectIds: new Set([SAUCER_ID]), fromHostId: CHARACTER_ID, toHostId: ROOM_ID })
    })

    it('runs a fully-grounded seed with no GroundingContext supplied', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID)
        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => (id === TRAY_ID ? ROOM_ID : undefined)
        )

        const result = runExecutor(
            seedGroundedTransferMembership({
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
            }),
            env
        )

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
            ],
        })
    })

    it('errors rather than throwing when an ungrounded instruction is seeded with no GroundingContext', () => {
        const graph = EphemeraLudicGraph.empty(ROOM_ID).addObject(TRAY_ID)
        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => (id === TRAY_ID ? ROOM_ID : undefined)
        )

        const result = runExecutor(
            seedTransferMembership({
                kind: 'change',
                primitive: 'transferMembership',
                object: objectSpanRef('object', 'tray'),
                from: objectSpanRef('from', 'room'),
                to: objectSpanRef('to', 'character'),
            }),
            env
        )

        expect(result).toEqual({ verdict: 'error', reason: expect.stringContaining('GroundingContext') })
    })
})
