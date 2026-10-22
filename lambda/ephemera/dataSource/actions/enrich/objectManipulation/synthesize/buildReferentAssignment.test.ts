import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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

    describe('a thing in several hosts (grounded by its view)', () => {
        const view = ['PRESENCE#onTable' as EphemeraPresenceNodeId]
        const severalHosts: DerivedReferentResolver = {
            actingCharacter: CHARACTER_ID,
            currentHost: () => undefined,
            viewHosts: (id, named) => (id === TRAY_ID && named[0] === view[0] ? [ROOM_ID] : undefined),
        }
        const fromTray = (named?: EphemeraPresenceNodeId[]) => currentHostRef({ ...objectSpanRef('tray', 'trayRef'), ...(named ? { view: named } : {}) })
        const takeFrom = (from: ReturnType<typeof fromTray>): Change => ({
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from,
            to: actingCharacterRef,
        })
        const spans = new Map([['trayRef', TRAY_ID]])

        it('grounds a transfer\'s from to the first host its view sits under', () => {
            const from = fromTray(view)

            expect(buildReferentAssignment(takeFrom(from), spans, severalHosts)?.derived.get(derivedReferentKey(from))).toBe(ROOM_ID)
        })

        it('does not ground a from with no view to say which part, so the step is dropped', () => {
            expect(buildReferentAssignment(takeFrom(fromTray()), spans, severalHosts)).toBeUndefined()
        })

        it('does not ground a from whose view the world no longer holds', () => {
            expect(buildReferentAssignment(takeFrom(fromTray(['PRESENCE#gone' as EphemeraPresenceNodeId])), spans, severalHosts)).toBeUndefined()
        })

        it('prefers the one host a thing is in over its view', () => {
            const oneHost: DerivedReferentResolver = { ...severalHosts, currentHost: () => TABLE_ID }
            const from = fromTray(view)

            expect(buildReferentAssignment(takeFrom(from), spans, oneHost)?.derived.get(derivedReferentKey(from))).toBe(TABLE_ID)
        })
    })

    it('adds nothing for an already-grounded step', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: withGroundedId(objectSpanRef('tray', 'trayRef'), TRAY_ID),
            target: graphNodeRef(TABLE_ID),
            relationKind: 'Custom', relationLabel: 'under',
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
