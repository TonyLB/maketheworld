// Library Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Library data source.
// The Library data source provides a simple list of asset IDs in the Library zone.

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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
    type: 'Snapshot'
    assetIds: AssetUUID[]
}

export type AssetAddedExternal = {
    type: 'Asset Added'
    assetId: AssetUUID
}

export type AssetRemovedExternal = {
    type: 'Asset Removed'
    assetId: AssetUUID
}

export type LibraryExternal = LibrarySnapshotExternal | AssetAddedExternal | AssetRemovedExternal

/**
 * Event serializer for the mtw.assets.library data source.
 * 
 * This serializer is a simple pass-through since internal and external formats
 * are identical. It primarily validates the structure and types of events.
 */
export class LibraryEventSerializer implements DataSourceEventSerializer<
    LibraryEventUpdate, 
    LibraryExternal, 
    LibrarySnapshot, 
    LibrarySnapshotExternal
> {
    serialize(params: {
        dataSourceKey: string;
        streamKey: string;
        update: LibraryEventUpdate;
        header: StreamingEventHeader;
    }): LibraryExternal {
        const { update } = params
        
        if (isAssetAdded(update)) {
            // Pass through - internal and external formats are identical
            return {
                type: 'Asset Added',
                assetId: update.assetId
            }
        } else if (isAssetRemoved(update)) {
            // Pass through - internal and external formats are identical
            return {
                type: 'Asset Removed',
                assetId: update.assetId
            }
        } else {
            throw new Error(`Unknown streaming event type in LibraryEventUpdate: ${JSON.stringify(update)}`)
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        streamKey: string
        externalUpdate: LibraryExternal 
        header: StreamingEventHeader
    }): LibraryEventUpdate | null {
        const { externalUpdate, header } = params
        const eventType = header.type
        
        // Validate and pass through
        if (eventType === 'Asset Added') {
            if (typeof externalUpdate.assetId !== 'string') {
                console.error('Invalid Asset Added event: assetId must be a string')
                return null
            }
            return {
                type: 'Asset Added',
                assetId: externalUpdate.assetId
            }
        } else if (eventType === 'Asset Removed') {
            if (typeof externalUpdate.assetId !== 'string') {
                console.error('Invalid Asset Removed event: assetId must be a string')
                return null
            }
            return {
                type: 'Asset Removed',
                assetId: externalUpdate.assetId
            }
        } else {
            console.error(`Unknown external streaming event type: ${(externalUpdate as any).type}`)
            return null
        }
    }
    
    serializeSnapshot(snapshot: LibrarySnapshot): LibrarySnapshotExternal {
        // Pass through - internal and external formats are identical
        return {
            type: 'Snapshot',
            assetIds: [...snapshot.assetIds]
        }
    }
    
    deserializeSnapshot(externalSnapshot: LibrarySnapshotExternal): LibrarySnapshot | null {
        try {
            // Validate structure
            if (!Array.isArray(externalSnapshot.assetIds)) {
                console.error('Invalid Library snapshot: assetIds must be an array')
                return null
            }
            
            // Validate all items are strings
            if (!externalSnapshot.assetIds.every(id => typeof id === 'string')) {
                console.error('Invalid Library snapshot: all assetIds must be strings')
                return null
            }
            
            // Pass through
            return {
                type: 'Snapshot',
                assetIds: [...externalSnapshot.assetIds]
            }
        } catch (error) {
            console.error('Failed to deserialize Library snapshot:', error)
            return null
        }
    }
}

// Type guard for external Library events
export const isLibraryExternal = (event: any): event is LibraryExternal => {
    if (!event || typeof event !== 'object' || !('type' in event)) {
        return false
    }
    
    switch((event as any).type) {
        case 'Snapshot':
            return Boolean(
                event.assetIds &&
                Array.isArray(event.assetIds) &&
                event.assetIds.every((id: any) => typeof id === 'string')
            )
        case 'Asset Added':
        case 'Asset Removed':
            return Boolean(
                typeof event.assetId === 'string'
            )
        default:
            return false
    }
}

