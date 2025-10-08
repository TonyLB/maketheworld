// ContentHeaders Sub-source Base Classes
// 
// This file contains base types and type guards for the ContentHeaders sub-source.
// Migrated from lambda/assets/contentHeaders/baseClasses.ts

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Internal types for content headers events (using StandardForm objects)
export type ContentHeadersEventUpdate = ContentHeadersSnapshot | ContentHeadersUpdate | ZoneUpdatedEvent

export type ContentHeadersSnapshot = {
    type: 'Snapshot Generated'
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
        event.type === 'Snapshot Generated' &&
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
            type: 'Snapshot Generated',
            assets: []
        }
    }

    /**
     * Apply a single update event to a snapshot
     * Returns the new snapshot (immutable pattern)
     */
    applyUpdate(
        snapshot: ContentHeadersSnapshot,
        update: ContentHeadersEventUpdate
    ): { success: true; snapshot: ContentHeadersSnapshot } | { success: false; error: Error; snapshot: ContentHeadersSnapshot } {
        try {
            if (isContentHeadersUpdate(update)) {
                // Handle Headers Updated event
                const { assetId, zone, standardForm } = update
                
                // Find the asset in the snapshot array
                const existingIndex = snapshot.assets.findIndex(asset => asset.assetId === assetId)
                
                if (existingIndex === -1) {
                    // Asset doesn't exist - add it (Direct Representation mode)
                    return {
                        success: true,
                        snapshot: {
                            type: 'Snapshot Generated',
                            assets: [
                                ...snapshot.assets,
                                {
                                    assetId,
                                    zone,
                                    standardForm
                                }
                            ]
                        }
                    }
                } else {
                    // Asset exists - merge the StandardForms (Edits to be Applied mode)
                    const existing = snapshot.assets[existingIndex]
                    const mergedStandardForm = existing.standardForm.merge(standardForm)
                    
                    // Create new array with the merged asset
                    const newAssets = [...snapshot.assets]
                    newAssets[existingIndex] = {
                        assetId,
                        zone,
                        standardForm: mergedStandardForm
                    }
                    
                    return {
                        success: true,
                        snapshot: {
                            type: 'Snapshot Generated',
                            assets: newAssets
                        }
                    }
                }
            } else if (isZoneUpdatedEvent(update)) {
                // Handle Zone Updated event
                const { assetId, toZone } = update
                
                // Find the asset in the snapshot array
                const existingIndex = snapshot.assets.findIndex(asset => asset.assetId === assetId)
                
                if (existingIndex === -1) {
                    // Asset doesn't exist - nothing to update
                    return {
                        success: true,
                        snapshot
                    }
                } else {
                    // Asset exists - update its zone
                    const newAssets = [...snapshot.assets]
                    newAssets[existingIndex] = {
                        ...newAssets[existingIndex],
                        zone: toZone
                    }
                    
                    return {
                        success: true,
                        snapshot: {
                            type: 'Snapshot Generated',
                            assets: newAssets
                        }
                    }
                }
            } else if (isContentHeadersSnapshot(update)) {
                // Handle Snapshot Generated event - replace entire snapshot
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