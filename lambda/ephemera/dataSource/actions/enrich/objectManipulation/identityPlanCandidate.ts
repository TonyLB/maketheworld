import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass } from '../../baseClasses'
import type {
    ObjectSpanCandidate,
    SpanCandidateLocus,
    SpanRelevanceSourceTag,
} from './spanResolution'

/**
 * Closed-registry membership plan stub (FT-2.2). Full Plan IR lands in Phase C.
 */
export type MembershipPlanStub = {
    kind: 'transferMembership'
    operationKind: 'takeHold' | 'drop'
}

export type IdentityPlanIdentity = {
    objectId: EphemeraObjectId
    label: string
    locus: SpanCandidateLocus
    jointRelevance: number
    sourceTags: readonly SpanRelevanceSourceTag[]
}

export type IdentityPlanCandidate = {
    identity: IdentityPlanIdentity
    plan: MembershipPlanStub
    /** Absolute confidence in [0, 1] (FT-1 joint relevance; no within-set rescale). */
    confidence: number
}

export function membershipOperationKindFromVerbClass(
    verbClass: ManipulationVerbClass
): 'takeHold' | 'drop' {
    return verbClass === 'release' ? 'drop' : 'takeHold'
}

export function membershipOperationKindFromLocus(
    locus: SpanCandidateLocus
): 'takeHold' | 'drop' | undefined {
    if (locus.kind === 'room') {
        return 'takeHold'
    }
    if (locus.kind === 'heldByActor') {
        return 'drop'
    }
    return undefined
}

export function identityPlanCandidateFromSpan(
    candidate: ObjectSpanCandidate,
    operationKind: 'takeHold' | 'drop'
): IdentityPlanCandidate {
    return {
        identity: {
            objectId: candidate.id,
            label: candidate.label,
            locus: candidate.locus,
            jointRelevance: candidate.jointRelevance,
            sourceTags: candidate.sourceTags,
        },
        plan: {
            kind: 'transferMembership',
            operationKind,
        },
        confidence: candidate.jointRelevance,
    }
}
