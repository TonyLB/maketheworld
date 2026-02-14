import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DataSourceEventSerializer, ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

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

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
type CoordinationSerializeParams = ResolvedStreamingEnvelope<CoordinationEventUpdate, StreamingEventHeader>
type CoordinationDeserializeParams = ResolvedStreamingEnvelope<CoordinationEventExternal, StreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isMoveAssetCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Move Asset' }; content: MoveAssetRequest } =>
    p.header.type === 'Move Asset'
const isApplyEditCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Apply Edit' }; content: ApplyEditRequest } =>
    p.header.type === 'Apply Edit'
const isCreateSnapshotCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Create Snapshot' }; content: CreateSnapshotRequest } =>
    p.header.type === 'Create Snapshot'
const isPurgeAssetCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Purge Asset' }; content: PurgeAssetRequest } =>
    p.header.type === 'Purge Asset'
const isCanonizeAssetCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Canonize Asset' }; content: CoordinationCanonizeEvent } =>
    p.header.type === 'Canonize Asset'
const isDecanonizeAssetCoordinationSerializeParams = (p: CoordinationSerializeParams): p is CoordinationSerializeParams & { header: StreamingEventHeader & { type: 'Decanonize Asset' }; content: CoordinationDecanonizeEvent } =>
    p.header.type === 'Decanonize Asset'

// Envelope type guards for deserialize (header.type narrows content)
const isMoveAssetCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Move Asset' }; content: MoveAssetRequestExternal } =>
    p.header.type === 'Move Asset'
const isApplyEditCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Apply Edit' }; content: ApplyEditRequestExternal } =>
    p.header.type === 'Apply Edit'
const isCreateSnapshotCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Create Snapshot' }; content: CreateSnapshotRequestExternal } =>
    p.header.type === 'Create Snapshot'
const isPurgeAssetCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Purge Asset' }; content: PurgeAssetRequestExternal } =>
    p.header.type === 'Purge Asset'
const isCanonizeAssetCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Canonize Asset' }; content: CoordinationCanonizeEventExternal } =>
    p.header.type === 'Canonize Asset'
const isDecanonizeAssetCoordinationDeserializeParams = (p: CoordinationDeserializeParams): p is CoordinationDeserializeParams & { header: StreamingEventHeader & { type: 'Decanonize Asset' }; content: CoordinationDecanonizeEventExternal } =>
    p.header.type === 'Decanonize Asset'

export class CoordinationEventSerializer implements DataSourceEventSerializer<CoordinationEventUpdate, CoordinationEventExternal> {
    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize(params: CoordinationSerializeParams): CoordinationEventExternal {
        if (isMoveAssetCoordinationSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Move Asset',
                fromZone: content.fromZone,
                toZone: content.toZone,
                player: content.player,
                subFolder: content.subFolder
            }
        }
        if (isApplyEditCoordinationSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Apply Edit',
                RequestId: content.RequestId,
                schema: content.schema,
                createIfNeeded: content.createIfNeeded,
                zone: content.zone
            }
        }
        if (isCreateSnapshotCoordinationSerializeParams(params)) {
            return { type: 'Create Snapshot' }
        }
        if (isPurgeAssetCoordinationSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Purge Asset',
                expectedZone: content.expectedZone,
                requireExists: content.requireExists
            }
        }
        if (isCanonizeAssetCoordinationSerializeParams(params)) {
            return { type: 'Canonize Asset' }
        }
        if (isDecanonizeAssetCoordinationSerializeParams(params)) {
            return { type: 'Decanonize Asset' }
        }
        throw new Error(`Unknown coordination event type: ${params.header.type}`)
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: CoordinationDeserializeParams): CoordinationEventUpdate | null {
        if (isCanonizeAssetCoordinationDeserializeParams(params)) {
            return { type: 'Canonize Asset' }
        }
        if (isDecanonizeAssetCoordinationDeserializeParams(params)) {
            return { type: 'Decanonize Asset' }
        }
        if (isMoveAssetCoordinationDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Move Asset',
                fromZone: content.fromZone!,
                toZone: content.toZone!,
                player: content.player,
                subFolder: content.subFolder
            }
        }
        if (isApplyEditCoordinationDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Apply Edit',
                RequestId: content.RequestId,
                schema: content.schema,
                createIfNeeded: content.createIfNeeded,
                zone: content.zone
            }
        }
        if (isCreateSnapshotCoordinationDeserializeParams(params)) {
            return { type: 'Create Snapshot' }
        }
        if (isPurgeAssetCoordinationDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Purge Asset',
                expectedZone: content.expectedZone,
                requireExists: content.requireExists
            }
        }
        return null
    }
    
    // Note: serializeSnapshot and deserializeSnapshot are not implemented
    // as coordination events are for a non-replayable data source that doesn't use snapshots
}
