import { AssetsDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import messageBus from '../messageBus'
import { healGlobalValues } from '../selfHealing/globalValues'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import internalCache from '../internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { cacheAsset, decacheAsset } from './caching'

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
export const assetsDataSource = new AssetsDataSource({
    dataSourceKey: 'mtw.assets',
    replayable: false, // Non-replayable - focuses on event streaming and processing
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is StreamingEventPayload => {
        // Subscribe to EventBridge events from other data sources that we care about
        // These are EventBridge events published by mtw.diagnostics, mtw.coordination, and mtw.wml
        return Boolean(
            ['mtw.diagnostics', 'mtw.coordination', 'mtw.wml'].includes(event.dataSourceKey) && 
            event.event && 
            typeof event.event === 'object' &&
            event.event !== null &&
            'source' in event.event
        )
    },
    receiveEvents: async ({ event, streamEvent }) => {
        // Process messageBus events that represent EventBridge events
        const eventData = event.event as any
        
        // Handle mtw.wml events
        if (eventData.source === 'mtw.wml' && event.detailType === 'Content Update') {
            const { AssetId } = eventData.detail
            if (AssetId) {
                try {
                    const assetId = AssetId.replace('ASSET#', '')
                    await cacheAsset({ assetId, streamEvent })
                    
                    // Stream the caching event for real-time subscribers
                    await streamEvent({
                        update: { 
                            type: 'CacheAsset',
                            assetId
                        },
                        streamKey: AssetId,
                        detailType: 'Asset Cached'
                    })
                } catch (error) {
                    console.error(`Error caching asset ${AssetId}:`, error)
                    messageBus.send({
                        type: 'Error',
                        body: { 
                            error: `Failed to cache asset ${AssetId}: ${error instanceof Error ? error.message : String(error)}`,
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
        if (eventData.source === 'mtw.wml' && event.detailType === 'Content Removed') {
            const { AssetId } = eventData.detail
            if (AssetId) {
                try {
                    const assetId = AssetId.replace('ASSET#', '')
                    await decacheAsset({ assetId, streamEvent })
                    
                    // Stream the decaching event for real-time subscribers
                    await streamEvent({
                        update: { 
                            type: 'DecacheAsset',
                            assetId
                        },
                        streamKey: AssetId,
                        detailType: 'Asset Decached'
                    })
                } catch (error) {
                    console.error(`Error decaching asset ${AssetId}:`, error)
                    messageBus.send({
                        type: 'Error',
                        body: { 
                            error: `Failed to decache asset ${AssetId}: ${error instanceof Error ? error.message : String(error)}`,
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
        
        // Handle mtw.diagnostics events
        if (eventData.source === 'mtw.diagnostics' && event.detailType === 'Heal Global Values') {
            const returnVal = await healGlobalValues({
                shouldHealConnections: Boolean(eventData.detail?.connections),
                shouldHealGlobalAssets: typeof eventData.detail?.assets !== 'boolean' || eventData.detail?.assets
            })
            
            return
        }
        
        // Handle mtw.coordination events
        if (eventData.source === 'mtw.coordination' && event.detailType === 'Remove Asset') {
            const { assetId } = eventData.detail
            if (assetId) {
                try {
                    // Decache the asset before removing it
                    await decacheAsset({ assetId, streamEvent })
                } catch (error) {
                    console.error(`Error decaching asset ${assetId}:`, error)
                    // Continue with removal even if decaching fails
                }
                
                messageBus.send({
                    type: 'RemoveAsset',
                    assetId
                })
                
                // Stream the removal as an asset-level event
                await streamEvent({
                    update: { 
                        type: 'RemoveAsset',
                        assetId
                    },
                    streamKey: assetId,
                    detailType: 'Asset Removed'
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
        
        if (eventData.source === 'mtw.coordination' && ['Canonize Asset', 'Decanonize Asset'].includes(event.detailType)) {
            const { assetId } = eventData.detail
            if (assetId) {
                const toZone = event.detailType === 'Canonize Asset' ? 'Canon' : 'Library'
                
                messageBus.send({
                    type: 'MoveByAssetId',
                    AssetId: `ASSET#${assetId}`,
                    toZone
                })
                
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
                
                // Stream the canon update (replacing the direct EventBridge publish)
                await streamEvent({
                    update: { 
                        assetIds: globalAssetsSorted
                    },
                    streamKey: 'canon-global',
                    detailType: 'Canon Updated'
                })
                return
            } else {
                // Send error message to messageBus
                messageBus.send({
                    type: 'Error',
                    body: { 
                        error: `Invalid arguments specified for ${eventData.detailType} event`,
                        statusCode: 400
                    }
                })
                return
            }
        }
        
    }
})

// Subscribe the DataSource to the messageBus for event processing
assetsDataSource.subscribe()

export default assetsDataSource
