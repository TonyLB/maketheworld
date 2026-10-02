import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    actingCharacterRef,
    currentHostRef,
    derivedReferentKey,
    graphNodeRef,
    objectSpanRef,
    withGroundedId,
} from '../plan/planStep'
import type { Change, GroundedId } from '../plan/planStep'
import { buildReferentAssignment, type DerivedReferentResolver } from './buildReferentAssignment'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const resolver = (hosts: Record<string, GroundedId>): DerivedReferentResolver => ({
    actingCharacter: CHARACTER_ID,
    currentHost: (id) => hosts[id],
})

describe('buildReferentAssignment', () => {
    it('resolves a take\'s actingCharacter and currentHost(actingCharacter), passing spans through', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const spans = new Map([['trayRef', TRAY_ID]])

        expect(buildReferentAssignment(change, spans, resolver({ [CHARACTER_ID]: ROOM_ID }))).toEqual({
            spans,
            derived: new Map([
                [derivedReferentKey(currentHostRef(actingCharacterRef)), ROOM_ID],
                [derivedReferentKey(actingCharacterRef), CHARACTER_ID],
            ]),
        })
    })

    it('resolves currentHost over a span through the span half', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: objectSpanRef('table', 'tableRef'),
        }
        const spans = new Map([['trayRef', TRAY_ID], ['tableRef', TABLE_ID]])

        expect(buildReferentAssignment(change, spans, resolver({ [TRAY_ID]: ROOM_ID }))?.derived).toEqual(
            new Map([[derivedReferentKey(currentHostRef(objectSpanRef('tray', 'trayRef'))), ROOM_ID]])
        )
    })

    it('returns undefined when the snapshot cannot resolve a derived referent', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }

        expect(buildReferentAssignment(change, new Map([['trayRef', TRAY_ID]]), resolver({}))).toBeUndefined()
    })

    it('adds nothing for an already-grounded step', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: withGroundedId(objectSpanRef('tray', 'trayRef'), TRAY_ID),
            target: graphNodeRef(TABLE_ID),
            relationKind: 'Under',
        }

        expect(buildReferentAssignment(change, new Map(), resolver({}))?.derived).toEqual(new Map())
    })

    it('throws when a currentHost targets a span missing from the span half', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: withGroundedId(objectSpanRef('tray', 'trayRef'), TRAY_ID),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: actingCharacterRef,
        }

        expect(() => buildReferentAssignment(change, new Map(), resolver({}))).toThrow('no span assignment')
    })
})
