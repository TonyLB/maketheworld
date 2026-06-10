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
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import {
    PlayersSubscribedContent,
    PlayersIncomingEvent,
    isPlayersSubscribedEnvelope,
    isPlayerSettingsEnvelope,
    isPlayersAssetRemovedEnvelope,
    isPlayersAssetAddedEnvelope,
    isPlayersZoneUpdatedEnvelope,
    isPlayersAssetUpdatedEnvelope,
} from './subscribedEvents'

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

type StreamEventFn = (params: { update: PlayerEventUpdate; streamKey: string; header: { type: string } }) => Promise<void>

const processPlayerSettings = async (
    event: Extract<PlayersIncomingEvent, { header: { dataSourceKey: 'api.assets' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    await emitSettingsUpdated(streamEvent, event.header.streamKey)
}

const handleAssetRemoved = async (
    event: Extract<PlayersIncomingEvent, { header: { type: 'Asset Removed' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    const assetId = event.header.streamKey as AssetUUID
    const { zone, player } = content
    if (isPlayerZone(zone) && player) {
        await invalidatePlayerLibrary(player)
        await emitAssetRemoved(streamEvent, player, assetId)
    }
}

const handleAssetAdded = async (
    event: Extract<PlayersIncomingEvent, { header: { type: 'Asset Added' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    const assetId = event.header.streamKey as AssetUUID
    const { zone, player } = content
    if (isPlayerZone(zone) && player) {
        const library = await invalidatePlayerLibrary(player)
        await emitAssetAssigned(streamEvent, player, assetId, library)
    }
}

const handleZoneUpdated = async (
    event: Extract<PlayersIncomingEvent, { header: { type: 'Zone Updated' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    const assetId = event.header.streamKey as AssetUUID
    const { fromZone, toZone, player } = content
    const wasPlayerZone = isPlayerZone(fromZone)
    const nowPlayerZone = isPlayerZone(toZone)
    if (!player) return
    if (!nowPlayerZone && wasPlayerZone) {
        await invalidatePlayerLibrary(player)
        await emitAssetRemoved(streamEvent, player, assetId)
        return
    }
    if (nowPlayerZone) {
        const library = await invalidatePlayerLibrary(player)
        await emitAssetAssigned(streamEvent, player, assetId, library)
    }
}

const handleAssetUpdated = async (
    event: Extract<PlayersIncomingEvent, { header: { type: 'Asset Updated' } }>,
    streamEvent: StreamEventFn
): Promise<void> => {
    const content = await event.getContent()
    const assetId = event.header.streamKey as AssetUUID
    const { player } = content
    if (player) {
        const library = await invalidatePlayerLibrary(player)
        await emitAssetAssigned(streamEvent, player, assetId, library)
    }
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
        assets: assetArray,
        characters: Object.values(characters ?? {}),
        settings
    }
}

const emitSettingsUpdated = async (
    streamEvent: StreamEventFn,
    player: string
) => {
    const { settings } = await getLibraryAndSettings(player)
    await streamEvent({
        streamKey: player,
        update: { settings },
        header: { type: 'Player Settings Updated' }
    })
}

const emitAssetAssigned = async (
    streamEvent: StreamEventFn,
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
        update: { asset: { ...asset } },
        header: { type: 'Player Asset Assigned' }
    })
}

const emitAssetRemoved = async (
    streamEvent: StreamEventFn,
    player: string,
    assetId: AssetUUID
) => {
    const assetKey = stripAssetId(assetId)
    console.log(`[emitAssetRemoved] Emitting Player Asset Removed for player=${player}, assetId=${assetId}, assetKey=${assetKey}`)
    await streamEvent({
        streamKey: player,
        update: { assetId: assetKey },
        header: { type: 'Player Asset Removed' }
    })
    console.log(`[emitAssetRemoved] Player Asset Removed event streamed for player=${player}, assetId=${assetId}`)
}

export const playersDataSource = new AssetsDataSource<PlayerSnapshot, PlayerEventUpdate, PlayersSubscribedContent>({
    dataSourceKey: 'mtw.assets.players',
    outboundBusDelivery: 'publish',
    replayable: true,
    snapshotContentGenerator: generatePlayerSnapshot,
    eventSerializer: new PlayerEventSerializer(),
    aggregator: new PlayerAggregator(),
    subscribedEventTypeGuard: isPlayersSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        await Promise.all(events.map(async (event) => {
            const streamKey = event.header.streamKey
            try {
                if (isPlayerSettingsEnvelope(event)) {
                    await processPlayerSettings(event, streamEvent)
                    return
                }
                if (isPlayersAssetRemovedEnvelope(event)) {
                    await handleAssetRemoved(event, streamEvent)
                    return
                }
                if (isPlayersAssetAddedEnvelope(event)) {
                    await handleAssetAdded(event, streamEvent)
                    return
                }
                if (isPlayersZoneUpdatedEnvelope(event)) {
                    await handleZoneUpdated(event, streamEvent)
                    return
                }
                if (isPlayersAssetUpdatedEnvelope(event)) {
                    await handleAssetUpdated(event, streamEvent)
                }
            } catch (error) {
                console.error(`mtw.assets.players: failed to process event for stream ${streamKey}`, error)
            }
        }))
    }
})

playersDataSource.subscribe()

export default playersDataSource

