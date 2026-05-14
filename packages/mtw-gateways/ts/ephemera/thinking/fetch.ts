import { thinkingResultFromEphemeraItem } from './normalize'
import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import {
    jobEphemeraId,
    jobMetaDataCategory,
    taskEphemeraId,
    thinkingResultMetaDataCategory,
    THINKING_TASK_DATA_CATEGORY_PREFIX,
} from './keys'

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
 * These rows associate work items with the job; payloads (results) live on **`TASK#${workItemId}`** + **`Meta::Result`**.
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
