import {
    jobEphemeraId,
    jobMetaDataCategory,
    jobTaskAdjacencyDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { isThinkingJobCreateEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'

export type PersistThinkingJobCreateOutcome = 'written' | 'invalidPayload'

/**
 * Bootstrap job partition: `Meta::Job` plus one adjacency stub per `workItemId` (overwrite-safe).
 */
export async function persistThinkingJobCreate(payload: unknown): Promise<PersistThinkingJobCreateOutcome> {
    if (!isThinkingJobCreateEvent(payload)) {
        return 'invalidPayload'
    }
    const event = payload
    const jobItem = {
        EphemeraId: jobEphemeraId(event.generationId),
        DataCategory: jobMetaDataCategory(),
        schemaVersion: event.schemaVersion,
        generationId: event.generationId,
        jobStatus: event.jobStatus,
        ...(event.createdAt !== undefined ? { createdAt: event.createdAt } : {}),
    }
    await ephemeraDB.putItem(jobItem)
    await Promise.all(
        event.workItemIds.map((workItemId) =>
            ephemeraDB.putItem({
                EphemeraId: jobEphemeraId(event.generationId),
                DataCategory: jobTaskAdjacencyDataCategory(workItemId),
            })
        )
    )
    internalCache.ThinkingJobs.invalidate(event.generationId)
    return 'written'
}
