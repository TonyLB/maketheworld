import { AssetsDataSource } from '../dataSource/abstract'
import messageBus from '../messageBus'
import { 
    ContentHeadersSnapshot, 
    ContentHeadersUpdate,
    ZoneUpdatedEvent
} from './baseClasses'
import { 
    ContentHeadersEventSerializer,
    ContentHeadersExternal,
    ContentHeadersSnapshotExternal
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'
import { ComponentEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent, AssetUpdatedEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { WMLZoneEvent, isWMLZoneEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { Zone } from '@tonylb/mtw-asset-workspace'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

//
// Replayable DataSource singleton for mtw.assets.contentHeaders
// 
// This DataSource provides filtered asset and component metadata for the content authoring UI,
// enabling content discovery and import workflows during the Bootstrapping phase.
// 
// Key responsibilities:
// - Subscribe to mtw.assets events (Component Updated)
// - Generate content headers snapshots for new subscribers
// - Stream content header updates for real-time UI synchronization
// - Maintain zone-based organization (Canon, Library, Personal)
// - Provide WML-serialized component metadata for Import Navigator consumption
//
// Type for subscribed events from mtw.assets
export type SubscribedAssetsEvent = {
    dataSourceKey: 'mtw.assets';
    streamKey: string;
    detailEnvelope: ComponentEventUpdate | AssetUpdatedEventUpdate;
    timestamp: number;
}

// Type guard for subscribed assets events
const isSubscribedAssetsEvent = (event: StreamingEventPayload): event is SubscribedAssetsEvent => {
    return Boolean(
        event.dataSourceKey === 'mtw.assets' && 
        event.detailEnvelope && 
        typeof event.detailEnvelope === 'object' &&
        event.detailEnvelope !== null &&
        'type' in event.detailEnvelope &&
        (event.detailEnvelope as any).type &&
        (((event.detailEnvelope as any).type === 'Component Updated') || ((event.detailEnvelope as any).type === 'Component Removed') || ((event.detailEnvelope as any).type === 'Asset Updated'))
    )
}

// Type for subscribed WML events
export type SubscribedWMLEvent = {
    dataSourceKey: 'mtw.wml';
    streamKey: string;
    detailEnvelope: WMLZoneEvent;
    timestamp: number;
}

// Union type for all subscribed events
export type SubscribedEvent = SubscribedAssetsEvent | SubscribedWMLEvent

// Type guard for subscribed WML events
const isSubscribedWMLEvent = (event: StreamingEventPayload): event is SubscribedWMLEvent => {
    return Boolean(
        event.dataSourceKey === 'mtw.wml' && 
        event.detailEnvelope && 
        typeof event.detailEnvelope === 'object' &&
        event.detailEnvelope !== null &&
        isWMLZoneEvent(event.detailEnvelope as any)
    )
}

// Type guard for subscribed events (from assets and mtw.wml Zone Changed)
const isSubscribedEvent = (event: StreamingEventPayload): event is SubscribedEvent => {
    return isSubscribedAssetsEvent(event) || isSubscribedWMLEvent(event)
}

//
// Helper to project a full component down to its "header" representation:
// tag, keys, and shortName (if present), with all other payload stripped.
//
function extractHeaderComponent(component: any) {
    if (!component) {
        return undefined
    }

    const minimalJson = {
        tag: component.tag as any,
        key: component.key,
        universalKey: component.universalKey,
        shortName: hasShortName(component) ? component.shortName?.toJSON() : undefined
    } as any

    return standardComponentFactory(minimalJson) ?? undefined
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

                // Start from a clone so we preserve asset-level metadata (e.g., ShortName)
                const headersAsset = assetCache.standardForm._clone()

                // Project each component down to its header representation
                const headerComponents = (headersAsset._components ?? [])
                    .filter(excludeUndefined)
                    .map((component) => extractHeaderComponent(component))
                    .filter(excludeUndefined)

                if (headerComponents.length === 0) {
                    return undefined
                }

                headersAsset._components = headerComponents
                headersAsset._topLevel = new ReferenceList(headerComponents.map((component) => (component.referenceData)))

                return {
                    assetId,
                    zone,
                    standardForm: headersAsset
                }
            })
        ).then(results => results.filter(excludeUndefined))
        
        return {
            type: 'Snapshot',
            assets: contentHeadersAssets
        }
    } catch (error) {
        console.error('Error generating content headers snapshot:', error)
        // Return empty snapshot on error
        return {
            type: 'Snapshot',
            assets: []
        }
    }
}

export const contentHeadersDataSource = new AssetsDataSource<
    ContentHeadersSnapshot, 
    ContentHeadersUpdate | ZoneUpdatedEvent, 
    SubscribedEvent,
    ContentHeadersExternal,
    ContentHeadersSnapshotExternal
>({
    dataSourceKey: 'mtw.assets.contentHeaders',
    replayable: true, // Support client subscriptions with historical data
    eventSerializer: new ContentHeadersEventSerializer(),
    snapshotContentGenerator: generateContentHeadersSnapshot,
    subscribedEventTypeGuard: isSubscribedEvent,
    receiveEvents: async ({ events, streamEvent }) => {
        // Process mtw.assets events and generate content header and zone updates
        // Group content events by asset to enable aggregation
        
        const { eventsByAsset, zoneEvents } = events.reduce<{ eventsByAsset: Record<AssetUUID, SubscribedEvent[]>, zoneEvents: SubscribedWMLEvent[] }>((previous, event) => {
            if (event.detailEnvelope.type === 'Component Updated' || event.detailEnvelope.type === 'Component Removed' || event.detailEnvelope.type === 'Asset Updated') {
                const assetId = event.streamKey as AssetUUID
                return {
                    ...previous,
                    eventsByAsset: {
                        ...previous.eventsByAsset,
                        [assetId]: [...previous.eventsByAsset[assetId] ?? [], event]
                    }
                }
            } else if (event.detailEnvelope.type === 'Zone Changed') {
                return {
                    ...previous,
                    zoneEvents: [...previous.zoneEvents, event as SubscribedWMLEvent]
                }
            }
            return previous
        }, { eventsByAsset: {}, zoneEvents: [] })
        

        const zoneUpdates = zoneEvents.map(async (zoneEvent) => {
            const { fromZone, toZone } = zoneEvent.detailEnvelope
            await streamEvent({
                streamKey: 'global',
                update: {
                    type: 'Zone Updated',
                    assetId: zoneEvent.streamKey as AssetUUID,
                    fromZone,
                    toZone
                }
            })
        })

        // Process each asset's events as a batch
        const contentHeadersUpdates = Object.entries(eventsByAsset).map(async ([assetId, assetEvents]) => {
            try {
                
                // Get the asset's zone information
                const zone = await getAssetZone(assetId as AssetUUID)
                if (!zone) {
                    console.warn(`Could not determine zone for asset ${assetId}, skipping content header update`)
                    messageBus.send({
                        type: 'Error',
                        body: {
                            error: `Could not determine zone for asset ${assetId}`,
                            statusCode: 400
                        }
                    })
                    return
                }
                
                // Create aggregated content header update for this asset
                const contentHeadersUpdate = createAggregatedContentHeadersUpdate(assetId as AssetUUID, zone, assetEvents)
                if (contentHeadersUpdate) {
                    await streamEvent({
                        update: contentHeadersUpdate,
                        streamKey: 'global'
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
        })

        await Promise.all([
            ...contentHeadersUpdates,
            ...zoneUpdates
        ])
    }
})

// Subscribe the DataSource to the messageBus for event processing
contentHeadersDataSource.subscribe()

export default contentHeadersDataSource
// Helper functions (these will be implemented in separate files)

/**
 * Get the zone for a given asset ID
 */
async function getAssetZone(assetId: AssetUUID): Promise<Zone | null> {
    try {
        const [assetMeta] = await internalCache.AssetMetaData.get([assetId])
        return assetMeta?.zone as Zone || null
    } catch (error) {
        console.error(`Error getting zone for asset ${assetId}:`, error)
        return null
    }
}

/**
 * Create an aggregated content header update from multiple events for the same asset
 */
function createAggregatedContentHeadersUpdate(
    assetId: AssetUUID,
    zone: Zone,
    events: SubscribedEvent[]
): ContentHeadersUpdate | null {
    try {
        const headerComponents: any[] = []
        let metadataAsset: StandardForm | null = null
        
        // Process all events for this asset
        for (const event of events) {
            if (event.detailEnvelope.type === 'Component Updated' || event.detailEnvelope.type === 'Component Removed') {
                const componentUpdate = event.detailEnvelope as ComponentUpdatedEvent | ComponentRemovedEvent
                const { component } = componentUpdate
                
                if (!component) {
                    console.warn(`Component Updated event for asset ${assetId} missing component data, skipping`)
                    continue
                }

                const headerComponent = extractHeaderComponent(component)
                if (headerComponent) {
                    headerComponents.push(headerComponent)
                }
            } else if (event.detailEnvelope.type === 'Asset Updated') {
                const assetUpdated = event.detailEnvelope as AssetUpdatedEventUpdate
                // Consume the provided StandardForm directly
                metadataAsset = assetUpdated.standardForm
            }
        }
        
        // If no header components were found, return null
        if (headerComponents.length === 0 && !metadataAsset) {
            return null
        }
        
        // Build a StandardForm from header metadata, then assign component instances
        const standardForm = metadataAsset ? metadataAsset._clone() : new StandardForm(assetId)
        standardForm._components = headerComponents
        standardForm._topLevel = new ReferenceList(headerComponents.map((component) => (component.referenceData)))
        
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

