/**
 * Fan-out room affordance refresh to one orchestration run per distinct occupant perspective.
 *
 * Used from inside mtw.ephemera.affordanceOrchestration receiveEvents (e.g. Objects Changed).
 * External callers outside the DataSource use sendAffordanceRefreshRequestedForRoom instead.
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { getRoomCharacterList } from '../../internalCache/hydrateRoomRoster'
import internalCache from '../../internalCache'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { RoomCharacterListItem } from '../../internalCache/baseClasses'
import {
    filterRoomCanonStackByCharacterAssets,
    groupCharacterRowsByPerspective,
    type CharacterPerspectiveRow,
} from '../renderOrchestration/fanOutStateChangedToPassiveRenders'
import {
    resolveCanonAssetStackForRoom,
    resolveRoomAssetStackForRoom,
    type CanonAssetStackCache,
} from '../state/resolveAssetStackForRoom'
import type { AffordanceOrchestrationReason } from './localApiEvents'
import type { AffordanceOrchestrationPublishedPayload } from './publishedEvents'
import { orchestrateAffordanceRequest } from './orchestrationHandler'

export type AffordanceRefreshPerspectiveGroup = {
    assetStack: AssetUUID[];
}

export type ResolveAffordanceRefreshGroupsDependencies = {
    resolveRoomAssetStackForRoom?: typeof resolveRoomAssetStackForRoom;
    resolveCanonAssetStackForRoom?: typeof resolveCanonAssetStackForRoom;
    canonStackCache?: CanonAssetStackCache;
    roomCharacterListGet?: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    characterMetaGet?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
}

export const resolveAffordanceRefreshGroupsForRoom = async (
    roomId: EphemeraRoomId,
    deps?: ResolveAffordanceRefreshGroupsDependencies
): Promise<AffordanceRefreshPerspectiveGroup[]> => {
    const resolveRoomStack = deps?.resolveRoomAssetStackForRoom ?? resolveRoomAssetStackForRoom
    const resolveCanon = deps?.resolveCanonAssetStackForRoom ?? resolveCanonAssetStackForRoom
    const cache: CanonAssetStackCache = deps?.canonStackCache ?? {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    }
    const listGet = deps?.roomCharacterListGet ?? getRoomCharacterList
    const characterMetaGet = deps?.characterMetaGet ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))

    const roomAssetStack = await resolveRoomStack(roomId, {
        RoomAssets: cache.RoomAssets,
    })
    const roomCanonStack = await resolveCanon(roomId, cache)
    const characters = await listGet(roomId)

    const characterMetaRows = await Promise.all(characters.map(async (character) => {
        const characterId = character.EphemeraId as EphemeraCharacterId
        const { assets = [] } = (await characterMetaGet(characterId)) || {}
        return { characterId, assets }
    }))
    const rows = characterMetaRows.reduce<CharacterPerspectiveRow[]>((previous, { characterId, assets }) => {
        const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, assets, roomCanonStack)
        if (filteredAssetStack.length === 0) {
            return previous
        }
        return [...previous, { characterId, filteredAssetStack }]
    }, [])

    const groups = groupCharacterRowsByPerspective(rows)
    return Object.values(groups).map(({ assetStack }) => ({ assetStack }))
}

export type FanOutAffordanceRefreshDependencies = ResolveAffordanceRefreshGroupsDependencies & {
    orchestrateAffordanceRequestFn?: typeof orchestrateAffordanceRequest;
}

export const fanOutAffordanceRefreshForRoom = async (
    {
        roomId,
        reason,
        streamEvent,
    }: {
        roomId: EphemeraRoomId;
        reason: AffordanceOrchestrationReason;
        streamEvent: StreamEventFunction<AffordanceOrchestrationPublishedPayload>;
    },
    deps?: FanOutAffordanceRefreshDependencies
): Promise<void> => {
    const groups = await resolveAffordanceRefreshGroupsForRoom(roomId, deps)
    if (groups.length === 0) {
        return
    }

    const orchestrate = deps?.orchestrateAffordanceRequestFn ?? orchestrateAffordanceRequest

    await Promise.all(
        groups.map(async ({ assetStack }) => {
            await orchestrate(
                {
                    payload: {
                        type: 'AffordancesRequested',
                        roomId,
                        perspective: { assetStack },
                        reason,
                    },
                    streamEvent,
                },
            )
        })
    )
}
