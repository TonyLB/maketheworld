/**
 * Chunk Operations
 * 
 * Operations for writing immutable chunk files to S3.
 * Chunks represent incremental edits (WML with Replace/Remove operations).
 * 
 * Design principles:
 * - Chunks are immutable once written (never modified or deleted)
 * - S3 key includes timestamp for chronological ordering + UUID for collision prevention
 * - Generic operations work with any prefix (content or auth)
 * - Zone tags enable lifecycle management (e.g., archival policies)
 */

import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { v4 as uuidv4 } from 'uuid'

const CHUNK_CONTENT_TYPE = 'text/plain; charset=utf-8'

/**
 * Reference to a written chunk for manifest tracking
 */
export interface ChunkReference {
    s3Key: string;
    chunkSize: number;
}

/**
 * Options for writing a chunk
 */
export interface WriteChunkOptions {
    prefix: string;      // S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
    timestamp: number;   // Milliseconds since epoch (for chronological ordering)
    content: string;     // WML content (delta with Replace/Remove operations)
    zone: Zone;          // Zone for S3 tags (enables lifecycle policies)
    authoringPlayer?: string;     // Player who authored this edit (optional)
}

/**
 * Write an immutable chunk to S3
 * 
 * Chunks are never modified after writing - they represent a point-in-time delta.
 * The S3 key includes both timestamp and UUID to ensure uniqueness even with
 * concurrent edits occurring at the same millisecond.
 * 
 */
export const writeChunk = async (options: WriteChunkOptions): Promise<ChunkReference> => {
    const { prefix, timestamp, content, zone, authoringPlayer } = options
    
    // Generate unique chunk identifier
    const chunkUuid = uuidv4()
    
    // Construct S3 key: {prefix}/chunks/{timestamp}-{uuid}.wml
    const s3Key = `${prefix}chunks/${timestamp}-${chunkUuid}.wml`
    
    // Prepare tags for lifecycle management
    const tags = { Zone: zone }
    
    // Prepare metadata (immutable attributes)
    const metadata: Record<string, string> = {
        timestamp: timestamp.toString()
    }
    
    if (authoringPlayer) {
        metadata.authoringPlayer = authoringPlayer
    }
    
    // Write chunk to S3
    await s3Client.putWithTags({
        Key: s3Key,
        Body: content,
        Tags: tags,
        Metadata: metadata,
        ContentType: CHUNK_CONTENT_TYPE
    })
    
    // Calculate size for manifest tracking
    const chunkSize = Buffer.byteLength(content, 'utf8')
    
    return {
        s3Key,
        chunkSize
    }
}

