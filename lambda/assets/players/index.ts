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
    isAssetCachedEvent,
    isAssetDecachedEvent,
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
    const payload = event.event
    if (!payload || typeof payload !== 'object' || typeof (payload as any).type !== 'string') {
        return false
    }
    return [
        isAssetCachedEvent,
        isAssetDecachedEvent,
        isAssetRemovedEvent,
        isAssetUpdatedEvent,
        isZoneUpdatedEvent
    ].some((guard) => guard(payload))
}

const isInternalPlayerEvent = (event: StreamingEventPayload): event is InternalPlayerEvent => {
    return event.dataSourceKey === 'internal' && isPlayerSettingsUpdatedEvent(event.event)
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

const resolvePlayerName = (event: AssetLevelEventUpdate, meta?: { player?: string }): string | undefined => {
    const eventPlayer = (event as unknown as { player?: string }).player
    if (typeof eventPlayer === 'string' && eventPlayer) {
        return eventPlayer
    }
    const metaPlayer = meta?.player
    return typeof metaPlayer === 'string' && metaPlayer ? metaPlayer : undefined
}

const isRemovalEvent = (event: AssetLevelEventUpdate): boolean =>
    isAssetDecachedEvent(event) || isAssetRemovedEvent(event)

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
    await streamEvent({
        streamKey: player,
        update: {
            type: 'Player Asset Removed',
            assetId: assetKey
        }
    })
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
                    const [meta] = await internalCache.AssetMetaData.get([assetId])
                    const player = resolvePlayerName(event.event, meta)

                    if (!player) {
                        return
                    }

                    if (isRemovalEvent(event.event)) {
                        await emitAssetRemoved(streamEvent, player, assetId)
                        return
                    }

                    if (isZoneUpdatedEvent(event.event)) {
                        const { fromZone, toZone } = event.event
                        const wasPlayerZone = isPlayerZone(fromZone)
                        const nowPlayerZone = isPlayerZone(toZone)

                        if (!nowPlayerZone && wasPlayerZone) {
                            await emitAssetRemoved(streamEvent, player, assetId)
                            return
                        }

                        if (nowPlayerZone) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                        return
                    }

                    if (isAssetCachedEvent(event.event) || isAssetUpdatedEvent(event.event)) {
                        const currentZone = meta?.zone
                        if (isPlayerZone(currentZone)) {
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

