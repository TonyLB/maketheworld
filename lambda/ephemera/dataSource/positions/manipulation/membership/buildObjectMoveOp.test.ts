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
            departures: [{ hostId: ROOM, graph: emptyFromGraph }],
            toHostId: CHARACTER,
            presenceSteps: [],
        })

        expect(op.moved).toEqual(TRAY)
        expect(op.froms).toEqual([ROOM])
        expect(op.to).toEqual(CHARACTER)
        expect(op.header).toBeNull()
    })

    it('carries no narration: an object move\'s lines are its attempt\'s narration units', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [{ hostId: ROOM, graph: emptyFromGraph }],
            toHostId: CHARACTER,
            presenceSteps: [],
        })

        expect(op.narration).toBeUndefined()
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
            departures: [{ hostId: ROOM, graph: fromGraph }],
            toHostId: CHARACTER,
            presenceSteps: [],
        })

        expect(op.dissolvedEdges).toEqual([])
    })

    it('strips the moved object\'s own containment edge into its departure graph\'s root on every move --- not gated on a caller\'s flag (3d, 2026-09-08: moved from executeMembershipTransfer\'s retired honorDefer mode)', () => {
        const fromGraph = testLudicGraph(TABLE, {
            nodes: [{ tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: TRAY }],
            edges: [{ tag: 'Relational', from: TRAY, to: TABLE, kind: 'On' }],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [{ hostId: TABLE, graph: fromGraph }],
            toHostId: ROOM,
            presenceSteps: [],
        })

        expect(op.dissolvedEdges).toEqual([{ hostId: TABLE, edge: { from: TRAY, to: TABLE, kind: 'On' } }])
    })

    it('a take leaving several hosts (the take rule) leaves each, and strips its own containment edge in each that has one', () => {
        const tableGraph = testLudicGraph(TABLE, {
            nodes: [{ tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: TRAY }],
            edges: [{ tag: 'Relational', from: TRAY, to: TABLE, kind: 'On' }],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [{ hostId: ROOM, graph: emptyFromGraph }, { hostId: TABLE, graph: tableGraph }],
            toHostId: CHANDELIER,
            presenceSteps: [],
        })

        expect(op.froms).toEqual([ROOM, TABLE])
        expect(op.dissolvedEdges).toEqual([{ hostId: TABLE, edge: { from: TRAY, to: TABLE, kind: 'On' } }])
    })

    it('a spread (keepFrom) keeps the own containment edge and leaves no host: the mover stays where it was', () => {
        const fromGraph = testLudicGraph(TABLE, {
            nodes: [{ tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: TRAY }],
            edges: [{ tag: 'Relational', from: TRAY, to: TABLE, kind: 'On' }],
        })
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [{ hostId: TABLE, graph: fromGraph }],
            toHostId: CHANDELIER,
            presenceSteps: [],
            containment: 'On',
            keepFrom: true,
        })

        expect(op).toMatchObject({ froms: [], to: CHANDELIER, dissolvedEdges: [], containment: 'On' })
    })
})
