import type { EphemeraCacheDynamoItem } from './baseClasses'

export const DEFAULT_SITUATION_EPHEMERA_ID = 'SITUATION#DEFAULT' as const

/**
 * Select the DEFAULT situation cache row for v1 Feature/Knowledge/Room prose (D9).
 * No fallback to other situation ids.
 */
export function selectDefaultSituationCacheRecord(
    records: EphemeraCacheDynamoItem[]
): EphemeraCacheDynamoItem | undefined {
    return records.find((r) => r.situationId === DEFAULT_SITUATION_EPHEMERA_ID)
}
