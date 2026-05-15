import { jobEphemeraId, jobMetaDataCategory } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import type { ThinkingJobReadSnapshot } from '@tonylb/mtw-gateways/ts/ephemera/thinking/fetch'
import type { ThinkingJobCompletedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    THINKING_JOB_COMPLETED_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'

export type MaybeCompleteThinkingJobOutcome = 'noop' | 'completed'

const ACTIVE_JOB_STATUSES = new Set<string>(['running', 'pending'])

/** Dynamo row shape for `Meta::Job` optimistic merge (subset of persisted fields). */
type ThinkingMetaJobRow = {
    EphemeraId?: string
    DataCategory?: string
    generationId?: string
    jobStatus?: string
    schemaVersion?: number
    createdAt?: string
    completedAt?: string
    failedAt?: string
    errorCode?: string
    errorMessage?: string
    lastFailedWorkItemId?: string
}

const metaJobKey = (generationId: string) => ({
    EphemeraId: jobEphemeraId(generationId),
    DataCategory: jobMetaDataCategory(),
})

/**
 * True when every adjacency work item has a schedule row with `scheduleStatus: 'completed'`.
 */
export const allJobSchedulesCompleted = (snapshot: ThinkingJobReadSnapshot): boolean => {
    if (snapshot.workItemIds.length === 0) {
        return false
    }
    return snapshot.workItemIds.every((workItemId) => {
        const schedule = snapshot.schedules.find((s) => s.workItemId === workItemId)
        return schedule?.scheduleStatus === 'completed'
    })
}

/**
 * After a schedule put + `ThinkingJobs.invalidate`, roll up to `Meta::Job` completed when all hops
 * are done and emit one internal-bus `Job Completed` on the first active -> completed transition.
 */
export async function maybeCompleteThinkingJob(deps: {
    generationId: string
    streamEvent: StreamEventFunction<ThinkingJobCompletedEvent, StreamingEventHeader>
}): Promise<MaybeCompleteThinkingJobOutcome> {
    const { generationId, streamEvent } = deps
    const snapshot = await internalCache.ThinkingJobs.get(generationId)

    if (
        snapshot.jobStatus === null ||
        !ACTIVE_JOB_STATUSES.has(snapshot.jobStatus) ||
        !allJobSchedulesCompleted(snapshot)
    ) {
        return 'noop'
    }

    const key = metaJobKey(generationId)
    const existing = await ephemeraDB.getItem<ThinkingMetaJobRow>({
        Key: key,
        getAllFields: true,
    })
    if (!existing?.generationId) {
        return 'noop'
    }

    const priorJobStatus = existing.jobStatus
    if (!priorJobStatus || !ACTIVE_JOB_STATUSES.has(priorJobStatus)) {
        return 'noop'
    }

    const completedAt = new Date().toISOString()
    const schemaVersion =
        snapshot.schemaVersion ?? existing.schemaVersion ?? THINKING_SCHEMA_VERSION_INITIAL

    await ephemeraDB.optimisticUpdate({
        Key: key,
        priorFetch: existing,
        updateKeys: ['jobStatus', 'completedAt', 'schemaVersion'],
        updateReducer: (draft) => {
            draft.jobStatus = 'completed'
            draft.completedAt = completedAt
            draft.schemaVersion = schemaVersion
        },
    })

    internalCache.ThinkingJobs.invalidate(generationId)

    const completedEvent: ThinkingJobCompletedEvent = {
        schemaVersion,
        generationId,
        jobStatus: 'completed',
        completedAt,
        schedules: snapshot.schedules,
    }

    await streamEvent({
        streamKey: jobEphemeraId(generationId),
        header: { type: THINKING_JOB_COMPLETED_HEADER_TYPE },
        update: completedEvent,
    })

    return 'completed'
}
