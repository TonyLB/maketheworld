import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/ungroundedPrimitive'
import { groundReferent, type GroundingContext, type ResolvedSpan } from './groundReferent'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const BENCH_A_ID = 'OBJECT#BenchA' as EphemeraObjectId
const BENCH_B_ID = 'OBJECT#BenchB' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const OTHER_ROOM_ID = 'ROOM#Lounge' as EphemeraRoomId

const baseContext = (resolvedSpans: ReadonlyMap<string, ResolvedSpan>): GroundingContext => ({
    actingCharacterId: CHARACTER_ID,
    resolvedSpans,
    getCurrentHost: (componentId) => (componentId === TRAY_ID ? ROOM_ID : undefined),
})

describe('groundReferent', () => {
    it('resolves an objectSpan referent from a resolved single-candidate stableRefKey', () => {
        const context = baseContext(new Map([['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }]]))

        expect(groundReferent(objectSpanRef('tray', 'trayRef'), context)).toEqual({ ok: true, candidates: [TRAY_ID] })
    })

    it('resolves an objectSpan referent to multiple candidates when the key has more than one', () => {
        const context = baseContext(new Map([
            ['benchRef1', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] }],
        ]))

        expect(groundReferent(objectSpanRef('bench', 'benchRef1'), context)).toEqual({
            ok: true,
            candidates: [BENCH_A_ID, BENCH_B_ID],
        })
    })

    it('fails when a referent has no stableRefKey to ground against', () => {
        const context = baseContext(new Map())

        const result = groundReferent(objectSpanRef('tray'), context)
        expect(result.ok).toBe(false)
    })

    it('fails when a stableRefKey verdict is unresolved', () => {
        const context = baseContext(new Map([['trayRef', { verdict: 'unresolved', reason: 'ambiguous' }]]))

        expect(groundReferent(objectSpanRef('tray', 'trayRef'), context)).toEqual({ ok: false, reason: 'ambiguous' })
    })

    it('fails when a stableRefKey has no supplied resolution at all', () => {
        const context = baseContext(new Map())

        const result = groundReferent(objectSpanRef('tray', 'trayRef'), context)
        expect(result.ok).toBe(false)
    })

    it('resolves actingCharacter to a single-element candidate list of the context character id', () => {
        const context = baseContext(new Map())

        expect(groundReferent(actingCharacterRef, context)).toEqual({ ok: true, candidates: [CHARACTER_ID] })
    })

    it('resolves currentHost(objectSpan) by grounding the inner referent then looking up its host', () => {
        const context = baseContext(new Map([['trayRef', { verdict: 'resolved', candidateIds: [TRAY_ID] }]]))

        expect(groundReferent(currentHostRef(objectSpanRef('tray', 'trayRef')), context)).toEqual({
            ok: true,
            candidates: [ROOM_ID],
        })
    })

    it('drops a candidate whose host does not resolve, keeping others, deduplicating equal hosts', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['benchRef1', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID, TRAY_ID] }],
            ]),
            getCurrentHost: (componentId) => {
                if (componentId === BENCH_A_ID) return ROOM_ID
                if (componentId === TRAY_ID) return ROOM_ID
                return undefined
            },
        }

        expect(groundReferent(currentHostRef(objectSpanRef('bench', 'benchRef1')), context)).toEqual({
            ok: true,
            candidates: [ROOM_ID],
        })
    })

    it('keeps distinct hosts for different candidates rather than collapsing them', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([
                ['benchRef1', { verdict: 'resolved', candidateIds: [BENCH_A_ID, BENCH_B_ID] }],
            ]),
            getCurrentHost: (componentId) => {
                if (componentId === BENCH_A_ID) return ROOM_ID
                if (componentId === BENCH_B_ID) return OTHER_ROOM_ID
                return undefined
            },
        }

        expect(groundReferent(currentHostRef(objectSpanRef('bench', 'benchRef1')), context)).toEqual({
            ok: true,
            candidates: [ROOM_ID, OTHER_ROOM_ID],
        })
    })

    it('propagates a failure from the inner referent of currentHost', () => {
        const context = baseContext(new Map())

        const result = groundReferent(currentHostRef(objectSpanRef('tray', 'trayRef')), context)
        expect(result.ok).toBe(false)
    })

    it('fails cleanly when getCurrentHost has no host for any grounded candidate', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map(),
            getCurrentHost: () => undefined,
        }

        const result = groundReferent(currentHostRef(actingCharacterRef), context)
        expect(result.ok).toBe(false)
    })

    it('resolves one level of nested currentHost(currentHost(...)) recursion', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map(),
            getCurrentHost: (componentId) => {
                if (componentId === CHARACTER_ID) return ROOM_ID
                if (componentId === ROOM_ID) return ROOM_ID
                return undefined
            },
        }

        // currentHost(currentHost(actingCharacter)) --- nothing upstream constructs this yet,
        // but the type allows it, so the recursion itself must not break.
        const result = groundReferent(currentHostRef(currentHostRef(actingCharacterRef)), context)
        expect(result).toEqual({ ok: true, candidates: [ROOM_ID] })
    })
})
