import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { objectSpanRef } from '../plan/ungroundedPrimitive'
import type { Assertion } from '../plan/ungroundedPrimitive'
import type { GroundingContext, ResolvedSpan } from './groundReferent'
import { groundAssertion } from './groundAssertion'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BENCH_A_ID = 'OBJECT#BenchA' as EphemeraObjectId
const BENCH_B_ID = 'OBJECT#BenchB' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const contextWith = (resolvedSpans: [string, ResolvedSpan][]): GroundingContext => ({
    actingCharacterId: CHARACTER_ID,
    resolvedSpans: new Map(resolvedSpans),
    getCurrentHost: (componentId) => (componentId === CHARACTER_ID ? ROOM_ID : undefined),
})

describe('groundAssertion', () => {
    it('grounds a containedBy Assertion with negate: true preserved', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: objectSpanRef('tray', 'trayRef'),
            object: objectSpanRef('table', 'tableRef'),
            negate: true,
        }
        const context = contextWith([
            ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
            ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
        ])

        expect(groundAssertion(assertion, context)).toEqual({
            ok: true,
            assertion: {
                kind: 'assertion',
                predicate: 'containedBy',
                subjectId: TRAY_ID,
                objectId: TABLE_ID,
                negate: true,
            },
        })
    })

    it('grounds an isolatedFromRelations Assertion into a singleton objectIds set', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'isolatedFromRelations',
            object: objectSpanRef('tray', 'trayRef'),
        }
        const context = contextWith([
            ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
        ])

        expect(groundAssertion(assertion, context)).toEqual({
            ok: true,
            assertion: {
                kind: 'assertion',
                predicate: 'isolatedFromRelations',
                objectIds: new Set([TRAY_ID]),
            },
        })
    })

    it('errors (BD-32) when a referent grounds to more than one candidate', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: objectSpanRef('bench', 'benchRef'),
            object: objectSpanRef('table', 'tableRef'),
            negate: false,
        }
        const context = contextWith([
            ['benchRef', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] }],
            ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
        ])

        const result = groundAssertion(assertion, context)
        expect(result.ok).toBe(false)
    })

    it('propagates an unresolved referent as a grounding failure', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'isolatedFromRelations',
            object: objectSpanRef('tray', 'trayRef'),
        }
        const context = contextWith([
            ['trayRef', { verdict: 'unresolved', reason: 'no catalog match' }],
        ])

        const result = groundAssertion(assertion, context)
        expect(result.ok).toBe(false)
    })
})
