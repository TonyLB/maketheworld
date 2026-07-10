import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    T_JOINT_ABS,
    T_JOINT_ABS_UNARY,
    T_JOINT_MARGIN,
} from './embeddingMatch/thresholds'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanCandidatePool, SpanResolutionOutcome } from './spanResolution'

/**
 * FT-2.1 bridge: single-span FT-5 auto-resolve on joint relevance floor + margin.
 * Superseded by FT-2.2 tuple selector + Consult wire. Declines map to error, not Consult.
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
            objectId: sole.id,
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
            objectId: head.id,
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
