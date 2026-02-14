// ContentHeaders Sub-source Event Contracts
// 
// This file contains event types, type guards, and serializers for the ContentHeaders sub-source.
// Migrated from lambda/assets/contentHeaders/serializers.ts

import { DataSourceEventSerializer, ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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
    type: 'Snapshot'
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

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
type ContentHeadersSerializeParams = ResolvedStreamingEnvelope<ContentHeadersEventUpdate, StreamingEventHeader>
type ContentHeadersDeserializeParams = ResolvedStreamingEnvelope<ContentHeadersExternal, StreamingEventHeader>

const isHeadersUpdatedContentHeadersSerializeParams = (p: ContentHeadersSerializeParams): p is ContentHeadersSerializeParams & { header: StreamingEventHeader & { type: 'Headers Updated' }; content: ContentHeadersUpdate } =>
    p.header.type === 'Headers Updated'
const isHeadersUpdatedContentHeadersDeserializeParams = (p: ContentHeadersDeserializeParams): p is ContentHeadersDeserializeParams & { header: StreamingEventHeader & { type: 'Headers Updated' }; content: ContentHeadersUpdateExternal } =>
    p.header.type === 'Headers Updated'

/**
 * Event serializer for the mtw.assets.contentHeaders data source.
 * 
 * This serializer implements the serialization boundary between internal StandardForm objects
 * and external WML strings. Internal processing works with StandardForm objects for manipulation,
 * while external transmission uses WML strings for cross-service communication.
 */
export class ContentHeadersEventSerializer implements DataSourceEventSerializer<ContentHeadersEventUpdate, ContentHeadersExternal, ContentHeadersSnapshot, ContentHeadersSnapshotExternal> {
    serialize(params: ContentHeadersSerializeParams): ContentHeadersExternal {
        if (isHeadersUpdatedContentHeadersSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Headers Updated',
                assetId: content.assetId,
                zone: content.zone,
                wml: schemaToWML([content.standardForm.schema])
            }
        }
        throw new Error(`Unknown streaming event type in ContentHeadersEventUpdate: ${params.header.type}`)
    }

    deserialize(params: ContentHeadersDeserializeParams): ContentHeadersEventUpdate | null {
        if (isHeadersUpdatedContentHeadersDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Headers Updated',
                assetId: content.assetId,
                zone: content.zone,
                standardForm: new StandardForm(content.wml)
            }
        }
        throw new Error(`Unknown external streaming event type: ${(params.content as any).type}`)
    }
    
    serializeSnapshot(snapshot: ContentHeadersSnapshot): ContentHeadersSnapshotExternal {
        // Convert internal StandardForm objects to external WML strings
        const externalAssets = snapshot.assets.map(asset => ({
            assetId: asset.assetId,
            zone: asset.zone,
            wml: schemaToWML([asset.standardForm.schema])
        }))
        
        return {
            type: 'Snapshot',
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
                type: 'Snapshot',
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
        case 'Snapshot':
            return Boolean(
                event.assets &&
                Array.isArray(event.assets)
            )
        case 'Headers Updated':
            return Boolean(
                typeof event.assetId === 'string' &&
                typeof event.zone === 'string' &&
                typeof event.wml === 'string'
            )
        case 'Zone Updated':
            return Boolean(
                typeof event.assetId === 'string' &&
                typeof event.fromZone === 'string' &&
                typeof event.toZone === 'string'
            )
        default:
            return false
    }
}

// Note: Utility functions like extractComponentMetadata, createContentHeadersAsset, 
// and createContentHeadersUpdate are business logic that belong in the data source 
// implementation, not in the serializer. They should be imported directly from 
// the data source where they are used.
