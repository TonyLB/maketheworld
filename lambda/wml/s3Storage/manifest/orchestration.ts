/**
 * Manifest Orchestration Operations
 * 
 * Higher-level operations that orchestrate multiple manifest subsystem operations.
 * These functions coordinate between chunks, snapshots, and manifest updates to
 * provide complete workflows.
 * 
 * Design principles:
 * - Orchestrate existing low-level operations (don't duplicate logic)
 * - Generic: Work with any prefix (content or auth)
 * - Caller holds atomicLock for concurrency protection
 */

import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { loadManifest } from './operations'
import { appendManifestEvents } from './operations'
import { writeSnapshot, SnapshotReference } from './snapshots'
import { isManifestChunkEvent, isManifestSnapshotEvent } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'

/**
 * Options for creating a manual snapshot
 */
export interface CreateManualSnapshotOptions {
    prefix: string;     // S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
    zone: Zone;         // Zone for S3 tags (enables lifecycle policies)
}

/**
 * Result of creating a manual snapshot
 */
export interface CreateManualSnapshotResult {
    success: true;
    snapshotReference: SnapshotReference;
    chunksBeforeSnapshot: number;
}

/**
 * Create a manual snapshot with manifest integration
 * 
 * This orchestrates the complete snapshot creation workflow:
 * 1. Load manifest to count chunks since last snapshot
 * 2. Write snapshot (copies materialized view to snapshot location)
 * 3. Append SnapshotEvent to manifest
 * 
 * The caller is responsible for:
 * - Holding atomicLock on the asset
 * - Emitting "Snapshot Created" event via DataSource
 * 
 * @param options - Snapshot creation options
 * @returns Snapshot reference and metadata
 */
export const createManualSnapshot = async (
    options: CreateManualSnapshotOptions
): Promise<CreateManualSnapshotResult> => {
    const { prefix, zone } = options
    const timestamp = Date.now()
    
    // Load manifest to count chunks since last snapshot
    const events = await loadManifest(prefix)
    
    // Find the index of the most recent snapshot (if any)
    const lastSnapshotIndex = events.reduce((lastIndex, event, currentIndex) => {
        return isManifestSnapshotEvent(event) ? currentIndex : lastIndex
    }, -1)
    
    // Count chunks after the last snapshot (or all chunks if no snapshot exists)
    const chunksAfterSnapshot = events.slice(lastSnapshotIndex + 1)
    const chunksBeforeSnapshot = chunksAfterSnapshot.filter(isManifestChunkEvent).length
    
    // Write snapshot (copies materialized view)
    const snapshotReference = await writeSnapshot({
        prefix,
        timestamp,
        zone,
        snapshotType: 'manual',
        chunksBeforeSnapshot
    })
    
    // Append snapshot event to manifest
    await appendManifestEvents(prefix, [
        {
            type: 'snapshot',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            s3Key: snapshotReference.s3Key,
            snapshotType: 'manual',
            chunksBeforeSnapshot,
            snapshotSize: snapshotReference.snapshotSize
        }
    ])
    
    return {
        success: true,
        snapshotReference,
        chunksBeforeSnapshot
    }
}

