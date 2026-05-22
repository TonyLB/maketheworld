import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import {
    getLensMarksWithDefaults,
    type LensMarkWithDefault,
} from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import {
    aggregatePerspectiveExplicit,
    type AggregatePerspective,
    type MergeParticipationOrder,
} from '../aggregate/input'
import type { MergedComponentResult } from '../aggregate/result'

export type CacheHostWithSituationFacets = StandardRoom | StandardFeature | StandardKnowledge

export function isCacheHostWithSituationFacets(
    component: StandardComponent
): component is CacheHostWithSituationFacets {
    return (
        component instanceof StandardRoom ||
        component instanceof StandardFeature ||
        component instanceof StandardKnowledge
    )
}

export function collectSituationIdsFromHostAuthoritative(
    authoritative: AuthoritativeComponentData
): ComponentUUID[] {
    const ids = new Set<ComponentUUID>()
    for (const { component } of authoritative.byAssets) {
        if (!isCacheHostWithSituationFacets(component)) {
            continue
        }
        for (const facet of component.situations?.items ?? []) {
            const situationId = (facet as StandardSituationProseFacet).reference?.universalKey
            if (situationId) {
                ids.add(situationId as ComponentUUID)
            }
        }
    }
    return [...ids]
}

export function collectLensUniversalKeyFromRoomAuthoritative(
    authoritative: AuthoritativeComponentData
): ComponentUUID | undefined {
    for (const { component } of authoritative.byAssets) {
        if (!(component instanceof StandardRoom)) {
            continue
        }
        const lensId = component.lens?.payload?.[0]?.universalKey as ComponentUUID | undefined
        if (lensId) {
            return lensId
        }
    }
    return undefined
}

export type BuildComponentExamplesPerspectivesArgs = {
    hostUniversalKey: EphemeraId;
    mergeParticipationOrder: MergeParticipationOrder;
    hostAuthoritative: AuthoritativeComponentData;
    resolveRoomLensMarkDefaults: boolean;
}

/**
 * Perspectives for a single aggregate.get batch: host, each situation referenced on the host,
 * and optional lens (Room only).
 */
export function buildComponentExamplesPerspectives(
    args: BuildComponentExamplesPerspectivesArgs
): AggregatePerspective[] {
    const {
        hostUniversalKey,
        mergeParticipationOrder,
        hostAuthoritative,
        resolveRoomLensMarkDefaults,
    } = args

    const hostPerspective = aggregatePerspectiveExplicit({
        universalKey: hostUniversalKey,
        mergeParticipationOrder,
    })

    const situationIds = collectSituationIdsFromHostAuthoritative(hostAuthoritative)
    const situationPerspectives = situationIds.map((situationId) =>
        aggregatePerspectiveExplicit({
            universalKey: situationId,
            mergeParticipationOrder,
        })
    )

    const perspectives: AggregatePerspective[] = [hostPerspective, ...situationPerspectives]

    if (resolveRoomLensMarkDefaults) {
        const lensId = collectLensUniversalKeyFromRoomAuthoritative(hostAuthoritative)
        if (lensId) {
            // LENS# is not an EphemeraId tag but ComponentData stores lens rows by universal key.
            perspectives.push(
                Object.freeze({
                    universalKey: lensId as EphemeraId,
                    mergeParticipationOrder,
                })
            )
        }
    }

    return perspectives
}

export function mergedResultsByUniversalKey(
    results: readonly MergedComponentResult[]
): Map<EphemeraId, MergedComponentResult> {
    return new Map(results.map((r) => [r.universalKey, r]))
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
