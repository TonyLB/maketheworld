import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ConsultAlternative } from './spanResolution'
import type { DryRunOutcome } from './validatePlanDryRun'

/**
 * The shared selection stage's cross-candidate selector (ISS8203 slice 3): legality partition,
 * then floor + margin on the legal survivors. Every route's candidates pass through it, so its
 * verdicts are the only ones a route maps to its result arm.
 */
export type ScoredPlanCandidate<T> = {
    candidate: T
    dryRun: DryRunOutcome
}

export type SelectPlanTupleResult<T> =
    | {
        verdict: 'resolved'
        candidate: T
        /** The winning candidate's own dry-run outcome (carries membership's `objectIds`, if any). */
        dryRun: DryRunOutcome
        legalSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'consult'
        alternatives: readonly ConsultAlternative[]
        legalSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'defer'
        candidate: T
        dryRun: DryRunOutcome
        deferSurvivors: readonly ScoredPlanCandidate<T>[]
    }
    | {
        verdict: 'abstain'
        reason: string
    }
    | {
        verdict: 'error'
        reason: string
    }

export type SelectPlanTupleInput<T> = {
    candidates: readonly T[]
    getConfidence: (candidate: T) => number
    dryRun: (candidate: T) => DryRunOutcome
    toConsultAlternative: (candidate: T) => ConsultAlternative
}

/**
 * FT-5 cross-tuple selector core: legality partition, then floor + margin on legal survivors.
 */
export function selectPlanTuple<T>(
    input: SelectPlanTupleInput<T>
): SelectPlanTupleResult<T> {
    const { candidates, getConfidence, dryRun, toConsultAlternative } = input

    if (candidates.length === 0) {
        return {
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        }
    }

    const scored: ScoredPlanCandidate<T>[] = candidates.map((candidate) => ({
        candidate,
        dryRun: dryRun(candidate),
    }))

    const legal = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'legal')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))

    if (legal.length > 0) {
        return selectAmongLegal(legal, getConfidence, toConsultAlternative)
    }

    const defer = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'defer')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))

    if (defer.length > 0) {
        return {
            verdict: 'defer',
            candidate: defer[0]!.candidate,
            dryRun: defer[0]!.dryRun,
            deferSurvivors: defer,
        }
    }

    const illegalHead = scored
        .filter(({ dryRun: outcome }) => outcome.verdict === 'illegal')
        .sort((a, b) => getConfidence(b.candidate) - getConfidence(a.candidate))[0]

    return {
        verdict: 'error',
        reason: illegalHead?.dryRun.reason
            ?? objectManipulationErrorMessages.noMatch,
    }
}

function selectAmongLegal<T>(
    legal: ScoredPlanCandidate<T>[],
    getConfidence: (candidate: T) => number,
    toConsultAlternative: (candidate: T) => ConsultAlternative
): SelectPlanTupleResult<T> {
    const head = legal[0]!
    const absFloor = legal.length === 1 ? T_JOINT_ABS_UNARY : T_JOINT_ABS
    const runnerUp = legal[1]
    const headConfidence = getConfidence(head.candidate)
    const margin = runnerUp === undefined
        ? 1
        : headConfidence - getConfidence(runnerUp.candidate)
    const marginPasses = legal.length === 1 || margin >= T_JOINT_MARGIN

    if (headConfidence >= absFloor && marginPasses) {
        return {
            verdict: 'resolved',
            candidate: head.candidate,
            dryRun: head.dryRun,
            legalSurvivors: legal,
        }
    }

    if (
        legal.length > 1
        && headConfidence >= absFloor
        && margin < T_JOINT_MARGIN
    ) {
        return {
            verdict: 'consult',
            alternatives: legal.map(({ candidate }) => toConsultAlternative(candidate)),
            legalSurvivors: legal,
        }
    }

    // Grey band: head below floor (or unary below unary floor) -> Abstain (FT-3.2)
    return {
        verdict: 'abstain',
        reason: objectManipulationErrorMessages.noMatch,
    }
}
