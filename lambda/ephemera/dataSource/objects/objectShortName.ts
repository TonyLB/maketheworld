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
