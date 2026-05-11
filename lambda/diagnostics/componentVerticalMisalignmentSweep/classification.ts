import type { ImportVerticalConsistencyClassification } from '@tonylb/mtw-gateways/ts/assets/components/verticals'

/**
 * Asset-level rollup over per-partition {@link ImportVerticalConsistencyClassification} statuses.
 * Priority matches repair severity: stale (replace) over orphan over missing (insert-only).
 * Returns `null` when every partition is aligned (no finding to emit).
 */
export function aggregateMisalignmentStatuses(
    parts: Array<ImportVerticalConsistencyClassification>
): 'missing' | 'orphan' | 'stale' | null {
    const bad = parts.filter((s): s is 'missing' | 'orphan' | 'stale' => s !== 'aligned')
    if (bad.length === 0) return null
    if (bad.some((s) => s === 'stale')) return 'stale'
    if (bad.some((s) => s === 'orphan')) return 'orphan'
    return 'missing'
}
