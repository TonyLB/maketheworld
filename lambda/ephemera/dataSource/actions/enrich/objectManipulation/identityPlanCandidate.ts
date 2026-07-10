import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass, RelationalOperationKind } from '../../baseClasses'
import type { NormalizedRelation } from './relationKind'
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

/**
 * Closed-registry relational plan stub (FT-3.3). Full Plan IR lands in Phase C.
 */
export type RelationalPlanStub = {
    kind: RelationalOperationKind
    operationKind: RelationalOperationKind
    relation: NormalizedRelation
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

/** Two-span relational `(identity, plan)` candidate (FT-3.3). */
export type RelationalIdentityPlanCandidate = {
    subject: IdentityPlanIdentity
    target: IdentityPlanIdentity
    plan: RelationalPlanStub
    /** min(subject, target) joint relevance --- one thin span sinks the command. */
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

export function identityFromSpanCandidate(
    candidate: ObjectSpanCandidate
): IdentityPlanIdentity {
    return {
        objectId: candidate.id,
        label: candidate.label,
        locus: candidate.locus,
        jointRelevance: candidate.jointRelevance,
        sourceTags: candidate.sourceTags,
    }
}

export function identityPlanCandidateFromSpan(
    candidate: ObjectSpanCandidate,
    operationKind: 'takeHold' | 'drop'
): IdentityPlanCandidate {
    return {
        identity: identityFromSpanCandidate(candidate),
        plan: {
            kind: 'transferMembership',
            operationKind,
        },
        confidence: candidate.jointRelevance,
    }
}

export function relationalIdentityPlanCandidateFromSpans(
    subject: ObjectSpanCandidate,
    target: ObjectSpanCandidate,
    operationKind: RelationalOperationKind,
    relation: NormalizedRelation
): RelationalIdentityPlanCandidate {
    const subjectIdentity = identityFromSpanCandidate(subject)
    const targetIdentity = identityFromSpanCandidate(target)
    return {
        subject: subjectIdentity,
        target: targetIdentity,
        plan: {
            kind: operationKind,
            operationKind,
            relation,
        },
        confidence: Math.min(subject.jointRelevance, target.jointRelevance),
    }
}
