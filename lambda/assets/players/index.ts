import { AssetsDataSource } from '../dataSource/abstract'
import internalCache from '../internalCache'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerEventSerializer,
    PlayerSnapshot,
    PlayerEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import {
    AssetLevelEventUpdate,
    isAssetAddedEvent,
    isAssetCachedEvent,
    isAssetDecachedEvent,
    isAssetRemovedEvent,
    isAssetUpdatedEvent,
    isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isPlayerSettingsUpdatedEvent, PlayerSettingsUpdatedEvent } from './coordinationSerializer'

const generatePlayerSnapshot = async (playerName: string): Promise<PlayerSnapshot> => {
    const [library, settings] = await Promise.all([
        internalCache.PlayerLibrary.get(playerName),
        internalCache.PlayerSettings.get(playerName)
    ])

    const assets = Object.values(library.Assets ?? {})
    const characters = Object.values(library.Characters ?? {})
    const { onboardCompleteTags = [], guestName, guestId } = settings || {}

    updateAssetOwnership(playerName, assets)

    return {
        type: 'Snapshot',
        assets,
        characters,
        settings: {
            onboardCompleteTags,
            ...(guestName ? { guestName } : {}),
            ...(guestId ? { guestId } : {})
        }
    }
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
        isAssetAddedEvent,
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

// NOTE: This ownership map is a stopgap accelerator while we still emit full player snapshots.
// It mirrors the current runtime's best knowledge of which player owns a given asset so we can
// skip repeated Dynamo lookups during the transition period. Because lambdas scale horizontally,
// it can go stale; we fall back to metadata queries when needed. Once we refactor the player data
// source to stream granular delta events (and remove full-snapshot streaming), we should delete
// this cache and rely solely on the delta contracts.
const assetOwnershipCache = new Map<string, Set<string>>()

function updateAssetOwnership(playerName: string, assets: { AssetId: string }[]) {
    const assetIds = new Set(assets.map(({ AssetId }) => AssetId))
    // Remove stale entries for this player
    for (const [assetId, owners] of assetOwnershipCache.entries()) {
        if (owners.has(playerName) && !assetIds.has(assetId)) {
            owners.delete(playerName)
            if (owners.size === 0) {
                assetOwnershipCache.delete(assetId)
            }
        }
    }
    assetIds.forEach((assetId) => {
        const owners = assetOwnershipCache.get(assetId) ?? new Set<string>()
        owners.add(playerName)
        assetOwnershipCache.set(assetId, owners)
    })
}

const playersForAsset = async (assetId: AssetUUID, event: AssetLevelEventUpdate): Promise<string[]> => {
    const owners = new Set<string>()

    const cachedOwners = assetOwnershipCache.get(assetId)
    if (cachedOwners) {
        cachedOwners.forEach((owner) => owners.add(owner))
    }

    // Some Zone Updated events include a player hint
    const potentialPlayer = (event as unknown as { player?: string }).player
    if (typeof potentialPlayer === 'string') {
        owners.add(potentialPlayer)
    }

    if (owners.size === 0) {
        const [meta] = await internalCache.AssetMetaData.get([assetId])
        if (meta?.player) {
            owners.add(meta.player)
        }
    }

    return [...owners]
}

const emitPlayerUpdate = async (streamEvent: (params: { update: PlayerEventUpdate; streamKey: string }) => Promise<void>, playerName: string) => {
    const [library, settings] = await Promise.all([
        internalCache.PlayerLibrary.get(playerName),
        internalCache.PlayerSettings.get(playerName)
    ])

    const assets = Object.values(library.Assets ?? {})
    const characters = Object.values(library.Characters ?? {})
    const { onboardCompleteTags = [], guestName, guestId } = settings || {}

    updateAssetOwnership(playerName, assets)

    const update: PlayerEventUpdate = {
        type: 'Player Library Updated',
        assets,
        characters,
        settings: {
            onboardCompleteTags,
            ...(guestName ? { guestName } : {}),
            ...(guestId ? { guestId } : {})
        }
    }

    await streamEvent({
        streamKey: playerName,
        update
    })
}

export const playersDataSource = new AssetsDataSource<PlayerSnapshot, PlayerEventUpdate, PlayersSubscribedEvent>({
    dataSourceKey: 'mtw.assets.players',
    replayable: true,
    snapshotContentGenerator: generatePlayerSnapshot,
    eventSerializer: new PlayerEventSerializer(),
    subscribedEventTypeGuard,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            try {
                if (isInternalPlayerEvent(event)) {
                    await emitPlayerUpdate(streamEvent, event.streamKey)
                    return
                }

                if (isAssetsStreamEvent(event)) {
                    const affectedPlayers = await playersForAsset(event.streamKey, event.event)
                    if (affectedPlayers.length === 0) {
                        return
                    }
                    await Promise.all(affectedPlayers.map((player) => emitPlayerUpdate(streamEvent, player)))
                }
            } catch (error) {
                console.error(`mtw.assets.players: failed to process event for stream ${event.streamKey}`, error)
            }
        }))
    }
})

playersDataSource.subscribe()

export default playersDataSource

