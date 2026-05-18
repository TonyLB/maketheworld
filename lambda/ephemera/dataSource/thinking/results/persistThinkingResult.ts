import {
    jobEphemeraId,
    jobTaskAdjacencyDataCategory,
    taskEphemeraId,
    thinkingDeleteAtFromTerminalIso,
    thinkingResultMetaDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { isThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'

export type PersistThinkingResultOutcome = 'written' | 'alreadyFinalized' | 'invalidPayload'

/**
 * Persist a completed thinking result: job adjacency stub (`JOB#` + `TASK#` sort key) then
 * idempotent `Meta::Result` on `TASK#${workItemId}`. First successful `Meta::Result` write wins
 * (`nonCollidingPutItem`); retries return `alreadyFinalized`.
 */
export async function persistThinkingResult(payload: unknown): Promise<PersistThinkingResultOutcome> {
    if (!isThinkingResultEvent(payload)) {
        return 'invalidPayload'
    }
    const event = payload
    const deleteAt = thinkingDeleteAtFromTerminalIso(event.completedAt)
    await ephemeraDB.putItem({
        EphemeraId: jobEphemeraId(event.generationId),
        DataCategory: jobTaskAdjacencyDataCategory(event.workItemId),
        deleteAt,
    })
    const item = {
        EphemeraId: taskEphemeraId(event.workItemId),
        DataCategory: thinkingResultMetaDataCategory(),
        schemaVersion: event.schemaVersion,
        generationId: event.generationId,
        workItemId: event.workItemId,
        segment: event.segment,
        ok: event.ok,
        completedAt: event.completedAt,
        deleteAt,
        ...(event.errorCode !== undefined ? { errorCode: event.errorCode } : {}),
        ...(event.errorMessage !== undefined ? { errorMessage: event.errorMessage } : {}),
        ...(event.verbose !== undefined ? { verbose: event.verbose } : {}),
    }
    const inserted = await ephemeraDB.nonCollidingPutItem(item)
    if (inserted) {
        internalCache.ThinkingResults.invalidate(event.workItemId)
        return 'written'
    }
    return 'alreadyFinalized'
}
