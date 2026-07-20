import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/ungroundedPrimitive'
import type { Change } from '../plan/ungroundedPrimitive'
import type { GroundingContext, ResolvedSpan } from './groundReferent'
import { groundChange } from './groundChange'

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

describe('groundChange', () => {
    it('grounds an establishRelation Change into a single-candidate EstablishRelationStep list', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'On',
        }
        const context = contextWith([
            ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
            ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
        ])

        expect(groundChange(change, context)).toEqual({
            ok: true,
            candidates: [{
                kind: 'establishRelation',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                relationKind: 'On',
                hostRoomId: ROOM_ID,
            }],
        })
    })

    it('grounds a dissolveRelation Change, passing relationLabel through for Custom kind', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'Custom',
            relationLabel: 'balanced on',
        }
        const context = contextWith([
            ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
            ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
        ])

        expect(groundChange(change, context)).toEqual({
            ok: true,
            candidates: [{
                kind: 'dissolveRelation',
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                relationKind: 'Custom',
                relationLabel: 'balanced on',
                hostRoomId: ROOM_ID,
            }],
        })
    })

    it('offers all 4 combinations, including both same-object ones, for two referents sharing a two-candidate pool (BD-23, "put bench on bench")', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('bench', 'benchRef1'),
            target: objectSpanRef('bench', 'benchRef2'),
            relationKind: 'On',
        }
        const context = contextWith([
            ['benchRef1', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] }],
            ['benchRef2', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] }],
        ])

        const result = groundChange(change, context)
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const pairs = result.candidates.map((step) => (
            step.kind === 'establishRelation' ? [step.subjectId, step.targetId] : null
        ))
        expect(pairs).toEqual(expect.arrayContaining([
            [BENCH_A_ID, BENCH_A_ID],
            [BENCH_A_ID, BENCH_B_ID],
            [BENCH_B_ID, BENCH_A_ID],
            [BENCH_B_ID, BENCH_B_ID],
        ]))
        expect(result.candidates).toHaveLength(4)
    })

    it('fails an establishRelation Change when the derived host is not a room for any candidate', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'On',
        }
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }],
                ['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }],
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
            subject: objectSpanRef('tray', 'trayRef'),
            target: objectSpanRef('table', 'tableRef'),
            relationKind: 'On',
        }
        const context = contextWith([['tableRef', { verdict: 'resolved', candidateIds: [TABLE_ID] }]])

        const result = groundChange(change, context)
        expect(result.ok).toBe(false)
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
