import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/**
 * Shared object shortName resolution --- extracted from `actions/roomObjectCatalogForCharacter.ts` so
 * `renderCache/ensureObjectShortNameCacheRecord.ts` (the Object description stub) can resolve the same
 * perspective-merged shortName without duplicating the asset-merge logic.
 */
export const shortNameFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!(component instanceof StandardObject) || !component.shortName) {
        return undefined
    }
    const shortName = shortNameToJSON(component.shortName)
    return typeof shortName === 'string' ? shortName : undefined
}

export const shortNameFromMergedAggregate = async (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
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
 * Live shortName resolution: merged aggregate first, then the improvisation pair row --- the same
 * two-step fallback `roomObjectCatalogForCharacter.ts` and `heldInventoryCatalogForCharacter.ts`
 * already duplicate inline, and the resolution the retired `ensureObjectShortNameCacheRecord.ts`
 * stub used to perform on every look. Used as a WML-build-time fallback so Object's real
 * `ensureAuthoredCatalog` path (an authored-facet-only cache, like Feature/Knowledge/Character) never
 * regresses to a nameless Object when no `SITUATION#DEFAULT` facet has been authored yet.
 */
export const resolveObjectShortName = async (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: {
        getComponentAggregate: ComponentAggregateMergedCache['get']
        getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent } | undefined>
    }
): Promise<string | undefined> => {
    let shortName = await shortNameFromMergedAggregate(objectId, assetStack, deps)
    if (!shortName) {
        const pairRow = await deps.getImprovisationObject(objectId)
        shortName = shortNameFromComponent(pairRow?.component)
    }
    return shortName
}
