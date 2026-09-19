import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { ludicCacheObjectHandles } from '../positions/ludicCache/catalogHandles'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { normalizeExitName } from './roomExitTargetsForCharacter'

export type RoomInPlayObjectCatalogEntry = {
    objectId: EphemeraObjectId
    normalizedShortName: string
    /** Pre-attached at parse ingress via handleParseRequested (EM-6). */
    embedding?: SemanticEmbedding
}

export type RoomObjectCatalogForCharacter = {
    roomId: EphemeraRoomId | null
    entries: RoomInPlayObjectCatalogEntry[]
}

export type RoomObjectCatalogDeps = {
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<string[]>
    /** Passed straight through to `ludicCacheObjectHandles` --- any host in the rebuild's walk, not just the seed room. */
    getLudicGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    resolvePerspective: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ assetStack: readonly string[] } | null>
    getComponentAggregate: ComponentAggregateMergedCache['get']
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): RoomObjectCatalogDeps => ({
    getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
    resolvePerspective: async (roomId, characterAssets) => {
        const resolved = await resolveCharacterRoomPerspectiveForRoom(roomId, characterAssets)
        if (resolved === null) {
            return null
        }
        return { assetStack: resolved.perspective.assetStack }
    },
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

/**
 * Merged-layer in-room object catalog for classify, enrich, and deterministic resolve (D6).
 *
 * **Rebuild Slice 4:** the candidate pool is now built from `ludicCache` (`catalogHandles.ts`)
 * rather than a flat `collectNestedObjectIds` walk --- see this file's `AGENT.md` "Known gap"
 * paragraph for what is (still, deliberately) exhaustive rather than presence-bucket-filtered
 * about this. `assetStack` must be resolved before the cache walk, since `buildLudicCache` needs
 * it to resolve object shortNames inline --- unlike the old flat walk, there is no way to learn
 * whether the room has any objects before knowing the character's perspective.
 */
export async function getRoomObjectCatalogForCharacter(
    characterId: EphemeraCharacterId,
    partialDeps: Partial<RoomObjectCatalogDeps> = {}
): Promise<RoomObjectCatalogForCharacter> {
    const deps: RoomObjectCatalogDeps = { ...defaultDeps(), ...partialDeps }
    const containers = await deps.getMembershipContainers(characterId)
    const roomId = containers[0]
    if (!roomId || !isEphemeraRoomId(roomId)) {
        return { roomId: null, entries: [] }
    }

    const characterAssets = await deps.getCharacterAssets(characterId)
    const resolvedPerspective = await deps.resolvePerspective(roomId, characterAssets)
    if (resolvedPerspective === null) {
        return { roomId, entries: [] }
    }

    const { assetStack } = resolvedPerspective
    const handles = await ludicCacheObjectHandles(roomId, assetStack, {
        getLudicGraph: deps.getLudicGraph,
        getComponentAggregate: deps.getComponentAggregate,
        getImprovisationObject: deps.getImprovisationObject,
    })

    const entries = handles
        .map(({ objectId, shortName }): RoomInPlayObjectCatalogEntry | undefined => {
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            return { objectId, normalizedShortName }
        })
        .filter((entry): entry is RoomInPlayObjectCatalogEntry => entry !== undefined)

    return { roomId, entries }
}

export function roomObjectLabelsFromCatalog(entries: readonly RoomInPlayObjectCatalogEntry[]): string[] {
    return [...new Set(entries.map(({ normalizedShortName }) => normalizedShortName))]
}
