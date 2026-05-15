// Ephemera thinking: schedule + result + job-completed EventBridge contracts;
// job bootstrap/error (api.ephemera only, not in ThinkingEventSerializer).
//
// Wire shapes are consumed by ephemera, subscriptions, and charcoal-client.
// Header discrimination uses StreamingEventHeader.type; external Detail carries payload `type`.

import {
    AggregationResult,
    DataSourceAggregator
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import {
    DataSourceEventSerializer,
    StreamingEventHeader
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ResolvedStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

/** EventBridge / streaming header `type` for a schedule-line update (provisional until publisher exists). */
export const THINKING_SCHEDULE_HEADER_TYPE = 'Thinking Schedule' as const

/** EventBridge / streaming header `type` for a thinking-result update. */
export const THINKING_RESULT_HEADER_TYPE = 'Thinking Result' as const

/** EventBridge / streaming header `type` for run-level job completion (scheduling DataSource streamEvent). */
export const THINKING_JOB_COMPLETED_HEADER_TYPE = 'Job Completed' as const

/** Detail-type string aligned with header.type for PutEvents / replay consumers. */
export const THINKING_SCHEDULE_DETAIL_TYPE = THINKING_SCHEDULE_HEADER_TYPE

export const THINKING_RESULT_DETAIL_TYPE = THINKING_RESULT_HEADER_TYPE

export const THINKING_JOB_COMPLETED_DETAIL_TYPE = THINKING_JOB_COMPLETED_HEADER_TYPE

/** Initial wire schema; bump when breaking envelope fields. */
export const THINKING_SCHEMA_VERSION_INITIAL = 1 as const

/**
 * Neutral routing key for a work item (API / Dynamo denormalization / harness phase).
 * Spelling matches task-plan examples; server maps pipeline stages to these literals.
 */
export type ThinkingSegment = 'candidates' | 'planSelect' | 'narrativeBeats'

const THINKING_SEGMENTS: readonly ThinkingSegment[] = ['candidates', 'planSelect', 'narrativeBeats']

export const isThinkingSegment = (value: unknown): value is ThinkingSegment =>
    typeof value === 'string' && (THINKING_SEGMENTS as readonly string[]).includes(value)

/** Run / job generation id (UUID string). */
export type ThinkingGenerationId = string

/** Per-task stable id (UUID string), pre-minted by the producer. */
export type ThinkingWorkItemId = string

/** Schedule lifecycle for subscribe / replay and Meta::Schedule persistence. */
export type ThinkingScheduleStatus = 'scheduled' | 'claimed' | 'cancelled' | 'completed'

const THINKING_SCHEDULE_STATUSES: readonly ThinkingScheduleStatus[] = [
    'scheduled',
    'claimed',
    'cancelled',
    'completed'
]

/** Initial job row status for api.ephemera Put Thinking Job Create (Meta::Job bootstrap). */
export type ThinkingJobCreateStatus = 'pending' | 'running'

/** Run-level job failure (distinct from per-step ThinkingResultEvent). */
export type ThinkingJobErrorStatus = 'failed'

/** Run-level job success after all schedule items complete (scheduling rollup). */
export type ThinkingJobCompleteStatus = 'completed'

/** All persisted Meta::Job jobStatus values (rollup + bootstrap + failure). */
export type ThinkingJobStatus = ThinkingJobCreateStatus | ThinkingJobErrorStatus | ThinkingJobCompleteStatus

const THINKING_JOB_STATUSES: readonly ThinkingJobStatus[] = ['pending', 'running', 'failed', 'completed']

export const isThinkingJobStatus = (value: unknown): value is ThinkingJobStatus =>
    typeof value === 'string' && (THINKING_JOB_STATUSES as readonly string[]).includes(value)

//
// Internal (messageBus): no payload `type`; discriminate via envelope header.type only.
//

export type ThinkingScheduleEvent = {
    schemaVersion: number
    generationId: ThinkingGenerationId
    workItemId: ThinkingWorkItemId
    segment: ThinkingSegment
    scheduleStatus: ThinkingScheduleStatus
    /** ISO-8601 timestamp when the item was enqueued, if known. */
    enqueuedAt?: string
}

/**
 * Completed thinking unit (success or failure). `verbose` is opaque at this boundary;
 * ephemera aligns shape with lambda harness inject types per `segment`.
 */
export type ThinkingResultEvent = {
    schemaVersion: number
    generationId: ThinkingGenerationId
    workItemId: ThinkingWorkItemId
    segment: ThinkingSegment
    ok: boolean
    /** ISO-8601 completion time. */
    completedAt: string
    errorCode?: string
    errorMessage?: string
    verbose?: unknown
}

/**
 * Bootstrap a thinking job partition: Meta::Job fields plus membership work item ids
 * (api.ephemera Put Thinking Job Create). Not part of ThinkingEventUpdate / EventBridge serializer.
 */
export type ThinkingJobCreateEvent = {
    schemaVersion: number
    generationId: ThinkingGenerationId
    workItemIds: ThinkingWorkItemId[]
    jobStatus: ThinkingJobCreateStatus
    /** ISO-8601 job creation time when known. */
    createdAt?: string
}

/**
 * Mark a job as failed at run level (api.ephemera Put Thinking Job Error).
 * Does not carry segment or per-step result semantics.
 */
export type ThinkingJobErrorEvent = {
    schemaVersion: number
    generationId: ThinkingGenerationId
    jobStatus: ThinkingJobErrorStatus
    /** ISO-8601 when the run was marked failed. */
    failedAt: string
    errorCode?: string
    errorMessage?: string
    lastFailedWorkItemId?: ThinkingWorkItemId
}

/**
 * Run-level job completion (mtw.ephemera.thinking.scheduling streamEvent after rollup).
 * Schedule snapshot only; no result bodies. Not an api.ephemera command.
 */
export type ThinkingJobCompletedEvent = {
    schemaVersion: number
    generationId: ThinkingGenerationId
    jobStatus: ThinkingJobCompleteStatus
    /** ISO-8601 when the job first transitioned to completed. */
    completedAt: string
    /** Terminal schedule snapshot for the job; no result bodies. */
    schedules: ThinkingScheduleEvent[]
}

export type ThinkingEventUpdate = ThinkingScheduleEvent | ThinkingResultEvent | ThinkingJobCompletedEvent

/**
 * Subscribe-time snapshot for mtw.ephemera.thinking.scheduling (streamKey `global`).
 * MVP may ship an empty `completedJobs` list; replay supplies Job Completed events after subscribe.
 */
export type ThinkingCompletedJobsSnapshot = {
    completedJobs: ThinkingJobCompletedEvent[]
}

//
// External (EventBridge Detail): includes `type` for wire / far-end header reconstruction.
//

export type ThinkingScheduleEventExternal = ThinkingScheduleEvent & {
    type: typeof THINKING_SCHEDULE_HEADER_TYPE
}

export type ThinkingResultEventExternal = ThinkingResultEvent & {
    type: typeof THINKING_RESULT_HEADER_TYPE
}

export type ThinkingJobCompletedEventExternal = ThinkingJobCompletedEvent & {
    type: typeof THINKING_JOB_COMPLETED_HEADER_TYPE
}

export type ThinkingEventExternal =
    | ThinkingScheduleEventExternal
    | ThinkingResultEventExternal
    | ThinkingJobCompletedEventExternal

export type ThinkingCompletedJobsSnapshotExternal = ThinkingCompletedJobsSnapshot

export type ThinkingSchedulingExternal = ThinkingEventExternal | ThinkingCompletedJobsSnapshotExternal

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const isThinkingScheduleEvent = (event: unknown): event is ThinkingScheduleEvent => {
    if (!isRecord(event)) {
        return false
    }
    return (
        typeof event.schemaVersion === 'number' &&
        typeof event.generationId === 'string' &&
        typeof event.workItemId === 'string' &&
        isThinkingSegment(event.segment) &&
        typeof event.scheduleStatus === 'string' &&
        (THINKING_SCHEDULE_STATUSES as readonly string[]).includes(event.scheduleStatus) &&
        (event.enqueuedAt === undefined || typeof event.enqueuedAt === 'string') &&
        !('ok' in event)
    )
}

export const isThinkingResultEvent = (event: unknown): event is ThinkingResultEvent => {
    if (!isRecord(event)) {
        return false
    }
    return (
        typeof event.schemaVersion === 'number' &&
        typeof event.generationId === 'string' &&
        typeof event.workItemId === 'string' &&
        isThinkingSegment(event.segment) &&
        typeof event.ok === 'boolean' &&
        typeof event.completedAt === 'string' &&
        (event.errorCode === undefined || typeof event.errorCode === 'string') &&
        (event.errorMessage === undefined || typeof event.errorMessage === 'string') &&
        !('type' in event) &&
        !('scheduleStatus' in event)
    )
}

const isNonEmptyStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((id) => typeof id === 'string' && id.length > 0)

const isNonEmptyScheduleArray = (value: unknown): value is ThinkingScheduleEvent[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isThinkingScheduleEvent(item))

export const isThinkingJobCreateEvent = (event: unknown): event is ThinkingJobCreateEvent => {
    if (!isRecord(event)) {
        return false
    }
    if (
        'failedAt' in event ||
        'ok' in event ||
        'scheduleStatus' in event ||
        'workItemId' in event ||
        'segment' in event ||
        'schedules' in event ||
        'completedAt' in event
    ) {
        return false
    }
    if (!isNonEmptyStringArray(event.workItemIds)) {
        return false
    }
    const status = event.jobStatus
    if (status !== 'pending' && status !== 'running') {
        return false
    }
    return (
        typeof event.schemaVersion === 'number' &&
        typeof event.generationId === 'string' &&
        (event.createdAt === undefined || typeof event.createdAt === 'string')
    )
}

export const isThinkingJobErrorEvent = (event: unknown): event is ThinkingJobErrorEvent => {
    if (!isRecord(event)) {
        return false
    }
    if (
        'workItemIds' in event ||
        'ok' in event ||
        'scheduleStatus' in event ||
        'segment' in event ||
        'schedules' in event ||
        'completedAt' in event
    ) {
        return false
    }
    if (event.jobStatus !== 'failed') {
        return false
    }
    return (
        typeof event.schemaVersion === 'number' &&
        typeof event.generationId === 'string' &&
        typeof event.failedAt === 'string' &&
        (event.errorCode === undefined || typeof event.errorCode === 'string') &&
        (event.errorMessage === undefined || typeof event.errorMessage === 'string') &&
        (event.lastFailedWorkItemId === undefined || typeof event.lastFailedWorkItemId === 'string')
    )
}

export const isThinkingJobCompletedEvent = (event: unknown): event is ThinkingJobCompletedEvent => {
    if (!isRecord(event)) {
        return false
    }
    if (
        'ok' in event ||
        'workItemId' in event ||
        'workItemIds' in event ||
        'failedAt' in event ||
        'scheduleStatus' in event ||
        'segment' in event
    ) {
        return false
    }
    if (event.jobStatus !== 'completed') {
        return false
    }
    if (!isNonEmptyScheduleArray(event.schedules)) {
        return false
    }
    return (
        typeof event.schemaVersion === 'number' &&
        typeof event.generationId === 'string' &&
        typeof event.completedAt === 'string'
    )
}

export const isThinkingScheduleEventExternal = (event: unknown): event is ThinkingScheduleEventExternal => {
    if (!isRecord(event) || event.type !== THINKING_SCHEDULE_HEADER_TYPE) {
        return false
    }
    const { type: _t, ...rest } = event
    return isThinkingScheduleEvent(rest)
}

export const isThinkingResultEventExternal = (event: unknown): event is ThinkingResultEventExternal => {
    if (!isRecord(event) || event.type !== THINKING_RESULT_HEADER_TYPE) {
        return false
    }
    const { type: _t, ...rest } = event
    return isThinkingResultEvent(rest)
}

export const isThinkingJobCompletedEventExternal = (event: unknown): event is ThinkingJobCompletedEventExternal => {
    if (!isRecord(event) || event.type !== THINKING_JOB_COMPLETED_HEADER_TYPE) {
        return false
    }
    const { type: _t, ...rest } = event
    return isThinkingJobCompletedEvent(rest)
}

export const isThinkingEventExternal = (event: unknown): event is ThinkingEventExternal =>
    isThinkingScheduleEventExternal(event) ||
    isThinkingResultEventExternal(event) ||
    isThinkingJobCompletedEventExternal(event)

export const isThinkingEventUpdate = (event: unknown): event is ThinkingEventUpdate =>
    isThinkingScheduleEvent(event) ||
    isThinkingResultEvent(event) ||
    isThinkingJobCompletedEvent(event)

export const isThinkingCompletedJobsSnapshot = (event: unknown): event is ThinkingCompletedJobsSnapshot => {
    if (!isRecord(event)) {
        return false
    }
    if (!Array.isArray(event.completedJobs)) {
        return false
    }
    return event.completedJobs.every((item) => isThinkingJobCompletedEvent(item))
}

export const isThinkingCompletedJobsSnapshotExternal = (
    event: unknown
): event is ThinkingCompletedJobsSnapshotExternal => isThinkingCompletedJobsSnapshot(event)

/** Accepts external payloads (with `type`) and WebSocket updates (shape-only; `eventType` on envelope). */
export const isThinkingSchedulingExternal = (event: unknown): event is ThinkingSchedulingExternal =>
    isThinkingEventExternal(event) ||
    isThinkingCompletedJobsSnapshotExternal(event) ||
    isThinkingJobCompletedEvent(event) ||
    isThinkingScheduleEvent(event) ||
    isThinkingResultEvent(event)

export type ThinkingJobsEventUpdate = ThinkingEventUpdate | ThinkingCompletedJobsSnapshot

export type ThinkingJobsEnvelope = ResolvedStreamingEnvelope<ThinkingJobsEventUpdate, StreamingEventHeader>

export function isThinkingJobsSnapshotEnvelope(
    envelope: ThinkingJobsEnvelope
): envelope is ResolvedStreamingEnvelope<ThinkingCompletedJobsSnapshot, StreamingEventHeader & { type: 'Snapshot' }> {
    return envelope.header.type === 'Snapshot'
}

export function isThinkingJobCompletedEnvelope(
    envelope: ThinkingJobsEnvelope
): envelope is ResolvedStreamingEnvelope<ThinkingJobCompletedEvent, StreamingEventHeader & { type: typeof THINKING_JOB_COMPLETED_HEADER_TYPE }> {
    return envelope.header.type === THINKING_JOB_COMPLETED_HEADER_TYPE
}

/**
 * Aggregator for mtw.ephemera.thinking.scheduling (streamKey `global`).
 * Materialized view is { completedJobs: ThinkingJobCompletedEvent[] }.
 */
export class ThinkingJobsAggregator implements DataSourceAggregator<ThinkingCompletedJobsSnapshot, ThinkingJobsEventUpdate> {
    createEmpty(_streamKey: string): ThinkingCompletedJobsSnapshot {
        return { completedJobs: [] }
    }

    applyUpdate(
        snapshot: ThinkingCompletedJobsSnapshot,
        envelope: ThinkingJobsEnvelope
    ): AggregationResult<ThinkingCompletedJobsSnapshot> {
        try {
            if (isThinkingJobsSnapshotEnvelope(envelope)) {
                if (!isThinkingCompletedJobsSnapshot(envelope.content)) {
                    throw new Error('ThinkingJobsAggregator: invalid snapshot content')
                }
                return { success: true, snapshot: envelope.content }
            }
            if (isThinkingJobCompletedEnvelope(envelope)) {
                if (!isThinkingJobCompletedEvent(envelope.content)) {
                    throw new Error('ThinkingJobsAggregator: invalid Job Completed content')
                }
                const { generationId } = envelope.content
                const withoutDuplicate = snapshot.completedJobs.filter(
                    (job) => job.generationId !== generationId
                )
                return {
                    success: true,
                    snapshot: {
                        completedJobs: [...withoutDuplicate, envelope.content]
                    }
                }
            }
            return {
                success: false,
                error: new Error(`Unknown update type: ${envelope.header.type}`),
                snapshot
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                snapshot
            }
        }
    }
}

/**
 * Serialize / deserialize thinking schedule, result, and job-completed payloads.
 * Routes on `header.type` only; external payloads include `type` for wire compatibility.
 */
export class ThinkingEventSerializer implements DataSourceEventSerializer<
    ThinkingEventUpdate,
    ThinkingEventExternal,
    ThinkingCompletedJobsSnapshot,
    ThinkingCompletedJobsSnapshotExternal
> {
    serialize(params: {
        content: ThinkingEventUpdate | ThinkingCompletedJobsSnapshot
        header: StreamingEventHeader
    }): ThinkingEventExternal | ThinkingCompletedJobsSnapshotExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            if (!isThinkingCompletedJobsSnapshot(content)) {
                throw new Error('ThinkingEventSerializer: snapshot header with non-snapshot content')
            }
            return {
                completedJobs: content.completedJobs.map((job) => ({
                    ...job,
                    schedules: job.schedules.map((schedule) => ({ ...schedule })),
                })),
            }
        }
        if (header.type === THINKING_SCHEDULE_HEADER_TYPE) {
            if (!isThinkingScheduleEvent(content)) {
                throw new Error('ThinkingEventSerializer: schedule header with non-schedule content')
            }
            return {
                type: THINKING_SCHEDULE_HEADER_TYPE,
                schemaVersion: content.schemaVersion,
                generationId: content.generationId,
                workItemId: content.workItemId,
                segment: content.segment,
                scheduleStatus: content.scheduleStatus,
                ...(content.enqueuedAt !== undefined ? { enqueuedAt: content.enqueuedAt } : {})
            }
        }
        if (header.type === THINKING_RESULT_HEADER_TYPE) {
            if (!isThinkingResultEvent(content)) {
                throw new Error('ThinkingEventSerializer: result header with non-result content')
            }
            return {
                type: THINKING_RESULT_HEADER_TYPE,
                schemaVersion: content.schemaVersion,
                generationId: content.generationId,
                workItemId: content.workItemId,
                segment: content.segment,
                ok: content.ok,
                completedAt: content.completedAt,
                ...(content.errorCode !== undefined ? { errorCode: content.errorCode } : {}),
                ...(content.errorMessage !== undefined ? { errorMessage: content.errorMessage } : {}),
                ...(content.verbose !== undefined ? { verbose: content.verbose } : {})
            }
        }
        if (header.type === THINKING_JOB_COMPLETED_HEADER_TYPE) {
            if (!isThinkingJobCompletedEvent(content)) {
                throw new Error('ThinkingEventSerializer: job-completed header with non-job-completed content')
            }
            return {
                type: THINKING_JOB_COMPLETED_HEADER_TYPE,
                schemaVersion: content.schemaVersion,
                generationId: content.generationId,
                jobStatus: content.jobStatus,
                completedAt: content.completedAt,
                schedules: content.schedules
            }
        }
        throw new Error(`ThinkingEventSerializer: unknown header.type ${header.type}`)
    }

    async deserialize(params: {
        content: ThinkingEventExternal | ThinkingCompletedJobsSnapshotExternal
        header: StreamingEventHeader
    }): Promise<ThinkingEventUpdate | ThinkingCompletedJobsSnapshot | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            if (!isThinkingCompletedJobsSnapshotExternal(content)) {
                return null
            }
            return {
                completedJobs: content.completedJobs.map((job) => ({
                    ...job,
                    schedules: job.schedules.map((schedule) => ({ ...schedule })),
                })),
            }
        }
        if (header.type === THINKING_SCHEDULE_HEADER_TYPE) {
            if (isThinkingScheduleEventExternal(content)) {
                const { type: _t, ...rest } = content
                return rest
            }
            if (isThinkingScheduleEvent(content)) {
                return content
            }
            return null
        }
        if (header.type === THINKING_RESULT_HEADER_TYPE) {
            if (isThinkingResultEventExternal(content)) {
                const { type: _t, ...rest } = content
                return rest
            }
            if (isThinkingResultEvent(content)) {
                return content
            }
            return null
        }
        if (header.type === THINKING_JOB_COMPLETED_HEADER_TYPE) {
            if (isThinkingJobCompletedEventExternal(content)) {
                const { type: _t, ...rest } = content
                return rest
            }
            if (isThinkingJobCompletedEvent(content)) {
                return content
            }
            return null
        }
        return null
    }
}
