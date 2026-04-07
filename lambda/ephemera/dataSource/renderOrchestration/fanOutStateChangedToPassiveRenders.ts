/**
 * Fan-out `mtw.ephemera.state` `State Changed` to passive {@link orchestrateRenderRequest} runs
 * (one per deduplicated perspective, `targets` = active characters sharing that view).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus, PublishTarget } from '../../messageBus/baseClasses'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import type { StateChangedPayload } from '../state/events'
import { resolveCanonAssetStackForRoom, type CanonAssetStackCache } from '../state/resolveAssetStackForRoom'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { RoomCharacterListItem } from '../../internalCache/baseClasses'
import internalCache from '../../internalCache'
import { orchestrateRenderRequest } from './orchestrationHandler'

/** Room canon stack order preserved; only assets also present on the character are kept. */
export const filterRoomCanonStackByCharacterAssets = (
    roomCanonStack: AssetUUID[],
    characterAssets: readonly string[]
): AssetUUID[] => {
    const set = new Set(characterAssets)
    return roomCanonStack.filter((id) => set.has(id))
}

export type CharacterPerspectiveRow = {
    characterId: EphemeraCharacterId;
    filteredAssetStack: AssetUUID[];
}

/**
 * Group characters that share the same filtered stack (same {@link computePerspectiveKey}).
 */
export const groupCharacterRowsByPerspective = (
    rows: CharacterPerspectiveRow[]
): Record<string, { assetStack: AssetUUID[]; characterIds: EphemeraCharacterId[] }> => {
    const map: Record<string, { assetStack: AssetUUID[]; characterIds: EphemeraCharacterId[] }> = rows.reduce((previous, row) => {
        const perspectiveKey = computePerspectiveKey(row.filteredAssetStack)
        return {
            ...previous,
            [perspectiveKey]: {
                assetStack: previous[perspectiveKey]?.assetStack ?? row.filteredAssetStack,
                characterIds: [...(previous[perspectiveKey]?.characterIds ?? []), row.characterId],
            },
        }
    }, {})
    return map
}

export type FanOutStateChangedDependencies = {
    resolveCanonAssetStackForRoom?: typeof resolveCanonAssetStackForRoom;
    canonStackCache?: CanonAssetStackCache;
    roomCharacterListGet?: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    characterMetaGet?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getMetaRoomBase?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    orchestrateRenderRequestFn?: typeof orchestrateRenderRequest;
};

export const fanOutStateChangedToPassiveRenders = async (
    {
        stateChanged,
        messageBus,
        streamEvent,
    }: {
        stateChanged: StateChangedPayload;
        messageBus: MessageBus;
        streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>;
    },
    deps?: FanOutStateChangedDependencies
): Promise<void> => {
    const resolveCanon = deps?.resolveCanonAssetStackForRoom ?? resolveCanonAssetStackForRoom
    const cache: CanonAssetStackCache = deps?.canonStackCache ?? {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    }
    const roomId = stateChanged.componentId

    const roomCanonStack = await resolveCanon(roomId, cache)
    const listGet = deps?.roomCharacterListGet ?? ((id: EphemeraRoomId) => internalCache.RoomCharacterList.get(id))
    const characters = await listGet(roomId)

    const characterMetaGet = deps?.characterMetaGet ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const characterMetaRows = await Promise.all(characters.map(async (character) => {
        const characterId = character.EphemeraId
        const { assets } = await characterMetaGet(characterId)
        return { characterId, assets }
    }))
    const rows = characterMetaRows.reduce<CharacterPerspectiveRow[]>((previous, { characterId, assets }) => {
        const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomCanonStack, assets)
        if (filteredAssetStack.length === 0) {
            return previous
        }
        return [...previous, { characterId, filteredAssetStack }]
    }, [])

    if (rows.length === 0) {
        return
    }

    const groups = groupCharacterRowsByPerspective(rows)
    const getMetaRoomBase = deps?.getMetaRoomBase ?? ((id: EphemeraRoomId) => internalCache.ComponentEphemeraMeta.get(id))
    const getMetaRoomMerged = async (rid: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => {
        const base = await getMetaRoomBase(rid)
        if (!base) {
            return undefined
        }
        return { ...base, state: stateChanged.newState }
    }

    const orchestrate = deps?.orchestrateRenderRequestFn ?? orchestrateRenderRequest

    await Promise.all(
        Object.values(groups)
            .map(async ({ assetStack, characterIds }) => {
                const targets = characterIds as PublishTarget[]
                await orchestrate(
                    {
                        payload: {
                            type: 'RenderRequested',
                            componentId: roomId,
                            perspective: { assetStack },
                            targets,
                        },
                        messageBus,
                        streamEvent,
                    },
                    { getMetaRoom: getMetaRoomMerged }
                )
            })
    )
}
