/**
 * Payload types and type guards for API-triggered internal events (dataSourceKey: 'api.ephemera').
 * Used by apiEphemera.ts send helpers and future DataSource receiveEvents. In-process only; no EventBridge.
 */
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
}

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
