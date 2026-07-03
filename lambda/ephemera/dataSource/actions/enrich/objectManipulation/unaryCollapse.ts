import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogScope } from './catalogMerge'
import type { SpanGrounding } from './identityStage'
import {
    objectManipulationErrorMessageForResolution,
    objectManipulationErrorMessages,
} from './resolveObjectSpan'

export type UnaryCollapseResult =
    | { type: 'resolved'; objectId: EphemeraObjectId; catalogScope: ObjectManipulationCatalogScope }
    | { type: 'error'; errorMessage: string }

function groundingToResolutionError(grounding: SpanGrounding): string {
    if (grounding.type === 'noCatalog') {
        return objectManipulationErrorMessageForResolution({ type: 'NoCatalog' })
    }
    if (grounding.type === 'noMatch') {
        return objectManipulationErrorMessageForResolution({ type: 'NoMatch' })
    }
    return objectManipulationErrorMessageForResolution({ type: 'AmbiguousMatch' })
}

export function collapseUnaryGrounding(spanGroundings: readonly SpanGrounding[]): UnaryCollapseResult {
    const resolved = spanGroundings.filter((g): g is Extract<SpanGrounding, { type: 'resolved' }> => g.type === 'resolved')

    if (resolved.length === 0) {
        const first = spanGroundings[0]
        if (first !== undefined && first.type !== 'resolved') {
            return { type: 'error', errorMessage: groundingToResolutionError(first) }
        }
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        }
    }

    if (resolved.length > 1) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.ambiguousMatch,
        }
    }

    const unresolved = spanGroundings.some((g) => g.type !== 'resolved')
    if (unresolved) {
        const firstUnresolved = spanGroundings.find((g) => g.type !== 'resolved')
        if (firstUnresolved !== undefined) {
            return { type: 'error', errorMessage: groundingToResolutionError(firstUnresolved) }
        }
    }

    const sole = resolved[0]
    return {
        type: 'resolved',
        objectId: sole.objectId,
        catalogScope: sole.catalogScope,
    }
}
