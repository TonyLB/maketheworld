/**
 * Fan-out `mtw.ephemera.state` `State Changed` to passive {@link orchestrateRenderRequest} runs.
 *
 * Resolve set **S = A ∪ P** (contract): **A** = deduplicated audience perspectives (`targets` = characters
 * sharing that view); **P** = keys in `Meta::Room.currentCacheByPerspective` not covered by **A** (pointer-only:
 * `allowGeneration: false`, empty `targets`). **A** wins when a perspective key appears in both.
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus, PublishTarget } from '../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import type { StateChangedPayload } from '../state/events'
import { resolveCanonAssetStackForRoom, type CanonAssetStackCache } from '../state/resolveAssetStackForRoom'
import type { CharacterMetaItem } from '../../internalCache/characterMeta'
import type { RoomCharacterListItem } from '../../internalCache/baseClasses'
import internalCache from '../../internalCache'
import { defaultGetCacheRecordById, orchestrateRenderRequest } from './orchestrationHandler'

/** Room canon stack order preserved; only assets also present on the character are kept. */
export const filterRoomCanonStackByCharacterAssets = (
    roomCanonStack: AssetUUID[],
    characterAssets: readonly string[]
): AssetUUID[] => {
    const set = new Set(characterAssets)
    return roomCanonStack.filter((id) => set.has(id))
}

/** Room canon order preserved; only assets in `requiredAssetIds` are kept (for pointer-only fan-out). */
export const filterRoomCanonStackByRequiredAssetIds = (
    roomCanonStack: AssetUUID[],
    requiredAssetIds: readonly AssetUUID[]
): AssetUUID[] => {
    const set = new Set<string>(requiredAssetIds)
    return roomCanonStack.filter((id) => set.has(id))
}

type ComputePk = typeof computePerspectiveKey

/**
 * Reconstruct `perspective.assetStack` for a meta pointer entry: canon filtered by cache row matcher,
 * then verify {@link computePerspectiveKey} matches the map key (hash is not reversible).
 */
export const assetStackForPointerOnlyPerspective = async (
    roomId: EphemeraRoomId,
    perspectiveKey: string,
    cacheId: EphemeraCacheId,
    roomCanonStack: AssetUUID[],
    getCacheRecordById: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>,
    computePk: ComputePk
): Promise<AssetUUID[] | undefined> => {
    const cacheRecord = await getCacheRecordById(roomId, cacheId)
    if (!cacheRecord) {
        return undefined
    }
    const candidate = filterRoomCanonStackByRequiredAssetIds(
        roomCanonStack,
        cacheRecord.perspectiveMatcher.requiredAssetIds
    )
    if (candidate.length === 0) {
        return undefined
    }
    if (computePk(candidate) !== perspectiveKey) {
        return undefined
    }
    return candidate
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
    getCacheRecordById?: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
    computePerspectiveKey?: ComputePk;
    orchestrateRenderRequestFn?: typeof orchestrateRenderRequest;
};

type PassiveFanOutWorkItem = {
    assetStack: AssetUUID[];
    targets: PublishTarget[];
    allowGenerationFalse: boolean;
}

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
    const computePk = deps?.computePerspectiveKey ?? computePerspectiveKey
    const getCacheRecordById = deps?.getCacheRecordById ?? defaultGetCacheRecordById
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

    const groups = groupCharacterRowsByPerspective(rows)
    const getMetaRoomBase = deps?.getMetaRoomBase ?? ((id: EphemeraRoomId) => internalCache.ComponentEphemeraMeta.get(id))
    const getMetaRoomMerged = async (rid: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => {
        const base = await getMetaRoomBase(rid)
        if (!base) {
            return undefined
        }
        return { ...base, state: stateChanged.newState }
    }

    const mergedMeta = await getMetaRoomMerged(roomId)
    const pointerMap = mergedMeta?.currentCacheByPerspective ?? {}

    const workByKey = new Map<string, PassiveFanOutWorkItem>()

    for (const { assetStack, characterIds } of Object.values(groups)) {
        const perspectiveKey = computePk(assetStack)
        workByKey.set(perspectiveKey, {
            assetStack,
            targets: characterIds as PublishTarget[],
            allowGenerationFalse: false,
        })
    }

    const audienceKeys = new Set(workByKey.keys())
    for (const perspectiveKey of Object.keys(pointerMap)) {
        if (audienceKeys.has(perspectiveKey)) {
            continue
        }
        const cacheId = pointerMap[perspectiveKey] as EphemeraCacheId | undefined
        if (cacheId === undefined) {
            continue
        }
        const assetStack = await assetStackForPointerOnlyPerspective(
            roomId,
            perspectiveKey,
            cacheId,
            roomCanonStack,
            getCacheRecordById,
            computePk
        )
        if (assetStack === undefined) {
            continue
        }
        workByKey.set(perspectiveKey, {
            assetStack,
            targets: [],
            allowGenerationFalse: true,
        })
    }

    if (workByKey.size === 0) {
        return
    }

    const orchestrate = deps?.orchestrateRenderRequestFn ?? orchestrateRenderRequest

    await Promise.all(
        [...workByKey.values()].map(async ({ assetStack, targets, allowGenerationFalse }) => {
            await orchestrate(
                {
                    payload: {
                        type: 'RenderRequested',
                        componentId: roomId,
                        perspective: { assetStack },
                        targets,
                        ...(allowGenerationFalse ? { allowGeneration: false as const } : {}),
                    },
                    messageBus,
                    streamEvent,
                },
                { getMetaRoom: getMetaRoomMerged }
            )
        })
    )
}
