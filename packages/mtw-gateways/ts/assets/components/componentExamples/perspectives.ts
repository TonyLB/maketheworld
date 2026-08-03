import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import {
    getLensMarksWithDefaults,
    type LensMarkWithDefault,
} from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'

import {
    aggregatePerspectiveExplicit,
    type AggregatePerspective,
    type MergeParticipationOrder,
} from '../aggregate/input'
import type { MergedComponentResult } from '../aggregate/result'

export type CacheHostWithSituationFacets =
    | StandardRoom
    | StandardFeature
    | StandardKnowledge
    | StandardObject
    | StandardCharacter

export function isCacheHostWithSituationFacets(
    component: StandardComponent
): component is CacheHostWithSituationFacets {
    return (
        component instanceof StandardRoom ||
        component instanceof StandardFeature ||
        component instanceof StandardKnowledge ||
        component instanceof StandardObject ||
        component instanceof StandardCharacter
    )
}

/** Situation facet targets on the merged cache-host at this participation order. */
export function collectSituationIdsFromMergedHost(host: CacheHostWithSituationFacets): ComponentUUID[] {
    const ids = new Set<ComponentUUID>()
    for (const facet of host.situations?.items ?? []) {
        const situationId = (facet as StandardSituationProseFacet).reference?.universalKey
        if (situationId) {
            ids.add(situationId as ComponentUUID)
        }
    }
    return [...ids]
}

export function collectLensUniversalKeyFromMergedRoom(room: StandardRoom): ComponentUUID | undefined {
    return room.lens?.payload?.[0]?.universalKey as ComponentUUID | undefined
}

export type BuildDependentsPerspectivesArgs = {
    situationIds: readonly ComponentUUID[];
    lensId?: ComponentUUID;
    mergeParticipationOrder: MergeParticipationOrder;
}

/**
 * Perspectives for the second aggregate.get batch (situations + optional lens; host omitted).
 */
export function buildDependentsPerspectives(args: BuildDependentsPerspectivesArgs): AggregatePerspective[] {
    const { situationIds, lensId, mergeParticipationOrder } = args

    const perspectives = situationIds.map((situationId) =>
        aggregatePerspectiveExplicit({
            universalKey: situationId,
            mergeParticipationOrder,
        })
    )

    return lensId
        ? [
              ...perspectives,
              Object.freeze({
                  universalKey: lensId as EphemeraId,
                  mergeParticipationOrder,
              }),
          ]
        : perspectives
}

export function mergedResultsByUniversalKey(
    results: readonly MergedComponentResult[]
): Map<EphemeraId, MergedComponentResult> {
    return new Map(results.map((r) => [r.universalKey, r]))
}

export function mergeResultsByUniversalKey(
    ...resultSets: readonly (readonly MergedComponentResult[])[]
): Map<EphemeraId, MergedComponentResult> {
    const map = new Map<EphemeraId, MergedComponentResult>()
    for (const results of resultSets) {
        for (const r of results) {
            map.set(r.universalKey, r)
        }
    }
    return map
}

export function resolveLensMarksForMergedRoom(
    mergedRoom: StandardRoom,
    lensMerged: StandardComponent | undefined
): LensMarkWithDefault[] | undefined {
    const lensId = mergedRoom.lens?.payload?.[0]?.universalKey
    if (!lensId || !(lensMerged instanceof StandardLens)) {
        return undefined
    }
    return getLensMarksWithDefaults(lensMerged)
}
