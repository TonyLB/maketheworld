// ContentHeaders Sub-source Event Contracts
// 
// This file contains event types, type guards, and serializers for the ContentHeaders sub-source.
// Migrated from lambda/assets/contentHeaders/serializers.ts

import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Import and re-export the base classes that are used by this sub-source
import { 
    ContentHeadersEventUpdate, 
    ContentHeadersSnapshot, 
    ContentHeadersUpdate,
    ZoneUpdatedEvent,
    isContentHeadersSnapshot,
    isContentHeadersUpdate,
    isZoneUpdatedEvent,
    ContentHeadersAggregator
} from './baseClasses'

export { 
    ContentHeadersAggregator
}

export type { 
    ContentHeadersEventUpdate, 
    ContentHeadersSnapshot, 
    ContentHeadersUpdate,
    ZoneUpdatedEvent
}

export { 
    isContentHeadersSnapshot,
    isContentHeadersUpdate,
    isZoneUpdatedEvent
}

// External event format (EventBridge) - using WML strings
// External snapshot uses an array for efficient JSON transmission
export type ContentHeadersSnapshotExternal = {
    type: 'Snapshot Generated'
    assets: Array<{
        assetId: AssetUUID
        zone: Zone
        wml: string // Serialized to WML for external consumption
    }>
}

export type ContentHeadersUpdateExternal = {
    type: 'Headers Updated'
    assetId: AssetUUID
    zone: Zone
    wml: string // Serialized to WML for external consumption
}

export type ZoneUpdatedEventExternal = {
    type: 'Zone Updated'
    assetId: AssetUUID
    fromZone: Zone
    toZone: Zone
}

export type ContentHeadersExternal = ContentHeadersSnapshotExternal | ContentHeadersUpdateExternal | ZoneUpdatedEventExternal

/**
 * Event serializer for the mtw.assets.contentHeaders data source.
 * 
 * This serializer implements the serialization boundary between internal StandardForm objects
 * and external WML strings. Internal processing works with StandardForm objects for manipulation,
 * while external transmission uses WML strings for cross-service communication.
 */
export class ContentHeadersEventSerializer implements DataSourceEventSerializer<ContentHeadersEventUpdate, ContentHeadersExternal, ContentHeadersSnapshot, ContentHeadersSnapshotExternal> {
    serialize(params: {
        dataSourceKey: string;
        streamKey: string;
        update: ContentHeadersEventUpdate;
    }): ContentHeadersExternal {
        const { update } = params
        
        if (isContentHeadersUpdate(update)) {
            // Convert internal StandardForm object to external WML string
            return {
                type: 'Headers Updated',
                assetId: update.assetId,
                zone: update.zone,
                wml: schemaToWML([update.standardForm.schema])
            }
        } else {
            throw new Error(`Unknown streaming event type in ContentHeadersEventUpdate: ${JSON.stringify(update)}`)
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        streamKey: string
        externalUpdate: ContentHeadersExternal 
    }): ContentHeadersEventUpdate | null {
        const { externalUpdate } = params
        
        if (externalUpdate.type === 'Headers Updated') {
            // Convert external WML string to internal StandardForm object
            const result: ContentHeadersUpdate = {
                type: 'Headers Updated',
                assetId: externalUpdate.assetId,
                zone: externalUpdate.zone,
                standardForm: new StandardForm(externalUpdate.wml)
            }
            return result
        } else {
            throw new Error(`Unknown external streaming event type: ${(externalUpdate as any).type}`)
        }
    }
    
    serializeSnapshot(snapshot: ContentHeadersSnapshot): ContentHeadersSnapshotExternal {
        // Convert internal StandardForm objects to external WML strings
        const externalAssets = snapshot.assets.map(asset => ({
            assetId: asset.assetId,
            zone: asset.zone,
            wml: schemaToWML([asset.standardForm.schema])
        }))
        
        return {
            type: 'Snapshot Generated',
            assets: externalAssets
        }
    }
    
    deserializeSnapshot(externalSnapshot: ContentHeadersSnapshotExternal): ContentHeadersSnapshot | null {
        try {
            // Convert external WML strings to internal StandardForm objects
            const internalAssets = externalSnapshot.assets.map(asset => ({
                assetId: asset.assetId,
                zone: asset.zone,
                standardForm: new StandardForm(asset.wml)
            }))
            
            return {
                type: 'Snapshot Generated',
                assets: internalAssets
            }
        } catch (error) {
            console.error('Failed to deserialize ContentHeaders snapshot:', error)
            return null
        }
    }
}

// Type guard for external ContentHeaders events
export const isContentHeadersExternal = (event: any): event is ContentHeadersExternal => {
    if (!event || typeof event !== 'object' || !('type' in event)) {
        return false
    }
    switch((event as any).type) {
        case 'Snapshot Generated':
            return Boolean(
                event.data &&
                Array.isArray((event.data as any).assets)
            )
        case 'Headers Updated':
            return Boolean(
                event.data &&
                typeof (event.data as any).assetId === 'string' &&
                typeof (event.data as any).wml === 'string'
            )
        default:
            return false
    }
}

// Note: Utility functions like extractComponentMetadata, createContentHeadersAsset, 
// and createContentHeadersUpdate are business logic that belong in the data source 
// implementation, not in the serializer. They should be imported directly from 
// the data source where they are used.
