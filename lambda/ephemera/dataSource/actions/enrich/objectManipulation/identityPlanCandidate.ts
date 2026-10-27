import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttempt } from '../../commandAttempt'
import type {
    ObjectSpanCandidate,
    SpanCandidateId,
    SpanCandidateLocus,
    SpanRelevanceSourceTag,
} from './spanResolution'

/** What a span grounded to: an object, or (for an exit span) the room the exit leads to. */
export type IdentityPlanIdentity = {
    id: SpanCandidateId
    label: string
    locus: SpanCandidateLocus
    jointRelevance: number
    sourceTags: readonly SpanRelevanceSourceTag[]
}

/** An identity's Object id, for a consumer that acts on objects only (the BD-19 fallbacks' Consult wording). */
export function objectIdOf(identity: IdentityPlanIdentity): EphemeraObjectId {
    if (!isEphemeraObjectId(identity.id)) {
        throw new Error(`objectIdOf: expected an Object identity, got "${identity.id}"`)
    }
    return identity.id
}

export type IdentityPlanCandidate = {
    identity: IdentityPlanIdentity
    /** The fixed plan this candidate's identity grounds into (Plan's attempt, shared by every candidate). */
    plan: CommandAttempt
    /** Absolute confidence in [0, 1] (FT-1 joint relevance; no within-set rescale). */
    confidence: number
}

/**
 * `IdentityPlanIdentity.id` is an Object (the mutation machinery's) or a Room (an exit's
 * destination, what a navigate action acts on), even though `ObjectSpanCandidate.id` also accepts
 * a Character or Feature (CPG-5's Phase 2) --- assert-and-throw at this seam, since nothing
 * downstream of a plan-candidate identity can act on a Character/Feature id yet.
 */
export function identityFromSpanCandidate(
    candidate: ObjectSpanCandidate
): IdentityPlanIdentity {
    if (!isEphemeraObjectId(candidate.id) && !isEphemeraRoomId(candidate.id)) {
        throw new Error(`identityFromSpanCandidate: expected an Object or Room candidate, got "${candidate.id}"`)
    }
    return {
        id: candidate.id,
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
