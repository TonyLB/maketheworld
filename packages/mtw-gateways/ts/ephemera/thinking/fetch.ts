import {
    thinkingJobMetaFromEphemeraItem,
    thinkingResultFromEphemeraItem,
    thinkingScheduleFromEphemeraItem,
} from './normalize'
import type { ThinkingJobStatus, ThinkingResultEvent, ThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import {
    jobEphemeraId,
    jobMetaDataCategory,
    parseWorkItemIdFromTaskEphemeraId,
    taskEphemeraId,
    thinkingResultMetaDataCategory,
    thinkingScheduleMetaDataCategory,
    THINKING_TASK_DATA_CATEGORY_PREFIX,
} from './keys'

/** Job-scoped read snapshot for rollup, `Job Completed` assembly, and `internalCache.ThinkingJobs`. */
export type ThinkingJobReadSnapshot = {
    generationId: string
    jobStatus: ThinkingJobStatus | null
    schemaVersion?: number
    createdAt?: string
    failedAt?: string
    errorCode?: string
    errorMessage?: string
    lastFailedWorkItemId?: string
    /** Membership from adjacency query (query order); includes ids without a schedule row. */
    workItemIds: string[]
    /** Normalized schedule rows only; adjacency without `Meta::Schedule` is omitted. */
    schedules: ThinkingScheduleEvent[]
}

const parseWorkItemIdsFromAdjacencyRows = (rows: Record<string, unknown>[]): string[] => {
    const out: string[] = []
    for (const row of rows) {
        if (typeof row.DataCategory !== 'string') {
            continue
        }
        const workItemId = parseWorkItemIdFromTaskEphemeraId(row.DataCategory)
        if (workItemId) {
            out.push(workItemId)
        }
    }
    return out
}

const fetchSchedulesForWorkItemIds = async (
    db: EphemeraThinkingReadDB,
    workItemIds: string[]
): Promise<ThinkingScheduleEvent[]> => {
    const schedules: ThinkingScheduleEvent[] = []
    const results = await Promise.all(
        workItemIds.map(async (workItemId) => {
            const item = await getTaskScheduleItem(db, workItemId)
            return item ? thinkingScheduleFromEphemeraItem(item) : null
        })
    )
    for (const normalized of results) {
        if (normalized) {
            schedules.push(normalized)
        }
    }
    return schedules
}

/**
 * Narrow store surface for thinking read gateway tests and production `ephemeraDB`.
 */
export type EphemeraThinkingReadDB = {
    query: <Row extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string }
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, string>
        allFields?: boolean
        ProjectionFields?: string[]
    }) => Promise<Row[]>
    getItem: <Row extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string; DataCategory: string }
        getAllFields?: boolean
        ProjectionFields?: string[]
    }) => Promise<Row | undefined>
}

/**
 * Adjacency rows under **`JOB#${generationId}`** (`DataCategory` begins with **`TASK#`**).
 * These rows associate work items with the job; payloads live on **`TASK#${workItemId}`** + **`Meta::Result`** / **`Meta::Schedule`**.
 */
export const queryTaskRowsForJob = async (
    db: EphemeraThinkingReadDB,
    generationId: string
): Promise<Record<string, unknown>[]> => {
    return db.query({
        Key: { EphemeraId: jobEphemeraId(generationId) },
        KeyConditionExpression: 'begins_with(DataCategory, :taskPrefix)',
        ExpressionAttributeValues: { ':taskPrefix': THINKING_TASK_DATA_CATEGORY_PREFIX },
        allFields: true,
    })
}

export const getTaskResultItem = async (
    db: EphemeraThinkingReadDB,
    workItemId: string
): Promise<Record<string, unknown> | undefined> => {
    return db.getItem({
        Key: {
            EphemeraId: taskEphemeraId(workItemId),
            DataCategory: thinkingResultMetaDataCategory(),
        },
        getAllFields: true,
    })
}

export const getTaskScheduleItem = async (
    db: EphemeraThinkingReadDB,
    workItemId: string
): Promise<Record<string, unknown> | undefined> => {
    return db.getItem({
        Key: {
            EphemeraId: taskEphemeraId(workItemId),
            DataCategory: thinkingScheduleMetaDataCategory(),
        },
        getAllFields: true,
    })
}

/**
 * Job metadata row; schema is owned by the persistence slice. Callers treat as an opaque record.
 */
export const getJobMetaItem = async (
    db: EphemeraThinkingReadDB,
    generationId: string
): Promise<Record<string, unknown> | undefined> => {
    return db.getItem({
        Key: {
            EphemeraId: jobEphemeraId(generationId),
            DataCategory: jobMetaDataCategory(),
        },
        getAllFields: true,
    })
}

export const fetchThinkingResult = async (
    db: EphemeraThinkingReadDB,
    workItemId: string
): Promise<ThinkingResultEvent | null> => {
    const item = await getTaskResultItem(db, workItemId)
    return item ? thinkingResultFromEphemeraItem(item) : null
}

export const fetchThinkingSchedule = async (
    db: EphemeraThinkingReadDB,
    workItemId: string
): Promise<ThinkingScheduleEvent | null> => {
    const item = await getTaskScheduleItem(db, workItemId)
    return item ? thinkingScheduleFromEphemeraItem(item) : null
}

/**
 * List schedule payloads for all work items on a job: adjacency **`Query`** on **`JOB#`**, then
 * per-**`workItemId`** **`GetItem`** on **`Meta::Schedule`**. Omits adjacency lines with missing
 * or malformed schedule rows (does not fail the whole load).
 */
export const listThinkingSchedulesForJob = async (
    db: EphemeraThinkingReadDB,
    generationId: string
): Promise<ThinkingScheduleEvent[]> => {
    const adjacencyRows = await queryTaskRowsForJob(db, generationId)
    const workItemIds = parseWorkItemIdsFromAdjacencyRows(adjacencyRows)
    return fetchSchedulesForWorkItemIds(db, workItemIds)
}

/**
 * Load job metadata plus adjacency membership and schedule rows for one **`generationId`**.
 */
export const fetchThinkingJobSnapshot = async (
    db: EphemeraThinkingReadDB,
    generationId: string
): Promise<ThinkingJobReadSnapshot> => {
    const [metaItem, adjacencyRows] = await Promise.all([
        getJobMetaItem(db, generationId),
        queryTaskRowsForJob(db, generationId),
    ])
    const meta = metaItem ? thinkingJobMetaFromEphemeraItem(metaItem) : null
    const workItemIds = parseWorkItemIdsFromAdjacencyRows(adjacencyRows)
    const schedules = await fetchSchedulesForWorkItemIds(db, workItemIds)
    return {
        generationId,
        jobStatus: meta?.jobStatus ?? null,
        ...(meta?.schemaVersion !== undefined ? { schemaVersion: meta.schemaVersion } : {}),
        ...(meta?.createdAt !== undefined ? { createdAt: meta.createdAt } : {}),
        ...(meta?.failedAt !== undefined ? { failedAt: meta.failedAt } : {}),
        ...(meta?.errorCode !== undefined ? { errorCode: meta.errorCode } : {}),
        ...(meta?.errorMessage !== undefined ? { errorMessage: meta.errorMessage } : {}),
        ...(meta?.lastFailedWorkItemId !== undefined
            ? { lastFailedWorkItemId: meta.lastFailedWorkItemId }
            : {}),
        workItemIds,
        schedules,
    }
}
