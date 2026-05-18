import {
    jobEphemeraId,
    jobTaskAdjacencyDataCategory,
    taskEphemeraId,
    thinkingDeleteAtFromTerminalIso,
    thinkingScheduleMetaDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import type { ThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'

/**
 * Overwrite a work item's schedule as cancelled with Dynamo TTL. Used on job failure cleanup.
 */
export async function cancelThinkingScheduleWithRetention(
    schedule: ThinkingScheduleEvent,
    terminalAtIso: string
): Promise<void> {
    const deleteAt = thinkingDeleteAtFromTerminalIso(terminalAtIso)
    await ephemeraDB.putItem({
        EphemeraId: jobEphemeraId(schedule.generationId),
        DataCategory: jobTaskAdjacencyDataCategory(schedule.workItemId),
        deleteAt,
    })
    const item = {
        EphemeraId: taskEphemeraId(schedule.workItemId),
        DataCategory: thinkingScheduleMetaDataCategory(),
        schemaVersion: schedule.schemaVersion,
        generationId: schedule.generationId,
        workItemId: schedule.workItemId,
        segment: schedule.segment,
        scheduleStatus: 'cancelled' as const,
        deleteAt,
        ...(schedule.enqueuedAt !== undefined ? { enqueuedAt: schedule.enqueuedAt } : {}),
    }
    await ephemeraDB.putItem(item)
    internalCache.ThinkingSchedules.invalidate(schedule.workItemId)
}
