// Library Data Source Base Classes
// 
// This file contains base types, type guards, and aggregator for the Library data source.
// The Library data source provides a list of asset IDs in the Library zone.

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AggregationResult, DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { SerializableObject, EventPayload, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ResolvedStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Internal types for library events (no type; discrimination by header)
export type LibraryEventUpdate = LibrarySnapshot | AssetAdded | AssetRemoved

export type LibrarySnapshot = {
    assetIds: AssetUUID[]
}

export type AssetAdded = {
    assetId: AssetUUID
}

export type AssetRemoved = {
    assetId: AssetUUID
}

// Type guards (shape-based)
export const isLibrarySnapshot = (event: any): event is LibrarySnapshot => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'assetIds' in event &&
        Array.isArray(event.assetIds)
    )
}

export const isAssetAdded = (event: any): event is AssetAdded => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'assetId' in event &&
        typeof event.assetId === 'string' &&
        !('assetIds' in event && Array.isArray(event.assetIds))
    )
}

export const isAssetRemoved = (event: any): event is AssetRemoved => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'assetId' in event &&
        typeof event.assetId === 'string' &&
        !('assetIds' in event && Array.isArray(event.assetIds))
    )
}

export const isLibraryUpdate = (event: any): event is AssetAdded | AssetRemoved => {
    return isAssetAdded(event) || isAssetRemoved(event)
}

// Envelope type guards: narrow both header and content so aggregator needs no casts
export type LibraryEnvelope = ResolvedStreamingEnvelope<LibraryEventUpdate, StreamingEventHeader>

export function isAssetAddedLibraryEnvelope(
    envelope: LibraryEnvelope
): envelope is ResolvedStreamingEnvelope<AssetAdded, StreamingEventHeader & { type: 'Asset Added' }> {
    return envelope.header.type === 'Asset Added'
}

export function isAssetRemovedLibraryEnvelope(
    envelope: LibraryEnvelope
): envelope is ResolvedStreamingEnvelope<AssetRemoved, StreamingEventHeader & { type: 'Asset Removed' }> {
    return envelope.header.type === 'Asset Removed'
}

export function isLibrarySnapshotEnvelope(
    envelope: LibraryEnvelope
): envelope is ResolvedStreamingEnvelope<LibrarySnapshot, StreamingEventHeader & { type: 'Snapshot' }> {
    return envelope.header.type === 'Snapshot'
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
            assetIds: []
        }
    }

    /**
     * Apply a single update event to a snapshot
     * Returns the new snapshot (immutable pattern)
     * Routes on envelope.header.type; uses envelope.content for domain data.
     */
    applyUpdate(
        snapshot: LibrarySnapshot,
        envelope: LibraryEnvelope
    ): AggregationResult<LibrarySnapshot> {
        try {
            if (isAssetAddedLibraryEnvelope(envelope)) {
                const { assetId } = envelope.content
                const assetIds = snapshot.assetIds.includes(assetId)
                    ? snapshot.assetIds
                    : [...snapshot.assetIds, assetId]
                return {
                    success: true,
                    snapshot: { assetIds }
                }
            }
            if (isAssetRemovedLibraryEnvelope(envelope)) {
                const { assetId } = envelope.content
                return {
                    success: true,
                    snapshot: {
                        assetIds: snapshot.assetIds.filter(id => id !== assetId)
                    }
                }
            }
            if (isLibrarySnapshotEnvelope(envelope)) {
                return { success: true, snapshot: envelope.content }
            }
            throw new Error(`Unknown update type: ${envelope.header.type}`)
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                snapshot
            }
        }
    }
}

