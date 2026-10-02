import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, graphNodeRef, objectSpanRef, withGroundedId } from '../plan/planStep'
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

// The expected result: the same Change, each referent kept and given its id.
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

        expect(groundChange(change, contextWith([]))).toEqual({
            ok: true,
            change: {
                kind: 'change',
                primitive: 'establishRelation',
                subject: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'trayRef', groundedId: TRAY_ID },
                target: { referentType: 'graphNode', groundedId: TABLE_ID },
                relationKind: 'Under',
            },
        })
    })

    it('fails a referent that still grounds to several candidates --- the product is the producer\'s, not Grounding\'s (AP-1)', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray', 'trayRef'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const context = contextWith([['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID, TABLE_ID] }]])

        expect(groundChange(change, context)).toEqual({ ok: false, reason: expect.stringContaining('expected exactly one') })
    })

    it('grounds each referent of a transferMembership Change to one id, derived ones included, keeping each referent', () => {
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
            change: groundedTransfer(change, TRAY_ID, ROOM_ID, CHARACTER_ID),
        })
    })

    it('grounds Object and Feature hosts for transferMembership (lowering types them)', () => {
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
            change: groundedTransfer(change, TRAY_ID, BOX_ID, NICHE_ID),
        })
    })

    it('grounds an Area host for transferMembership', () => {
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
            change: groundedTransfer(change, TRAY_ID, BOX_ID, DOWNTOWN_ID),
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
