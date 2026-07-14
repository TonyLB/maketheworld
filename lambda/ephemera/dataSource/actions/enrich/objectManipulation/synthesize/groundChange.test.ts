import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/ungroundedPrimitive'
import type { Change } from '../plan/ungroundedPrimitive'
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
    it('grounds an establishRelation Change into an EstablishRelationStep', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray'),
            target: objectSpanRef('table'),
            relationKind: 'On',
        }
        const context = contextWith([
            ['tray', { verdict: 'resolved', objectId: TRAY_ID }],
            ['table', { verdict: 'resolved', objectId: TABLE_ID }],
        ])

        expect(groundChange(change, context)).toEqual({
            ok: true,
            step: {
                kind: 'establishRelation',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                relationKind: 'On',
                hostRoomId: ROOM_ID,
            },
        })
    })

    it('grounds a dissolveRelation Change, passing relationLabel through for Custom kind', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: objectSpanRef('tray'),
            target: objectSpanRef('table'),
            relationKind: 'Custom',
            relationLabel: 'balanced on',
        }
        const context = contextWith([
            ['tray', { verdict: 'resolved', objectId: TRAY_ID }],
            ['table', { verdict: 'resolved', objectId: TABLE_ID }],
        ])

        expect(groundChange(change, context)).toEqual({
            ok: true,
            step: {
                kind: 'dissolveRelation',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                relationKind: 'Custom',
                relationLabel: 'balanced on',
                hostRoomId: ROOM_ID,
            },
        })
    })

    it('fails an establishRelation Change when the derived host is not a room', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray'),
            target: objectSpanRef('table'),
            relationKind: 'On',
        }
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['tray', { verdict: 'resolved', objectId: TRAY_ID }],
                ['table', { verdict: 'resolved', objectId: TABLE_ID }],
            ]),
            getCurrentHost: (componentId) => (componentId === CHARACTER_ID ? CHARACTER_ID : undefined),
        }

        const result = groundChange(change, context)
        expect(result.ok).toBe(false)
    })

    it('fails an establishRelation Change when subject does not resolve', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray'),
            target: objectSpanRef('table'),
            relationKind: 'On',
        }
        const context = contextWith([['table', { verdict: 'resolved', objectId: TABLE_ID }]])

        const result = groundChange(change, context)
        expect(result.ok).toBe(false)
    })

    it('grounds a transferMembership Change into a single-element, not-yet-carry-closed objectIds set', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray'),
            from: currentHostRef(objectSpanRef('tray')),
            to: actingCharacterRef,
        }
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([['tray', { verdict: 'resolved', objectId: TRAY_ID }]]),
            getCurrentHost: (componentId) => (componentId === TRAY_ID ? ROOM_ID : undefined),
        }

        expect(groundChange(change, context)).toEqual({
            ok: true,
            step: {
                kind: 'transferMembership',
                objectIds: new Set([TRAY_ID]),
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
            },
        })
    })

    it('fails a transferMembership Change when the object referent does not resolve', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray'),
            from: currentHostRef(objectSpanRef('tray')),
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
