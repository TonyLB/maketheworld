import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    actingCharacterRef,
    currentHostRef,
    derivedReferentKey,
    graphNodeRef,
    objectSpanRef,
    withGroundedId,
} from '../plan/planStep'
import type { Change, ReferentAssignment } from '../plan/planStep'
import { groundChange } from './groundChange'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const groundedTransfer = (change: Change, objectId: string, fromId: string, toId: string) => {
    if (change.primitive !== 'transferMembership') throw new Error('expected a transferMembership Change')
    return {
        ...change,
        object: { ...change.object, groundedId: objectId },
        from: { ...change.from, groundedId: fromId },
        to: { ...change.to, groundedId: toId },
    }
}

describe('groundChange', () => {
    it('grounds a substituted relational Change by passing its known ids through, referents kept', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: withGroundedId(objectSpanRef('tray', 'trayRef'), TRAY_ID),
            target: graphNodeRef(TABLE_ID),
            relationKind: 'Under',
        }
        const assignment: ReferentAssignment = { spans: new Map(), derived: new Map() }

        expect(groundChange(change, assignment)).toEqual({
            kind: 'change',
            primitive: 'establishRelation',
            subject: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'trayRef', groundedId: TRAY_ID },
            target: { referentType: 'graphNode', groundedId: TABLE_ID },
            relationKind: 'Under',
        })
    })

    it('throws when an objectSpan referent has no span assignment for its stableRefKey --- a construction bug (AP-10)', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const assignment: ReferentAssignment = {
            spans: new Map(),
            derived: new Map([
                [derivedReferentKey(actingCharacterRef), CHARACTER_ID],
                [derivedReferentKey(currentHostRef(actingCharacterRef)), ROOM_ID],
            ]),
        }

        expect(() => groundChange(change, assignment)).toThrow('no span assignment')
    })

    it('grounds every referent of a transferMembership Change in one pass, span and derived together', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const assignment: ReferentAssignment = {
            spans: new Map([['trayRef', TRAY_ID]]),
            derived: new Map([
                [derivedReferentKey(actingCharacterRef), CHARACTER_ID],
                [derivedReferentKey(currentHostRef(actingCharacterRef)), ROOM_ID],
            ]),
        }

        expect(groundChange(change, assignment)).toEqual(groundedTransfer(change, TRAY_ID, ROOM_ID, CHARACTER_ID))
    })

    it('grounds a Feature host for transferMembership (lowering types it, not Grounding)', () => {
        const NICHE_ID = 'FEATURE#Niche' as EphemeraFeatureId
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: objectSpanRef('niche', 'nicheRef'),
            to: actingCharacterRef,
        }
        const assignment: ReferentAssignment = {
            spans: new Map([['trayRef', TRAY_ID], ['nicheRef', NICHE_ID]]),
            derived: new Map([[derivedReferentKey(actingCharacterRef), CHARACTER_ID]]),
        }

        expect(groundChange(change, assignment)).toEqual(groundedTransfer(change, TRAY_ID, NICHE_ID, CHARACTER_ID))
    })

    it('throws when a derived referent (actingCharacter/currentHost) has no entry in the assignment', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const assignment: ReferentAssignment = {
            spans: new Map([['trayRef', TRAY_ID]]),
            derived: new Map(),
        }

        expect(() => groundChange(change, assignment)).toThrow('no derived assignment')
    })

    it('passes an already-grounded referent through untouched, consulting neither namespace', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: graphNodeRef(TRAY_ID),
            target: graphNodeRef(TABLE_ID),
            relationKind: 'Custom',
            relationLabel: 'tied to',
        }
        const assignment: ReferentAssignment = { spans: new Map(), derived: new Map() }

        expect(groundChange(change, assignment)).toEqual(change)
    })
})
