import { AssetsDataSource } from '../dataSource/abstract'
import messageBus from '../messageBus'
import { 
    ContentHeadersSnapshot, 
    ContentHeadersUpdate
} from './baseClasses'
import { ContentHeadersEventSerializer } from './serializers'
import { ComponentEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent } from '../dataSource/serializers'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { extractHeader } from './extractHeader'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'

//
// Replayable DataSource singleton for mtw.assets.contentHeaders
// 
// This DataSource provides filtered asset and component metadata for the content authoring UI,
// enabling content discovery and import workflows during the Bootstrapping phase.
// 
// Key responsibilities:
// - Subscribe to mtw.assets events (Component Updated, Component Removed)
// - Generate content headers snapshots for new subscribers
// - Stream content header updates for real-time UI synchronization
// - Maintain zone-based organization (Canon, Library, Personal)
// - Provide WML-serialized component metadata for Import Navigator consumption
//
// Type for subscribed events from mtw.assets
export type SubscribedAssetsEvent = {
    dataSourceKey: 'mtw.assets'
    event: {
        streamKey: string
        update: ComponentEventUpdate
    }
    timestamp: number
}

// Type guard for subscribed events
const isSubscribedAssetsEvent = (event: StreamingEventPayload): event is SubscribedAssetsEvent => {
    return Boolean(
        event.dataSourceKey === 'mtw.assets' && 
        event.event && 
        typeof event.event === 'object' &&
        event.event !== null &&
        event.event.update &&
        typeof event.event.update === 'object' &&
        event.event.update.type &&
        ['Component Updated', 'Component Removed'].includes(event.event.update.type)
    )
}

const generateContentHeadersSnapshot = async (): Promise<ContentHeadersSnapshot> => {
    try {
        // Query all assets from the DynamoDB table using DataCategoryIndex
        const Items = await assetDB.query({
            IndexName: 'DataCategoryIndex',
            Key: {
                DataCategory: 'Meta::Asset'
            },
            ProjectionFields: ['AssetId', 'zone']
        })
        
        // Process all assets in parallel to extract content headers
        const contentHeadersAssets = await Promise.all(
            Items.map(async (item) => {
                const assetId = item.AssetId as AssetUUID
                const zone = item.zone as 'Canon' | 'Library' | 'Personal'
                
                // Load the asset's StandardForm using the internal cache
                const [assetCache] = await internalCache.AssetData.get([assetId])
                if (!assetCache?.standardForm) {
                    return undefined
                }
                
                // Transform the asset's StandardForm to contain only header information for all components
                const headersAsset = assetCache.standardForm._clone()
                headersAsset._components = headersAsset._components
                    .map(component => extractHeader(component))
                    .filter(excludeUndefined)
                
                if (headersAsset._components.length > 0) {
                    return {
                        assetId,
                        zone,
                        standardForm: headersAsset
                    }
                }
                return undefined
            })
        ).then(results => results.filter(excludeUndefined))
        
        return {
            type: 'Snapshot Generated',
            assets: contentHeadersAssets
        }
    } catch (error) {
        console.error('Error generating content headers snapshot:', error)
        // Return empty snapshot on error
        return {
            type: 'Snapshot Generated',
            assets: []
        }
    }
}

export const contentHeadersDataSource = new AssetsDataSource<ContentHeadersSnapshot, ContentHeadersUpdate, SubscribedAssetsEvent>({
    dataSourceKey: 'mtw.assets.contentHeaders',
    replayable: true, // Support client subscriptions with historical data
    eventSerializer: new ContentHeadersEventSerializer(),
    snapshotContentGenerator: generateContentHeadersSnapshot,
    subscribedEventTypeGuard: isSubscribedAssetsEvent,
    receiveEvents: async ({ events, streamEvent }) => {
        // Process mtw.assets events in parallel and generate content header updates
        // Each event is processed independently for now (aggregation will come later)
        
        await Promise.all(events.map(async (event) => {
            // Process mtw.assets events and generate content header updates
            // The event parameter is now properly typed as SubscribedAssetsEvent
            
            if (event.event.update.type === 'Component Updated') {
                const componentUpdate = event.event.update as ComponentUpdatedEvent
                const { assetId, component } = componentUpdate
                if (assetId && component) {
                    try {
                        // Get the asset's zone information
                        const zone = await getAssetZone(assetId as AssetUUID)
                        if (!zone) {
                            console.warn(`Could not determine zone for asset ${assetId}, skipping content header update`)
                            return
                        }
                        
                        // Create content header update from component
                        const contentHeadersUpdate = createContentHeadersUpdate(assetId as AssetUUID, zone, component)
                        if (contentHeadersUpdate) {
                            await streamEvent({
                                update: contentHeadersUpdate,
                                streamKey: 'global',
                                detailType: 'Headers Updated'
                            })
                        }
                    } catch (error) {
                        console.error(`Error processing Component Updated event for asset ${assetId}:`, error)
                        messageBus.send({
                            type: 'Error',
                            body: { 
                                error: `Failed to process component update for asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                                statusCode: 500
                            }
                        })
                    }
                    return
                }
            }
            
            if (event.event.update.type === 'Component Removed') {
                const componentRemoval = event.event.update as ComponentRemovedEvent
                const { assetId, componentId } = componentRemoval
                if (assetId && componentId) {
                    try {
                        // Get the asset's zone information
                        const zone = await getAssetZone(assetId as AssetUUID)
                        if (!zone) {
                            console.warn(`Could not determine zone for asset ${assetId}, skipping content header update`)
                            return
                        }
                        
                        // For component removal, we need to create a minimal StandardForm with just the component being removed
                        // This will be handled by the snapshot generation logic when it processes the current asset state
                        const contentHeadersUpdate: ContentHeadersUpdate = {
                            type: 'Headers Updated',
                            assetId: assetId as AssetUUID,
                            zone,
                            standardForm: createRemovalStandardForm(componentId)
                        }
                        
                        await streamEvent({
                            update: contentHeadersUpdate,
                            streamKey: 'global',
                            detailType: 'Headers Updated'
                        })
                    } catch (error) {
                        console.error(`Error processing Component Removed event for asset ${assetId}:`, error)
                        messageBus.send({
                            type: 'Error',
                            body: { 
                                error: `Failed to process component removal for asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                                statusCode: 500
                            }
                        })
                    }
                    return
                }
            }
            
            console.warn(`Unhandled event type in content headers data source: ${event.event.update.type}`)
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
contentHeadersDataSource.subscribe()

export default contentHeadersDataSource
// Helper functions (these will be implemented in separate files)

/**
 * Get the zone for a given asset ID
 */
async function getAssetZone(assetId: AssetUUID): Promise<'Canon' | 'Library' | 'Personal' | null> {
    // TODO: Implement zone lookup logic
    // This should query the asset metadata to determine the current zone
    throw new Error('getAssetZone not yet implemented')
}

/**
 * Create a content headers update from a component
 */
function createContentHeadersUpdate(
    assetId: AssetUUID, 
    zone: 'Canon' | 'Library' | 'Personal', 
    component: any
): ContentHeadersUpdate | null {
    // TODO: Implement content headers update creation
    // This should use the extractHeader utility to create a minimal StandardForm
    throw new Error('createContentHeadersUpdate not yet implemented')
}

/**
 * Create a StandardForm representing a component removal
 */
function createRemovalStandardForm(componentId: string): any {
    // TODO: Implement removal StandardForm creation
    // This should create a StandardForm with a Remove wrapper around the component
    throw new Error('createRemovalStandardForm not yet implemented')
}

