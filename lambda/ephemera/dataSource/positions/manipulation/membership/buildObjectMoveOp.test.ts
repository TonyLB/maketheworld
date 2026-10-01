import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildObjectMoveOp } from './buildObjectMoveOp'
import { testLudicGraph } from '../../ludicGraph/testFixtures'

const TRAY = 'OBJECT#Tray' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

const emptyFromGraph = testLudicGraph(ROOM, { nodes: [{ tag: 'Object', universalKey: TRAY }], edges: [] })

describe('buildObjectMoveOp', () => {
    it('carries the moved object id directly as the moved set', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.moved).toEqual(TRAY)
        expect(op.froms).toEqual([ROOM])
        expect(op.to).toEqual(CHARACTER)
        expect(op.headerSlot).toBeNull()
    })

    it('builds narration ingredients naming only the moved object', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })

        expect(op.narration).toEqual({
            kind: 'objectMove',
            characterName: 'Alice',
            objectShortName: 'tray',
        })
    })

    it('omits narration entirely when no ingredients are supplied (object-lifecycle move)', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.narration).toBeUndefined()
    })

    it('declares no verb or direction --- the compiler derives it from the host pair', () => {
        const takeHold = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })
        const drop = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: testLudicGraph(CHARACTER, { nodes: [{ tag: 'Object', universalKey: TRAY }], edges: [] }),
            fromHostId: CHARACTER,
            toHostId: ROOM,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })

        // Identical narration for opposite directions is the point: this builder never knew the
        // verb, which is why `inferOperationFromFact` could be deleted rather than relocated here.
        expect(takeHold.narration).toEqual(drop.narration)
    })

    it('derives dissolvedEdges from fromGraph: a dissolve-classified boundary edge is included', () => {
        const fromGraph = testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: TRAY },
                { tag: 'Object', universalKey: TABLE },
                { tag: 'Object', universalKey: CHANDELIER },
            ],
            edges: [
                { tag: 'Relational', from: TRAY, to: TABLE, kind: 'Against' },
                { tag: 'Relational', from: CHANDELIER, to: TABLE, kind: 'Under' },
            ],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.dissolvedEdges).toEqual([{ from: TRAY, to: TABLE, kind: 'Against' }])
    })

    it('strips the moved object\'s own containment edge into fromGraph\'s root, unconditionally --- not gated on any flag (3d, 2026-09-08: moved from executeMembershipTransfer\'s retired honorDefer mode)', () => {
        const fromGraph = testLudicGraph(TABLE, {
            nodes: [{ tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: TRAY }],
            edges: [{ tag: 'Relational', from: TRAY, to: TABLE, kind: 'On' }],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph,
            fromHostId: TABLE,
            toHostId: ROOM,
            bundleId: 'BUNDLE#test',
        })

        expect(op.dissolvedEdges).toEqual([{ from: TRAY, to: TABLE, kind: 'On' }])
    })

    it('leaves a defer-classified boundary edge alone --- no authority to decide whether severing it is acceptable', () => {
        const fromGraph = testLudicGraph(ROOM, {
            nodes: [{ tag: 'Object', universalKey: TRAY }, { tag: 'Object', universalKey: CHANDELIER }],
            edges: [{ tag: 'Relational', from: TRAY, to: CHANDELIER, kind: 'Under' }],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.dissolvedEdges).toEqual([])
    })

    describe('met edges (the attempt\'s verdicts, honored not judged)', () => {
        const POST = 'OBJECT#Post' as EphemeraObjectId
        const lashed = { from: TRAY, to: POST, kind: 'Custom' as const, relationLabel: 'is lashed to' }
        const lashedGraph = testLudicGraph(ROOM, {
            nodes: [{ tag: 'Object', universalKey: TRAY }, { tag: 'Object', universalKey: POST }],
            edges: [{ tag: 'Relational', ...lashed }],
        })

        it('dissolves a defer-classified Custom edge that matches a met edge', () => {
            const op = buildObjectMoveOp({
                entityId: TRAY,
                fromGraph: lashedGraph,
                fromHostId: ROOM,
                toHostId: CHARACTER,
                bundleId: 'BUNDLE#test',
                metEdges: [lashed],
            })

            expect(op.dissolvedEdges).toEqual([lashed])
        })

        it('ignores a met edge that is no longer in the graph, rather than dissolving a missing edge', () => {
            const op = buildObjectMoveOp({
                entityId: TRAY,
                fromGraph: emptyFromGraph,
                fromHostId: ROOM,
                toHostId: CHARACTER,
                bundleId: 'BUNDLE#test',
                metEdges: [lashed],
            })

            expect(op.dissolvedEdges).toEqual([])
        })

        it('leaves a defer edge nobody judged in place, even when another edge was met', () => {
            const op = buildObjectMoveOp({
                entityId: TRAY,
                fromGraph: lashedGraph,
                fromHostId: ROOM,
                toHostId: CHARACTER,
                bundleId: 'BUNDLE#test',
                metEdges: [{ ...lashed, relationLabel: 'is tied to' }],
            })

            expect(op.dissolvedEdges).toEqual([])
        })
    })

    it('folds extraDissolvedEdges in alongside the structurally-derived set (the post-repair rebuild)', () => {
        const repairedEdge = { from: TRAY, to: CHANDELIER, kind: 'Under' as const }
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            extraDissolvedEdges: [repairedEdge],
        })

        expect(op.dissolvedEdges).toEqual([repairedEdge])
    })
})
