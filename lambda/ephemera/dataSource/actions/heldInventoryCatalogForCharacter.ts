import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../internalCache'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { presencesHolding } from '../positions/ludicGraph/presenceSubGraph'
import type { RoomInPlayObjectCatalogEntry } from './roomObjectCatalogForCharacter'
import { normalizeExitName } from './roomExitTargetsForCharacter'
import { resolveComponentShortName } from '../objects/objectShortName'

export type HeldInventoryCatalogForCharacter = {
    entries: RoomInPlayObjectCatalogEntry[]
}

export type HeldInventoryCatalogDeps = {
    getLudicGraph: (characterId: EphemeraCharacterId) => Promise<EphemeraLudicGraph>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    getComponentAggregate: ComponentAggregateMergedCache['get']
}

const defaultDeps = (): HeldInventoryCatalogDeps => ({
    getLudicGraph: (characterId) => internalCache.Positions.getLudicGraph(characterId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
})

/**
 * Merged-layer held inventory catalog for object-manipulation identity stage (O5).
 *
 * A held thing is seen in the character's own buckets, so each entry's `presence` is every
 * binding of the character's graph that holds it (`presencesHolding`).
 */
export async function getHeldInventoryCatalogForCharacter(
    characterId: EphemeraCharacterId,
    partialDeps: Partial<HeldInventoryCatalogDeps> = {}
): Promise<HeldInventoryCatalogForCharacter> {
    const deps: HeldInventoryCatalogDeps = { ...defaultDeps(), ...partialDeps }
    const ludicGraph = await deps.getLudicGraph(characterId)
    const objectIds = [...ludicGraph.objectIds]
    if (objectIds.length === 0) {
        return { entries: [] }
    }

    const assetStack = await deps.getCharacterAssets(characterId)
    const entries = (
        await Promise.all(objectIds.map(async (objectId): Promise<RoomInPlayObjectCatalogEntry | undefined> => {
            const shortName = await resolveComponentShortName(objectId, assetStack, deps)
            if (!shortName) {
                return undefined
            }
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            const presence = presencesHolding(ludicGraph, objectId)
            return { objectId, normalizedShortName, ...(presence !== undefined ? { presence } : {}) }
        }))
    ).filter((entry): entry is RoomInPlayObjectCatalogEntry => entry !== undefined)

    return { entries }
}
