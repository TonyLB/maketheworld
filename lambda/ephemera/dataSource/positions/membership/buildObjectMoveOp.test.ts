import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildObjectMoveOp } from './buildObjectMoveOp'
import type { CarryClosureFragment } from '../positionGraph/expandValidate/interactionUnderTransfer'

const TRAY = 'OBJECT#Tray' as EphemeraObjectId
const GLASS = 'OBJECT#Glass' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

const fragment = (members: EphemeraObjectId[]): CarryClosureFragment => ({
    rootId: TRAY,
    members: new Set(members),
    edges: [],
})

describe('buildObjectMoveOp', () => {
    it('carries the closure as the moved set, with the fragment root as primary', () => {
        const op = buildObjectMoveOp({
            fragment: fragment([TRAY, GLASS]),
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.moved).toEqual({ kind: 'closure', fragment: fragment([TRAY, GLASS]) })
        expect(op.froms).toEqual([ROOM])
        expect(op.to).toEqual(CHARACTER)
        expect(op.headerSlot).toBeNull()
    })

    it('takes carriedCount from the fragment, so it cannot drift from what is transferred', () => {
        const op = buildObjectMoveOp({
            fragment: fragment([TRAY, GLASS]),
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
            carriedCount: 2,
        })
    })

    it('omits narration entirely when no ingredients are supplied (object-lifecycle move)', () => {
        const op = buildObjectMoveOp({
            fragment: fragment([TRAY]),
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.narration).toBeUndefined()
    })

    it('declares no verb or direction --- the compiler derives it from the host pair', () => {
        const takeHold = buildObjectMoveOp({
            fragment: fragment([TRAY]),
            dissolvedEdges: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        })
        const drop = buildObjectMoveOp({
            fragment: fragment([TRAY]),
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
            fragment: fragment([TRAY]),
            dissolvedEdges,
            fromHostId: ROOM,
            toHostId: CHARACTER,
            bundleId: 'BUNDLE#test',
        })

        expect(op.dissolvedEdges).toEqual(dissolvedEdges)
    })
})
