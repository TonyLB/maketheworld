/**
 * Append Manifest Events with Lazy Migration Support
 * 
 * This utility function handles the common pattern of:
 * 1. Check if lazy migration is needed (create initial snapshot from existing content)
 * 2. Add new manifest events
 * 3. Batch all events into a single appendManifestEvents call
 * 
 * This maintains the optimization of batching snapshot + new events
 * into a single S3 operation, avoiding multiple round-trips.
 * 
 * Used by:
 * - applyEdit: For content edits with lazy migration
 * - moveAsset: For zone changes with lazy migration
 * - Future operations that need manifest history
 */

import { loadManifest, appendManifestEvents } from '../../s3Storage/manifest/operations'
import { writeSnapshot } from '../../s3Storage/manifest/snapshots'
import { ManifestEvent, ManifestSnapshotEvent } from '../../s3Storage/manifest/baseClasses'
import AssetWorkspace from '../../s3Storage/AssetWorkspace'
import { v4 as uuidv4 } from 'uuid'

/**
 * Append manifest events with lazy migration support
 * 
 * @param prefix - S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
 * @param assetWorkspace - AssetWorkspace instance for context (zone, content)
 * @param timestamp - Timestamp for snapshot creation and event ordering
 * @param events - Array of ManifestEvent objects to append
 */
export const appendManifestEventsWithLazyMigration = async (
    prefix: string,
    assetWorkspace: AssetWorkspace,
    timestamp: number,
    events: ManifestEvent[]
): Promise<void> => {
    // Handle empty array - no-op
    if (events.length === 0) {
        return
    }
    
    // Check if lazy migration is needed
    const manifest = await loadManifest(prefix)
    const hasContent = (assetWorkspace.standard?._components?.length ?? 0) > 0
    const needsMigration = manifest.length === 0
    
    const eventsToAppend: ManifestEvent[] = []
    
    // Lazy migration: create initial snapshot
    if (needsMigration) {
        if (hasContent) {
            console.log(`Lazy migration: Creating initial snapshot for ${assetWorkspace.assetId || 'unknown'}`)
        } else {
            console.log(`Lazy migration: Creating empty manifest for ${assetWorkspace.assetId || 'unknown'}`)
        }
        
        // Create snapshot (from existing content or empty)
        const snapshotRef = await writeSnapshot({
            prefix,
            timestamp,
            zone: assetWorkspace.zone,
            snapshotType: 'manual',
            chunksBeforeSnapshot: 0  // Migration boundary - no chunks before this
        })
        
        const snapshotEvent: ManifestSnapshotEvent = {
            type: 'snapshot',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            s3Key: snapshotRef.s3Key,
            snapshotType: 'manual',
            chunksBeforeSnapshot: 0,
            snapshotSize: snapshotRef.snapshotSize
        }
        
        eventsToAppend.push(snapshotEvent)
    }
    
    // Add the new events
    eventsToAppend.push(...events)
    
    // Batch all events into single appendManifestEvents call
    await appendManifestEvents(prefix, eventsToAppend)
}

export default appendManifestEventsWithLazyMigration
