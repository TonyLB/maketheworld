import type { ObjectManipulationCatalogEntry } from '../../actorObjectCatalog'
import { normalizeExitName } from '../../normalizeExitName'
import type { ParseCommandErrorResult } from '../../baseClasses'
import type { ParseSkeleton } from './parse/parseToken'
import { spanMatchForms } from './spanMatchForms'

export const conceptErrorMessages = {
    notPhysical: "That's not a physical thing.",
} as const

/**
 * The name-only refusal for a Concept (AK-8, option B): a Concept is never a referent, so a span that finds no
 * physical match but names one exactly (short name, leading article peeled) is refused kindly rather than "not
 * understood". A small replaceable seam, not a general mechanism: the user expects to elaborate it as error
 * reporting is upgraded. A span a catalog entry also matches exactly is a real object's, and the Concept never
 * competes with it. Exit spans are not checked.
 */
export const conceptRefusalFor = (
    skeletons: readonly ParseSkeleton[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    conceptNames: readonly string[]
): ParseCommandErrorResult | undefined => {
    const concepts = new Set(conceptNames.map(normalizeExitName))
    const objects = new Set(catalog.map(({ normalizedShortName }) => normalizedShortName))
    const named = skeletons.some((skeleton) => skeleton.some((token) => {
        if (token.type !== 'objectSpan' || token.catalog === 'exits') {
            return false
        }
        const forms = spanMatchForms(token.span)
        return forms.some((form) => concepts.has(form)) && !forms.some((form) => objects.has(form))
    }))
    return named ? { type: 'Error', errorMessage: conceptErrorMessages.notPhysical } : undefined
}
