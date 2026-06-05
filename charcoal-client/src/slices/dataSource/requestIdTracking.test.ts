import { describe, expect, it } from 'vitest'
import {
    CONFIRMED_TTL_MS,
    PENDING_TTL_MS,
    prunePendingEditsStorage,
    pruneStaleConfirmedRequestIdRows,
    storedConfirmedRequestIdStrings
} from './requestIdTracking'

const NOW = 1_000_000

describe('storedConfirmedRequestIdStrings', () => {
    it('maps storage rows to id strings', () => {
        expect(storedConfirmedRequestIdStrings([
            { id: 'req-a', seenAt: 100 },
            { id: 'req-b', seenAt: 200 }
        ])).toEqual(['req-a', 'req-b'])
    })

    it('returns STABLE_EMPTY for empty rows', () => {
        expect(storedConfirmedRequestIdStrings([])).toEqual([])
    })
})

describe('prunePendingEditsStorage', () => {
    const row = (key: string, time: number) => ({ meta: { key, time }, edit: {} as never })

    it('clears rows matching confirmed ids before age trim', () => {
        const result = prunePendingEditsStorage([
            row('confirmed', NOW - 1),
            row('fresh', NOW - 1)
        ], { now: NOW, confirmedIds: ['confirmed'] })
        expect(result.map((r) => r.meta.key)).toEqual(['fresh'])
    })

    it('trims rows older than PENDING_TTL_MS', () => {
        const result = prunePendingEditsStorage([
            row('stale', NOW - PENDING_TTL_MS),
            row('fresh', NOW - PENDING_TTL_MS + 1)
        ], { now: NOW })
        expect(result.map((r) => r.meta.key)).toEqual(['fresh'])
    })

    it('applies confirmed clear then age trim', () => {
        const result = prunePendingEditsStorage([
            row('confirmed-stale', NOW - PENDING_TTL_MS),
            row('unconfirmed-stale', NOW - PENDING_TTL_MS),
            row('fresh', NOW - 1)
        ], { now: NOW, confirmedIds: ['confirmed-stale'] })
        expect(result.map((r) => r.meta.key)).toEqual(['fresh'])
    })

    it('returns the same array reference when nothing would be pruned', () => {
        const pendingEdits = [
            row('fresh-a', NOW - 1),
            row('fresh-b', NOW - PENDING_TTL_MS + 1)
        ]
        expect(prunePendingEditsStorage(pendingEdits, { now: NOW })).toBe(pendingEdits)
        expect(prunePendingEditsStorage(pendingEdits, { now: NOW, confirmedIds: ['other'] })).toBe(pendingEdits)
    })

    it('returns a new array reference when pruning removes rows', () => {
        const pendingEdits = [row('stale', NOW - PENDING_TTL_MS)]
        const result = prunePendingEditsStorage(pendingEdits, { now: NOW })
        expect(result).not.toBe(pendingEdits)
    })
})

describe('pruneStaleConfirmedRequestIdRows', () => {
    it('removes rows older than CONFIRMED_TTL_MS', () => {
        const result = pruneStaleConfirmedRequestIdRows([
            { id: 'stale', seenAt: NOW - CONFIRMED_TTL_MS },
            { id: 'fresh', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
        ], NOW, CONFIRMED_TTL_MS, [])
        expect(result.map((r) => r.id)).toEqual(['fresh'])
    })

    it('retains stale rows when pending key matches (oscillation invariant)', () => {
        const result = pruneStaleConfirmedRequestIdRows([
            { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
        ], NOW, CONFIRMED_TTL_MS, ['req-a'])
        expect(result.map((r) => r.id)).toEqual(['req-a'])
    })

    it('removes stale row once pending key is gone', () => {
        const result = pruneStaleConfirmedRequestIdRows([
            { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
        ], NOW, CONFIRMED_TTL_MS, [])
        expect(result).toEqual([])
    })

    it('returns the same array reference when nothing would be pruned', () => {
        const allFresh = [
            { id: 'fresh-a', seenAt: NOW - CONFIRMED_TTL_MS + 1 },
            { id: 'fresh-b', seenAt: NOW - 1 }
        ]
        expect(pruneStaleConfirmedRequestIdRows(allFresh, NOW, CONFIRMED_TTL_MS, [])).toBe(allFresh)

        const staleProtectedByPending = [
            { id: 'fresh', seenAt: NOW - CONFIRMED_TTL_MS + 1 },
            { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
        ]
        expect(
            pruneStaleConfirmedRequestIdRows(staleProtectedByPending, NOW, CONFIRMED_TTL_MS, ['req-a'])
        ).toBe(staleProtectedByPending)
    })

    it('returns a new array reference when pruning removes rows', () => {
        const rows = [{ id: 'stale', seenAt: NOW - CONFIRMED_TTL_MS }]
        const result = pruneStaleConfirmedRequestIdRows(rows, NOW, CONFIRMED_TTL_MS, [])
        expect(result).not.toBe(rows)
    })
})
