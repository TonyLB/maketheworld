import { AssetsDataSource } from './abstract'
import messageBus from '../messageBus'
import { healGlobalValues } from '../selfHealing/globalValues'
import internalCache from '../internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { cacheAsset, decacheAsset } from './caching'
import { AssetsEventSerializer, AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import {
    AssetsIncomingEvent,
    AssetsSubscribedContent,
    isWMLZoneChangedEvent,
    isWMLAssetPurgedEvent,
    isDiagnosticsHealGlobalValuesEvent,
    isCoordinationRemoveAssetEvent,
    isWMLContentUpdateEvent,
} from './subscribedEvents'

type StreamEventFn = (params: { update: AssetsEventUpdate; streamKey: string }) => Promise<void>

const handleContentUpdate = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Content Update' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const assetId = event.header.streamKey as AssetUUID
    if (!assetId) {
        messageBus.send({ type: 'Error', body: { error: 'Invalid AssetId in Content Update event', statusCode: 400 } })
        return
    }
    try {
        const { zone, player, isNewAsset } = await cacheAsset({ assetId, streamEvent })
        if (isNewAsset) {
            await streamEvent({
                update: { type: 'Asset Added', zone, ...(player ? { player } : {}) },
                streamKey: assetId
            })
        }
        await streamEvent({
            update: { type: 'Asset Cached', zone },
            streamKey: assetId,
        })
    } catch (error) {
        console.error(`Error caching asset ${assetId}:`, error)
        messageBus.send({
            type: 'Error',
            body: { error: `Failed to cache asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`, statusCode: 500 }
        })
    }
}

const handleZoneChanged = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Zone Changed' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContentInternal()
    const { fromZone, toZone, player, subFolder } = content
    const assetId = event.header.streamKey as AssetUUID
    if (!assetId) return
    const assetUUID = AssetKey(assetId)
    await assetDB.putItem({
        AssetId: assetUUID,
        DataCategory: 'Meta::Asset',
        address: { zone: toZone, ...(player && { player }), ...(subFolder && { subFolder }) },
        zone: toZone,
        ...(player && { player })
    })
    if (toZone === 'Canon' || fromZone === 'Canon') {
        const Items = await assetDB.query({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: 'Meta::Asset' },
            FilterExpression: "zone = :canon",
            ExpressionAttributeValues: { ':canon': 'Canon' },
            ProjectionFields: ['AssetId', 'zone']
        })
        const canonGraph = await internalCache.Graph.get(Items.map(({ AssetId }) => (AssetId)), 'back')
        const globalAssetsSorted = canonGraph.reverse().topologicalSort().flat()
        await streamEvent({ update: { type: 'Canon Updated', assetIds: globalAssetsSorted }, streamKey: 'canon-global' })
    }
    await streamEvent({
        update: { type: 'Zone Updated', fromZone, toZone, ...(player ? { player } : {}) },
        streamKey: assetUUID
    })
}

const handleAssetPurged = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Asset Purged' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContentInternal()
    const assetId = event.header.streamKey as AssetUUID
    if (!assetId) {
        messageBus.send({ type: 'Error', body: { error: 'Invalid AssetId in Asset Purged event', statusCode: 400 } })
        return
    }
    try {
        await decacheAsset({ assetId, streamEvent })
    } catch (error) {
        console.error(`Error decaching asset ${assetId} during purge:`, error)
    }
    const { zone, player } = content
    if (!zone) {
        console.error(`Cannot emit Asset Removed for ${assetId}: zone is missing from Asset Purged event`)
        return
    }
    await streamEvent({
        update: { type: 'Asset Removed', zone, ...(player ? { player } : {}) },
        streamKey: assetId
    })
}

const handleHealGlobalValues = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Heal Global Values' } }>
): Promise<void> => {
    const healContent = await event.getContentInternal()
    await healGlobalValues({
        shouldHealConnections: Boolean(healContent.connections),
        shouldHealGlobalAssets: typeof healContent.assets !== 'boolean' || healContent.assets
    })
}

const handleRemoveAsset = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Remove Asset' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContentInternal()
    const { assetId } = content
    if (!assetId) {
        messageBus.send({
            type: 'Error',
            body: { error: 'Invalid arguments specified for Remove Asset event', statusCode: 400 }
        })
        return
    }
    try {
        await decacheAsset({ assetId: assetId as string, streamEvent })
    } catch (error) {
        console.error(`Error decaching asset ${assetId}:`, error)
    }
    const assetMeta = (await internalCache.AssetMetaData.get([assetId as AssetUUID]))[0]
    const zone = assetMeta?.zone
    const player = assetMeta?.player
    if (!zone) {
        console.error(`Cannot emit Asset Removed for ${assetId}: zone not found in metadata`)
        return
    }
    await streamEvent({
        update: { type: 'Asset Removed', zone, ...(player ? { player } : {}) },
        streamKey: assetId as string
    })
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
export const assetsDataSource = new AssetsDataSource<never, AssetsEventUpdate, AssetsSubscribedContent>({
    dataSourceKey: 'mtw.assets',
    replayable: false, // Non-replayable - focuses on event streaming and processing
    eventSerializer: new AssetsEventSerializer(), // Handle all asset event serialization (component and asset-level)
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (header: StreamingEventHeader): boolean => {
        // Subscribe to events from other data sources that we care about
        // These are events published by mtw.diagnostics, mtw.coordination, and mtw.wml
        return ['mtw.diagnostics', 'mtw.coordination', 'mtw.wml'].includes(header.dataSourceKey) && typeof header.type === 'string'
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal messageBus events from other data sources
        // Process each event in the batch independently and in parallel
        // Cast to envelope union for TypeScript narrowing
        const typedEvents = events as AssetsIncomingEvent[]

        await Promise.all(typedEvents.map(async (event) => {
            if (isWMLContentUpdateEvent(event)) {
                await handleContentUpdate(event, streamEvent)
                return
            }
            if (isWMLZoneChangedEvent(event)) {
                await handleZoneChanged(event, streamEvent)
                return
            }
            if (isWMLAssetPurgedEvent(event)) {
                await handleAssetPurged(event, streamEvent)
                return
            }
            if (isDiagnosticsHealGlobalValuesEvent(event)) {
                await handleHealGlobalValues(event)
                return
            }
            if (isCoordinationRemoveAssetEvent(event)) {
                await handleRemoveAsset(event, streamEvent)
            }
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
assetsDataSource.subscribe()

export default assetsDataSource
