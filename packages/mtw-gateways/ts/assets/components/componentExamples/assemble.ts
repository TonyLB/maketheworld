import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import { aggregatePerspectiveExplicit } from '../aggregate/input'

import { authoredExampleFromSituationFacet } from './enrichment'
import {
    defaultResolveRoomLensMarkDefaults,
    validateAssembleComponentExamplesInput,
    type AssembleComponentExamplesInput,
} from './input'
import type { ComponentExamplesAggregatePort } from './ports'
import {
    buildDependentsPerspectives,
    collectLensUniversalKeyFromMergedRoom,
    collectSituationIdsFromMergedHost,
    isCacheHostWithSituationFacets,
    mergeResultsByUniversalKey,
    resolveLensMarksForMergedRoom,
} from './perspectives'
import {
    authoredExampleSetFromEntries,
    emptyAuthoredExampleSet,
    type AuthoredExampleSet,
} from './result'

export type AssembleComponentExamplesAtPerspectiveArgs = {
    input: AssembleComponentExamplesInput;
    aggregate: ComponentExamplesAggregatePort;
}

/**
 * Batch assembly of all situation facets on a cache-host at one participation order (A3).
 * Discovery uses merged host from ComponentAggregate; dependents merged in a second batch.
 */
export async function assembleComponentExamplesAtPerspective(
    args: AssembleComponentExamplesAtPerspectiveArgs
): Promise<AuthoredExampleSet> {
    const { input, aggregate } = args
    const validated = validateAssembleComponentExamplesInput(input)
    const { hostUniversalKey, mergeParticipationOrder, options } = validated

    const resolveRoomLensMarkDefaults =
        options?.resolveRoomLensMarkDefaults ?? defaultResolveRoomLensMarkDefaults(hostUniversalKey)

    const hostPerspective = aggregatePerspectiveExplicit({
        universalKey: hostUniversalKey,
        mergeParticipationOrder,
    })

    const [hostResult] = await aggregate.get([hostPerspective])
    if (!hostResult || !isCacheHostWithSituationFacets(hostResult.merged)) {
        return emptyAuthoredExampleSet()
    }

    const mergedHost = hostResult.merged
    const facets = mergedHost.situations?.items ?? []
    if (facets.length === 0) {
        return emptyAuthoredExampleSet()
    }

    const situationIds = collectSituationIdsFromMergedHost(mergedHost)
    const lensId =
        resolveRoomLensMarkDefaults && mergedHost instanceof StandardRoom
            ? collectLensUniversalKeyFromMergedRoom(mergedHost)
            : undefined

    const dependentsPerspectives = buildDependentsPerspectives({
        situationIds,
        lensId,
        mergeParticipationOrder,
    })

    const dependentResults =
        dependentsPerspectives.length > 0 ? await aggregate.get(dependentsPerspectives) : []

    const resultsByKey = mergeResultsByUniversalKey([hostResult], dependentResults)

    const lensMarks =
        mergedHost instanceof StandardRoom
            ? resolveLensMarksForMergedRoom(
                  mergedHost,
                  lensId ? resultsByKey.get(lensId as EphemeraId)?.merged : undefined
              )
            : undefined

    const entries: [ComponentUUID, ReturnType<typeof authoredExampleFromSituationFacet>][] = []

    for (const facet of facets) {
        const proseFacet = facet as StandardSituationProseFacet
        const situationId = proseFacet.reference?.universalKey as ComponentUUID | undefined
        if (!situationId) {
            continue
        }

        const situationResult = resultsByKey.get(situationId as EphemeraId)
        const mergedSituation = situationResult?.merged
        if (!(mergedSituation instanceof StandardSituation)) {
            continue
        }

        entries.push([
            situationId,
            authoredExampleFromSituationFacet(
                situationId,
                mergedSituation,
                proseFacet.payload,
                lensMarks !== undefined ? { lensMarks } : undefined
            ),
        ])
    }

    if (entries.length === 0) {
        return emptyAuthoredExampleSet()
    }

    return authoredExampleSetFromEntries(entries)
}
