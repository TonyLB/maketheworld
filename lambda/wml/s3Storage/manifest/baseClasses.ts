/**
 * Manifest Event Schema - Base Classes
 * 
 * Defines the NDJSON event log format for tracking asset history.
 * Each manifest file (manifest-latest.ndjson) contains a chronological sequence
 * of events that describe the evolution of an asset's content.
 * 
 * Design Principles:
 * - Events are immutable records of what happened
 * - NDJSON format (one event per line) for append-only operations
 * - Generic design works for both content ({uuid}.wml/) and auth ({uuid}.auth.wml/) prefixes
 * - Self-describing: all information needed to reconstruct current state
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'

/**
 * Base fields common to all manifest events
 */
export interface ManifestEventBase {
    timestamp: string;      // ISO 8601 timestamp
    eventId: string;        // Unique event identifier (UUID)
}

/**
 * Chunk Event - Records a delta edit applied to the asset
 * 
 * Represents an incremental change (WML with Replace/Remove operations).
 * The chunk file contains the actual WML delta content.
 * 
 * S3 key format: {prefix}/chunks/{timestamp}-{uuid}.wml
 * - timestamp: milliseconds since epoch (for chronological ordering)
 * - uuid: unique identifier (prevents collision on concurrent edits)
 */
export interface ManifestChunkEvent extends ManifestEventBase {
    type: 'chunk';
    s3Key: string;          // Full S3 key (e.g., "{uuid}.wml/chunks/1729252800000-abc123.wml")
    authoringPlayer?: string;  // Player who authored this edit (if applicable)
    chunkSize?: number;     // Size in bytes (optional, for metrics)
}

/**
 * Snapshot Event - Records a full content snapshot
 * 
 * Represents a complete materialized state at a point in time.
 * Enables efficient reconstruction (start from snapshot, apply subsequent chunks).
 */
export interface ManifestSnapshotEvent extends ManifestEventBase {
    type: 'snapshot';
    s3Key: string;          // Full S3 key to snapshot file (e.g., "{uuid}.wml/snapshots/{timestamp}.wml")
    snapshotType: 'manual' | 'automatic';  // How was this snapshot created
    chunksBeforeSnapshot: number;          // Number of chunks this snapshot replaces
    snapshotSize?: number;                 // Size in bytes (optional, for metrics)
}

/**
 * Zone Change Event - Records a zone transition
 * 
 * Represents movement between zones (Personal → Library → Canon, etc.).
 * Does not involve content changes, only metadata updates.
 */
export interface ManifestZoneChangeEvent extends ManifestEventBase {
    type: 'zoneChange';
    fromZone: Zone;
    toZone: Zone;
}

/**
 * Merge Event - Records merging of another asset into this one
 * 
 * FUTURE: Represents incorporation of content from another asset.
 * References the source asset and timestamp for drilling into merge history.
 * Deferred to Phase 3.
 */
export interface ManifestMergeEvent extends ManifestEventBase {
    type: 'merge';
    sourceAssetId: AssetUUID;       // Asset that was merged in
    sourceTimestamp?: string;       // Timestamp of source asset state that was merged (for history drilling)
    s3Key: string;                  // Chunk containing the merge delta
}

/**
 * Union type of all manifest events
 */
export type ManifestEvent = 
    | ManifestChunkEvent 
    | ManifestSnapshotEvent 
    | ManifestZoneChangeEvent
    // | ManifestMergeEvent  // Future: Phase 3

/**
 * Manifest structure
 * 
 * The manifest is an NDJSON file where each line is a ManifestEvent.
 * Events are in chronological order (oldest first).
 * 
 * Format: One JSON object per line (newline-delimited)
 * Location: {prefix}/manifest-latest.ndjson
 */
export type Manifest = ManifestEvent[]

/**
 * Type guards for manifest events
 */
export const isManifestChunkEvent = (event: any): event is ManifestChunkEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'chunk' &&
        typeof event.timestamp === 'string' &&
        typeof event.eventId === 'string' &&
        typeof event.s3Key === 'string'
    )
}

export const isManifestSnapshotEvent = (event: any): event is ManifestSnapshotEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'snapshot' &&
        typeof event.timestamp === 'string' &&
        typeof event.eventId === 'string' &&
        typeof event.s3Key === 'string' &&
        typeof event.snapshotType === 'string' &&
        ['manual', 'automatic'].includes(event.snapshotType) &&
        typeof event.chunksBeforeSnapshot === 'number'
    )
}

export const isManifestZoneChangeEvent = (event: any): event is ManifestZoneChangeEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'zoneChange' &&
        typeof event.timestamp === 'string' &&
        typeof event.eventId === 'string' &&
        typeof event.fromZone === 'string' &&
        typeof event.toZone === 'string'
    )
}

export const isManifestEvent = (event: any): event is ManifestEvent => {
    return isManifestChunkEvent(event) || 
           isManifestSnapshotEvent(event) || 
           isManifestZoneChangeEvent(event)
}

/**
 * Reconstruction state
 * 
 * Represents the information needed to efficiently reconstruct current state
 * from a manifest. This is derived from the manifest event log.
 */
export interface ManifestReconstructionState {
    /**
     * Latest snapshot to start reconstruction from (if any)
     * If undefined, start from empty and apply all chunks
     */
    latestSnapshot?: {
        timestamp: string;
        s3Key: string;
    };
    
    /**
     * Chunks to apply after the snapshot (in chronological order)
     * If no snapshot, this includes all chunks
     */
    chunks: Array<{
        timestamp: string;
        s3Key: string;
    }>;
    
    /**
     * Current zone (from latest zone change event, if any)
     */
    currentZone?: Zone;
    
    /**
     * Metadata about the manifest
     */
    metadata: {
        totalEvents: number;
        totalChunks: number;
        totalSnapshots: number;
        lastModified: string;  // ISO 8601 timestamp of latest event
    };
}

