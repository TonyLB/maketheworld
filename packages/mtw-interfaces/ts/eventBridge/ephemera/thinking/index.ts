// Ephemera thinking: schedule + thinking-result EventBridge contracts + job bootstrap/error (api.ephemera)
//
// Wire shapes are consumed by ephemera, subscriptions, and charcoal-client.
// Header discrimination uses StreamingEventHeader.type; external Detail carries payload `type`.

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

/** EventBridge / streaming header `type` for a schedule-line update (provisional until publisher exists). */
export const THINKING_SCHEDULE_HEADER_TYPE = 'Thinking Schedule' as const

/** EventBridge / streaming header `type` for a thinking-result update. */
export const THINKING_RESULT_HEADER_TYPE = 'Thinking Result' as const

/** Detail-type string aligned with header.type for PutEvents / replay consumers. */
export const THINKING_SCHEDULE_DETAIL_TYPE = THINKING_SCHEDULE_HEADER_TYPE

export const THINKING_RESULT_DETAIL_TYPE = THINKING_RESULT_HEADER_TYPE

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

/** Provisional schedule lifecycle for subscribe / replay MVP. */
export type ThinkingScheduleStatus = 'scheduled' | 'claimed' | 'cancelled'

/** Initial job row status for api.ephemera Put Thinking Job Create (Meta::Job bootstrap). */
export type ThinkingJobCreateStatus = 'pending' | 'running'

/** Run-level job failure (distinct from per-step ThinkingResultEvent). */
export type ThinkingJobErrorStatus = 'failed'

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

export type ThinkingEventUpdate = ThinkingScheduleEvent | ThinkingResultEvent

//
// External (EventBridge Detail): includes `type` for wire / far-end header reconstruction.
//

export type ThinkingScheduleEventExternal = ThinkingScheduleEvent & {
    type: typeof THINKING_SCHEDULE_HEADER_TYPE
}

export type ThinkingResultEventExternal = ThinkingResultEvent & {
    type: typeof THINKING_RESULT_HEADER_TYPE
}

export type ThinkingEventExternal = ThinkingScheduleEventExternal | ThinkingResultEventExternal

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
        ['scheduled', 'claimed', 'cancelled'].includes(event.scheduleStatus) &&
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

export const isThinkingJobCreateEvent = (event: unknown): event is ThinkingJobCreateEvent => {
    if (!isRecord(event)) {
        return false
    }
    if (
        'failedAt' in event ||
        'ok' in event ||
        'scheduleStatus' in event ||
        'workItemId' in event ||
        'segment' in event
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
    if ('workItemIds' in event || 'ok' in event || 'scheduleStatus' in event || 'segment' in event) {
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

export const isThinkingEventExternal = (event: unknown): event is ThinkingEventExternal =>
    isThinkingScheduleEventExternal(event) || isThinkingResultEventExternal(event)

export const isThinkingEventUpdate = (event: unknown): event is ThinkingEventUpdate =>
    isThinkingScheduleEvent(event) || isThinkingResultEvent(event)

/**
 * Serialize / deserialize thinking schedule and result payloads.
 * Routes on `header.type` only; external payloads include `type` for wire compatibility.
 */
export class ThinkingEventSerializer implements DataSourceEventSerializer<ThinkingEventUpdate, ThinkingEventExternal> {
    serialize(params: { content: ThinkingEventUpdate; header: StreamingEventHeader }): ThinkingEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('ThinkingEventSerializer does not support snapshot serialization')
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
        throw new Error(`ThinkingEventSerializer: unknown header.type ${header.type}`)
    }

    async deserialize(params: {
        content: ThinkingEventExternal
        header: StreamingEventHeader
    }): Promise<ThinkingEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === THINKING_SCHEDULE_HEADER_TYPE) {
            if (!isThinkingScheduleEventExternal(content)) {
                return null
            }
            const { type: _t, ...rest } = content
            return rest
        }
        if (header.type === THINKING_RESULT_HEADER_TYPE) {
            if (!isThinkingResultEventExternal(content)) {
                return null
            }
            const { type: _t, ...rest } = content
            return rest
        }
        return null
    }
}
