import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttempt } from '../../commandAttempt'
import type {
    ObjectSpanCandidate,
    SpanCandidateLocus,
    SpanRelevanceSourceTag,
} from './spanResolution'

export type IdentityPlanIdentity = {
    objectId: EphemeraObjectId
    label: string
    locus: SpanCandidateLocus
    jointRelevance: number
    sourceTags: readonly SpanRelevanceSourceTag[]
}

export type IdentityPlanCandidate = {
    identity: IdentityPlanIdentity
    /** The fixed plan this candidate's identity grounds into (Plan's attempt, shared by every candidate). */
    plan: CommandAttempt
    /** Absolute confidence in [0, 1] (FT-1 joint relevance; no within-set rescale). */
    confidence: number
}

/**
 * `IdentityPlanIdentity.objectId` is membership/relational-plan-facing (Object-only
 * mutation machinery, deliberately not widened by CPG-5's Phase 2) even though
 * `ObjectSpanCandidate.id` now accepts `EphemeraThingId` --- assert-and-throw at this
 * seam, since nothing downstream of a plan-candidate identity can act on a
 * Character/Feature id yet.
 */
export function identityFromSpanCandidate(
    candidate: ObjectSpanCandidate
): IdentityPlanIdentity {
    if (!isEphemeraObjectId(candidate.id)) {
        throw new Error(`identityFromSpanCandidate: expected an Object candidate, got "${candidate.id}"`)
    }
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
    plan: CommandAttempt
): IdentityPlanCandidate {
    return {
        identity: identityFromSpanCandidate(candidate),
        plan,
        confidence: candidate.jointRelevance,
    }
}
