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

    it('builds template narration labelling only the moved object', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: emptyFromGraph,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            narration: { actorName: 'Alice', labels: { [TRAY]: 'tray' } },
        })

        expect(op.narration).toEqual({
            kind: 'template',
            actorName: 'Alice',
            labels: { [TRAY]: 'tray' },
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
            narration: { actorName: 'Alice', labels: { [TRAY]: 'tray' } },
        })
        const drop = buildObjectMoveOp({
            entityId: TRAY,
            fromGraph: testLudicGraph(CHARACTER, { nodes: [{ tag: 'Object', universalKey: TRAY }], edges: [] }),
            fromHostId: CHARACTER,
            toHostId: ROOM,
            bundleId: 'BUNDLE#test',
            narration: { actorName: 'Alice', labels: { [TRAY]: 'tray' } },
        })

        // Identical narration for opposite directions is the point: this builder never knew the
        // verb, which is why `inferOperationFromFact` could be deleted rather than relocated here.
        expect(takeHold.narration).toEqual(drop.narration)
    })

    it('derives no boundary-edge dissolve, of any class --- those are the command attempt\'s own facilitating actions', () => {
        const fromGraph = testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: TRAY },
                { tag: 'Object', universalKey: TABLE },
                { tag: 'Object', universalKey: CHANDELIER },
            ],
            edges: [
                { tag: 'Relational', from: TRAY, to: TABLE, kind: 'Custom', relationLabel: 'against' },
                { tag: 'Relational', from: TRAY, to: CHANDELIER, kind: 'Custom', relationLabel: 'under' },
            ],
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
})
