import type {
    ThinkingJobStatus,
    ThinkingResultEvent,
    ThinkingScheduleEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    isThinkingJobStatus,
    isThinkingResultEvent,
    isThinkingScheduleEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import {
    isThinkingResultMetaDataCategory,
    isThinkingScheduleMetaDataCategory,
    THINKING_TASK_EPHEMERA_PREFIX,
} from './keys'

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

/**
 * Normalize a Dynamo item into `ThinkingScheduleEvent`.
 *
 * **Physical row contract:** persistence stores contract fields as **top-level** attributes
 * (`schemaVersion`, `generationId`, `workItemId`, `segment`, `scheduleStatus`, optional `enqueuedAt`)
 * alongside `EphemeraId` and `DataCategory`. Keys are stripped before validation. Schedule rows use
 * **`EphemeraId` = `TASK#${workItemId}`** and **`DataCategory` = `Meta::Schedule`**.
 */
export const thinkingScheduleFromEphemeraItem = (item: unknown): ThinkingScheduleEvent | null => {
    if (!isRecord(item)) {
        return null
    }
    const { EphemeraId: _e, DataCategory: _d, ...rest } = item
    return isThinkingScheduleEvent(rest) ? rest : null
}

/** Normalized fields from a persisted `Meta::Job` row (job partition). */
export type ThinkingJobMeta = {
    schemaVersion: number
    generationId: string
    jobStatus: ThinkingJobStatus
    createdAt?: string
    completedAt?: string
    failedAt?: string
    errorCode?: string
    errorMessage?: string
    lastFailedWorkItemId?: string
}

const isThinkingJobMetaPayload = (rest: Record<string, unknown>): rest is ThinkingJobMeta => {
    if (typeof rest.schemaVersion !== 'number' || typeof rest.generationId !== 'string') {
        return false
    }
    return isThinkingJobStatus(rest.jobStatus)
}

/**
 * Normalize a Dynamo item into job metadata fields from **`Meta::Job`**.
 *
 * **Physical row contract:** `schemaVersion`, `generationId`, `jobStatus`, and optional run-level
 * timestamps / error fields at the top level alongside `EphemeraId` and `DataCategory`.
 */
export const thinkingJobMetaFromEphemeraItem = (item: unknown): ThinkingJobMeta | null => {
    if (!isRecord(item)) {
        return null
    }
    const { EphemeraId: _e, DataCategory: _d, ...rest } = item
    if (!isThinkingJobMetaPayload(rest)) {
        return null
    }
    const meta: ThinkingJobMeta = {
        schemaVersion: rest.schemaVersion,
        generationId: rest.generationId,
        jobStatus: rest.jobStatus,
    }
    if (typeof rest.createdAt === 'string') {
        meta.createdAt = rest.createdAt
    }
    if (typeof rest.completedAt === 'string') {
        meta.completedAt = rest.completedAt
    }
    if (typeof rest.failedAt === 'string') {
        meta.failedAt = rest.failedAt
    }
    if (typeof rest.errorCode === 'string') {
        meta.errorCode = rest.errorCode
    }
    if (typeof rest.errorMessage === 'string') {
        meta.errorMessage = rest.errorMessage
    }
    if (typeof rest.lastFailedWorkItemId === 'string') {
        meta.lastFailedWorkItemId = rest.lastFailedWorkItemId
    }
    return meta
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

export const filterThinkingScheduleRows = (rows: unknown[]): ThinkingScheduleEvent[] => {
    const out: ThinkingScheduleEvent[] = []
    for (const row of rows) {
        if (
            !isRecord(row) ||
            !isTaskPartitionEphemeraIdString(row.EphemeraId) ||
            typeof row.DataCategory !== 'string' ||
            !isThinkingScheduleMetaDataCategory(row.DataCategory)
        ) {
            continue
        }
        const normalized = thinkingScheduleFromEphemeraItem(row)
        if (normalized) {
            out.push(normalized)
        }
    }
    return out
}
