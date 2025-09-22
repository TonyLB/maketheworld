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
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRemove } from '@tonylb/mtw-wml/ts/standardize/components/edits'

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
        // Process mtw.assets events and generate content header updates
        // Group events by asset to enable aggregation
        
        console.log(`Processing ${events.length} events in contentHeaders data source`)
        
        // Group events by asset ID
        const eventsByAsset = new Map<AssetUUID, SubscribedAssetsEvent[]>()
        
        for (const event of events) {
            if (event.event.update.type === 'Component Updated') {
                const componentUpdate = event.event.update as ComponentUpdatedEvent
                const { assetId } = componentUpdate
                
                if (!assetId) {
                    console.warn('Component Updated event missing assetId, skipping')
                    continue
                }
                
                if (!eventsByAsset.has(assetId as AssetUUID)) {
                    eventsByAsset.set(assetId as AssetUUID, [])
                }
                eventsByAsset.get(assetId as AssetUUID)!.push(event)
            } else if (event.event.update.type === 'Component Removed') {
                const componentRemoval = event.event.update as ComponentRemovedEvent
                const { assetId } = componentRemoval
                
                if (!assetId) {
                    console.warn('Component Removed event missing assetId, skipping')
                    continue
                }
                
                if (!eventsByAsset.has(assetId as AssetUUID)) {
                    eventsByAsset.set(assetId as AssetUUID, [])
                }
                eventsByAsset.get(assetId as AssetUUID)!.push(event)
            } else {
                // Defensive programming: handle unexpected event types
                console.warn(`Unhandled event type in content headers data source: ${(event.event.update as any).type}`)
            }
        }
        
        // Process each asset's events as a batch
        await Promise.all(Array.from(eventsByAsset.entries()).map(async ([assetId, assetEvents]) => {
            try {
                console.log(`Processing ${assetEvents.length} events for asset ${assetId}`)
                
                // Get the asset's zone information
                const zone = await getAssetZone(assetId)
                if (!zone) {
                    console.warn(`Could not determine zone for asset ${assetId}, skipping content header update`)
                    return
                }
                
                // Create aggregated content header update for this asset
                const contentHeadersUpdate = createAggregatedContentHeadersUpdate(assetId, zone, assetEvents)
                if (contentHeadersUpdate) {
                    console.log(`Generated aggregated content header update for asset ${assetId} in zone ${zone}`)
                    await streamEvent({
                        update: contentHeadersUpdate,
                        streamKey: 'global',
                        detailType: 'Headers Updated'
                    })
                } else {
                    console.log(`No content header update generated for asset ${assetId} (no suitable components for headers)`)
                }
            } catch (error) {
                console.error(`Error processing events for asset ${assetId}:`, error)
                messageBus.send({
                    type: 'Error',
                    body: { 
                        error: `Failed to process events for asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                        statusCode: 500
                    }
                })
            }
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
    try {
        const [assetMeta] = await internalCache.AssetMetaData.get([assetId])
        return assetMeta?.zone || null
    } catch (error) {
        console.error(`Error getting zone for asset ${assetId}:`, error)
        return null
    }
}

/**
 * Create a content headers update from a component
 */
function createContentHeadersUpdate(
    assetId: AssetUUID, 
    zone: 'Canon' | 'Library' | 'Personal', 
    component: any
): ContentHeadersUpdate | null {
    try {
        // Extract header information from the component
        const headerComponent = extractHeader(component)
        if (!headerComponent) {
            // Component doesn't have a shortName or is not suitable for headers
            return null
        }

        // Create a minimal StandardForm with just the header component
        const standardForm = new StandardForm([
            { tag: 'Asset', key: assetId.split('#')[1], universalKey: assetId },
            headerComponent.toJSON()
        ])

        return {
            type: 'Headers Updated',
            assetId,
            zone,
            standardForm
        }
    } catch (error) {
        console.error(`Error creating content headers update for asset ${assetId}:`, error)
        return null
    }
}

/**
 * Create a StandardForm representing a component removal
 */
function createRemovalStandardForm(componentId: string): StandardForm {
    try {
        // Create a minimal StandardForm for component removal
        // For now, we'll create a simple asset structure
        // The actual removal logic will be handled by the snapshot generation
        const assetKey = componentId.split('#')[1] || 'unknown'
        return new StandardForm([
            { tag: 'Asset', key: assetKey, universalKey: `ASSET#${assetKey}` }
        ])
    } catch (error) {
        console.error(`Error creating removal StandardForm for component ${componentId}:`, error)
        // Return a minimal StandardForm on error
        return new StandardForm([
            { tag: 'Asset', key: 'unknown', universalKey: 'ASSET#unknown' }
        ])
    }
}

/**
 * Create an aggregated content header update from multiple events for the same asset
 */
function createAggregatedContentHeadersUpdate(
    assetId: AssetUUID,
    zone: 'Canon' | 'Library' | 'Personal',
    events: SubscribedAssetsEvent[]
): ContentHeadersUpdate | null {
    try {
        const assetKey = assetId.split('#')[1]
        const headerComponents: any[] = []
        
        // Process all events for this asset
        for (const event of events) {
            if (event.event.update.type === 'Component Updated') {
                const componentUpdate = event.event.update as ComponentUpdatedEvent
                const { component } = componentUpdate
                
                if (!component) {
                    console.warn(`Component Updated event for asset ${assetId} missing component data, skipping`)
                    continue
                }
                
                // Extract header information from the component
                const headerComponent = extractHeader(component)
                if (headerComponent) {
                    headerComponents.push(headerComponent)
                }
            } else if (event.event.update.type === 'Component Removed') {
                const componentRemoval = event.event.update as ComponentRemovedEvent
                const { componentId } = componentRemoval
                
                if (!componentId) {
                    console.warn(`Component Removed event for asset ${assetId} missing componentId, skipping`)
                    continue
                }
                
                // For component removal, we'll create a minimal representation
                // The actual removal logic will be handled by the snapshot generation
                console.log(`Component ${componentId} removed from asset ${assetId}`)
            }
        }
        
        // If no header components were found, return null
        if (headerComponents.length === 0) {
            return null
        }
        
        // Create a StandardForm with all the header components
        const standardForm = new StandardForm([
            { tag: 'Asset', key: assetKey, universalKey: assetId },
            ...headerComponents
        ])
        
        return {
            type: 'Headers Updated',
            assetId,
            zone,
            standardForm
        }
    } catch (error) {
        console.error(`Error creating aggregated content headers update for asset ${assetId}:`, error)
        return null
    }
}

