// ContentHeaders Sub-source Base Classes
// 
// This file contains base types and type guards for the ContentHeaders sub-source.
// Migrated from lambda/assets/contentHeaders/baseClasses.ts

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Internal types for content headers events (using StandardForm objects)
export type ContentHeadersEventUpdate = ContentHeadersSnapshot | ContentHeadersUpdate | ZoneUpdatedEvent

export type ContentHeadersSnapshot = {
    type: 'Snapshot'
    assets: Array<{
        assetId: AssetUUID
        zone: Zone
        standardForm: StandardForm // Internal representation for manipulation
    }>
}

export type ContentHeadersUpdate = {
    type: 'Headers Updated'
    assetId: AssetUUID
    zone: Zone
    standardForm: StandardForm // Internal representation for manipulation
}

// Type guards for content headers events
export const isContentHeadersSnapshot = (event: any): event is ContentHeadersSnapshot => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Snapshot' &&
        'assets' in event &&
        Array.isArray(event.assets)
    )
}

export const isContentHeadersUpdate = (event: any): event is ContentHeadersUpdate => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Headers Updated' &&
        'assetId' in event &&
        'zone' in event &&
        'standardForm' in event &&
        typeof event.assetId === 'string' &&
        isZone(event.zone)
    )
}

export type ZoneUpdatedEvent = {
    type: 'Zone Updated'
    assetId: AssetUUID
    fromZone: Zone
    toZone: Zone
}

// Type guards for zone updated events
export const isZoneUpdatedEvent = (event: any): event is ZoneUpdatedEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Zone Updated' &&
        'assetId' in event &&
        'fromZone' in event &&
        'toZone' in event &&
        typeof event.assetId === 'string' &&
        isZone(event.fromZone) &&
        isZone(event.toZone)
    )
}

/**
 * Aggregator for ContentHeaders data source
 * 
 * Handles combining snapshots with streaming events to maintain current state.
 * Works with internal format (StandardForm objects).
 */
export class ContentHeadersAggregator {
    /**
     * Create an empty snapshot (before any data arrives)
     */
    createEmpty(): ContentHeadersSnapshot {
        return {
            type: 'Snapshot',
            assets: []
        }
    }

    /**
     * Apply a single update event to a snapshot
     * Returns the new snapshot (immutable pattern)
     */
    applyUpdate(
        snapshot: ContentHeadersSnapshot,
        update: ContentHeadersEventUpdate,
        _header: StreamingEventHeader
    ): { success: true; snapshot: ContentHeadersSnapshot } | { success: false; error: Error; snapshot: ContentHeadersSnapshot } {
        try {
            if (isContentHeadersUpdate(update)) {
                // Handle Headers Updated event
                const { assetId, zone, standardForm } = update
                
                // Find existing asset if any
                const existing = snapshot.assets.find(asset => asset.assetId === assetId)
                
                // Merge with existing StandardForm (Edits to be Applied mode) or use incoming (Direct Representation mode)
                const mergedStandardForm = existing 
                    ? existing.standardForm.merge(standardForm)
                    : standardForm
                
                // Create baseline by filtering out the existing record, then add the new/merged one
                const baselineAssets = snapshot.assets.filter(asset => asset.assetId !== assetId)
                
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assets: [
                            ...baselineAssets,
                            {
                                assetId,
                                zone,
                                standardForm: mergedStandardForm
                            }
                        ]
                    }
                }
            } else if (isZoneUpdatedEvent(update)) {
                // Handle Zone Updated event
                const { assetId, toZone } = update
                
                // Find existing asset if any
                const existing = snapshot.assets.find(asset => asset.assetId === assetId)
                
                // Get the StandardForm (existing or create empty placeholder)
                const standardForm = existing 
                    ? existing.standardForm
                    : new StandardForm(`<Asset uuid=(${assetId.split('#')[1] || 'unknown'})></Asset>`)
                
                // Create baseline by filtering out the existing record, then add the updated one
                const baselineAssets = snapshot.assets.filter(asset => asset.assetId !== assetId)
                
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assets: [
                            ...baselineAssets,
                            {
                                assetId,
                                zone: toZone,
                                standardForm
                            }
                        ]
                    }
                }
            } else if (isContentHeadersSnapshot(update)) {
                // Handle Snapshot event - replace entire snapshot
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