import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/**
 * Shared component shortName resolution --- extracted from `actions/roomObjectCatalogForCharacter.ts` so
 * `renderCache/ensureObjectShortNameCacheRecord.ts` (the Object description stub) can resolve the same
 * perspective-merged shortName without duplicating the asset-merge logic. `shortName` is a member of
 * `StandardComponent` itself, not Object-specific, so any component kind resolves the same way.
 */
export const shortNameFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!component?.shortName) {
        return undefined
    }
    const shortName = shortNameToJSON(component.shortName)
    return typeof shortName === 'string' ? shortName : undefined
}

/**
 * Live shortName resolution for any cache-kind host, via the merged aggregate only. `getAcrossAssets`
 * already routes `ASSET#IMPROVISATION` through the same ephemeraDB pair-row table a separate
 * improvisation lookup would read (`EphemeraComponentDataCompositeCache`) --- a second fallback read
 * would only ever fire when this one already found nothing anywhere in the stack, so there is none.
 * `appendImprovisationToPerspective` only accepts Object/Character ids (improvisation never applies
 * to Room/Feature/Area), so other kinds pass `assetStack` straight through as the participation order.
 */
export const resolveComponentShortName = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<string | undefined> => {
    const mergeParticipationOrder = isEphemeraObjectId(hostId) || isEphemeraCharacterId(hostId)
        ? appendImprovisationToPerspective([...assetStack] as AssetUUID[], [hostId])
        : [...assetStack] as AssetUUID[]
    const perspective = aggregatePerspectiveExplicit({
        universalKey: hostId,
        mergeParticipationOrder,
    })
    const aggregateResults = await deps.getComponentAggregate([perspective])
    return shortNameFromComponent(aggregateResults[0]?.merged)
}

/** Thin Object-typed wrapper over {@link resolveComponentShortName} for existing Object-only callers. */
export const resolveObjectShortName = (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<string | undefined> => resolveComponentShortName(objectId, assetStack, deps)
