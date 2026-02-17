/**
 * Payload types and type guards for API-triggered internal events (dataSourceKey: 'api.wml').
 * Used by subscribedEvents.ts and receiveEvents handlers. No serializers; in-process only.
 */
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'

//
// Internal types for coordination events (no type; discrimination by header)
//

export type CoordinationCanonizeEvent = Record<string, never>

export type CoordinationDecanonizeEvent = Record<string, never>

export type MoveAssetRequest = {
    fromZone: Zone;
    toZone: Zone;
    player?: string;
    subFolder?: string;
}

export type ApplyEditRequest = {
    RequestId?: string;
    schema: string;
    createIfNeeded?: boolean;
    zone?: Zone;
}

export type CreateSnapshotRequest = Record<string, never>

export type PurgeAssetRequest = {
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

//
// Type guards (shape-based)
//

export const isMoveAssetRequest = (event: any): event is MoveAssetRequest => {
    return event &&
        typeof event === 'object' &&
        typeof event.fromZone === 'string' &&
        typeof event.toZone === 'string'
}

export const isCoordinationCanonizeEvent = (event: any): event is CoordinationCanonizeEvent => {
    return event && typeof event === 'object' && Object.keys(event).length === 0
}

export const isCoordinationDecanonizeEvent = (event: any): event is CoordinationDecanonizeEvent => {
    return event && typeof event === 'object' && Object.keys(event).length === 0
}

export const isApplyEditRequest = (event: any): event is ApplyEditRequest => {
    return event &&
        typeof event === 'object' &&
        typeof event.schema === 'string' &&
        (event.RequestId === undefined || typeof event.RequestId === 'string') &&
        !('fromZone' in event)
}

export const isCreateSnapshotRequest = (event: any): event is CreateSnapshotRequest => {
    return event && typeof event === 'object' && Object.keys(event).length === 0
}

export const isPurgeAssetRequest = (event: any): event is PurgeAssetRequest => {
    return event &&
        typeof event === 'object' &&
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
