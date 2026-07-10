import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogScope } from './catalogMerge'
import { selectSingleSpanFromPool, spanResolutionErrorReason } from './selectSingleSpanFromPool'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanCandidateLocus, SpanCandidatePool } from './spanResolution'

export type UnaryCollapseResult =
    | { type: 'resolved'; objectId: EphemeraObjectId; catalogScope: ObjectManipulationCatalogScope }
    | { type: 'error'; errorMessage: string }

export const locusToCatalogScope = (locus: SpanCandidateLocus): ObjectManipulationCatalogScope => (
    locus.kind === 'heldByActor' ? 'held' : 'room'
)

/**
 * FT-2.1 bridge helper. Membership compile uses {@link selectMembershipFromPool} (FT-2.2).
 * Retained for tests and any non-membership callers of single-span bridge collapse.
 */
export function collapseUnarySpanPools(spanPools: readonly SpanCandidatePool[]): UnaryCollapseResult {
    if (spanPools.length === 0) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        }
    }

    if (spanPools.length > 1) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.ambiguousMatch,
        }
    }

    const outcome = selectSingleSpanFromPool(spanPools[0]!)
    if (outcome.verdict === 'resolved') {
        return {
            type: 'resolved',
            objectId: outcome.objectId,
            catalogScope: locusToCatalogScope(outcome.locus),
        }
    }

    return {
        type: 'error',
        errorMessage: spanResolutionErrorReason(outcome),
    }
}
