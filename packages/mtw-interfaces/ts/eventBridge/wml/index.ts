// WML Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the WML data source.
// Migrated from lambda/wml/dataSource/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Internal types for WML events
// Content Update: carries edit/delta (not full document). Consumers must merge onto current state.
export type WMLContentEvent = 
    | {
        type: 'Content Update'
        schema: StandardForm
        RequestIds?: string[]
    }
    | {
        type: 'Merge Conflict'
        error?: string
        RequestIds?: string[]
    }

export type WMLZoneEvent = {
    type: 'Zone Changed'
    fromZone: Zone
    toZone: Zone
    player?: string
    subFolder?: string
}

export type WMLSnapshotEvent = {
    type: 'Snapshot Created'
    chunksBeforeSnapshot: number
    snapshotSize: number
}

export type WMLPurgeEvent = {
    type: 'Asset Purged'
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

// Type guards
export const isWMLContentEvent = (event: any): event is WMLContentEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        (event.type === 'Content Update' || event.type === 'Merge Conflict')
    )
}

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

export const isWMLContentUpdateEvent = (event: any): event is WMLContentEvent & { type: 'Content Update' } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Content Update' &&
        'schema' in event &&
        event.schema instanceof StandardForm
    )
}

export const isWMLMergeConflictEvent = (event: any): event is WMLContentEvent & { type: 'Merge Conflict' } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Merge Conflict'
    )
}

export const isWMLZoneEvent = (event: any): event is WMLZoneEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Zone Changed' &&
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
        'type' in event &&
        event.type === 'Snapshot Created' &&
        typeof event.chunksBeforeSnapshot === 'number' &&
        typeof event.snapshotSize === 'number'
    )
}

export const isWMLPurgeEvent = (event: any): event is WMLPurgeEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Asset Purged' &&
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

    applyUpdate(view: StandardFormData, event: WMLContentEvent): { success: true; snapshot: StandardFormData } | { success: false; error: Error; snapshot: StandardFormData } {
        if (event.type === 'Merge Conflict') {
            return { success: false, error: new Error(event.error ?? 'Merge conflict'), snapshot: view }
        }
        const current = new StandardForm(view)
        const merged = current.merge(event.schema)
        return { success: true, snapshot: merged.toJSON() }
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
    serialize(params: { dataSourceKey: string; streamKey: string; update: WMLEventUpdate; header?: StreamingEventHeader }): WMLEventExternal {
        const { update } = params
        if (isWMLZoneEvent(update)) {
            // Zone events pass through as-is (they're already structured data)
            return update as WMLZoneEventExternal
        } else if (isWMLSnapshotEvent(update)) {
            // Snapshot events pass through as-is (they're already structured data)
            return update as WMLSnapshotEventExternal
        } else if (isWMLContentUpdateEvent(update)) {
            // Content Update events need WML conversion
            return {
                type: 'Content Update',
                wml: schemaToWML([update.schema.schema]),
                ...(update.RequestIds != null ? { RequestIds: update.RequestIds } : {})
            }
        } else if (isWMLMergeConflictEvent(update)) {
            // Merge Conflict events pass through with error information
            return {
                type: 'Merge Conflict',
                error: update.error,
                ...(update.RequestIds != null ? { RequestIds: update.RequestIds } : {})
            }
        } else if (isWMLPurgeEvent(update)) {
            // Purge events pass through as-is (including optional player)
            return {
                type: 'Asset Purged',
                zone: update.zone,
                objectsDeleted: update.objectsDeleted,
                ...(update.player ? { player: update.player } : {})
            }
        } else {
            throw new Error(`Unknown WML event type: ${JSON.stringify(update)}`)
        }
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: { dataSourceKey: string; streamKey: string; externalUpdate: WMLEventExternal; header: StreamingEventHeader }): WMLEventUpdate | null {
        const { externalUpdate, header } = params
        const eventType = header.type
        if (eventType === 'Zone Changed') {
            // Zone events pass through as-is
            return externalUpdate as WMLZoneEvent
        } else if (eventType === 'Snapshot Created') {
            // Snapshot events pass through as-is
            return externalUpdate as WMLSnapshotEvent
        } else if (eventType === 'Content Update') {
            if ('wml' in externalUpdate && externalUpdate.wml) {
                try {
                    // Parse WML string back to StandardForm
                    const schemaNode = nodeFromWML(externalUpdate.wml)
                    const standardForm = new StandardForm(schemaNode)
                    return {
                        type: 'Content Update',
                        schema: standardForm,
                        ...(externalUpdate.RequestIds != null ? { RequestIds: externalUpdate.RequestIds } : {})
                    }
                } catch (error) {
                    throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
                }
            } else {
                throw new Error(`Content Update event missing required 'wml' property`)
            }
        } else if (eventType === 'Merge Conflict') {
            // Merge Conflict events pass through with error information
            return {
                type: 'Merge Conflict',
                error: externalUpdate.error,
                ...(externalUpdate.RequestIds != null ? { RequestIds: externalUpdate.RequestIds } : {})
            }
        } else if (eventType === 'Asset Purged') {
            // Purge events pass through as-is
            return externalUpdate as WMLPurgeEvent
        } else {
            throw new Error(`Unknown external WML event type: ${JSON.stringify(externalUpdate)}`)
        }
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

    serialize(params: { dataSourceKey: string; streamKey: string; update: WMLContentEvent; header: StreamingEventHeader }): WMLContentEventExternal {
        return this.baseSerializer.serialize(params) as WMLContentEventExternal
    }

    deserialize(params: { dataSourceKey: string; streamKey: string; externalUpdate: WMLContentEventExternal; header: StreamingEventHeader }): WMLContentEvent | null {
        if (!isWMLContentEventExternal(params.externalUpdate)) {
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