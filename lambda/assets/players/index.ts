import { AssetsDataSource } from '../dataSource/abstract'
import internalCache from '../internalCache'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerEventSerializer,
    PlayerSnapshot,
    PlayerEventUpdate,
    PlayerSettingsUpdated
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { PlayerAggregator } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players/baseClasses'
import {
    AssetLevelEventUpdate,
    isAssetAddedEvent,
    isAssetRemovedEvent,
    isAssetUpdatedEvent,
    isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isPlayerSettingsUpdatedEvent, PlayerSettingsUpdatedEvent } from './coordinationSerializer'

type PlayerLibraryView = {
    Assets: Record<string, any>
    Characters: Record<string, any>
    draftURL: string
}

type LibraryWithSettings = {
    assets: PlayerLibraryView['Assets']
    characters: PlayerLibraryView['Characters']
    settings: PlayerSettingsUpdated['settings']
}

type AssetsStreamEvent = StreamingEventPayload & {
    dataSourceKey: 'mtw.assets'
    streamKey: AssetUUID
    event: AssetLevelEventUpdate
}

type InternalPlayerEvent = StreamingEventPayload & {
    dataSourceKey: 'internal'
    streamKey: string
    event: PlayerSettingsUpdatedEvent
}

type PlayersSubscribedEvent = AssetsStreamEvent | InternalPlayerEvent

const isAssetsStreamEvent = (event: StreamingEventPayload): event is AssetsStreamEvent => {
    if (event.dataSourceKey !== 'mtw.assets') {
        return false
    }
    const payload = (event as any).detailEnvelope as any
    if (!payload || typeof payload !== 'object' || typeof (payload as any).type !== 'string') {
        return false
    }
    return [
        isAssetAddedEvent,
        isAssetRemovedEvent,
        isAssetUpdatedEvent,
        isZoneUpdatedEvent
    ].some((guard) => guard(payload))
}

const isInternalPlayerEvent = (event: StreamingEventPayload): event is InternalPlayerEvent => {
    return event.dataSourceKey === 'internal' && isPlayerSettingsUpdatedEvent((event as any).detailEnvelope as any)
}

const subscribedEventTypeGuard = (event: StreamingEventPayload): event is PlayersSubscribedEvent => {
    return isAssetsStreamEvent(event) || isInternalPlayerEvent(event)
}

const stripAssetId = (assetId: AssetUUID): string => {
    const [, uuid] = splitType(assetId)
    return uuid
}

const playerZones = new Set(['Personal', 'Draft'])
const isPlayerZone = (zone?: string) => typeof zone === 'string' && playerZones.has(zone)

const invalidatePlayerLibrary = async (player: string) => {
    internalCache.PlayerLibrary.invalidate(player)
    return internalCache.PlayerLibrary.get(player)
}

const getLibraryAndSettings = async (player: string): Promise<LibraryWithSettings> => {
    const [library, settings] = await Promise.all([
        invalidatePlayerLibrary(player),
        internalCache.PlayerSettings.get(player)
    ])
    const { onboardCompleteTags = [], guestName, guestId } = settings || {}
    return {
        assets: library.Assets,
        characters: library.Characters,
        settings: {
            onboardCompleteTags,
            ...(guestName ? { guestName } : {}),
            ...(guestId ? { guestId } : {})
        }
    }
}

const generatePlayerSnapshot = async (playerName: string): Promise<PlayerSnapshot> => {
    const { assets, characters, settings } = await getLibraryAndSettings(playerName)
    const assetArray = Object.values(assets ?? {})
    return {
        type: 'Snapshot',
        assets: assetArray,
        characters: Object.values(characters ?? {}),
        settings
    }
}

const emitSettingsUpdated = async (
    streamEvent: (params: { update: PlayerEventUpdate; streamKey: string }) => Promise<void>,
    player: string
) => {
    const { settings } = await getLibraryAndSettings(player)
    await streamEvent({
        streamKey: player,
        update: {
            type: 'Player Settings Updated',
            settings
        }
    })
}

const emitAssetAssigned = async (
    streamEvent: (params: { update: PlayerEventUpdate; streamKey: string }) => Promise<void>,
    player: string,
    assetId: AssetUUID,
    library: PlayerLibraryView
) => {
    const assetKey = stripAssetId(assetId)
    const asset = library.Assets[assetKey]
    if (!asset) {
        return
    }

    await streamEvent({
        streamKey: player,
        update: {
            type: 'Player Asset Assigned',
            asset: { ...asset }
        }
    })
}

const emitAssetRemoved = async (
    streamEvent: (params: { update: PlayerEventUpdate; streamKey: string }) => Promise<void>,
    player: string,
    assetId: AssetUUID
) => {
    const assetKey = stripAssetId(assetId)
    console.log(`[emitAssetRemoved] Emitting Player Asset Removed for player=${player}, assetId=${assetId}, assetKey=${assetKey}`)
    await streamEvent({
        streamKey: player,
        update: {
            type: 'Player Asset Removed',
            assetId: assetKey
        }
    })
    console.log(`[emitAssetRemoved] Player Asset Removed event streamed for player=${player}, assetId=${assetId}`)
}

export const playersDataSource = new AssetsDataSource<PlayerSnapshot, PlayerEventUpdate, PlayersSubscribedEvent>({
    dataSourceKey: 'mtw.assets.players',
    replayable: true,
    snapshotContentGenerator: generatePlayerSnapshot,
    eventSerializer: new PlayerEventSerializer(),
    aggregator: new PlayerAggregator(),
    subscribedEventTypeGuard,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            try {
                if (isInternalPlayerEvent(event)) {
                    await emitSettingsUpdated(streamEvent, event.streamKey)
                    return
                }

                if (isAssetsStreamEvent(event)) {
                    const assetId = event.streamKey

                    if (isAssetRemovedEvent((event as any).detailEnvelope as any)) {
                        // Use zone and player from event payload (forwarded from source event) to avoid cache timing issues
                        const { zone, player } = (event as any).detailEnvelope as any
                        if (isPlayerZone(zone) && player) {
                            // Invalidate cache for consistency (even though we only need assetId for removal)
                            await invalidatePlayerLibrary(player)
                            await emitAssetRemoved(streamEvent, player, assetId)
                        }
                        return
                    }

                    if (isAssetAddedEvent((event as any).detailEnvelope as any)) {
                        // Use zone and player from event payload to avoid cache timing issues
                        const { zone, player } = (event as any).detailEnvelope as any
                        if (isPlayerZone(zone) && player) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                        return
                    }

                    if (isZoneUpdatedEvent((event as any).detailEnvelope as any)) {
                        // Use zone and player from event payload to avoid cache timing issues
                        const { fromZone, toZone, player } = (event as any).detailEnvelope as any
                        const wasPlayerZone = isPlayerZone(fromZone)
                        const nowPlayerZone = isPlayerZone(toZone)

                        if (!player) {
                            return
                        }

                        if (!nowPlayerZone && wasPlayerZone) {
                            // Invalidate cache for consistency (even though we only need assetId for removal)
                            await invalidatePlayerLibrary(player)
                            await emitAssetRemoved(streamEvent, player, assetId)
                            return
                        }

                        if (nowPlayerZone) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                        return
                    }

                    if (isAssetUpdatedEvent((event as any).detailEnvelope as any)) {
                        // Asset Updated handles metadata changes (ShortName/Summary)
                        // If the asset is already in the player's library, the aggregator will handle idempotent updates
                        // Use player from event payload to avoid cache timing issues
                        const { player } = (event as any).detailEnvelope as any
                        if (player) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                    }
                }
            } catch (error) {
                console.error(`mtw.assets.players: failed to process event for stream ${event.streamKey}`, error)
            }
        }))
    }
})

playersDataSource.subscribe()

export default playersDataSource

