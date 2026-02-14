import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Internal types for coordination events
export type CoordinationCanonizeEvent = {
    type: 'Canonize Asset'
}

export type CoordinationDecanonizeEvent = {
    type: 'Decanonize Asset'
}

export type MoveAssetRequest = {
    type: 'Move Asset';
    fromZone: Zone;
    toZone: Zone;
    player?: string;      // DEPRECATED Phase 1: No longer used (player stored in S3 metadata)
    subFolder?: string;   // DEPRECATED Phase 1: No longer used (flat storage, no subdirectories)
}

export type ApplyEditRequest = {
    type: 'Apply Edit';
    RequestId?: string;
    schema: string;
    createIfNeeded?: boolean;
    zone?: Zone;
}

export type CreateSnapshotRequest = {
    type: 'Create Snapshot';
}

export type PurgeAssetRequest = {
    type: 'Purge Asset';
    expectedZone: 'Draft' | 'Archive';
    requireExists?: boolean;
}

// Union type for all internal coordination events
export type CoordinationEventUpdate = CoordinationCanonizeEvent | CoordinationDecanonizeEvent | MoveAssetRequest | ApplyEditRequest | CreateSnapshotRequest | PurgeAssetRequest

// Event type strings for header-only routing (used by subscribedEventTypeGuard)
export const COORDINATION_EVENT_TYPES = new Set<string>([
    'Canonize Asset',
    'Decanonize Asset',
    'Move Asset',
    'Apply Edit',
    'Create Snapshot',
    'Purge Asset'
])

// External types for coordination events (same as internal since they're hand-created)
export type CoordinationCanonizeEventExternal = {
    type: 'Canonize Asset';
}

export type CoordinationDecanonizeEventExternal = {
    type: 'Decanonize Asset';
}

export type MoveAssetRequestExternal = {
    type: 'Move Asset';
    fromZone: Zone;
    toZone: Zone;
    player?: string;      // DEPRECATED Phase 1: No longer used (player stored in S3 metadata)
    subFolder?: string;   // DEPRECATED Phase 1: No longer used (flat storage, no subdirectories)
}

export type ApplyEditRequestExternal = {
    type: 'Apply Edit';
    RequestId?: string;
    schema: string;
    createIfNeeded?: boolean;
    zone?: Zone;
}

export type CreateSnapshotRequestExternal = {
    type: 'Create Snapshot';
}

export type PurgeAssetRequestExternal = {
    type: 'Purge Asset';
    expectedZone: 'Draft' | 'Archive';
    requireExists?: boolean;
}

export type CoordinationEventExternal = 
    | CoordinationCanonizeEventExternal 
    | CoordinationDecanonizeEventExternal 
    | MoveAssetRequestExternal
    | ApplyEditRequestExternal
    | CreateSnapshotRequestExternal
    | PurgeAssetRequestExternal

// Type guards
export const isMoveAssetRequest = (event: any): event is MoveAssetRequest => {
    return event && 
        typeof event === 'object' && 
        typeof event.type === 'string' &&
        event.type === 'Move Asset' &&
        typeof event.fromZone === 'string' &&
        typeof event.toZone === 'string'
}

export const isCoordinationCanonizeEvent = (event: any): event is CoordinationCanonizeEvent => {
    return event && 
        typeof event === 'object' && 
        event.type === 'Canonize Asset'
}

export const isCoordinationDecanonizeEvent = (event: any): event is CoordinationDecanonizeEvent => {
    return event && 
        typeof event === 'object' && 
        event.type === 'Decanonize Asset'
}

export const isApplyEditRequest = (event: any): event is ApplyEditRequest => {
    return event && 
        typeof event === 'object' && 
        event.type === 'Apply Edit' &&
        typeof event.schema === 'string' &&
        (event.RequestId === undefined || typeof event.RequestId === 'string')
}

export const isCreateSnapshotRequest = (event: any): event is CreateSnapshotRequest => {
    return event && 
        typeof event === 'object' && 
        event.type === 'Create Snapshot'
}

export const isPurgeAssetRequest = (event: any): event is PurgeAssetRequest => {
    return event && 
        typeof event === 'object' && 
        event.type === 'Purge Asset' &&
        typeof event.expectedZone === 'string' &&
        (event.expectedZone === 'Draft' || event.expectedZone === 'Archive')
}

export const isCoordinationEventUpdate = (event: unknown): event is CoordinationEventUpdate => {
    return isCoordinationCanonizeEvent(event) || 
           isCoordinationDecanonizeEvent(event) || 
           isMoveAssetRequest(event) ||
           isApplyEditRequest(event) ||
           isCreateSnapshotRequest(event) ||
           isPurgeAssetRequest(event)
}

/**
 * Serializer/Deserializer for coordination format events
 * 
 * This handles the conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * Coordination events are hand-created and pass through as structured data
 */
export class CoordinationEventSerializer implements DataSourceEventSerializer<CoordinationEventUpdate, CoordinationEventExternal> {
    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize(params: {
        update: CoordinationEventUpdate;
        header: StreamingEventHeader;
    }): CoordinationEventExternal {
        const { update, header } = params
        if (header.type === 'Move Asset') {
            const move = update as MoveAssetRequest
            return {
                type: 'Move Asset',
                fromZone: move.fromZone,
                toZone: move.toZone,
                player: move.player,
                subFolder: move.subFolder
            }
        } else if (header.type === 'Apply Edit') {
            const apply = update as ApplyEditRequest
            return {
                type: 'Apply Edit',
                RequestId: apply.RequestId,
                schema: apply.schema,
                createIfNeeded: apply.createIfNeeded,
                zone: apply.zone
            }
        } else if (header.type === 'Create Snapshot') {
            return {
                type: 'Create Snapshot'
            }
        } else if (header.type === 'Purge Asset') {
            const purge = update as PurgeAssetRequest
            return {
                type: 'Purge Asset',
                expectedZone: purge.expectedZone,
                requireExists: purge.requireExists
            }
        } else if (header.type === 'Canonize Asset' || header.type === 'Decanonize Asset') {
            return {
                type: header.type
            }
        } else {
            throw new Error(`Unknown coordination event type: ${header.type}`)
        }
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: { externalUpdate: CoordinationEventExternal; header: StreamingEventHeader }): CoordinationEventUpdate | null {
        const { externalUpdate, header } = params
        const eventType = header.type

        if (eventType === 'Canonize Asset') {
            return {
                type: 'Canonize Asset'
            }
        } else if (eventType === 'Decanonize Asset') {
            return {
                type: 'Decanonize Asset'
            }
        } else if (eventType === 'Move Asset') {
            const ext = externalUpdate as MoveAssetRequestExternal
            return {
                type: 'Move Asset',
                fromZone: ext.fromZone!,
                toZone: ext.toZone!,
                player: ext.player,
                subFolder: ext.subFolder
            }
        } else if (eventType === 'Apply Edit') {
            const ext = externalUpdate as ApplyEditRequestExternal
            return {
                type: 'Apply Edit',
                RequestId: ext.RequestId,
                schema: ext.schema,
                createIfNeeded: ext.createIfNeeded,
                zone: ext.zone
            }
        } else if (eventType === 'Create Snapshot') {
            return {
                type: 'Create Snapshot'
            }
        } else if (eventType === 'Purge Asset') {
            const ext = externalUpdate as PurgeAssetRequestExternal
            return {
                type: 'Purge Asset',
                expectedZone: ext.expectedZone,
                requireExists: ext.requireExists
            }
        } else {
            return null
        }
    }
    
    // Note: serializeSnapshot and deserializeSnapshot are not implemented
    // as coordination events are for a non-replayable data source that doesn't use snapshots
}
