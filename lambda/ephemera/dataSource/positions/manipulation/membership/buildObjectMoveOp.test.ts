import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildObjectMoveOp } from './buildObjectMoveOp'

const TRAY = 'OBJECT#Tray' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

describe('buildObjectMoveOp', () => {
    it('carries the moved object id directly as the moved set', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [ROOM],
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
            departures: [ROOM],
            toHostId: CHARACTER,
            presenceSteps: [],
        })

        expect(op.narration).toBeUndefined()
    })

    it('derives no boundary-edge dissolve, of any class --- those are the command attempt\'s own facilitating actions', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [ROOM],
            toHostId: CHARACTER,
            presenceSteps: [],
        })

        expect(op.dissolvedEdges).toBeUndefined()
    })

    it('names every host left, and strips no containment edge: the hosting kind is on the node and leaves with it', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            departures: [ROOM, TABLE],
            toHostId: CHANDELIER,
            presenceSteps: [],
        })

        expect(op.froms).toEqual([ROOM, TABLE])
        expect(op.dissolvedEdges).toBeUndefined()
    })
})
