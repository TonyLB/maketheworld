import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import {
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '../../baseClasses'
import type { EphemeraMembershipHostId } from '../../ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '../../ephemeraPositionAdjacency'

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

export type DiagnosticsWMLMaterializedViewFindingEvent = {
    type: 'WML Materialized View Finding'
    assetId: string
    diagnosticRunId: string
    timestamp: string
}

export type RenderCacheTargetCatalog = {
    ephemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId
    perspectiveKey: string
}

export type DiagnosticsEphemeraRenderCacheFindingEvent = {
    type: 'Ephemera RenderCache Finding'
    targetCatalogs: RenderCacheTargetCatalog[]
    status: 'missing' | 'corrupted'
    diagnosticRunId: string
    timestamp: string
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

export type DiagnosticsOrphanedImprovisedObjectFindingEvent = {
    type: 'Orphaned Improvised Object Finding'
    objectId: EphemeraObjectId
    diagnosticRunId: string
    timestamp: string
}

/**
 * LP4i: a `Meta::*.ludicGraph` row whose stored payload fails the shipped shape guard
 * (`isEphemeraLudicGraphFieldPayload`) --- currently only reachable by the root-in-nodes gap
 * (concepts clause 3), since the guard is the single source of truth for staleness and nothing
 * else in the shape has drifted yet.
 */
export type DiagnosticsLudicGraphStaleStructureFindingEvent = {
    type: 'Ludic Graph Stale Structure Finding'
    ephemeraId: EphemeraMembershipHostId
    diagnosticRunId: string
    timestamp: string
}

/**
 * LP6a (LD-18): a `ludicGraph` port whose denormalized exterior values (`kind`,
 * `exteriorRelationLabel`) disagree with the referring edge held by the host the port itself
 * names. The subject is the individual port, not the row --- a mismatch is one crossing being
 * wrong, and triage needs to know which. Scoped to a *named* referrer: a port whose named
 * referrer holds no matching edge asks *who should refer here*, which only the reverse index
 * answers, and is not a finding.
 */
export type DiagnosticsLudicGraphPortMismatchFindingEvent = {
    type: 'Ludic Graph Port Mismatch Finding'
    ephemeraId: EphemeraMembershipHostId
    portId: string
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
    assets?: unknown
}

// Union type for all internal diagnostics events
export type DiagnosticsEventUpdate =
    | DiagnosticsS3StructureFindingEvent
    | DiagnosticsCacheConsistencyFindingEvent
    | DiagnosticsWMLMaterializedViewFindingEvent
    | DiagnosticsEphemeraRenderCacheFindingEvent
    | DiagnosticsStaleSessionIdFindingEvent
    | DiagnosticsRoomOccupancyDriftFindingEvent
    | DiagnosticsOrphanedImprovisedObjectFindingEvent
    | DiagnosticsPlayerMisalignmentFindingEvent
    | DiagnosticsComponentVerticalMisalignedFindingEvent
    | DiagnosticsLudicGraphStaleStructureFindingEvent
    | DiagnosticsLudicGraphPortMismatchFindingEvent
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

export type DiagnosticsWMLMaterializedViewFindingEventExternal = {
    type: 'WML Materialized View Finding'
    assetId: string
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsEphemeraRenderCacheFindingEventExternal = {
    type: 'Ephemera RenderCache Finding'
    targetCatalogs: RenderCacheTargetCatalog[]
    status: 'missing' | 'corrupted'
    diagnosticRunId?: string
    timestamp?: string
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

export type DiagnosticsOrphanedImprovisedObjectFindingEventExternal = {
    type: 'Orphaned Improvised Object Finding'
    objectId: EphemeraObjectId
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsLudicGraphStaleStructureFindingEventExternal = {
    type: 'Ludic Graph Stale Structure Finding'
    ephemeraId: EphemeraMembershipHostId
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsLudicGraphPortMismatchFindingEventExternal = {
    type: 'Ludic Graph Port Mismatch Finding'
    ephemeraId: EphemeraMembershipHostId
    portId: string
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
    | DiagnosticsWMLMaterializedViewFindingEventExternal
    | DiagnosticsEphemeraRenderCacheFindingEventExternal
    | DiagnosticsStaleSessionIdFindingEventExternal
    | DiagnosticsRoomOccupancyDriftFindingEventExternal
    | DiagnosticsOrphanedImprovisedObjectFindingEventExternal
    | DiagnosticsPlayerMisalignmentFindingEventExternal
    | DiagnosticsComponentVerticalMisalignedFindingEventExternal
    | DiagnosticsLudicGraphStaleStructureFindingEventExternal
    | DiagnosticsLudicGraphPortMismatchFindingEventExternal

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

const PERSPECTIVE_KEY_V1_PREFIX = 'PERSPECTIVE#v1#'

export const isCacheHostEphemeraId = (
    id: unknown
): id is EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId => (
    typeof id === 'string' &&
    (isEphemeraRoomId(id) || isEphemeraFeatureId(id) || isEphemeraKnowledgeId(id))
)

export const isPerspectiveKeyV1 = (key: unknown): key is string => (
    typeof key === 'string' &&
    key.startsWith(PERSPECTIVE_KEY_V1_PREFIX) &&
    key.length > PERSPECTIVE_KEY_V1_PREFIX.length
)

export const isRenderCacheTargetCatalog = (entry: unknown): entry is RenderCacheTargetCatalog => (
    Boolean(
        entry &&
        typeof entry === 'object' &&
        isCacheHostEphemeraId((entry as RenderCacheTargetCatalog).ephemeraId) &&
        isPerspectiveKeyV1((entry as RenderCacheTargetCatalog).perspectiveKey)
    )
)

export const dedupeRenderCacheTargetCatalogs = (
    entries: RenderCacheTargetCatalog[]
): RenderCacheTargetCatalog[] => {
    const seen = new Set<string>()
    const deduped: RenderCacheTargetCatalog[] = []
    for (const entry of entries) {
        const key = `${entry.ephemeraId}::${entry.perspectiveKey}`
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        deduped.push(entry)
    }
    return deduped
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

export const isWMLMaterializedViewFindingEvent = (event: any): event is DiagnosticsWMLMaterializedViewFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'WML Materialized View Finding' &&
        typeof event.assetId === 'string'
    )
}

export const isEphemeraRenderCacheFindingEvent = (event: any): event is DiagnosticsEphemeraRenderCacheFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Ephemera RenderCache Finding' &&
        Array.isArray(event.targetCatalogs) &&
        event.targetCatalogs.every((entry: unknown) => isRenderCacheTargetCatalog(entry)) &&
        typeof event.status === 'string' &&
        ['missing', 'corrupted'].includes(event.status)
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

export const isOrphanedImprovisedObjectFindingEvent = (
    event: any
): event is DiagnosticsOrphanedImprovisedObjectFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Orphaned Improvised Object Finding' &&
        typeof event.objectId === 'string' &&
        isEphemeraObjectId(event.objectId)
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

export const isLudicGraphStaleStructureFindingEvent = (
    event: any
): event is DiagnosticsLudicGraphStaleStructureFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Ludic Graph Stale Structure Finding' &&
        typeof event.ephemeraId === 'string' &&
        isEphemeraMembershipHostId(event.ephemeraId)
    )
}

export const isLudicGraphPortMismatchFindingEvent = (
    event: any
): event is DiagnosticsLudicGraphPortMismatchFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Ludic Graph Port Mismatch Finding' &&
        typeof event.ephemeraId === 'string' &&
        isEphemeraMembershipHostId(event.ephemeraId) &&
        typeof event.portId === 'string' &&
        event.portId.length > 0
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
    return isS3StructureFindingEvent(event) || isCacheConsistencyFindingEvent(event) || isWMLMaterializedViewFindingEvent(event) ||
        isEphemeraRenderCacheFindingEvent(event) ||
        isStaleSessionIdFindingEvent(event) || isRoomOccupancyDriftFindingEvent(event) ||
        isOrphanedImprovisedObjectFindingEvent(event) || isPlayerMisalignmentFindingEvent(event) ||
        isComponentVerticalMisalignedFindingEvent(event) || isLudicGraphStaleStructureFindingEvent(event) ||
        isLudicGraphPortMismatchFindingEvent(event) ||
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
        if (header.type === 'WML Materialized View Finding' && isWMLMaterializedViewFindingEvent(content)) {
            return {
                type: 'WML Materialized View Finding',
                assetId: content.assetId,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Ephemera RenderCache Finding' && isEphemeraRenderCacheFindingEvent(content)) {
            return {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: content.targetCatalogs,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp,
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
        if (header.type === 'Orphaned Improvised Object Finding' && isOrphanedImprovisedObjectFindingEvent(content)) {
            return {
                type: 'Orphaned Improvised Object Finding',
                objectId: content.objectId,
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
        if (header.type === 'Ludic Graph Stale Structure Finding' && isLudicGraphStaleStructureFindingEvent(content)) {
            return {
                type: 'Ludic Graph Stale Structure Finding',
                ephemeraId: content.ephemeraId,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Ludic Graph Port Mismatch Finding' && isLudicGraphPortMismatchFindingEvent(content)) {
            return {
                type: 'Ludic Graph Port Mismatch Finding',
                ephemeraId: content.ephemeraId,
                portId: content.portId,
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

        if (eventType === 'WML Materialized View Finding') {
            if (typeof content.assetId !== 'string') {
                return null
            }
            return {
                type: 'WML Materialized View Finding',
                assetId: content.assetId,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Ephemera RenderCache Finding') {
            if (!Array.isArray(content.targetCatalogs) || typeof content.status !== 'string') {
                return null
            }
            if (!content.targetCatalogs.every((entry: unknown) => isRenderCacheTargetCatalog(entry))) {
                return null
            }
            if (!['missing', 'corrupted'].includes(content.status)) {
                return null
            }
            return {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: dedupeRenderCacheTargetCatalogs(content.targetCatalogs as RenderCacheTargetCatalog[]),
                status: content.status as 'missing' | 'corrupted',
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString(),
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

        if (eventType === 'Orphaned Improvised Object Finding') {
            if (typeof content.objectId !== 'string' || !isEphemeraObjectId(content.objectId)) {
                return null
            }
            return {
                type: 'Orphaned Improvised Object Finding',
                objectId: content.objectId as EphemeraObjectId,
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

        if (eventType === 'Ludic Graph Stale Structure Finding') {
            if (typeof content.ephemeraId !== 'string' || !isEphemeraMembershipHostId(content.ephemeraId)) {
                return null
            }
            return {
                type: 'Ludic Graph Stale Structure Finding',
                ephemeraId: content.ephemeraId as EphemeraMembershipHostId,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Ludic Graph Port Mismatch Finding') {
            if (typeof content.ephemeraId !== 'string' || !isEphemeraMembershipHostId(content.ephemeraId)) {
                return null
            }
            if (typeof content.portId !== 'string' || !content.portId.length) {
                return null
            }
            return {
                type: 'Ludic Graph Port Mismatch Finding',
                ephemeraId: content.ephemeraId as EphemeraMembershipHostId,
                portId: content.portId,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Heal Global Values') {
            return {
                type: 'Heal Global Values',
                assets: content.assets
            }
        }

        return null
    }
}

