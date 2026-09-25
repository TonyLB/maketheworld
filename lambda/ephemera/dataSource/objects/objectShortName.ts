import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { glossToJSON } from '@tonylb/mtw-wml/ts/standardize/components/glossField'
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
 * `gloss` counterpart to {@link shortNameFromComponent} (reasoningGloss slice 5). `Gloss` is optional on
 * every kind (RG-2), so absence here is as valid as a resolved string --- there is no separate "unresolved"
 * sentinel to track.
 */
export const glossFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!component?.gloss) {
        return undefined
    }
    const gloss = glossToJSON(component.gloss)
    return typeof gloss === 'string' ? gloss : undefined
}

/**
 * The merged-aggregate read shared by {@link resolveComponentShortName} and
 * {@link resolveComponentCacheFields} --- one perspective fetch, however many fields a caller resolves
 * off the result. `getAcrossAssets` already routes `ASSET#IMPROVISATION` through the same ephemeraDB
 * pair-row table a separate improvisation lookup would read (`EphemeraComponentDataCompositeCache`) ---
 * a second fallback read would only ever fire when this one already found nothing anywhere in the
 * stack, so there is none. `appendImprovisationToPerspective` only accepts Object/Character ids
 * (improvisation never applies to Room/Feature/Area), so other kinds pass `assetStack` straight through
 * as the participation order.
 */
const resolveMergedComponent = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<StandardComponent | undefined> => {
    const mergeParticipationOrder = isEphemeraObjectId(hostId) || isEphemeraCharacterId(hostId)
        ? appendImprovisationToPerspective([...assetStack] as AssetUUID[], [hostId])
        : [...assetStack] as AssetUUID[]
    const perspective = aggregatePerspectiveExplicit({
        universalKey: hostId,
        mergeParticipationOrder,
    })
    const aggregateResults = await deps.getComponentAggregate([perspective])
    return aggregateResults[0]?.merged
}

/** Live shortName resolution for any cache-kind host, via the merged aggregate only. */
export const resolveComponentShortName = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<string | undefined> => shortNameFromComponent(await resolveMergedComponent(hostId, assetStack, deps))

/**
 * `shortName` and `gloss` off one merged-aggregate read (reasoningGloss slice 5) --- for callers that
 * want both, so resolving `gloss` alongside `shortName` costs no extra aggregate fetch.
 */
export const resolveComponentCacheFields = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<{ shortName?: string; gloss?: string }> => {
    const component = await resolveMergedComponent(hostId, assetStack, deps)
    return { shortName: shortNameFromComponent(component), gloss: glossFromComponent(component) }
}

/** Thin Object-typed wrapper over {@link resolveComponentShortName} for existing Object-only callers. */
export const resolveObjectShortName = (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: { getComponentAggregate: ComponentAggregateMergedCache['get'] }
): Promise<string | undefined> => resolveComponentShortName(objectId, assetStack, deps)
