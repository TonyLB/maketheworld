import type { ManipulationVerbClass } from '../../baseClasses'
import {
    identityPlanCandidateFromSpan,
    membershipOperationKindFromLocus,
    membershipOperationKindFromVerbClass,
    type IdentityPlanCandidate,
} from './identityPlanCandidate'
import type { ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'

export type ProposeMembershipTuplesInput = {
    pool: SpanCandidatePool
    /** When present, every candidate is proposed with the verb-derived operation (illegal-if-wrong). */
    verbClass?: ManipulationVerbClass
}

/**
 * Deterministic membership propose-N (FT-2.2).
 * verbClass present -> same intended op on all v1-locus candidates (legality filters).
 * verbClass absent -> locus-derived op per candidate.
 */
export function proposeMembershipTuples(
    input: ProposeMembershipTuplesInput
): IdentityPlanCandidate[] {
    const { pool, verbClass } = input
    const source = pool.shortlist ?? pool.candidates
    if (source.length === 0) {
        return []
    }

    const intendedOp = verbClass !== undefined
        ? membershipOperationKindFromVerbClass(verbClass)
        : undefined

    const tuples: IdentityPlanCandidate[] = []
    for (const candidate of source) {
        if (!isV1MembershipLocus(candidate)) {
            continue
        }
        const operationKind = intendedOp
            ?? membershipOperationKindFromLocus(candidate.locus)
        if (operationKind === undefined) {
            continue
        }
        tuples.push(identityPlanCandidateFromSpan(candidate, operationKind))
    }
    return tuples
}

function isV1MembershipLocus(candidate: ObjectSpanCandidate): boolean {
    return candidate.locus.kind === 'room' || candidate.locus.kind === 'heldByActor'
}
