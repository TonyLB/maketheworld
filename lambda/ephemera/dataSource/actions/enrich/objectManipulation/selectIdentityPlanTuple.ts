import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanResolutionConsultAlternative, SpanResolutionOutcome } from './spanResolution'
import {
    validateMembershipPlanDryRun,
    type DryRunOutcome,
    type ValidateMembershipPlanContext,
} from './validatePlanDryRun'

export type ScoredIdentityPlanCandidate = {
    candidate: IdentityPlanCandidate
    dryRun: DryRunOutcome
}

export type SelectIdentityPlanTupleResult =
    | {
        verdict: 'resolved'
        candidate: IdentityPlanCandidate
        legalSurvivors: readonly ScoredIdentityPlanCandidate[]
    }
    | {
        verdict: 'consult'
        alternatives: readonly SpanResolutionConsultAlternative[]
        legalSurvivors: readonly ScoredIdentityPlanCandidate[]
    }
    | {
        verdict: 'defer'
        candidate: IdentityPlanCandidate
        deferSurvivors: readonly ScoredIdentityPlanCandidate[]
    }
    | {
        verdict: 'error'
        reason: string
    }

export type SelectIdentityPlanTupleInput = {
    candidates: readonly IdentityPlanCandidate[]
    dryRunContext?: ValidateMembershipPlanContext
    /** Used to build Consult proposedCommand strings. */
    commandSpan?: string
}

/**
 * FT-5 cross-tuple selector: legality partition, then floor + margin on legal survivors.
 */
export function selectIdentityPlanTuple(
    input: SelectIdentityPlanTupleInput
): SelectIdentityPlanTupleResult {
    const { candidates, dryRunContext = {}, commandSpan = 'object' } = input

    if (candidates.length === 0) {
        return {
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        }
    }

    const scored: ScoredIdentityPlanCandidate[] = candidates.map((candidate) => ({
        candidate,
        dryRun: validateMembershipPlanDryRun(candidate, dryRunContext),
    }))

    const legal = scored
        .filter(({ dryRun }) => dryRun.verdict === 'legal')
        .sort((a, b) => b.candidate.confidence - a.candidate.confidence)

    if (legal.length > 0) {
        return selectAmongLegal(legal, commandSpan)
    }

    const defer = scored
        .filter(({ dryRun }) => dryRun.verdict === 'defer')
        .sort((a, b) => b.candidate.confidence - a.candidate.confidence)

    if (defer.length > 0) {
        return {
            verdict: 'defer',
            candidate: defer[0]!.candidate,
            deferSurvivors: defer,
        }
    }

    const illegalHead = scored
        .filter(({ dryRun }) => dryRun.verdict === 'illegal')
        .sort((a, b) => b.candidate.confidence - a.candidate.confidence)[0]

    return {
        verdict: 'error',
        reason: illegalHead?.dryRun.reason
            ?? objectManipulationErrorMessages.noMatch,
    }
}

function selectAmongLegal(
    legal: ScoredIdentityPlanCandidate[],
    commandSpan: string
): SelectIdentityPlanTupleResult {
    const head = legal[0]!
    const absFloor = legal.length === 1 ? T_JOINT_ABS_UNARY : T_JOINT_ABS
    const runnerUp = legal[1]
    const margin = runnerUp === undefined
        ? 1
        : head.candidate.confidence - runnerUp.candidate.confidence
    const marginPasses = legal.length === 1 || margin >= T_JOINT_MARGIN

    if (head.candidate.confidence >= absFloor && marginPasses) {
        return {
            verdict: 'resolved',
            candidate: head.candidate,
            legalSurvivors: legal,
        }
    }

    if (
        legal.length > 1
        && head.candidate.confidence >= absFloor
        && margin < T_JOINT_MARGIN
    ) {
        return {
            verdict: 'consult',
            alternatives: legal.map(({ candidate }) =>
                consultAlternativeFromCandidate(candidate, commandSpan)
            ),
            legalSurvivors: legal,
        }
    }

    // Grey band: head below floor (or unary below unary floor)
    return {
        verdict: 'error',
        reason: objectManipulationErrorMessages.noMatch,
    }
}

function consultAlternativeFromCandidate(
    candidate: IdentityPlanCandidate,
    commandSpan: string
): SpanResolutionConsultAlternative {
    const verb = candidate.plan.operationKind === 'drop' ? 'drop' : 'take'
    return {
        objectId: candidate.identity.objectId,
        label: candidate.identity.label,
        proposedCommand: `${verb} the ${candidate.identity.label}`,
    }
}

export function selectIdentityPlanTupleToSpanOutcome(
    result: SelectIdentityPlanTupleResult
): SpanResolutionOutcome {
    if (result.verdict === 'resolved') {
        return {
            verdict: 'resolved',
            objectId: result.candidate.identity.objectId,
            locus: result.candidate.identity.locus,
        }
    }
    if (result.verdict === 'consult') {
        return {
            verdict: 'consult',
            alternatives: result.alternatives,
        }
    }
    if (result.verdict === 'defer') {
        return {
            verdict: 'resolved',
            objectId: result.candidate.identity.objectId,
            locus: result.candidate.identity.locus,
        }
    }
    return {
        verdict: 'error',
        reason: result.reason,
    }
}

export function resolvedObjectIdFromTupleSelection(
    result: SelectIdentityPlanTupleResult
): EphemeraObjectId | undefined {
    if (result.verdict === 'resolved' || result.verdict === 'defer') {
        return result.candidate.identity.objectId
    }
    return undefined
}
