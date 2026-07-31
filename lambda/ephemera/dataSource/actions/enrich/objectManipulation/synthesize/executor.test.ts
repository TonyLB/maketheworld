import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraPositionGraph } from '../../../../positions/positionGraph'
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
    it('BD-13: carries a connected object and dissolves a boundary edge, transferMembership retiring after its paired isolatedFromRelations', () => {
        const graph = EphemeraPositionGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addObject(CUP_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'On' })
            .addRelationalEdge({ from: CUP_ID, to: TRAY_ID, kind: 'On' })

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => ([TRAY_ID, CUP_ID, TABLE_ID].includes(id) ? ROOM_ID : undefined)
        )

        const seed: WorklistInstruction[] = [
            { id: 'isolated', tag: 'grounded', step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([TRAY_ID]) } },
            { id: 'transfer', tag: 'grounded', step: { kind: 'transferMembership', objectIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID } },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' },
                { kind: 'transferMembership', objectIds: new Set([TRAY_ID, CUP_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
            ],
        })
        // Fix 2: one shared closure computation for the paired instructions, not two.
        expect(env.settledGroups.size).toBe(1)
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

    it("BD-16: repairs a sameHost violation, the repair transfer (and its own isolatedFromRelations) retiring before the paired relational Change", () => {
        const characterGraph = EphemeraPositionGraph.empty(CHARACTER_ID).addObject(SAUCER_ID)
        const roomGraph = EphemeraPositionGraph.empty(ROOM_ID).addObject(CUP_ID)

        const env = createExpansionEnvironment(
            (hostId) => {
                if (hostId === CHARACTER_ID) return characterGraph
                if (hostId === ROOM_ID) return roomGraph
                return undefined
            },
            (id) => {
                if (id === SAUCER_ID) return CHARACTER_ID
                if (id === CUP_ID) return ROOM_ID
                return undefined
            }
        )

        const seed: WorklistInstruction[] = [
            {
                id: 'sameHost',
                tag: 'grounded',
                step: { kind: 'assertion', predicate: 'sameHost', subjectId: SAUCER_ID, objectId: CUP_ID, negate: false, relationKind: 'On' },
            },
            {
                id: 'establish',
                tag: 'grounded',
                step: { kind: 'establishRelation', subjectId: SAUCER_ID, targetId: CUP_ID, relationKind: 'On' },
            },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [
                { kind: 'transferMembership', objectIds: new Set([SAUCER_ID]), fromHostId: CHARACTER_ID, toHostId: ROOM_ID },
                { kind: 'establishRelation', subjectId: SAUCER_ID, targetId: CUP_ID, relationKind: 'On' },
            ],
        })
    })

    it('BD-16: a satisfied sameHost mints no repair, the relational Change retires alone', () => {
        const roomGraph = EphemeraPositionGraph.empty(ROOM_ID).addObject(SAUCER_ID).addObject(CUP_ID)

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? roomGraph : undefined),
            (id) => ([SAUCER_ID, CUP_ID].includes(id) ? ROOM_ID : undefined)
        )

        const seed: WorklistInstruction[] = [
            {
                id: 'sameHost',
                tag: 'grounded',
                step: { kind: 'assertion', predicate: 'sameHost', subjectId: SAUCER_ID, objectId: CUP_ID, negate: false, relationKind: 'On' },
            },
            {
                id: 'establish',
                tag: 'grounded',
                step: { kind: 'establishRelation', subjectId: SAUCER_ID, targetId: CUP_ID, relationKind: 'On' },
            },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result).toEqual({
            verdict: 'legal',
            steps: [{ kind: 'establishRelation', subjectId: SAUCER_ID, targetId: CUP_ID, relationKind: 'On' }],
        })
    })

    it('BD-28: a lone isolatedFromRelations (no paired transfer) mints its DissolveRelationSteps directly', () => {
        const graph = EphemeraPositionGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addObject(TABLE_ID)
            .addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'On' })

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
            steps: [{ kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' }],
        })
    })

    it('errors if a carry-classified edge survives to command-expansion time (internal-consistency guard)', () => {
        const graph = EphemeraPositionGraph.empty(ROOM_ID)
            .addObject(TRAY_ID)
            .addObject(CUP_ID)
            .addRelationalEdge({ from: CUP_ID, to: TRAY_ID, kind: 'On' })

        const env = createExpansionEnvironment(
            (hostId) => (hostId === ROOM_ID ? graph : undefined),
            (id) => ([TRAY_ID, CUP_ID].includes(id) ? ROOM_ID : undefined)
        )

        // Seeded already `operandExpanded` with an incomplete set (cup should have
        // been absorbed) --- simulates the "should be unreachable" case directly,
        // since normal operand-expansion always closes the set first.
        const seed: WorklistInstruction[] = [
            { id: 'isolated', tag: 'operandExpanded', step: { kind: 'assertion', predicate: 'isolatedFromRelations', objectIds: new Set([TRAY_ID]) } },
        ]

        const result = runExecutor(seed, env, emptyGroundingContext)

        expect(result.verdict).toBe('error')
    })

    it('defers the whole run on a Custom-kind boundary edge, not a partial result', () => {
        const graph = EphemeraPositionGraph.empty(ROOM_ID)
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
        const graph = EphemeraPositionGraph.empty(ROOM_ID).addObject(TRAY_ID)
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
        const graph = EphemeraPositionGraph.empty(ROOM_ID).addObject(TRAY_ID)
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
