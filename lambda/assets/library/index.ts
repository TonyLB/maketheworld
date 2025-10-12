import { AssetsDataSource } from '../dataSource/abstract'
import messageBus from '../messageBus'
import { 
    LibrarySnapshot, 
    AssetAdded,
    AssetRemoved,
    LibraryEventSerializer,
    LibraryExternal,
    LibrarySnapshotExternal
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetLevelEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

//
// Replayable DataSource singleton for mtw.assets.library
// 
// This DataSource provides a simple list of asset IDs in the Library zone.
// The Library UI uses this to know which assets are available, then fetches
// detailed metadata separately via other data sources (e.g., mtw.assets.contentHeaders).
// 
// Key responsibilities:
// - Subscribe to mtw.assets events (Zone Updated, Asset Cached, Asset Removed)
// - Generate library snapshots containing Library zone asset IDs only
// - Stream asset added/removed events when assets enter/leave Library zone
// - Filter out non-Library zone changes
// - Maintain simple list of AssetUUIDs without metadata
//

// Type for subscribed events from mtw.assets (asset-level events only)
export type SubscribedAssetsEvent = {
    dataSourceKey: 'mtw.assets';
    streamKey: string; // AssetId
    event: AssetLevelEventUpdate;
    timestamp: number;
}

// Type guard for subscribed assets events we care about
const isSubscribedAssetsEvent = (event: StreamingEventPayload): event is SubscribedAssetsEvent => {
    return Boolean(
        event.dataSourceKey === 'mtw.assets' && 
        event.event && 
        typeof event.event === 'object' &&
        event.event !== null &&
        'type' in event.event &&
        // We only care about asset-level events that affect zone status
        ['Zone Updated', 'Asset Cached', 'Asset Removed'].includes(event.event.type)
    )
}

/**
 * Generate a snapshot of all asset IDs in the Library zone
 */
const generateLibrarySnapshot = async (): Promise<LibrarySnapshot> => {
    try {
        // Query all assets in Library zone
        const Items = await assetDB.query({
            IndexName: 'ZoneIndex',
            Key: {
                zone: 'Library'
            },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'Meta::Asset'
            },
            ProjectionFields: ['AssetId']
        })
        
        // Extract just the asset IDs
        const assetIds: AssetUUID[] = Items.map(({ AssetId }) => AssetId as AssetUUID)
        
        return {
            type: 'Snapshot',
            assetIds
        }
    } catch (error) {
        console.error('Error generating library snapshot:', error)
        // Return empty snapshot on error
        return {
            type: 'Snapshot',
            assetIds: []
        }
    }
}

/**
 * Library DataSource instance
 * 
 * Subscribes to 'global' stream for all Library zone changes
 */
export const libraryDataSource = new AssetsDataSource<
    LibrarySnapshot, 
    AssetAdded | AssetRemoved, 
    SubscribedAssetsEvent,
    LibraryExternal,
    LibrarySnapshotExternal
>({
    dataSourceKey: 'mtw.assets.library',
    replayable: true, // Support client subscriptions with historical data
    eventSerializer: new LibraryEventSerializer(),
    snapshotContentGenerator: generateLibrarySnapshot,
    subscribedEventTypeGuard: isSubscribedAssetsEvent,
    receiveEvents: async ({ events, streamEvent }) => {
        // Process mtw.assets events and generate library updates
        // We only care about events that affect the Library zone
        
        await Promise.all(events.map(async (event) => {
            const assetId = event.streamKey as AssetUUID
            
            try {
                if (event.event.type === 'Zone Updated') {
                    const { fromZone, toZone } = event.event
                    
                    // Asset entering Library zone
                    if (toZone === 'Library' && fromZone !== 'Library') {
                        await streamEvent({
                            update: {
                                type: 'Asset Added',
                                assetId
                            },
                            streamKey: 'global'
                        })
                    }
                    // Asset leaving Library zone
                    else if (fromZone === 'Library' && toZone !== 'Library') {
                        await streamEvent({
                            update: {
                                type: 'Asset Removed',
                                assetId
                            },
                            streamKey: 'global'
                        })
                    }
                    // Ignore zone changes that don't involve Library
                }
                else if (event.event.type === 'Asset Cached') {
                    const { zone } = event.event
                    
                    // Asset cached in Library zone (new asset or recache)
                    if (zone === 'Library') {
                        await streamEvent({
                            update: {
                                type: 'Asset Added',
                                assetId
                            },
                            streamKey: 'global'
                        })
                    }
                }
                else if (event.event.type === 'Asset Removed') {
                    // Asset removed - we don't know its zone, but remove from library just in case
                    // The aggregator will handle idempotent removal (no-op if not present)
                    await streamEvent({
                        update: {
                            type: 'Asset Removed',
                            assetId
                        },
                        streamKey: 'global'
                    })
                }
            } catch (error) {
                console.error(`Error processing library event for asset ${assetId}:`, error)
                messageBus.send({
                    type: 'Error',
                    body: {
                        error: `Failed to process library event for asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                        statusCode: 500
                    }
                })
            }
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
libraryDataSource.subscribe()

export default libraryDataSource

