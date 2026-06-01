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
    assets: Array<{
        assetId: AssetUUID
        zone: Zone
        wml: string // Serialized to WML for external consumption
    }>
}

export type ContentHeadersUpdateExternal = {
    assetId: AssetUUID
    zone: Zone
    wml: string // Serialized to WML for external consumption
}

export type ZoneUpdatedEventExternal = {
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
const isZoneUpdatedContentHeadersSerializeParams = (p: ContentHeadersSerializeParams): p is ContentHeadersSerializeParams & { header: StreamingEventHeader & { type: 'Zone Updated' }; content: ZoneUpdatedEvent } =>
    p.header.type === 'Zone Updated'
const isHeadersUpdatedContentHeadersDeserializeParams = (p: ContentHeadersDeserializeParams): p is ContentHeadersDeserializeParams & { header: StreamingEventHeader & { type: 'Headers Updated' }; content: ContentHeadersUpdateExternal } =>
    p.header.type === 'Headers Updated'
const isZoneUpdatedContentHeadersDeserializeParams = (p: ContentHeadersDeserializeParams): p is ContentHeadersDeserializeParams & { header: StreamingEventHeader & { type: 'Zone Updated' }; content: ZoneUpdatedEventExternal } =>
    p.header.type === 'Zone Updated'

/**
 * Event serializer for the mtw.assets.contentHeaders data source.
 * 
 * This serializer implements the serialization boundary between internal StandardForm objects
 * and external WML strings. Internal processing works with StandardForm objects for manipulation,
 * while external transmission uses WML strings for cross-service communication.
 */
export class ContentHeadersEventSerializer implements DataSourceEventSerializer<ContentHeadersEventUpdate, ContentHeadersExternal, ContentHeadersSnapshot, ContentHeadersSnapshotExternal> {
    serialize(params: ContentHeadersSerializeParams): ContentHeadersExternal {
        if (params.header?.type === 'Snapshot') {
            const snapshot = params.content as ContentHeadersSnapshot
            const externalAssets = snapshot.assets.map(asset => ({
                assetId: asset.assetId,
                zone: asset.zone,
                wml: schemaToWML([asset.standardForm.schema])
            }))
            return { assets: externalAssets }
        }
        if (isHeadersUpdatedContentHeadersSerializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId,
                zone: content.zone,
                wml: schemaToWML([content.standardForm.schema])
            }
        }
        if (isZoneUpdatedContentHeadersSerializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId,
                fromZone: content.fromZone,
                toZone: content.toZone
            }
        }
        throw new Error(`Unknown streaming event type in ContentHeadersEventUpdate: ${params.header.type}`)
    }

    async deserialize(params: ContentHeadersDeserializeParams): Promise<ContentHeadersEventUpdate | null> {
        if (params.header?.type === 'Snapshot') {
            const externalSnapshot = params.content as ContentHeadersSnapshotExternal
            try {
                const internalAssets = externalSnapshot.assets.map(asset => ({
                    assetId: asset.assetId,
                    zone: asset.zone,
                    standardForm: new StandardForm(asset.wml)
                }))
                return { assets: internalAssets }
            } catch (error) {
                console.error('Failed to deserialize ContentHeaders snapshot:', error)
                return null
            }
        }
        if (isHeadersUpdatedContentHeadersDeserializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId,
                zone: content.zone,
                standardForm: new StandardForm(content.wml)
            }
        }
        if (isZoneUpdatedContentHeadersDeserializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId,
                fromZone: content.fromZone,
                toZone: content.toZone
            }
        }
        throw new Error(`Unknown external streaming event type: ${params.header.type}`)
    }
}

// Type guard for external ContentHeaders events (shape-based; type optional)
export const isContentHeadersExternal = (event: any): event is ContentHeadersExternal => {
    if (!event || typeof event !== 'object') {
        return false
    }
    // Snapshot: assets array
    if (event.assets && Array.isArray(event.assets)) {
        return true
    }
    // Headers Updated: assetId, zone, wml
    if (typeof event.assetId === 'string' && typeof event.zone === 'string' && typeof event.wml === 'string') {
        return true
    }
    // Zone Updated: assetId, fromZone, toZone
    if (typeof event.assetId === 'string' && typeof event.fromZone === 'string' && typeof event.toZone === 'string') {
        return true
    }
    return false
}

// Note: Utility functions like extractComponentMetadata, createContentHeadersAsset, 
// and createContentHeadersUpdate are business logic that belong in the data source 
// implementation, not in the serializer. They should be imported directly from 
// the data source where they are used.
