import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/planStep'
import type { Change } from '../plan/planStep'
import type { GroundingContext, ResolvedSpan } from './groundReferent'
import { groundChange } from './groundChange'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const contextWith = (resolvedSpans: [string, ResolvedSpan][]): GroundingContext => ({
    actingCharacterId: CHARACTER_ID,
    resolvedSpans: new Map(resolvedSpans),
    getCurrentHost: (componentId) => (componentId === CHARACTER_ID ? ROOM_ID : undefined),
})

describe('groundChange', () => {
    it('fails establishRelation/dissolveRelation immediately: relational Changes ground by substitution, not through groundChange (AP-7/AP-8)', () => {
        const establish: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'Under',
        }
        const dissolve: Change = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'Under',
        }
        const context = contextWith([
            ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
            ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
        ])

        expect(groundChange(establish, context).ok).toBe(false)
        expect(groundChange(dissolve, context).ok).toBe(false)
    })

    it('grounds a transferMembership Change into a single-element, not-yet-carry-closed objectIds set', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: actingCharacterRef,
        }
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }]]),
            getCurrentHost: (componentId) => (componentId === TRAY_ID ? ROOM_ID : undefined),
        }

        expect(groundChange(change, context)).toEqual({
            ok: true,
            candidates: [{
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
            }],
        })
    })

    it('admits Object and Feature host candidates for transferMembership', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: objectSpanRef('niche', 'nicheRef'),
        }
        const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
        const NICHE_ID = 'FEATURE#Niche' as EphemeraFeatureId
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
                ['nicheRef', { verdict: 'resolved', candidateIds: [NICHE_ID] }],
            ]),
            getCurrentHost: (componentId) => (componentId === TRAY_ID ? BOX_ID : undefined),
        }

        expect(groundChange(change, context)).toEqual({
            ok: true,
            candidates: [{
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: BOX_ID,
                toHostId: NICHE_ID,
            }],
        })
    })

    it('admits an Area host candidate for transferMembership', () => {
        // Area is not an `EphemeraThingId` (thing.ts deliberately excludes it), so it can
        // never resolve directly off an objectSpan the way Object/Feature candidates do ---
        // it can only arrive via `currentHost(X)`, whose `getCurrentHost` callback returns
        // `EphemeraMembershipHostId`. Ground both `from` and `to` as current hosts of two
        // different objects to exercise that path.
        const ANCHOR_ID = 'OBJECT#Anchor' as EphemeraObjectId
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: currentHostRef(objectSpanRef('anchor', 'anchorRef')),
        }
        const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
        const DOWNTOWN_ID = 'AREA#Downtown' as EphemeraAreaId
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
                ['anchorRef', { verdict: 'resolved', candidateIds: [ANCHOR_ID] }],
            ]),
            getCurrentHost: (componentId) => {
                if (componentId === TRAY_ID) return BOX_ID
                if (componentId === ANCHOR_ID) return DOWNTOWN_ID
                return undefined
            },
        }

        expect(groundChange(change, context)).toEqual({
            ok: true,
            candidates: [{
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: BOX_ID,
                toHostId: DOWNTOWN_ID,
            }],
        })
    })

    it('fails a transferMembership Change when the object referent does not resolve', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(objectSpanRef('tray', 'trayRef')),
            to: actingCharacterRef,
        }
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map(),
            getCurrentHost: () => ROOM_ID,
        }

        const result = groundChange(change, context)
        expect(result.ok).toBe(false)
    })
})
