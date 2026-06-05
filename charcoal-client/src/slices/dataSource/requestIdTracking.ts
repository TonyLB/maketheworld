import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ConfirmedRequestId, RequestIdTrackingHeaderField } from './baseClasses'

export const PENDING_TTL_MS = 3 * 60 * 1000
export const CONFIRMED_TTL_MS = 5 * 60 * 1000

const extractRequestIdsArray = (header: Record<string, unknown>): string[] => {
    const v = header.RequestIds
    if (!Array.isArray(v) || v.length === 0) {
        return []
    }
    return v.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const extractRequestIdSingular = (header: Record<string, unknown>): string[] => {
    const v = header.RequestId
    if (typeof v !== 'string' || v.length === 0) {
        return []
    }
    return [v]
}

export const extractConfirmedIdsFromHeader = (
    header: StreamingEventHeader & Record<string, unknown>,
    headerField: RequestIdTrackingHeaderField
): string[] => {
    const headerRecord = header as Record<string, unknown>

    if (headerField === 'RequestIds') {
        return extractRequestIdsArray(headerRecord)
    }
    if (headerField === 'RequestId') {
        return extractRequestIdSingular(headerRecord)
    }

    const fromArray = extractRequestIdsArray(headerRecord)
    const seen = new Set(fromArray)
    const fromSingular = extractRequestIdSingular(headerRecord).filter((id) => !seen.has(id))
    return [...fromArray, ...fromSingular]
}

export const appendConfirmedRequestIds = (
    existing: ConfirmedRequestId[] | undefined,
    ids: string[],
    seenAt: number
): ConfirmedRequestId[] => [
    ...(existing ?? []),
    ...ids.map((id) => ({ id, seenAt }))
]

/** Stable empty result for I1 referential stability when no ids pass TTL filter. */
export const STABLE_EMPTY_CONFIRMED_IDS: string[] = []

type ConfirmedIdsCacheEntry = { now: number; ttl: number; result: string[] }
const confirmedIdsCacheByRows = new WeakMap<ConfirmedRequestId[], ConfirmedIdsCacheEntry>()

const computeConfirmedRequestIdStrings = (
    rows: ConfirmedRequestId[],
    now: number,
    confirmedTtlMs: number
): string[] =>
    rows
        .filter(({ seenAt }) => now - seenAt < confirmedTtlMs)
        .map(({ id }) => id)

export const selectConfirmedRequestIdStrings = (
    rows: ConfirmedRequestId[] | undefined,
    now: number,
    confirmedTtlMs: number = CONFIRMED_TTL_MS
): string[] => {
    if (!rows) {
        return STABLE_EMPTY_CONFIRMED_IDS
    }

    const cached = confirmedIdsCacheByRows.get(rows)
    if (cached && cached.now === now && cached.ttl === confirmedTtlMs) {
        return cached.result
    }

    const computed = computeConfirmedRequestIdStrings(rows, now, confirmedTtlMs)
    const result = computed.length === 0 ? STABLE_EMPTY_CONFIRMED_IDS : computed
    confirmedIdsCacheByRows.set(rows, { now, ttl: confirmedTtlMs, result })
    return result
}

/** Map raw storage rows to id strings (no TTL filter). */
export const storedConfirmedRequestIdStrings = (
    rows: ConfirmedRequestId[] | undefined
): string[] => (rows ?? []).map(({ id }) => id)

export type PendingEditRow = {
    meta: { key: string; time: number }
}

/**
 * Storage GC for pendingEdits: clear by confirmed ids, then trim by age.
 * Uses a `.some` fast-path before `.filter` so no-op periodic cleanup (the common
 * case) returns the original array reference without allocating a throwaway copy.
 * Trade-off: when rows are actually removed, we scan twice (some + filter).
 */
export const prunePendingEditsStorage = <T extends PendingEditRow>(
    pendingEdits: T[],
    { now, confirmedIds }: { now: number; confirmedIds?: string[] }
): T[] => {
    const confirmedSet = confirmedIds?.length ? new Set(confirmedIds) : null
    const wouldPrune = pendingEdits.some(
        ({ meta }) => confirmedSet?.has(meta.key) || now - meta.time >= PENDING_TTL_MS
    )
    if (!wouldPrune) {
        return pendingEdits
    }
    return pendingEdits.filter(({ meta }) => {
        if (confirmedSet?.has(meta.key)) {
            return false
        }
        return now - meta.time < PENDING_TTL_MS
    })
}

/**
 * Storage GC for confirmedRequestIds; retains rows with live pending keys (oscillation invariant).
 * Same `.some` fast-path as prunePendingEditsStorage: no allocation on no-op, double scan when pruning.
 */
export const pruneStaleConfirmedRequestIdRows = (
    rows: ConfirmedRequestId[],
    now: number,
    confirmedTtlMs: number,
    pendingKeys: Iterable<string>
): ConfirmedRequestId[] => {
    const pendingSet = pendingKeys instanceof Set ? pendingKeys : new Set(pendingKeys)
    const wouldPrune = rows.some(
        ({ id, seenAt }) => !pendingSet.has(id) && now - seenAt >= confirmedTtlMs
    )
    if (!wouldPrune) {
        return rows
    }
    return rows.filter(({ id, seenAt }) =>
        pendingSet.has(id) || now - seenAt < confirmedTtlMs
    )
}
