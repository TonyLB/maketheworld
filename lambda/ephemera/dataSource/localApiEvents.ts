/**
 * Payload types and type guards for API-triggered internal events (dataSourceKey: 'api.ephemera').
 * Used by apiEphemera.ts send helpers and future DataSource receiveEvents. In-process only; no EventBridge.
 * Includes cache commands, thinking schedule (`PutThinkingScheduleCommand`), thinking job create/error,
 * room state, and parse requests.
 */
import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    ThinkingJobCreateEvent,
    ThinkingJobErrorEvent,
    ThinkingScheduleEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    isThinkingJobCreateEvent,
    isThinkingJobErrorEvent,
    isThinkingScheduleEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import type { EphemeraCacheComponentId, EphemeraCacheMarkState } from './renderCache/baseClasses'
import type { PutCacheRecordInput } from './renderCache/putCacheRecord'

export type PutCacheRecordCommand = {
    componentId: EphemeraCacheComponentId;
    record: PutCacheRecordInput;
    existingDataCategory?: string;
    /** Prototype: correlate cache updates to a conversations row; remove when orchestration matches events without DS plumbing (see conversations/AGENT.md). */
    conversationId?: string;
};

export type DeleteCacheRecordsCommand = {
    componentId: EphemeraCacheComponentId;
    dataCategories: string[];
};

/**
 * Proposed world-state marks for a component (e.g. Room); paired with header `State Change` on api.ephemera.
 * Default marks when none are stored are resolved server-side (`resolveCanonAssetStackForRoom` inside
 * `computeDefaultMarksForRoom`).
 */
export type StateChangeCommand = {
    componentId: EphemeraCacheComponentId;
    markState: EphemeraCacheMarkState;
    /** When set, handlers emit a correlated `ReturnValue` ack. */
    requestId?: string;
}

/**
 * Runtime object list patch for a room `Meta::Room`; paired with header `Objects Change` on api.ephemera.
 * v1: room `componentId` only; internal callers only (no `requestId` / ReturnValue).
 * `add` entries are full rows (`OBJECT#...` + `shortName`); `remove` lists object ids to drop.
 */
export type ObjectsChangeCommand = {
    componentId: EphemeraCacheComponentId;
    add: EphemeraMetaRoomObject[];
    remove: EphemeraObjectId[];
}

/**
 * Synthetic action-parse request for mtw.ephemera.actions.
 * `command` is raw player input to be parsed into an action shape.
 */
export type ParseRequestedCommand = {
    characterId: string;
    command: string;
    requestId?: string;
}

/** Thinking schedule row payload; paired with header `Put Thinking Schedule` on api.ephemera. */
export type PutThinkingScheduleCommand = ThinkingScheduleEvent

export const isPutThinkingScheduleCommand = (value: unknown): value is PutThinkingScheduleCommand =>
    isThinkingScheduleEvent(value)

/** Thinking job bootstrap (`Meta::Job` + membership); paired with header `Put Thinking Job Create` on api.ephemera. */
export type PutThinkingJobCreateCommand = ThinkingJobCreateEvent

export const isPutThinkingJobCreateCommand = (value: unknown): value is PutThinkingJobCreateCommand =>
    isThinkingJobCreateEvent(value)

/** Run-level job failure; paired with header `Put Thinking Job Error` on api.ephemera. */
export type PutThinkingJobErrorCommand = ThinkingJobErrorEvent

export const isPutThinkingJobErrorCommand = (value: unknown): value is PutThinkingJobErrorCommand =>
    isThinkingJobErrorEvent(value)

const isMarkStateShape = (value: unknown): value is EphemeraCacheMarkState => {
    if (!value || typeof value !== 'object') {
        return false
    }
    return Array.isArray((value as Record<string, unknown>).markValue)
}

export const isStateChangeCommand = (value: unknown): value is StateChangeCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.componentId !== 'string') {
        return false
    }
    if (!isMarkStateShape(v.markState)) {
        return false
    }
    if (v.requestId !== undefined && typeof v.requestId !== 'string') {
        return false
    }
    return true
}

export const isObjectsChangeCommand = (value: unknown): value is ObjectsChangeCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.componentId !== 'string') {
        return false
    }
    if (!Array.isArray(v.add) || !v.add.every((x) => isEphemeraMetaRoomObject(x))) {
        return false
    }
    if (!Array.isArray(v.remove) || !v.remove.every((x) => typeof x === 'string' && isEphemeraObjectId(x))) {
        return false
    }
    return true
}

export const isParseRequestedCommand = (value: unknown): value is ParseRequestedCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.command !== 'string') {
        return false
    }
    if (v.requestId !== undefined && typeof v.requestId !== 'string') {
        return false
    }
    return true
}

export const isPutCacheRecordCommand = (value: unknown): value is PutCacheRecordCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.componentId !== 'string') {
        return false
    }
    if (!v.record || typeof v.record !== 'object') {
        return false
    }
    const record = v.record as Record<string, unknown>
    if (record.markState === undefined || record.renderedContent === undefined || record.provenance === undefined) {
        return false
    }
    const prov = record.provenance as Record<string, unknown>
    if (typeof prov !== 'object' || prov === null || typeof prov.type !== 'string') {
        return false
    }
    if (typeof record.perspectiveId !== 'string' || record.perspectiveMatcher === undefined) {
        return false
    }
    if (v.existingDataCategory !== undefined && typeof v.existingDataCategory !== 'string') {
        return false
    }
    if (v.conversationId !== undefined && typeof v.conversationId !== 'string') {
        return false
    }
    return true
}

export const isDeleteCacheRecordsCommand = (value: unknown): value is DeleteCacheRecordsCommand => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.componentId !== 'string') {
        return false
    }
    if (!Array.isArray(v.dataCategories)) {
        return false
    }
    if (!v.dataCategories.every((x) => typeof x === 'string')) {
        return false
    }
    return true
}

/** Union of all api.ephemera command payloads (discriminated by header.type on the bus). */
export type EphemeraApiCommandPayload =
    | PutCacheRecordCommand
    | DeleteCacheRecordsCommand
    | StateChangeCommand
    | ObjectsChangeCommand
    | ParseRequestedCommand
    | PutThinkingScheduleCommand
    | PutThinkingJobCreateCommand
    | PutThinkingJobErrorCommand
