import type { RelationalOperationKind } from '../../baseClasses'
import {
    relationalIdentityPlanCandidateFromSpans,
    type RelationalIdentityPlanCandidate,
} from './identityPlanCandidate'
import type { NormalizedRelation } from './relationKind'
import type { SpanCandidatePool } from './spanResolution'

export type ProposeRelationalTuplesInput = {
    subjectPool: SpanCandidatePool
    targetPool: SpanCandidatePool
    operationKind: RelationalOperationKind
    relation: NormalizedRelation
}

/**
 * Deterministic relational propose-N (FT-3.3): cartesian of subject x target shortlists.
 * Skips same-id pairs. Confidence = min(subject, target) joint relevance.
 */
export function proposeRelationalTuples(
    input: ProposeRelationalTuplesInput
): RelationalIdentityPlanCandidate[] {
    const { subjectPool, targetPool, operationKind, relation } = input
    const subjects = subjectPool.shortlist ?? subjectPool.candidates
    const targets = targetPool.shortlist ?? targetPool.candidates
    if (subjects.length === 0 || targets.length === 0) {
        return []
    }

    const tuples: RelationalIdentityPlanCandidate[] = []
    for (const subject of subjects) {
        for (const target of targets) {
            if (subject.id === target.id) {
                continue
            }
            tuples.push(
                relationalIdentityPlanCandidateFromSpans(
                    subject,
                    target,
                    operationKind,
                    relation
                )
            )
        }
    }
    return tuples
}
