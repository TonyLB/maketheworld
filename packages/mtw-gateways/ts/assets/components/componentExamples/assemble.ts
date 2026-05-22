import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardSituationProseFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import { AggregateInputError } from '../aggregate/input'

import { authoredExampleFromSituationFacet } from './enrichment'
import {
    defaultResolveRoomLensMarkDefaults,
    validateAssembleComponentExamplesInput,
    type AssembleComponentExamplesInput,
} from './input'
import type { ComponentExamplesAggregatePort } from './ports'
import {
    buildComponentExamplesPerspectives,
    collectLensUniversalKeyFromRoomAuthoritative,
    isCacheHostWithSituationFacets,
    mergedResultsByUniversalKey,
    resolveLensMarksForMergedRoom,
} from './perspectives'
import {
    authoredExampleSetFromEntries,
    emptyAuthoredExampleSet,
    type AuthoredExampleSet,
} from './result'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

export type AssembleComponentExamplesAtPerspectiveArgs = {
    input: AssembleComponentExamplesInput;
    aggregate: ComponentExamplesAggregatePort;
    /**
     * Supplies authoritative host rows for perspective discovery (situation + lens ids).
     * Ephemera/diagnostics wire this to ComponentData.get([host]).
     */
    getAuthoritative: (hostUniversalKey: EphemeraId) => Promise<AuthoritativeComponentData>;
}

/**
 * Batch assembly of all situation facets on a cache-host at one participation order (A3).
 */
export async function assembleComponentExamplesAtPerspective(
    args: AssembleComponentExamplesAtPerspectiveArgs
): Promise<AuthoredExampleSet> {
    const { input, aggregate, getAuthoritative } = args
    const validated = validateAssembleComponentExamplesInput(input)
    const { hostUniversalKey, mergeParticipationOrder, options } = validated

    const resolveRoomLensMarkDefaults =
        options?.resolveRoomLensMarkDefaults ?? defaultResolveRoomLensMarkDefaults(hostUniversalKey)

    const hostAuthoritative = await getAuthoritative(hostUniversalKey)
    if (hostAuthoritative.ComponentId !== hostUniversalKey) {
        throw new AggregateInputError(
            `Authoritative ComponentId ${hostAuthoritative.ComponentId} does not match host ${hostUniversalKey}`
        )
    }

    const perspectives = buildComponentExamplesPerspectives({
        hostUniversalKey,
        mergeParticipationOrder,
        hostAuthoritative,
        resolveRoomLensMarkDefaults,
    })

    const results = await aggregate.get(perspectives)
    const resultsByKey = mergedResultsByUniversalKey(results)

    const hostResult = resultsByKey.get(hostUniversalKey)
    if (!hostResult || !isCacheHostWithSituationFacets(hostResult.merged)) {
        return emptyAuthoredExampleSet()
    }

    const mergedHost = hostResult.merged
    const facets = mergedHost.situations?.items ?? []
    if (facets.length === 0) {
        return emptyAuthoredExampleSet()
    }

    const lensMarks =
        mergedHost instanceof StandardRoom
            ? resolveLensMarksForMergedRoom(
                  mergedHost,
                  (() => {
                      const lensId = collectLensUniversalKeyFromRoomAuthoritative(hostAuthoritative)
                      return lensId ? resultsByKey.get(lensId as EphemeraId)?.merged : undefined
                  })()
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
