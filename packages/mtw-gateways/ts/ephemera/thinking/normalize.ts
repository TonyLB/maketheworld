import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { isThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import { isThinkingResultMetaDataCategory, THINKING_TASK_EPHEMERA_PREFIX } from './keys'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isTaskPartitionEphemeraIdString = (ephemeraId: unknown): ephemeraId is string =>
    typeof ephemeraId === 'string' && ephemeraId.startsWith(THINKING_TASK_EPHEMERA_PREFIX)

/**
 * Normalize a Dynamo item into `ThinkingResultEvent`.
 *
 * **Physical row contract:** persistence stores contract fields as **top-level** attributes
 * (`schemaVersion`, `generationId`, `workItemId`, `segment`, `ok`, `completedAt`, optional
 * `errorCode`, `errorMessage`, `verbose`) alongside `EphemeraId` and `DataCategory`. Keys are
 * stripped before validation. Result rows use **`EphemeraId` = `TASK#${workItemId}`** and
 * **`DataCategory` = `Meta::Result`**.
 */
export const thinkingResultFromEphemeraItem = (item: unknown): ThinkingResultEvent | null => {
    if (!isRecord(item)) {
        return null
    }
    const { EphemeraId: _e, DataCategory: _d, ...rest } = item
    return isThinkingResultEvent(rest) ? rest : null
}

export const filterThinkingResultRows = (rows: unknown[]): ThinkingResultEvent[] => {
    const out: ThinkingResultEvent[] = []
    for (const row of rows) {
        if (
            !isRecord(row) ||
            !isTaskPartitionEphemeraIdString(row.EphemeraId) ||
            typeof row.DataCategory !== 'string' ||
            !isThinkingResultMetaDataCategory(row.DataCategory)
        ) {
            continue
        }
        const normalized = thinkingResultFromEphemeraItem(row)
        if (normalized) {
            out.push(normalized)
        }
    }
    return out
}
