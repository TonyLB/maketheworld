import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type {
    ComponentExamplesMarkState,
    ComponentExamplesProvenance,
    ComponentExamplesRenderedContent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'

/**
 * One situation facet on a cache-host component, merged at a participation order.
 * Identified by (host, situationId, mergeParticipationOrder) -- not a standalone example id.
 */
export type AuthoredExample = {
    situationId: ComponentUUID;
    markState: ComponentExamplesMarkState;
    renderedContent: ComponentExamplesRenderedContent;
    provenance: ComponentExamplesProvenance;
}

/** Hydrate desired set keyed by situationId (H5). */
export type AuthoredExampleSet = ReadonlyMap<ComponentUUID, AuthoredExample>

export function emptyAuthoredExampleSet(): AuthoredExampleSet {
    return new Map()
}

export function authoredExampleSetFromEntries(
    entries: readonly (readonly [ComponentUUID, AuthoredExample])[]
): AuthoredExampleSet {
    const situationIds = entries.map(([situationId]) => situationId)
    const duplicateSituationId = situationIds.find(
        (situationId, index) => situationIds.indexOf(situationId) !== index
    )
    if (duplicateSituationId !== undefined) {
        throw new Error(`Duplicate situationId in AuthoredExampleSet: ${duplicateSituationId}`)
    }

    const keyMismatch = entries.find(
        ([situationId, example]) => example.situationId !== situationId
    )
    if (keyMismatch !== undefined) {
        const [situationId, example] = keyMismatch
        throw new Error(
            `AuthoredExample.situationId (${example.situationId}) does not match map key (${situationId})`
        )
    }

    return new Map(entries)
}

export function authoredExampleSetSituationIds(set: AuthoredExampleSet): ComponentUUID[] {
    return [...set.keys()]
}
