import { AssetsDataSource } from './abstract'
import messageBus from '../messageBus'
import { healGlobalValues } from '../selfHealing/globalValues'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import internalCache from '../internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { cacheAsset, decacheAsset } from './caching'
import { AssetsEventSerializer, AssetsEventUpdate } from './serializers'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventUpdate } from '../../wml/dataSource/serializers'
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"

// Separate type for WML events with precise typing
type WMLSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'mtw.wml'
    event: WMLEventUpdate
}

// Union type constraint for legitimate incoming subscribed events
type AssetsSubscribedEvent = WMLSubscribedEvent | (
    StreamingEventPayload & {
        dataSourceKey: 'mtw.diagnostics' | 'mtw.coordination'
        event: {
            type: string
        } & Record<string, unknown>
    }
)

// Type guard for WML events
const isWMLSubscribedEvent = (event: AssetsSubscribedEvent): event is WMLSubscribedEvent => {
    return event.dataSourceKey === 'mtw.wml'
}

//
// Non-replayable DataSource singleton for mtw.assets
// 
// This DataSource handles serving event mesh items for the mtw.assets top-level
// dataSource and processes incoming events that have impacts at the assets level.
// 
// Key responsibilities:
// - Stream asset-level events to EventBridge for real-time subscribers
// - Process incoming events from other data sources that affect assets
// - Handle WML events for asset caching and decaching
// - Handle coordination events (canonization, removal, etc.)
// - Process diagnostic events (healing, global values)
// - Handle player and library update events
//
export const assetsDataSource = new AssetsDataSource<never, AssetsEventUpdate, AssetsSubscribedEvent>({
    dataSourceKey: 'mtw.assets',
    replayable: false, // Non-replayable - focuses on event streaming and processing
    eventSerializer: new AssetsEventSerializer(), // Handle all asset event serialization (component and asset-level)
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is AssetsSubscribedEvent => {
        // Subscribe to events from other data sources that we care about
        // These are events published by mtw.diagnostics, mtw.coordination, and mtw.wml
        return Boolean(
            ['mtw.diagnostics', 'mtw.coordination', 'mtw.wml'].includes(event.dataSourceKey) && 
            event.event && 
            typeof event.event === 'object' &&
            'type' in event.event &&
            typeof event.event.type === 'string'
        )
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal messageBus events from other data sources
        // Process each event in the batch independently and in parallel
        
        await Promise.all(events.map(async (event) => {
            // Handle mtw.wml events
            if (isWMLSubscribedEvent(event) && event.event.type === 'Content Update') {
                const assetId = event.streamKey as AssetUUID
                if (assetId) {
                    try {
                        await cacheAsset({ assetId, streamEvent })
                        
                        // Stream the caching event for real-time subscribers
                        await streamEvent({
                            update: { 
                                type: 'Asset Cached'
                            },
                            streamKey: assetId,
                        })
                    } catch (error) {
                        console.error(`Error caching asset ${assetId}:`, error)
                        messageBus.send({
                            type: 'Error',
                            body: { 
                                error: `Failed to cache asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                                statusCode: 500
                            }
                        })
                    }
                    return
                } else {
                    messageBus.send({
                        type: 'Error',
                        body: { 
                            error: 'Invalid AssetId in Content Update event',
                            statusCode: 400
                        }
                    })
                    return
                }
            }
            
            // Handle mtw.wml Content Removed events
            if (isWMLSubscribedEvent(event) && event.event.type === 'Content Removed') {
                const assetId = event.streamKey as AssetUUID
                if (assetId) {
                    try {
                        await decacheAsset({ assetId, streamEvent })
                        
                        // Stream the decaching event for real-time subscribers
                        await streamEvent({
                            update: { 
                                type: 'Asset Decached',
                            },
                            streamKey: assetId
                        })
                    } catch (error) {
                        console.error(`Error decaching asset ${assetId}:`, error)
                        messageBus.send({
                            type: 'Error',
                            body: { 
                                error: `Failed to decache asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`,
                                statusCode: 500
                            }
                        })
                    }
                    return
                } else {
                    messageBus.send({
                        type: 'Error',
                        body: { 
                            error: 'Invalid AssetId in Content Removed event',
                            statusCode: 400
                        }
                    })
                    return
                }
            }

            // Handle mtw.wml Zone Changed events
            if (isWMLSubscribedEvent(event) && event.event.type === 'Zone Changed') {
                const { fromZone, toZone, player, subFolder } = event.event
                const assetId = event.streamKey as AssetUUID
                if (assetId) {
                    // Ensure AssetId is properly formatted as ASSET#${string}
                    const assetUUID = AssetKey(assetId)
                    
                    // Update the Meta::Asset record with new zone information
                    await assetDB.putItem({
                        AssetId: assetUUID,
                        DataCategory: 'Meta::Asset',
                        address: {
                            zone: toZone,
                            ...(player && { player }),
                            ...(subFolder && { subFolder })
                        },
                        zone: toZone,
                        ...(player && { player })
                    })
                    
                    // Handle canon graph management when entering/leaving Canon zone
                    if (toZone === 'Canon' || fromZone === 'Canon') {
                        // Query for canon assets after the move
                        const Items = await assetDB.query({
                            IndexName: 'DataCategoryIndex',
                            Key: {
                                DataCategory: 'Meta::Asset'
                            },
                            FilterExpression: "zone = :canon",
                            ExpressionAttributeValues: {
                                ':canon': 'Canon'
                            },
                            ProjectionFields: ['AssetId', 'zone']
                        })
                        const canonGraph = await internalCache.Graph.get(Items.map(({ AssetId }) => (AssetId)), 'back')
                        const globalAssetsSorted = canonGraph.reverse().topologicalSort().flat()
                        
                        // Stream the canon update
                        await streamEvent({
                            update: { 
                                type: 'Canon Updated',
                                assetIds: globalAssetsSorted
                            },
                            streamKey: 'canon-global'
                        })
                    }
                    
                    // TODO: Update internal caches - remove from old zone cache and add to new zone cache
                    // This requires cache management logic to handle zone transitions
                }
            }

            // Handle mtw.diagnostics events
            if (event.dataSourceKey === 'mtw.diagnostics' && event.event.type === 'Heal Global Values') {
                const returnVal = await healGlobalValues({
                    shouldHealConnections: Boolean(event.event.connections),
                    shouldHealGlobalAssets: typeof event.event.assets !== 'boolean' || event.event.assets
                })
                
                return
            }
            
            // Handle mtw.coordination events
            if (event.dataSourceKey === 'mtw.coordination' && event.event.type === 'Remove Asset') {
                const { assetId } = event.event
                if (assetId) {
                    try {
                        // Decache the asset before removing it
                        await decacheAsset({ assetId: assetId as string, streamEvent })
                    } catch (error) {
                        console.error(`Error decaching asset ${assetId}:`, error)
                        // Continue with removal even if decaching fails
                    }
                    
                    // Stream the removal as an asset-level event
                    await streamEvent({
                        update: { 
                            type: 'Asset Removed',
                            assetId: assetId as string
                        },
                        streamKey: assetId as string
                    })
                    return
                    } else {
                    // Send error message to messageBus
                    messageBus.send({
                        type: 'Error',
                        body: { 
                            error: 'Invalid arguments specified for Remove Asset event',
                            statusCode: 400
                        }
                    })
                    return
                }
            }
        
        })) // End of Promise.all processing events batch in parallel
        
    }
})

// Subscribe the DataSource to the messageBus for event processing
assetsDataSource.subscribe()

export default assetsDataSource
