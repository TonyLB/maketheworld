// WML Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the WML data source.
// Migrated from lambda/wml/dataSource/serializers.ts

import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Internal types for WML events
export type WMLContentEvent = 
    | {
        type: 'Content Update'
        schema: StandardForm
    }
    | {
        type: 'Content Removed'
    }
    | {
        type: 'Merge Conflict'
        error?: string
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
}

// Union type for all internal WML events
export type WMLEventUpdate = WMLContentEvent | WMLZoneEvent | WMLSnapshotEvent | WMLPurgeEvent

// External types for WML events
export type WMLContentEventExternal = 
    | {
        type: 'Content Update'
        wml: string
    }
    | {
        type: 'Content Removed'
    }
    | {
        type: 'Merge Conflict'
        error?: string
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
}

// Union type for all external WML events
export type WMLEventExternal = WMLContentEventExternal | WMLZoneEventExternal | WMLSnapshotEventExternal | WMLPurgeEventExternal

// Type guards
export const isWMLContentEvent = (event: any): event is WMLContentEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        (event.type === 'Content Update' || event.type === 'Content Removed' || event.type === 'Merge Conflict')
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
        case 'Content Removed':
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

export const isWMLContentRemovedEvent = (event: any): event is WMLContentEvent & { type: 'Content Removed' } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Content Removed'
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
    serialize(params: { dataSourceKey: string; streamKey: string; update: WMLEventUpdate }): WMLEventExternal {
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
                wml: schemaToWML([update.schema.schema])
            }
        } else if (isWMLContentRemovedEvent(update)) {
            // Content Removed events don't need WML
            return {
                type: 'Content Removed'
            }
        } else if (isWMLMergeConflictEvent(update)) {
            // Merge Conflict events pass through with error information
            return {
                type: 'Merge Conflict',
                error: update.error
            }
        } else if (isWMLPurgeEvent(update)) {
            // Purge events pass through as-is
            return {
                type: 'Asset Purged',
                zone: update.zone,
                objectsDeleted: update.objectsDeleted
            }
        } else {
            throw new Error(`Unknown WML event type: ${JSON.stringify(update)}`)
        }
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: { dataSourceKey: string; streamKey: string; externalUpdate: WMLEventExternal }): WMLEventUpdate | null {
        const { externalUpdate } = params
        if (externalUpdate.type === 'Zone Changed') {
            // Zone events pass through as-is
            return externalUpdate as WMLZoneEvent
        } else if (externalUpdate.type === 'Snapshot Created') {
            // Snapshot events pass through as-is
            return externalUpdate as WMLSnapshotEvent
        } else if (externalUpdate.type === 'Content Update') {
            if ('wml' in externalUpdate && externalUpdate.wml) {
                try {
                    // Parse WML string back to StandardForm
                    const schemaNode = nodeFromWML(externalUpdate.wml)
                    const standardForm = new StandardForm(schemaNode)
                    return {
                        type: 'Content Update',
                        schema: standardForm
                    }
                } catch (error) {
                    throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
                }
            } else {
                throw new Error(`Content Update event missing required 'wml' property`)
            }
        } else if (externalUpdate.type === 'Content Removed') {
            // Content Removed events don't need WML parsing
            return {
                type: 'Content Removed'
            }
        } else if (externalUpdate.type === 'Merge Conflict') {
            // Merge Conflict events pass through with error information
            return {
                type: 'Merge Conflict',
                error: externalUpdate.error
            }
        } else if (externalUpdate.type === 'Asset Purged') {
            // Purge events pass through as-is
            return externalUpdate as WMLPurgeEvent
        } else {
            throw new Error(`Unknown external WML event type: ${JSON.stringify(externalUpdate)}`)
        }
    }
    
    // Note: serializeSnapshot and deserializeSnapshot are not implemented
    // as WML events are for a non-replayable data source that doesn't use snapshots
}