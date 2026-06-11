import { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StreamEnvelopeFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
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
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Zone } from '@tonylb/mtw-asset-workspace'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import {
    ContentHeadersIncomingEvent,
    ContentHeadersSubscribedContent,
    isContentHeadersSubscribedEnvelope,
    isZoneChangedContentHeadersEvent,
    isComponentHeadersEvent,
    isAssetUpdatedHeadersEvent,
} from './subscribedEvents'

type ContentHeadersStreamEvent = (params: {
    update: ContentHeadersUpdate | ZoneUpdatedEvent
    streamKey: string
    header: { type: string }
}) => Promise<void>

// Re-export for consumers that imported from this file
export type { SubscribedAssetsContent, SubscribedWMLContent } from './subscribedEvents'

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
        shortName: component.shortName?.toJSON()
    } as any

    const { component: headerComponent } = standardComponentFactory(minimalJson)
    return headerComponent ?? undefined
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
            assets: contentHeadersAssets
        }
    } catch (error) {
        console.error('Error generating content headers snapshot:', error)
        // Return empty snapshot on error
        return {
            assets: []
        }
    }
}

export const contentHeadersDataSource = new AssetsDataSource<
    ContentHeadersSnapshot,
    ContentHeadersUpdate | ZoneUpdatedEvent,
    ContentHeadersSubscribedContent,
    ContentHeadersExternal,
    ContentHeadersSnapshotExternal
>({
    dataSourceKey: 'mtw.assets.contentHeaders',
    replayable: true, // Support client subscriptions with historical data
    eventSerializer: new ContentHeadersEventSerializer(),
    snapshotContentGenerator: generateContentHeadersSnapshot,
    subscribedEventTypeGuard: isContentHeadersSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }: { events: Array<StreamingEventEnvelope<ContentHeadersSubscribedContent>>; streamEvent: ContentHeadersStreamEvent; streamEnvelope: StreamEnvelopeFunction }) => {
        // Process mtw.assets events and generate content header and zone updates
        // Group content events by asset to enable aggregation
        // Cast to envelope union for TypeScript narrowing
        const typedEvents = events as ContentHeadersIncomingEvent[]

        const { eventsByAsset, zoneEvents } = typedEvents.reduce<{ eventsByAsset: Record<AssetUUID, ContentHeadersIncomingEvent[]>, zoneEvents: ContentHeadersIncomingEvent[] }>((previous, event) => {
            const { header } = event
            if (header.dataSourceKey === 'mtw.assets' && (header.type === 'Component Updated' || header.type === 'Component Removed' || header.type === 'Asset Updated')) {
                const assetId = header.streamKey as AssetUUID
                return {
                    ...previous,
                    eventsByAsset: {
                        ...previous.eventsByAsset,
                        [assetId]: [...previous.eventsByAsset[assetId] ?? [], event]
                    }
                }
            } else if (isZoneChangedContentHeadersEvent(event)) {
                return {
                    ...previous,
                    zoneEvents: [...previous.zoneEvents, event]
                }
            }
            return previous
        }, { eventsByAsset: {}, zoneEvents: [] })

        const zoneUpdates = zoneEvents.map(async (zoneEvent) => {
            if (!isZoneChangedContentHeadersEvent(zoneEvent)) return
            const content = await zoneEvent.getContent()
            if (!content) return
            const { fromZone, toZone } = content
            await streamEvent({
                streamKey: 'global',
                update: {
                    assetId: zoneEvent.header.streamKey as AssetUUID,
                    fromZone,
                    toZone
                },
                header: { type: 'Zone Updated' }
            })
        })

        // Process each asset's events as a batch
        const contentHeadersUpdates = Object.entries(eventsByAsset).map(async ([assetId, assetEvents]) => {
            try {
                // Get the asset's zone information
                const zone = await getAssetZone(assetId as AssetUUID)
                if (!zone) {
                    console.warn(`Could not determine zone for asset ${assetId}, skipping content header update`)
                    messageBus.publish({
                        type: 'Error',
                        body: {
                            error: `Could not determine zone for asset ${assetId}`,
                            statusCode: 400
                        }
                    })
                    return
                }

                // Create aggregated content header update for this asset
                const contentHeadersUpdate = await createAggregatedContentHeadersUpdate(assetId as AssetUUID, zone, assetEvents)
                if (contentHeadersUpdate) {
                    await streamEvent({
                        update: contentHeadersUpdate,
                        streamKey: 'global',
                        header: { type: 'Headers Updated' }
                    })
                } else {
                    console.log(`No content header update generated for asset ${assetId} (no suitable components for headers)`)
                }
            } catch (error) {
                console.error(`Error processing events for asset ${assetId}:`, error)
                messageBus.publish({
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
async function createAggregatedContentHeadersUpdate(
    assetId: AssetUUID,
    zone: Zone,
    events: ContentHeadersIncomingEvent[]
): Promise<ContentHeadersUpdate | null> {
    try {
        const headerComponents: any[] = []
        let metadataAsset: StandardForm | null = null

        // Process all events for this asset
        for (const event of events) {
            const content = await event.getContent()
            if (!content) continue
            const { header } = event
            if (isComponentHeadersEvent(event)) {
                const component = 'component' in content ? content.component : undefined

                if (!component) {
                    console.warn(`Component Updated event for asset ${assetId} missing component data, skipping`)
                    continue
                }

                const headerComponent = extractHeaderComponent(component)
                if (headerComponent) {
                    headerComponents.push(headerComponent)
                }
            } else if (isAssetUpdatedHeadersEvent(event)) {
                // Consume the provided StandardForm directly
                metadataAsset = 'standardForm' in content ? content.standardForm : null
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
            assetId,
            zone,
            standardForm
        }
    } catch (error) {
        console.error(`Error creating aggregated content headers update for asset ${assetId}:`, error)
        return null
    }
}

