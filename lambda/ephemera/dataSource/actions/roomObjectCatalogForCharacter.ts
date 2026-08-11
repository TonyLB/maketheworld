import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { normalizeExitName } from './roomExitTargetsForCharacter'
import { shortNameFromComponent, shortNameFromMergedAggregate } from '../objects/objectShortName'

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
    getPositionGraph: (roomId: EphemeraRoomId) => Promise<EphemeraLudicGraph>
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
    getPositionGraph: (roomId) => internalCache.Positions.getPositionGraph(roomId),
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

    const positionGraph = await deps.getPositionGraph(roomId)
    const objectIds = [...positionGraph.objectIds]
    if (objectIds.length === 0) {
        return { roomId, entries: [] }
    }

    const characterAssets = await deps.getCharacterAssets(characterId)
    const resolvedPerspective = await deps.resolvePerspective(roomId, characterAssets)
    if (resolvedPerspective === null) {
        return { roomId, entries: [] }
    }

    const { assetStack } = resolvedPerspective
    const entries = (
        await Promise.all(objectIds.map(async (objectId): Promise<RoomInPlayObjectCatalogEntry | undefined> => {
            let shortName = await shortNameFromMergedAggregate(objectId, assetStack, deps)
            if (!shortName) {
                const pairRow = await deps.getImprovisationObject(objectId)
                shortName = shortNameFromComponent(pairRow?.component)
            }
            if (!shortName) {
                return undefined
            }
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            return { objectId, normalizedShortName }
        }))
    ).filter((entry): entry is RoomInPlayObjectCatalogEntry => entry !== undefined)

    return { roomId, entries }
}

export function roomObjectLabelsFromCatalog(entries: readonly RoomInPlayObjectCatalogEntry[]): string[] {
    return [...new Set(entries.map(({ normalizedShortName }) => normalizedShortName))]
}
