// ContentHeaders Sub-source Base Classes
// 
// This file contains base types and type guards for the ContentHeaders sub-source.
// Migrated from lambda/assets/contentHeaders/baseClasses.ts

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

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

// Envelope type guards: narrow both header and content so aggregator needs no casts
export type ContentHeadersEnvelope = ResolvedStreamingEnvelope<ContentHeadersEventUpdate, StreamingEventHeader>

export function isContentHeadersUpdateEnvelope(
    envelope: ContentHeadersEnvelope
): envelope is ResolvedStreamingEnvelope<ContentHeadersUpdate, StreamingEventHeader & { type: 'Headers Updated' }> {
    return envelope.header.type === 'Headers Updated'
}

export function isZoneUpdatedContentHeadersEnvelope(
    envelope: ContentHeadersEnvelope
): envelope is ResolvedStreamingEnvelope<ZoneUpdatedEvent, StreamingEventHeader & { type: 'Zone Updated' }> {
    return envelope.header.type === 'Zone Updated'
}

export function isContentHeadersSnapshotEnvelope(
    envelope: ContentHeadersEnvelope
): envelope is ResolvedStreamingEnvelope<ContentHeadersSnapshot, StreamingEventHeader & { type: 'Snapshot' }> {
    return envelope.header.type === 'Snapshot'
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
     * Routes on envelope.header.type; uses envelope.content for domain data.
     */
    applyUpdate(
        snapshot: ContentHeadersSnapshot,
        envelope: ContentHeadersEnvelope
    ): { success: true; snapshot: ContentHeadersSnapshot } | { success: false; error: Error; snapshot: ContentHeadersSnapshot } {
        try {
            if (isContentHeadersUpdateEnvelope(envelope)) {
                const { assetId, zone, standardForm } = envelope.content
                const existing = snapshot.assets.find(asset => asset.assetId === assetId)
                const mergedStandardForm = existing
                    ? existing.standardForm.merge(standardForm)
                    : standardForm
                const baselineAssets = snapshot.assets.filter(asset => asset.assetId !== assetId)
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assets: [
                            ...baselineAssets,
                            { assetId, zone, standardForm: mergedStandardForm }
                        ]
                    }
                }
            }
            if (isZoneUpdatedContentHeadersEnvelope(envelope)) {
                const { assetId, toZone } = envelope.content
                const existing = snapshot.assets.find(asset => asset.assetId === assetId)
                const standardForm = existing
                    ? existing.standardForm
                    : new StandardForm(`<Asset uuid=(${assetId.split('#')[1] || 'unknown'})></Asset>`)
                const baselineAssets = snapshot.assets.filter(asset => asset.assetId !== assetId)
                return {
                    success: true,
                    snapshot: {
                        type: 'Snapshot',
                        assets: [
                            ...baselineAssets,
                            { assetId, zone: toZone, standardForm }
                        ]
                    }
                }
            }
            if (isContentHeadersSnapshotEnvelope(envelope)) {
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