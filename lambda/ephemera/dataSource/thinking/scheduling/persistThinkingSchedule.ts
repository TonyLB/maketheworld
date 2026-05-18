import {
    isTerminalThinkingScheduleStatus,
    jobEphemeraId,
    jobTaskAdjacencyDataCategory,
    taskEphemeraId,
    thinkingDeleteAtFromTerminalIso,
    thinkingScheduleMetaDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { isThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'

export type PersistThinkingScheduleOutcome = 'written' | 'invalidPayload'

/**
 * Persist schedule state: job adjacency (`JOB#` + `TASK#` sort key) then overwrite `Meta::Schedule`
 * on `TASK#${workItemId}` (status transitions use putItem, not nonCollidingPutItem).
 */
export async function persistThinkingSchedule(payload: unknown): Promise<PersistThinkingScheduleOutcome> {
    if (!isThinkingScheduleEvent(payload)) {
        return 'invalidPayload'
    }
    const event = payload
    const terminalRetention =
        isTerminalThinkingScheduleStatus(event.scheduleStatus)
            ? { deleteAt: thinkingDeleteAtFromTerminalIso(new Date().toISOString()) }
            : {}
    await ephemeraDB.putItem({
        EphemeraId: jobEphemeraId(event.generationId),
        DataCategory: jobTaskAdjacencyDataCategory(event.workItemId),
        ...terminalRetention,
    })
    const item = {
        EphemeraId: taskEphemeraId(event.workItemId),
        DataCategory: thinkingScheduleMetaDataCategory(),
        schemaVersion: event.schemaVersion,
        generationId: event.generationId,
        workItemId: event.workItemId,
        segment: event.segment,
        scheduleStatus: event.scheduleStatus,
        ...terminalRetention,
        ...(event.enqueuedAt !== undefined ? { enqueuedAt: event.enqueuedAt } : {}),
    }
    await ephemeraDB.putItem(item)
    internalCache.ThinkingSchedules.invalidate(event.workItemId)
    internalCache.ThinkingJobs.invalidate(event.generationId)
    return 'written'
}
