import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import { AssetUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraRoomId, isEphemeraRoomId } from '../../baseClasses'

//
// Internal types for diagnostics events
//

export type DiagnosticsS3StructureFindingEvent = {
    type: 'S3 Structure Finding'
    source: string              // e.g., "primitives.wml"
    status: 'missing' | 'present' | 'corrupted' | 'unexpected'
    diagnosticRunId: string
    timestamp: string
}

export type DiagnosticsCacheConsistencyFindingEvent = {
    type: 'Cache Consistency Finding'
    assetId: string             // e.g., "ASSET#primitives"
    status: 'stale' | 'missing'
    diagnosticRunId: string
    timestamp: string
}

export type DiagnosticsEphemeraRenderCacheFindingEvent = {
    type: 'Ephemera RenderCache Finding'
    perspective: AssetUUID[]
    status: 'missing' | 'corrupted'
    diagnosticRunId: string
    timestamp: string
    roomIds?: EphemeraRoomId[]
}

export type DiagnosticsStaleSessionIdFindingEvent = {
    type: 'Stale SessionId Finding'
    player: string
    diagnosticRunId: string
    timestamp: string
}

export type DiagnosticsRoomOccupancyDriftFindingEvent = {
    type: 'Room Occupancy Drift Finding'
    roomId: EphemeraRoomId
    diagnosticRunId: string
    timestamp: string
}

export type DiagnosticsPlayerMisalignmentFindingEvent = {
    type: 'Player Misalignment Finding'
    player: string
    diagnosticRunId: string
    timestamp: string
}

/** Indexed import vertical hops disagree with authoritative component `_from`; see heal path on `mtw.assets`. */
export type DiagnosticsComponentVerticalMisalignedFindingEvent = {
    type: 'Component Vertical Misaligned Finding'
    assetId: string
    /** `stale`: both orphans and misses in some partition (wrong hops); otherwise worst single kind. */
    status: 'missing' | 'stale' | 'orphan'
    diagnosticRunId: string
    timestamp: string
}

/** Heal Global Values content shape (for deserialize only; produced elsewhere) */
export type DiagnosticsHealGlobalValuesContent = {
    type: 'Heal Global Values'
    connections?: unknown
    assets?: unknown
}

// Union type for all internal diagnostics events
export type DiagnosticsEventUpdate =
    | DiagnosticsS3StructureFindingEvent
    | DiagnosticsCacheConsistencyFindingEvent
    | DiagnosticsEphemeraRenderCacheFindingEvent
    | DiagnosticsStaleSessionIdFindingEvent
    | DiagnosticsRoomOccupancyDriftFindingEvent
    | DiagnosticsPlayerMisalignmentFindingEvent
    | DiagnosticsComponentVerticalMisalignedFindingEvent
    | DiagnosticsHealGlobalValuesContent

//
// External types for diagnostics events (EventBridge format)
//

export type DiagnosticsS3StructureFindingEventExternal = {
    type: 'S3 Structure Finding'
    source: string
    status: 'missing' | 'present' | 'corrupted' | 'unexpected'
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsCacheConsistencyFindingEventExternal = {
    type: 'Cache Consistency Finding'
    assetId: string
    status: 'stale' | 'missing'
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsEphemeraRenderCacheFindingEventExternal = {
    type: 'Ephemera RenderCache Finding'
    perspective: AssetUUID[]
    status: 'missing' | 'corrupted'
    diagnosticRunId?: string
    timestamp?: string
    roomIds?: EphemeraRoomId[]
}

export type DiagnosticsStaleSessionIdFindingEventExternal = {
    type: 'Stale SessionId Finding'
    player: string
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsRoomOccupancyDriftFindingEventExternal = {
    type: 'Room Occupancy Drift Finding'
    roomId: EphemeraRoomId
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsPlayerMisalignmentFindingEventExternal = {
    type: 'Player Misalignment Finding'
    player: string
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsComponentVerticalMisalignedFindingEventExternal = {
    type: 'Component Vertical Misaligned Finding'
    assetId: string
    status?: 'missing' | 'stale' | 'orphan'
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsEventExternal =
    | DiagnosticsS3StructureFindingEventExternal
    | DiagnosticsCacheConsistencyFindingEventExternal
    | DiagnosticsEphemeraRenderCacheFindingEventExternal
    | DiagnosticsStaleSessionIdFindingEventExternal
    | DiagnosticsRoomOccupancyDriftFindingEventExternal
    | DiagnosticsPlayerMisalignmentFindingEventExternal
    | DiagnosticsComponentVerticalMisalignedFindingEventExternal

//
// Type guards
//

export const isS3StructureFindingEvent = (event: any): event is DiagnosticsS3StructureFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'S3 Structure Finding' &&
        typeof event.source === 'string' &&
        typeof event.status === 'string' &&
        ['missing', 'present', 'corrupted', 'unexpected'].includes(event.status)
    )
}

export const isCacheConsistencyFindingEvent = (event: any): event is DiagnosticsCacheConsistencyFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Cache Consistency Finding' &&
        typeof event.assetId === 'string' &&
        typeof event.status === 'string' &&
        ['stale', 'missing'].includes(event.status)
    )
}

export const isEphemeraRenderCacheFindingEvent = (event: any): event is DiagnosticsEphemeraRenderCacheFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Ephemera RenderCache Finding' &&
        Array.isArray(event.perspective) &&
        event.perspective.every((entry: unknown) => typeof entry === 'string' && isSchemaAssetUUID(entry)) &&
        typeof event.status === 'string' &&
        ['missing', 'corrupted'].includes(event.status) &&
        (!event.roomIds || (
            Array.isArray(event.roomIds) &&
            event.roomIds.every((entry: unknown) => typeof entry === 'string' && isEphemeraRoomId(entry))
        ))
    )
}

export const isStaleSessionIdFindingEvent = (event: any): event is DiagnosticsStaleSessionIdFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Stale SessionId Finding' &&
        typeof event.player === 'string' &&
        event.player.length > 0
    )
}

export const isRoomOccupancyDriftFindingEvent = (event: any): event is DiagnosticsRoomOccupancyDriftFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Room Occupancy Drift Finding' &&
        typeof event.roomId === 'string' &&
        isEphemeraRoomId(event.roomId)
    )
}

export const isPlayerMisalignmentFindingEvent = (event: any): event is DiagnosticsPlayerMisalignmentFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Player Misalignment Finding' &&
        typeof event.player === 'string' &&
        event.player.length > 0
    )
}

export const isComponentVerticalMisalignedFindingEvent = (
    event: any
): event is DiagnosticsComponentVerticalMisalignedFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Component Vertical Misaligned Finding' &&
        typeof event.assetId === 'string' &&
        typeof event.status === 'string' &&
        ['missing', 'stale', 'orphan'].includes(event.status)
    )
}

export const isDiagnosticsEventUpdate = (event: unknown): event is DiagnosticsEventUpdate => {
    return isS3StructureFindingEvent(event) || isCacheConsistencyFindingEvent(event) || isEphemeraRenderCacheFindingEvent(event) ||
        isStaleSessionIdFindingEvent(event) || isRoomOccupancyDriftFindingEvent(event) || isPlayerMisalignmentFindingEvent(event) ||
        isComponentVerticalMisalignedFindingEvent(event) ||
        (typeof event === 'object' && event !== null && (event as any).type === 'Heal Global Values')
}

/**
 * Serializer/Deserializer for diagnostics format events
 * 
 * Handles conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * The detail-type field from EventBridge becomes the 'type' field internally
 */
export class DiagnosticsEventSerializer implements DataSourceEventSerializer<DiagnosticsEventUpdate, DiagnosticsEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {}
    /**
     * Serialize an internal event to external format for EventBridge transmission
     */
    serialize(params: {
        content: DiagnosticsEventUpdate;
        header: StreamingEventHeader;
    }): DiagnosticsEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('DiagnosticsEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'S3 Structure Finding' && isS3StructureFindingEvent(content)) {
            return {
                type: 'S3 Structure Finding',
                source: content.source,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Cache Consistency Finding' && isCacheConsistencyFindingEvent(content)) {
            return {
                type: 'Cache Consistency Finding',
                assetId: content.assetId,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Ephemera RenderCache Finding' && isEphemeraRenderCacheFindingEvent(content)) {
            return {
                type: 'Ephemera RenderCache Finding',
                perspective: content.perspective,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp,
                ...(content.roomIds ? { roomIds: content.roomIds } : {})
            }
        }
        if (header.type === 'Stale SessionId Finding' && isStaleSessionIdFindingEvent(content)) {
            return {
                type: 'Stale SessionId Finding',
                player: content.player,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Room Occupancy Drift Finding' && isRoomOccupancyDriftFindingEvent(content)) {
            return {
                type: 'Room Occupancy Drift Finding',
                roomId: content.roomId,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Player Misalignment Finding' && isPlayerMisalignmentFindingEvent(content)) {
            return {
                type: 'Player Misalignment Finding',
                player: content.player,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Component Vertical Misaligned Finding' && isComponentVerticalMisalignedFindingEvent(content)) {
            return {
                type: 'Component Vertical Misaligned Finding',
                assetId: content.assetId,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        throw new Error(`Unknown diagnostics event type: ${header.type}`)
    }

    /**
     * Deserialize an external event to internal format for messageBus processing
     *
     * Note: The detail-type from EventBridge becomes the 'type' field in content
     * via the fromEventBridgeFormat transformation
     */
    async deserialize(params: {
        content: any  // Will have type field from EventBridge detail-type
        header: StreamingEventHeader
    }): Promise<DiagnosticsEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        const eventType = header.type

        // The type field comes from EventBridge detail-type
        if (eventType === 'S3 Structure Finding') {
            // Validate required fields
            if (typeof content.source !== 'string' || typeof content.status !== 'string') {
                return null
            }

            return {
                type: 'S3 Structure Finding',
                source: content.source,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Cache Consistency Finding') {
            if (typeof content.assetId !== 'string' || typeof content.status !== 'string') {
                return null
            }
            if (!['stale', 'missing'].includes(content.status)) {
                return null
            }
            return {
                type: 'Cache Consistency Finding',
                assetId: content.assetId,
                status: content.status as 'stale' | 'missing',
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Ephemera RenderCache Finding') {
            if (!Array.isArray(content.perspective) || typeof content.status !== 'string') {
                return null
            }
            if (!content.perspective.every((entry: unknown) => typeof entry === 'string' && isSchemaAssetUUID(entry))) {
                return null
            }
            if (!['missing', 'corrupted'].includes(content.status)) {
                return null
            }
            if (content.roomIds !== undefined) {
                if (!Array.isArray(content.roomIds) || !content.roomIds.every((entry: unknown) => typeof entry === 'string' && isEphemeraRoomId(entry))) {
                    return null
                }
            }
            return {
                type: 'Ephemera RenderCache Finding',
                perspective: content.perspective as AssetUUID[],
                status: content.status as 'missing' | 'corrupted',
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString(),
                ...(content.roomIds ? { roomIds: content.roomIds as EphemeraRoomId[] } : {})
            }
        }

        if (eventType === 'Stale SessionId Finding') {
            if (typeof content.player !== 'string' || content.player.length === 0) {
                return null
            }
            return {
                type: 'Stale SessionId Finding',
                player: content.player,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Room Occupancy Drift Finding') {
            if (typeof content.roomId !== 'string' || !isEphemeraRoomId(content.roomId)) {
                return null
            }
            return {
                type: 'Room Occupancy Drift Finding',
                roomId: content.roomId as EphemeraRoomId,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Player Misalignment Finding') {
            if (typeof content.player !== 'string' || content.player.length === 0) {
                return null
            }
            return {
                type: 'Player Misalignment Finding',
                player: content.player,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Component Vertical Misaligned Finding') {
            if (typeof content.assetId !== 'string' || typeof content.status !== 'string') {
                return null
            }
            if (!['missing', 'stale', 'orphan'].includes(content.status)) {
                return null
            }
            return {
                type: 'Component Vertical Misaligned Finding',
                assetId: content.assetId,
                status: content.status as 'missing' | 'stale' | 'orphan',
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Heal Global Values') {
            return {
                type: 'Heal Global Values',
                connections: content.connections,
                assets: content.assets
            }
        }

        return null
    }
}

