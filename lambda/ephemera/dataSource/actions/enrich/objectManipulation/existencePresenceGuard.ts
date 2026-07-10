import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanCandidateLocus } from './spanResolution'
import { locusToCatalogScope } from './unaryCollapse'

export type ExistencePresenceGuardResult =
    | { type: 'ok' }
    | { type: 'error'; reason: string }

/**
 * Post-selection referential integrity (FT-5 phase 2): chosen id exists in ingress
 * catalogs and claimed locus matches catalog scope.
 */
export function existencePresenceGuard(
    candidate: IdentityPlanCandidate,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ExistencePresenceGuardResult {
    const entry = catalog.find((item) => item.objectId === candidate.identity.objectId)
    if (entry === undefined) {
        return {
            type: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        }
    }

    const expectedScope = locusToCatalogScope(candidate.identity.locus)
    if (entry.catalogScope !== expectedScope) {
        return {
            type: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        }
    }

    if (!locusMatchesV1Scope(candidate.identity.locus, entry.catalogScope)) {
        return {
            type: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        }
    }

    return { type: 'ok' }
}

function locusMatchesV1Scope(
    locus: SpanCandidateLocus,
    catalogScope: ObjectManipulationCatalogEntry['catalogScope']
): boolean {
    if (catalogScope === 'room') {
        return locus.kind === 'room'
    }
    return locus.kind === 'heldByActor'
}

export function catalogContainsObjectId(
    catalog: readonly ObjectManipulationCatalogEntry[],
    objectId: EphemeraObjectId
): boolean {
    return catalog.some((entry) => entry.objectId === objectId)
}
