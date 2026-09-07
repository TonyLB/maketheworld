import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildObjectMoveOp } from './buildObjectMoveOp'

const TRAY = 'OBJECT#Tray' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

describe('buildObjectMoveOp', () => {
    it('carries the moved object id directly as the moved set', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.moved).toEqual(TRAY)
        expect(op.froms).toEqual([ROOM])
        expect(op.to).toEqual(CHARACTER)
        expect(op.headerSlot).toBeNull()
    })

    it('builds narration ingredients with no carriedCount (retired: computeCarryClosure is a singleton since CD3)', () => {
        const op = buildObjectMoveOp({
            entityId: TRAY,
            dissolvedEdges: [],
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
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.narration).toBeUndefined()
    })

    it('declares no verb or direction --- the compiler derives it from the host pair', () => {
        const takeHold = buildObjectMoveOp({
            entityId: TRAY,
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })
        const drop = buildObjectMoveOp({
            entityId: TRAY,
            dissolvedEdges: [],
            fromHostId: CHARACTER,
            toHostId: ROOM,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })

        // Identical narration for opposite directions is the point: this builder never knew the
        // verb, which is why `inferOperationFromFact` could be deleted rather than relocated here.
        expect(takeHold.narration).toEqual(drop.narration)
    })

    it('passes Expansion-classified severed edges through untouched', () => {
        const dissolvedEdges = [{ from: TRAY, to: TABLE, kind: 'On' as const }]
        const op = buildObjectMoveOp({
            entityId: TRAY,
            dissolvedEdges,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.dissolvedEdges).toEqual(dissolvedEdges)
    })
})
