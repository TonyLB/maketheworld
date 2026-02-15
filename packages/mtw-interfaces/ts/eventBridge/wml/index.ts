// WML Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the WML data source.
// Migrated from lambda/wml/dataSource/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ResolvedStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Internal types for WML events (no type field; discrimination by envelope.header.type only)
// Content Update: carries edit/delta (not full document). Consumers must merge onto current state.
export type WMLContentEvent =
    | { schema: StandardForm; RequestIds?: string[] }
    | { error?: string; RequestIds?: string[] }

export type WMLZoneEvent = {
    fromZone: Zone
    toZone: Zone
    player?: string
    subFolder?: string
}

export type WMLSnapshotEvent = {
    chunksBeforeSnapshot: number
    snapshotSize: number
}

export type WMLPurgeEvent = {
    zone: 'Draft' | 'Archive'
    objectsDeleted: number
    player?: string  // Present for Draft zone (Personal assets are not purgeable)
}

// Union type for all internal WML events
export type WMLEventUpdate = WMLContentEvent | WMLZoneEvent | WMLSnapshotEvent | WMLPurgeEvent

// External types for WML events
// Content Update: wml is edit/delta WML (Replace/Remove etc.). Consumers must merge onto current state.
export type WMLContentEventExternal = 
    | {
        type: 'Content Update'
        wml: string
        RequestIds?: string[]
    }
    | {
        type: 'Merge Conflict'
        error?: string
        RequestIds?: string[]
    }

export type WMLZoneEventExternal = {
    type: 'Zone Changed'
    fromZone: Zone
    toZone: Zone
    player?: string
    subFolder?: string
}

export type WMLSnapshotEventExternal = {
    type: 'Snapshot Created'
    chunksBeforeSnapshot: number
    snapshotSize: number
}

export type WMLPurgeEventExternal = {
    type: 'Asset Purged'
    zone: 'Draft' | 'Archive'
    objectsDeleted: number
    player?: string  // Present for Draft zone (Personal assets are not purgeable)
}

// Union type for all external WML events
export type WMLEventExternal = WMLContentEventExternal | WMLZoneEventExternal | WMLSnapshotEventExternal | WMLPurgeEventExternal

// External type guard for WML EventBridge payloads
export const isWMLContentEventExternal = (event: any): event is WMLContentEventExternal => {
    if (!event || typeof event !== 'object' || !('type' in event)) {
        return false
    }
    switch((event as any).type) {
        case 'Content Update':
            // Must include wml string
            return typeof (event as any).wml === 'string'
        case 'Merge Conflict':
            return true
        default:
            return false
    }
}

export const isWMLContentUpdateEvent = (event: any): event is WMLContentEvent & { schema: StandardForm } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'schema' in event &&
        event.schema instanceof StandardForm
    )
}

export const isWMLMergeConflictEvent = (event: any): event is WMLContentEvent & { error?: string } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        !('schema' in event && event.schema instanceof StandardForm)
    )
}

// Type guard for internal content union (shape-based)
export const isWMLContentEvent = (event: any): event is WMLContentEvent =>
    isWMLContentUpdateEvent(event) || isWMLMergeConflictEvent(event)

// Envelope type guards for WML content events (narrow both header and content; no casts in aggregator)
export type WMLContentEnvelope = ResolvedStreamingEnvelope<WMLContentEvent, StreamingEventHeader>

export function isWMLMergeConflictEnvelope(
    envelope: WMLContentEnvelope
): envelope is ResolvedStreamingEnvelope<WMLContentEvent & { error?: string }, StreamingEventHeader & { type: 'Merge Conflict' }> {
    return envelope.header.type === 'Merge Conflict'
}

export function isWMLContentUpdateEnvelope(
    envelope: WMLContentEnvelope
): envelope is ResolvedStreamingEnvelope<WMLContentEvent & { schema: StandardForm }, StreamingEventHeader & { type: 'Content Update' }> {
    return envelope.header.type === 'Content Update'
}

export const isWMLZoneEvent = (event: any): event is WMLZoneEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'fromZone' in event &&
        'toZone' in event &&
        typeof event.fromZone === 'string' &&
        typeof event.toZone === 'string' &&
        isZone(event.fromZone) &&
        isZone(event.toZone)
    )
}

export const isWMLSnapshotEvent = (event: any): event is WMLSnapshotEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        typeof event.chunksBeforeSnapshot === 'number' &&
        typeof event.snapshotSize === 'number'
    )
}

export const isWMLPurgeEvent = (event: any): event is WMLPurgeEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        typeof event.zone === 'string' &&
        (event.zone === 'Draft' || event.zone === 'Archive') &&
        typeof event.objectsDeleted === 'number'
    )
}

/**
 * Empty StandardFormData for WML dataSource materialized view before any snapshot/events.
 */
const EMPTY_WML_VIEW: StandardFormData = {
    universalKey: 'ASSET#uninitialized' as any,
    components: [],
    metaData: []
}

/**
 * Aggregator for WML dataSource slice: materialized view is StandardFormData;
 * Content Update events merge delta onto view; Merge Conflict leaves view unchanged.
 */
export class WMLAggregator implements DataSourceAggregator<StandardFormData, WMLContentEvent> {
    createEmpty(): StandardFormData {
        return JSON.parse(JSON.stringify(EMPTY_WML_VIEW))
    }

    applyUpdate(view: StandardFormData, envelope: WMLContentEnvelope): { success: true; snapshot: StandardFormData } | { success: false; error: Error; snapshot: StandardFormData } {
        if (isWMLMergeConflictEnvelope(envelope)) {
            const errMsg = envelope.content.error ?? 'Merge conflict'
            return { success: false, error: new Error(errMsg), snapshot: view }
        }
        if (isWMLContentUpdateEnvelope(envelope)) {
            const current = new StandardForm(view)
            const merged = current.merge(envelope.content.schema)
            return { success: true, snapshot: merged.toJSON() }
        }
        return { success: false, error: new Error('Expected Content Update when header is not Merge Conflict'), snapshot: view }
    }
}

/**
 * Type guard for materialized view (StandardFormData) in recentEvents.
 * Used by WML dataSource slice to distinguish snapshot from update events.
 */
export const isWMLMaterializedView = (event: any): event is StandardFormData => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'universalKey' in event &&
        'components' in event &&
        Array.isArray(event.components) &&
        'metaData' in event
    )
}

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
type WMLSerializeParams = ResolvedStreamingEnvelope<WMLEventUpdate, StreamingEventHeader>
type WMLDeserializeParams = ResolvedStreamingEnvelope<WMLEventExternal, StreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isZoneChangedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Zone Changed' }; content: WMLZoneEvent } =>
    p.header.type === 'Zone Changed'
const isSnapshotCreatedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Snapshot Created' }; content: WMLSnapshotEvent } =>
    p.header.type === 'Snapshot Created'
const isContentUpdateWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Content Update' }; content: WMLContentEvent & { schema: StandardForm } } =>
    p.header.type === 'Content Update'
const isMergeConflictWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Merge Conflict' }; content: WMLContentEvent & { error?: string } } =>
    p.header.type === 'Merge Conflict'
const isAssetPurgedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Asset Purged' }; content: WMLPurgeEvent } =>
    p.header.type === 'Asset Purged'

// Envelope type guards for deserialize (header.type narrows content)
const isZoneChangedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Zone Changed' }; content: WMLZoneEventExternal } =>
    p.header.type === 'Zone Changed'
const isSnapshotCreatedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Snapshot Created' }; content: WMLSnapshotEventExternal } =>
    p.header.type === 'Snapshot Created'
const isContentUpdateWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Content Update' }; content: WMLContentEventExternal & { type: 'Content Update' } } =>
    p.header.type === 'Content Update'
const isMergeConflictWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Merge Conflict' }; content: WMLContentEventExternal & { type: 'Merge Conflict' } } =>
    p.header.type === 'Merge Conflict'
const isAssetPurgedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Purged' }; content: WMLPurgeEventExternal } =>
    p.header.type === 'Asset Purged'

/**
 * Serializer/Deserializer for WML format events
 * 
 * This handles the conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * Different event types are handled differently:
 * - Content events: Convert StandardForm to/from WML strings
 * - Zone events: Pass through as structured data
 */
export class WMLEventSerializer implements DataSourceEventSerializer<WMLEventUpdate, WMLEventExternal> {
    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize(params: WMLSerializeParams): WMLEventExternal {
        if (isZoneChangedWMLSerializeParams(params)) {
            const { content } = params
            return { type: 'Zone Changed', fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}), ...(content.subFolder != null ? { subFolder: content.subFolder } : {}) }
        }
        if (isSnapshotCreatedWMLSerializeParams(params)) {
            const { content } = params
            return { type: 'Snapshot Created', chunksBeforeSnapshot: content.chunksBeforeSnapshot, snapshotSize: content.snapshotSize }
        }
        if (isContentUpdateWMLSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Content Update',
                wml: schemaToWML([content.schema.schema]),
                ...(content.RequestIds != null ? { RequestIds: content.RequestIds } : {})
            }
        }
        if (isMergeConflictWMLSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Merge Conflict',
                error: content.error,
                ...(content.RequestIds != null ? { RequestIds: content.RequestIds } : {})
            }
        }
        if (isAssetPurgedWMLSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Asset Purged',
                zone: content.zone,
                objectsDeleted: content.objectsDeleted,
                ...(content.player != null ? { player: content.player } : {})
            }
        }
        throw new Error(`Unknown WML event type: ${params.header.type}`)
    }


    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: WMLDeserializeParams): WMLEventUpdate | null {
        if (isZoneChangedWMLDeserializeParams(params)) {
            const { content } = params
            return { fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}), ...(content.subFolder != null ? { subFolder: content.subFolder } : {}) }
        }
        if (isSnapshotCreatedWMLDeserializeParams(params)) {
            const { content } = params
            return { chunksBeforeSnapshot: content.chunksBeforeSnapshot, snapshotSize: content.snapshotSize }
        }
        if (isContentUpdateWMLDeserializeParams(params)) {
            const { content } = params
            if (!content.wml) {
                throw new Error(`Content Update event missing required 'wml' property`)
            }
            try {
                const schemaNode = nodeFromWML(content.wml)
                const standardForm = new StandardForm(schemaNode)
                return {
                    schema: standardForm,
                    ...(content.RequestIds != null ? { RequestIds: content.RequestIds } : {})
                }
            } catch (error) {
                throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
            }
        }
        if (isMergeConflictWMLDeserializeParams(params)) {
            const { content } = params
            return {
                error: content.error,
                ...(content.RequestIds != null ? { RequestIds: content.RequestIds } : {})
            }
        }
        if (isAssetPurgedWMLDeserializeParams(params)) {
            const { content } = params
            return { zone: content.zone, objectsDeleted: content.objectsDeleted, ...(content.player != null ? { player: content.player } : {}) }
        }
        throw new Error(`Unknown external WML event type: ${JSON.stringify(params.content)}`)
    }
    
    // Note: serializeSnapshot and deserializeSnapshot are not implemented
    // as WML events are for a non-replayable data source that doesn't use snapshots
}

/**
 * Event serializer for the WML dataSource slice (mtw.wml).
 * Only content events (Content Update, Merge Conflict) are deserialized; other event types return null.
 * Snapshot is StandardFormData; deserializeSnapshot is identity (slice receives resolved payload from sidecar).
 */
export class WMLDataSourceEventSerializer implements DataSourceEventSerializer<WMLContentEvent, WMLContentEventExternal, StandardFormData, StandardFormData> {
    private readonly baseSerializer = new WMLEventSerializer()

    serialize(params: { content: WMLContentEvent; header: StreamingEventHeader }): WMLContentEventExternal {
        return this.baseSerializer.serialize(params) as WMLContentEventExternal
    }

    deserialize(params: { content: WMLContentEventExternal; header: StreamingEventHeader }): WMLContentEvent | null {
        // Route on header: only Content Update and Merge Conflict are accepted for this slice
        if (params.header.type !== 'Content Update' && params.header.type !== 'Merge Conflict') {
            return null
        }
        const result = this.baseSerializer.deserialize(params)
        if (result && isWMLContentEvent(result)) {
            return result
        }
        return null
    }

    deserializeSnapshot(externalSnapshot: StandardFormData): StandardFormData | null {
        return externalSnapshot
    }
}