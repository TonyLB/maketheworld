// Library Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Library data source.
// The Library data source provides a simple list of asset IDs in the Library zone.

import { DataSourceEventSerializer, ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

// Import and re-export the base classes
import { 
    LibraryEventUpdate, 
    LibrarySnapshot, 
    AssetAdded,
    AssetRemoved,
    isLibrarySnapshot,
    isAssetAdded,
    isAssetRemoved,
    isLibraryUpdate,
    LibraryAggregator
} from './baseClasses'

export { 
    LibraryAggregator
}

export type { 
    LibraryEventUpdate, 
    LibrarySnapshot, 
    AssetAdded,
    AssetRemoved
}

export { 
    isLibrarySnapshot,
    isAssetAdded,
    isAssetRemoved,
    isLibraryUpdate
}

// External event format (EventBridge/Storage)
// For the Library data source, external format is identical to internal format
// No complex serialization needed - just asset UUID arrays
export type LibrarySnapshotExternal = {
    assetIds: AssetUUID[]
}

export type AssetAddedExternal = {
    assetId: AssetUUID
}

export type AssetRemovedExternal = {
    assetId: AssetUUID
}

export type LibraryExternal = LibrarySnapshotExternal | AssetAddedExternal | AssetRemovedExternal

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
type LibrarySerializeParams = ResolvedStreamingEnvelope<LibraryEventUpdate, StreamingEventHeader>
type LibraryDeserializeParams = ResolvedStreamingEnvelope<LibraryExternal, StreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isAssetAddedLibrarySerializeParams = (p: LibrarySerializeParams): p is LibrarySerializeParams & { header: StreamingEventHeader & { type: 'Asset Added' }; content: AssetAdded } =>
    p.header.type === 'Asset Added'
const isAssetRemovedLibrarySerializeParams = (p: LibrarySerializeParams): p is LibrarySerializeParams & { header: StreamingEventHeader & { type: 'Asset Removed' }; content: AssetRemoved } =>
    p.header.type === 'Asset Removed'

// Envelope type guards for deserialize (header.type narrows content)
const isAssetAddedLibraryEnvelope = (
    params: LibraryDeserializeParams
): params is LibraryDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Added' }; content: AssetAddedExternal } =>
    params.header.type === 'Asset Added'

const isAssetRemovedLibraryEnvelope = (
    params: LibraryDeserializeParams
): params is LibraryDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Removed' }; content: AssetRemovedExternal } =>
    params.header.type === 'Asset Removed'

/**
 * Event serializer for the mtw.assets.library data source.
 * 
 * This serializer is a simple pass-through since internal and external formats
 * are identical. It primarily validates the structure and types of events.
 * Routing uses header.type only (envelope type guards); content.type is not read.
 */
export class LibraryEventSerializer implements DataSourceEventSerializer<
    LibraryEventUpdate, 
    LibraryExternal, 
    LibrarySnapshot, 
    LibrarySnapshotExternal
> {
    serialize(params: LibrarySerializeParams): LibraryExternal {
        if (params.header?.type === 'Snapshot') {
            const snapshot = params.content as LibrarySnapshot
            return { assetIds: [...snapshot.assetIds] }
        }
        if (isAssetAddedLibrarySerializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId
            }
        }
        if (isAssetRemovedLibrarySerializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId
            }
        }
        throw new Error(`Unknown streaming event type in LibraryEventUpdate: ${params.header.type}`)
    }
    
    async deserialize(params: LibraryDeserializeParams): Promise<LibraryEventUpdate | null> {
        if (params.header?.type === 'Snapshot') {
            const content = params.content as LibrarySnapshotExternal
            try {
                if (!Array.isArray(content.assetIds)) {
                    console.error('Invalid Library snapshot: assetIds must be an array')
                    return null
                }
                if (!content.assetIds.every(id => typeof id === 'string')) {
                    console.error('Invalid Library snapshot: all assetIds must be strings')
                    return null
                }
                return { assetIds: [...content.assetIds] }
            } catch (error) {
                console.error('Failed to deserialize Library snapshot:', error)
                return null
            }
        }
        if (isAssetAddedLibraryEnvelope(params)) {
            if (typeof params.content.assetId !== 'string') {
                console.error('Invalid Asset Added event: assetId must be a string')
                return null
            }
            return {
                assetId: params.content.assetId
            }
        }
        if (isAssetRemovedLibraryEnvelope(params)) {
            if (typeof params.content.assetId !== 'string') {
                console.error('Invalid Asset Removed event: assetId must be a string')
                return null
            }
            return {
                assetId: params.content.assetId
            }
        }
        console.error(`Unknown external streaming event type: ${params.header.type}`)
        return null
    }
}

// Type guard for external Library events (shape-based; type optional)
export const isLibraryExternal = (event: any): event is LibraryExternal => {
    if (!event || typeof event !== 'object') {
        return false
    }
    // Snapshot: assetIds array
    if (event.assetIds && Array.isArray(event.assetIds) && event.assetIds.every((id: any) => typeof id === 'string')) {
        return true
    }
    // Asset Added / Asset Removed: assetId string (indistinguishable by shape; both accepted)
    if (typeof event.assetId === 'string') {
        return true
    }
    return false
}

