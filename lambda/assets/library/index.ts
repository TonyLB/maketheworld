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
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { ZoneUpdatedEventUpdate, AssetCachedEventUpdate, AssetRemovedEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import {
    LibraryIncomingEvent,
    isLibrarySubscribedEnvelope,
    isZoneUpdatedLibraryEvent,
    isAssetCachedLibraryEvent,
    isAssetRemovedLibraryEvent,
} from './subscribedEvents'

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

const processZoneUpdated = async (
    event: Extract<LibraryIncomingEvent, { header: { type: 'Zone Updated' } }>,
    streamEvent: (params: { update: AssetAdded | AssetRemoved; streamKey: string; header: { type: string } }) => Promise<void>
): Promise<void> => {
    const content = await event.getContent()
    const { fromZone, toZone } = content
    const assetId = event.header.streamKey as AssetUUID
    if (toZone === 'Library' && fromZone !== 'Library') {
        await streamEvent({ update: { type: 'Asset Added', assetId }, streamKey: 'global', header: { type: 'Asset Added' } })
    } else if (fromZone === 'Library' && toZone !== 'Library') {
        await streamEvent({ update: { type: 'Asset Removed', assetId }, streamKey: 'global', header: { type: 'Asset Removed' } })
    }
}

const processAssetCached = async (
    event: Extract<LibraryIncomingEvent, { header: { type: 'Asset Cached' } }>,
    streamEvent: (params: { update: AssetAdded | AssetRemoved; streamKey: string; header: { type: string } }) => Promise<void>
): Promise<void> => {
    const content = await event.getContent()
    const { zone } = content
    const assetId = event.header.streamKey as AssetUUID
    if (zone === 'Library') {
        await streamEvent({ update: { type: 'Asset Added', assetId }, streamKey: 'global', header: { type: 'Asset Added' } })
    }
}

const processAssetRemoved = async (
    event: Extract<LibraryIncomingEvent, { header: { type: 'Asset Removed' } }>,
    streamEvent: (params: { update: AssetAdded | AssetRemoved; streamKey: string; header: { type: string } }) => Promise<void>
): Promise<void> => {
    const assetId = event.header.streamKey as AssetUUID
    await streamEvent({ update: { type: 'Asset Removed', assetId }, streamKey: 'global', header: { type: 'Asset Removed' } })
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
            assetIds
        }
    } catch (error) {
        console.error('Error generating library snapshot:', error)
        return {
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
    ZoneUpdatedEventUpdate | AssetCachedEventUpdate | AssetRemovedEventUpdate,
    LibraryExternal,
    LibrarySnapshotExternal
>({
    dataSourceKey: 'mtw.assets.library',
    replayable: true, // Support client subscriptions with historical data
    eventSerializer: new LibraryEventSerializer(),
    snapshotContentGenerator: generateLibrarySnapshot,
    subscribedEventTypeGuard: isLibrarySubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        const typedEvents = events as LibraryIncomingEvent[]
        await Promise.all(typedEvents.map(async (event) => {
            const assetId = event.header.streamKey as AssetUUID
            try {
                if (isZoneUpdatedLibraryEvent(event)) {
                    await processZoneUpdated(event, streamEvent)
                } else if (isAssetCachedLibraryEvent(event)) {
                    await processAssetCached(event, streamEvent)
                } else if (isAssetRemovedLibraryEvent(event)) {
                    await processAssetRemoved(event, streamEvent)
                }
            } catch (error) {
                console.error(`Error processing library event for asset ${assetId}:`, error)
                messageBus.publish({
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

