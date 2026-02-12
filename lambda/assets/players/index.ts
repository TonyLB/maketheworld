import { AssetsDataSource } from '../dataSource/abstract'
import internalCache from '../internalCache'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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

const PLAYERS_ASSET_EVENT_TYPES = new Set(['Asset Added', 'Asset Removed', 'Asset Updated', 'Zone Updated'])
const PLAYER_SETTINGS_TYPE = 'Player Settings Updated'

/** Payload types of events mtw.assets.players subscribes to (internal + mtw.assets). */
type PlayersSubscribedContent = PlayerSettingsUpdatedEvent | AssetLevelEventUpdate

const subscribedEventTypeGuard = (header: StreamingEventHeader): boolean => {
    if (header.dataSourceKey === 'internal') {
        return header.type === PLAYER_SETTINGS_TYPE
    }
    if (header.dataSourceKey === 'mtw.assets') {
        return PLAYERS_ASSET_EVENT_TYPES.has(header.type)
    }
    return false
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

export const playersDataSource = new AssetsDataSource<PlayerSnapshot, PlayerEventUpdate, PlayersSubscribedContent>({
    dataSourceKey: 'mtw.assets.players',
    replayable: true,
    snapshotContentGenerator: generatePlayerSnapshot,
    eventSerializer: new PlayerEventSerializer(),
    aggregator: new PlayerAggregator(),
    subscribedEventTypeGuard,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const { header, content } = event
            const streamKey = header.streamKey
            try {
                if (header.dataSourceKey === 'internal' && isPlayerSettingsUpdatedEvent(content)) {
                    await emitSettingsUpdated(streamEvent, streamKey)
                    return
                }

                if (header.dataSourceKey === 'mtw.assets') {
                    const assetId = streamKey as AssetUUID
                    const payload = content

                    if (isAssetRemovedEvent(payload)) {
                        const { zone, player } = payload
                        if (isPlayerZone(zone) && player) {
                            await invalidatePlayerLibrary(player)
                            await emitAssetRemoved(streamEvent, player, assetId)
                        }
                        return
                    }

                    if (isAssetAddedEvent(payload)) {
                        const { zone, player } = payload
                        if (isPlayerZone(zone) && player) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                        return
                    }

                    if (isZoneUpdatedEvent(payload)) {
                        const { fromZone, toZone, player } = payload
                        const wasPlayerZone = isPlayerZone(fromZone)
                        const nowPlayerZone = isPlayerZone(toZone)

                        if (!player) {
                            return
                        }

                        if (!nowPlayerZone && wasPlayerZone) {
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

                    if (isAssetUpdatedEvent(payload)) {
                        const { player } = payload
                        if (player) {
                            const library = await invalidatePlayerLibrary(player)
                            await emitAssetAssigned(streamEvent, player, assetId, library)
                        }
                    }
                }
            } catch (error) {
                console.error(`mtw.assets.players: failed to process event for stream ${streamKey}`, error)
            }
        }))
    }
})

playersDataSource.subscribe()

export default playersDataSource

