import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectSpanCandidate, SpanCandidatePool, SpanResolutionOutcome } from './spanResolution'

/**
 * `SpanResolutionOutcome` is membership-plan-facing (Object-only mutation machinery,
 * CPG-5's Phase 2 deliberately leaves relational/membership steps Object-scoped) even
 * though `ObjectSpanCandidate.id` widened to `EphemeraThingId` for Identify's own
 * candidate representation --- assert-and-throw at this seam rather than widening
 * `SpanResolutionOutcome.objectId`, since nothing downstream of this bridge can act on
 * a Character/Feature id yet.
 */
const assertObjectCandidate = (candidate: ObjectSpanCandidate): EphemeraObjectId => {
    if (!isEphemeraObjectId(candidate.id)) {
        throw new Error(`selectSingleSpanFromPool: expected an Object candidate, got "${candidate.id}"`)
    }
    return candidate.id
}

/**
 * FT-2.1 bridge: single-span FT-5 auto-resolve on joint relevance floor + margin.
 * Membership superseded by FT-2.2 {@link selectMembershipFromPool}.
 * Relational superseded by FT-3.3's native skeleton pipeline (see compileRelationalFromSkeleton.ts).
 * Retained for harness / unit history. Declines map to error, not Consult.
 */
export function selectSingleSpanFromPool(pool: SpanCandidatePool): SpanResolutionOutcome {
    const { candidates } = pool

    if (candidates.length === 0) {
        return {
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        }
    }

    const head = candidates[0]!
    const exactCandidates = candidates.filter((candidate) => candidate.sourceTags.includes('exact'))

    if (exactCandidates.length === 1) {
        const sole = exactCandidates[0]!
        return {
            verdict: 'resolved',
            objectId: assertObjectCandidate(sole),
            locus: sole.locus,
        }
    }

    if (exactCandidates.length > 1) {
        return {
            verdict: 'error',
            reason: objectManipulationErrorMessages.ambiguousMatch,
        }
    }

    const absFloor = candidates.length === 1 ? T_JOINT_ABS_UNARY : T_JOINT_ABS
    const margin = head.marginToRunnerUp ?? 0
    const marginPasses = candidates.length === 1 || margin >= T_JOINT_MARGIN

    if (head.jointRelevance >= absFloor && marginPasses) {
        return {
            verdict: 'resolved',
            objectId: assertObjectCandidate(head),
            locus: head.locus,
        }
    }

    const ambiguousByMargin = candidates.length > 1
        && head.jointRelevance >= absFloor
        && margin < T_JOINT_MARGIN

    return {
        verdict: 'error',
        reason: ambiguousByMargin
            ? objectManipulationErrorMessages.ambiguousMatch
            : objectManipulationErrorMessages.noMatch,
    }
}

export function spanResolutionErrorReason(outcome: SpanResolutionOutcome): string {
    if (outcome.verdict === 'error') {
        return outcome.reason
    }
    return objectManipulationErrorMessages.noMatch
}

export function resolvedObjectIdFromSpanOutcome(
    outcome: SpanResolutionOutcome
): EphemeraObjectId | undefined {
    return outcome.verdict === 'resolved' ? outcome.objectId : undefined
}
