import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    IMPROVISATION_ASSET_ID,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import type { RoomInPlayObjectCatalogEntry } from './roomObjectCatalogForCharacter'
import { normalizeExitName } from './roomExitTargetsForCharacter'

export type HeldInventoryCatalogForCharacter = {
    entries: RoomInPlayObjectCatalogEntry[]
}

export type HeldInventoryCatalogDeps = {
    getLudicGraph: (characterId: EphemeraCharacterId) => Promise<EphemeraLudicGraph>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    getComponentAggregate: ComponentAggregateMergedCache['get']
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): HeldInventoryCatalogDeps => ({
    getLudicGraph: (characterId) => internalCache.Positions.getLudicGraph(characterId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

const shortNameFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!(component instanceof StandardObject) || !component.shortName) {
        return undefined
    }
    const shortName = shortNameToJSON(component.shortName)
    return typeof shortName === 'string' ? shortName : undefined
}

const shortNameFromMergedAggregate = async (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: Pick<HeldInventoryCatalogDeps, 'getComponentAggregate'>
): Promise<string | undefined> => {
    const mergeParticipationOrder = appendImprovisationToPerspective([...assetStack] as AssetUUID[], [objectId])
    const perspective = aggregatePerspectiveExplicit({
        universalKey: objectId,
        mergeParticipationOrder,
    })
    const aggregateResults = await deps.getComponentAggregate([perspective])
    return shortNameFromComponent(aggregateResults[0]?.merged)
}

/**
 * Merged-layer held inventory catalog for object-manipulation identity stage (O5).
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

    return { entries }
}
