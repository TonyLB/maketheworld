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
const SNAPSHOT_CONTENT_TYPE = 'text/plain; charset=utf-8'


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
    content?: string;                      // Optional: Direct content to write (if provided, uses PutObject instead of CopyObject)
}

/**
 * Write an immutable snapshot to S3
 * 
 * Snapshots are never modified after writing - they represent a complete materialized
 * state at a specific point in time.
 * 
 * Two modes of operation:
 * 1. **Copy mode** (default, when content not provided):
 *    - Uses S3 CopyObject to copy from materialized view
 *    - Efficient: no data transfer through Lambda
 *    - Parallel HeadObject on source to get size without sequential latency
 * 
 * 2. **Direct write mode** (when content is provided):
 *    - Uses S3 PutObject to write content directly
 *    - Enables optimization: compose content in-memory, write snapshot, then write different content to view
 *    - Example: Synthesize empty baseline → write as snapshot → apply edits → write to view (avoids copy-then-overwrite)
 */
export const writeSnapshot = async (options: WriteSnapshotOptions): Promise<SnapshotReference> => {
    const { prefix, timestamp, zone, snapshotType, chunksBeforeSnapshot, authoringPlayer, content } = options
    
    // Destination: snapshot location
    const s3Key = `${prefix}snapshots/${timestamp}.wml`
    
    // Prepare metadata (immutable attributes)
    const metadata: Record<string, string> = {
        timestamp: timestamp.toString(),
        snapshotType,
        chunksBeforeSnapshot: chunksBeforeSnapshot.toString()
    }
    
    if (authoringPlayer) {
        metadata.authoringPlayer = authoringPlayer
    }
    
    // Prepare tags for lifecycle management
    const tags = { Zone: zone }
    
    let snapshotSize: number
    
    if (content !== undefined) {
        // Direct write mode: Write provided content to snapshot location
        await s3Client.putWithTags({
            Key: s3Key,
            Body: content,
            Tags: tags,
            Metadata: metadata,
            ContentType: SNAPSHOT_CONTENT_TYPE
        })
        
        // Calculate size from content
        snapshotSize = Buffer.byteLength(content, 'utf8')
    } else {
        // Copy mode: Copy from materialized view
        // Source: materialized view (e.g., "test.wml")
        // Remove trailing slash from prefix: "test.wml/" -> "test.wml"
        const sourceKey = prefix.slice(0, -1)
        
        // Parallel: Copy object + Get size from source
        // Size is reliable because snapshot has identical content to source
        const [, size] = await Promise.all([
            s3Client.copyWithTags({
                CopySource: sourceKey,
                Key: s3Key,
                Metadata: metadata,
                Tags: tags,
                ContentType: SNAPSHOT_CONTENT_TYPE
            }),
            s3Client.getSize({ Key: sourceKey })
        ])
        
        snapshotSize = size
    }
    
    return {
        s3Key,
        snapshotSize
    }
}

