import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetsDataSource } from './abstract'
import messageBus from '../messageBus'
import { healGlobalValues } from '../selfHealing/globalValues'
import internalCache from '../internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { cacheAsset, decacheAsset } from './caching'
import { AssetsEventSerializer, AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import {
    AssetsIncomingEvent,
    AssetsSubscribedContent,
    isApiAssetsHealPlayerEvent,
    isApiAssetsHealComponentVerticalEvent,
    isAssetsSubscribedEnvelope,
    isCognitoNewPlayerEvent,
    isWMLZoneChangedEvent,
    isWMLAssetPurgedEvent,
    isDiagnosticsHealGlobalValuesEvent,
    isDiagnosticsCacheConsistencyFindingEvent,
    isDiagnosticsPlayerMisalignmentFindingEvent,
    isWMLContentUpdateEvent,
} from './subscribedEvents'
import { healPlayer } from '../player/heal'
import { healComponentVertical } from './components/verticals/healComponentVertical'

type StreamEventFn = (params: { update: AssetsEventUpdate; streamKey: string; header: { type: string } }) => Promise<void>

const handleContentUpdate = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Content Update' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const assetId = event.header.streamKey as AssetUUID
    if (!assetId) {
        messageBus.publish({ type: 'Error', body: { error: 'Invalid AssetId in Content Update event', statusCode: 400 } })
        return
    }
    try {
        const { zone, player, isNewAsset } = await cacheAsset({ assetId, streamEvent })
        if (isNewAsset) {
            await streamEvent({
                update: { zone, ...(player ? { player } : {}) },
                streamKey: assetId,
                header: { type: 'Asset Added' }
            })
        }
        await streamEvent({
            update: { zone },
            streamKey: assetId,
            header: { type: 'Asset Cached' }
        })
    } catch (error) {
        console.error(`Error caching asset ${assetId}:`, error)
        messageBus.publish({
            type: 'Error',
            body: { error: `Failed to cache asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`, statusCode: 500 }
        })
    }
}

const handleZoneChanged = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Zone Changed' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    if (!content) return
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
        await streamEvent({ update: { assetIds: globalAssetsSorted }, streamKey: 'canon-global', header: { type: 'Canon Updated' } })
    }
    await streamEvent({
        update: { fromZone, toZone, ...(player ? { player } : {}) },
        streamKey: assetUUID,
        header: { type: 'Zone Updated' }
    })
}

const handleAssetPurged = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Asset Purged' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    if (!content) return
    const assetId = event.header.streamKey as AssetUUID
    if (!assetId) {
        messageBus.publish({ type: 'Error', body: { error: 'Invalid AssetId in Asset Purged event', statusCode: 400 } })
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
        update: { zone, ...(player ? { player } : {}) },
        streamKey: assetId,
        header: { type: 'Asset Removed' }
    })
}

const handleHealGlobalValues = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Heal Global Values' } }>
): Promise<void> => {
    const healContent = await event.getContent()
    if (!healContent) return
    await healGlobalValues({
        shouldHealConnections: Boolean(healContent.connections),
        shouldHealGlobalAssets: typeof healContent.assets !== 'boolean' || healContent.assets
    })
}

const handleCacheConsistencyFinding = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Cache Consistency Finding' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    if (!content?.assetId || typeof content.assetId !== 'string') return
    const assetId = AssetKey(content.assetId)
    try {
        await cacheAsset({ assetId, streamEvent })
    } catch (error) {
        console.error(`Error caching asset ${assetId} from Cache Consistency Finding:`, error)
        messageBus.publish({
            type: 'Error',
            body: { error: `Failed to cache asset ${assetId}: ${error instanceof Error ? error.message : String(error)}`, statusCode: 500 }
        })
    }
}

const handleNewPlayerHeal = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'New Player' } }>
): Promise<void> => {
    const content = await event.getContent()
    if (!content?.player || typeof content.player !== 'string') {
        return
    }
    await healPlayer(content.player)
}

const handlePlayerMisalignmentFinding = async (
    event: Extract<AssetsIncomingEvent, { header: { type: 'Player Misalignment Finding' } }>
): Promise<void> => {
    const content = await event.getContent()
    if (!content?.player || typeof content.player !== 'string') {
        return
    }
    await healPlayer(content.player)
}

const handleApiHealPlayer = async (
    event: Extract<AssetsIncomingEvent, { header: { dataSourceKey: 'api.assets'; type: 'HealPlayer' } }>
): Promise<void> => {
    const content = await event.getContent()
    if (!content?.player || typeof content.player !== 'string') {
        return
    }
    const result = await healPlayer(content.player)
    messageBus.publish({
        type: 'ReturnValue',
        body: result as Record<string, any>
    })
}

const handleApiHealComponentVertical = async (
    event: Extract<
        AssetsIncomingEvent,
        { header: { dataSourceKey: 'api.assets'; type: 'HealComponentVertical' } }
    >
): Promise<void> => {
    const content = await event.getContent()
    if (content?.type !== 'HealComponentVertical' || !content.assetId || typeof content.assetId !== 'string') {
        return
    }
    const result = await healComponentVertical({
        assetId: content.assetId,
        componentUniversalKeys: content.componentUniversalKeys as EphemeraId[] | undefined,
    })
    messageBus.publish({
        type: 'ReturnValue',
        body: result as Record<string, any>,
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
// - Handle WML purge and decache
// - Process diagnostic events (healing, global values)
// - Handle player and library update events
//
export const assetsDataSource = new AssetsDataSource<never, AssetsEventUpdate, AssetsSubscribedContent>({
    dataSourceKey: 'mtw.assets',
    outboundBusDelivery: 'publish',
    replayable: false, // Non-replayable - focuses on event streaming and processing
    eventSerializer: new AssetsEventSerializer(), // Handle all asset event serialization (component and asset-level)
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: isAssetsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        await Promise.all(events.map(async (event) => {
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
            if (isDiagnosticsCacheConsistencyFindingEvent(event)) {
                await handleCacheConsistencyFinding(event, streamEvent)
                return
            }
            if (isDiagnosticsPlayerMisalignmentFindingEvent(event)) {
                await handlePlayerMisalignmentFinding(event)
                return
            }
            if (isCognitoNewPlayerEvent(event)) {
                await handleNewPlayerHeal(event)
                return
            }
            if (isApiAssetsHealPlayerEvent(event)) {
                await handleApiHealPlayer(event)
                return
            }
            if (isApiAssetsHealComponentVerticalEvent(event)) {
                await handleApiHealComponentVertical(event)
                return
            }
        }))
    }
})

// Subscribe the DataSource to the messageBus for event processing
assetsDataSource.subscribe()

export default assetsDataSource
