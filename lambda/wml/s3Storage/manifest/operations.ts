/**
 * Manifest Operations
 * 
 * Core operations for reading and writing manifest files (NDJSON event logs).
 * These operations are generic and work with any prefix (content or auth).
 * 
 * Concurrency: The caller is responsible for using singleFlight pattern
 * for concurrency control. These functions do not handle coordination internally.
 */

import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { ManifestEvent, isManifestEvent } from './baseClasses'

/**
 * Load and parse a manifest file
 * 
 * @param prefix - S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
 * @returns Array of ManifestEvent objects in chronological order
 */
export const loadManifest = async (prefix: string): Promise<ManifestEvent[]> => {
    const manifestKey = `${prefix}manifest-latest.ndjson`
    
    let contents: string
    try {
        contents = await s3Client.get({ Key: manifestKey })
    } catch (err: any) {
        // Gracefully handle missing manifest (returns empty array)
        if (err && (err.Code === 'NoSuchKey' || err.name === 'NoSuchKey')) {
            return []
        }
        throw err
    }
    
    // Handle empty file
    if (!contents || contents.trim() === '') {
        return []
    }
    
    // Parse NDJSON format (one JSON object per line)
    const lines = contents.split('\n').filter(line => line.trim() !== '')
    
    const events = lines
        .map((line, i) => {
            try {
                const parsed = JSON.parse(line)
                
                // Validate using type guard
                if (isManifestEvent(parsed)) {
                    return parsed
                } else {
                    console.warn(`Invalid manifest event at line ${i + 1} in ${manifestKey}:`, parsed)
                    return null
                }
            } catch (err) {
                console.warn(`Failed to parse manifest line ${i + 1} in ${manifestKey}:`, err)
                return null
            }
        })
        .filter((event): event is ManifestEvent => event !== null)
    
    return events
}

/**
 * Append events to a manifest file
 * 
 * This function handles both initialization (creating new manifest) and
 * subsequent appends to existing manifests. Accepts a batch of events
 * to minimize S3 write operations.
 * 
 * @param prefix - S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
 * @param events - Array of ManifestEvent objects to append
 */
export const appendManifestEvents = async (prefix: string, events: ManifestEvent[]): Promise<void> => {
    const manifestKey = `${prefix}manifest-latest.ndjson`
    
    // Handle empty array - no-op
    if (events.length === 0) {
        return
    }
    
    // Validate all events before appending
    const invalidIndex = events.findIndex(event => !isManifestEvent(event))
    if (invalidIndex !== -1) {
        throw new Error(`Invalid manifest event at index ${invalidIndex}: failed type guard validation`)
    }
    
    // Load existing manifest (or empty array if doesn't exist)
    const existingEvents = await loadManifest(prefix)
    
    // Append new events
    const updatedEvents = [...existingEvents, ...events]
    
    // Serialize to NDJSON format (one JSON object per line)
    const ndjsonContent = updatedEvents
        .map(e => JSON.stringify(e))
        .join('\n')
    
    // Write back to S3
    // Note: No tags/metadata needed on manifest files themselves
    // (Zone tags are on chunks, snapshots, and materialized views)
    await s3Client.put({
        Key: manifestKey,
        Body: ndjsonContent
    })
}

