// Library Data Source Base Classes
// 
// This file contains base types, type guards, and aggregator for the Library data source.
// The Library data source provides a list of asset IDs in the Library zone.

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AggregationResult, DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { SerializableObject, EventPayload, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Internal types for library events
export type LibraryEventUpdate = LibrarySnapshot | AssetAdded | AssetRemoved

export type LibrarySnapshot = {
    type: 'Snapshot'
    assetIds: AssetUUID[]
}

export type AssetAdded = {
    type: 'Asset Added'
    assetId: AssetUUID
}

export type AssetRemoved = {
    type: 'Asset Removed'
    assetId: AssetUUID
}

// Type guards for library events
export const isLibrarySnapshot = (event: any): event is LibrarySnapshot => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Snapshot' &&
        'assetIds' in event &&
        Array.isArray(event.assetIds)
    )
}

export const isAssetAdded = (event: any): event is AssetAdded => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Asset Added' &&
        'assetId' in event &&
        typeof event.assetId === 'string'
    )
}

export const isAssetRemoved = (event: any): event is AssetRemoved => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Asset Removed' &&
        'assetId' in event &&
        typeof event.assetId === 'string'
    )
}

export const isLibraryUpdate = (event: any): event is AssetAdded | AssetRemoved => {
    return isAssetAdded(event) || isAssetRemoved(event)
}

/**
 * Aggregator for Library data source
 * 
 * Handles combining snapshots with streaming events to maintain current state.
 * Simple add/remove operations on asset ID arrays.
 */
export class LibraryAggregator implements DataSourceAggregator<LibrarySnapshot, LibraryEventUpdate> {
    /**
     * Create an empty snapshot (before any data arrives)
     */
    createEmpty(): LibrarySnapshot {
        return {
            type: 'Snapshot',
            assetIds: []
        }
    }

    /**
     * Apply a single update event to a snapshot
     * Returns the new snapshot (immutable pattern)
     */
    applyUpdate(
        snapshot: LibrarySnapshot,
        update: LibraryEventUpdate,
        _header: StreamingEventHeader
    ): AggregationResult<LibrarySnapshot> {
        try {
            if (isAssetAdded(update)) {
                // Add asset UUID if not already present (idempotent)
                const assetIds = snapshot.assetIds.includes(update.assetId)
                    ? snapshot.assetIds
                    : [...snapshot.assetIds, update.assetId]
                
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assetIds
                    }
                }
            } else if (isAssetRemoved(update)) {
                // Remove asset UUID from array (idempotent)
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assetIds: snapshot.assetIds.filter(id => id !== update.assetId)
                    }
                }
            } else if (isLibrarySnapshot(update)) {
                // Replace entire snapshot
                return {
                    success: true,
                    snapshot: update
                }
            } else {
                throw new Error(`Unknown update type: ${JSON.stringify(update)}`)
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                snapshot
            }
        }
    }
}

