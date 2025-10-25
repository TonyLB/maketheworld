/**
 * Snapshot Operations
 * 
 * Operations for writing immutable snapshot files to S3.
 * Snapshots represent full materialized content at specific points in time.
 * 
 * Design principles:
 * - Snapshots are immutable once written (never modified or deleted)
 * - Uses S3 CopyObject to efficiently copy materialized view to snapshot location
 * - Parallel HeadObject to get size without sequential latency
 * - S3 key includes timestamp for chronological ordering (no UUID needed - coordinated operation)
 * - Generic operations work with any prefix (content or auth)
 * - Zone tags enable lifecycle management (e.g., archival policies)
 */

import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'

/**
 * Reference to a written snapshot for manifest tracking
 */
export interface SnapshotReference {
    s3Key: string;
    snapshotSize: number;
}

/**
 * Options for writing a snapshot
 */
export interface WriteSnapshotOptions {
    prefix: string;                        // S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
    timestamp: number;                     // Milliseconds since epoch (for chronological ordering)
    zone: Zone;                            // Zone for S3 tags (enables lifecycle policies)
    snapshotType: 'manual' | 'automatic' | 'initializeManifest';  // How was this snapshot created
    chunksBeforeSnapshot: number;          // Number of chunks this snapshot replaces
    authoringPlayer?: string;              // Player who created this snapshot (if applicable)
}

/**
 * Write an immutable snapshot to S3
 * 
 * Snapshots are never modified after writing - they represent a complete materialized
 * state at a specific point in time. The snapshot is created by copying the current
 * materialized view with new metadata/tags.
 * 
 * Uses S3 CopyObject for efficiency (no data transfer through Lambda).
 * Parallel HeadObject on source to get size without sequential latency.
 */
export const writeSnapshot = async (options: WriteSnapshotOptions): Promise<SnapshotReference> => {
    const { prefix, timestamp, zone, snapshotType, chunksBeforeSnapshot, authoringPlayer } = options
    
    // Source: materialized view (e.g., "test.wml")
    // Remove trailing slash from prefix: "test.wml/" -> "test.wml"
    const sourceKey = prefix.slice(0, -1)
    
    // Destination: snapshot location
    const s3Key = `${prefix}snapshots/${timestamp}.wml`
    
    // Prepare metadata (immutable attributes)
    const metadata: Record<string, string> = {
        timestamp: timestamp.toString(),
        snapshotType,
        chunksBeforeSnapshot: chunksBeforeSnapshot.toString()
    }
    
    // Prepare tags for lifecycle management
    const tags = { Zone: zone }
    
    // Parallel: Copy object + Get size from source
    // Size is reliable because snapshot has identical content to source
    const [, snapshotSize] = await Promise.all([
        s3Client.copyWithTags({
            CopySource: sourceKey,
            Key: s3Key,
            Metadata: metadata,
            Tags: tags
        }),
        s3Client.getSize({ Key: sourceKey })
    ])
    
    return {
        s3Key,
        snapshotSize
    }
}

