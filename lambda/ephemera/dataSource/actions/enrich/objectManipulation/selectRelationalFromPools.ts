import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RelationalOperationKind } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { existencePresenceGuardForIdentity } from './existencePresenceGuard'
import type { RelationalIdentityPlanCandidate } from './identityPlanCandidate'
import { proposeRelationalTuples } from './proposeRelationalTuples'
import type { NormalizedRelation } from './relationKind'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    selectPlanTuple,
    type SelectPlanTupleResult,
} from './selectIdentityPlanTuple'
import type { SpanCandidatePool, SpanResolutionConsultAlternative } from './spanResolution'
import {
    validateRelationalPlanDryRun,
    type ValidateRelationalPlanContext,
} from './validatePlanDryRun'

export type SelectRelationalFromPoolsResult =
    | {
        type: 'resolved'
        subjectId: EphemeraObjectId
        targetId: EphemeraObjectId
        operationKind: RelationalOperationKind
        relation: NormalizedRelation
    }
    | {
        type: 'consult'
        alternatives: readonly SpanResolutionConsultAlternative[]
    }
    | {
        type: 'abstain'
        reason: string
    }
    | {
        type: 'error'
        errorMessage: string
    }

export type SelectRelationalFromPoolsInput = {
    subjectPool: SpanCandidatePool
    targetPool: SpanCandidatePool
    operationKind: RelationalOperationKind
    relation: NormalizedRelation
    catalog: readonly ObjectManipulationCatalogEntry[]
    dryRunContext: ValidateRelationalPlanContext
    /** Optional relation phrase override for Consult copy (defaults from relation). */
    relationPhrase?: string
}

/**
 * Relational FT-3.3 glue: propose-N -> FT-5 selector -> dual existence/presence guard.
 */
export function selectRelationalFromPools(
    input: SelectRelationalFromPoolsInput
): SelectRelationalFromPoolsResult {
    const {
        subjectPool,
        targetPool,
        operationKind,
        relation,
        catalog,
        dryRunContext,
        relationPhrase,
    } = input

    const subjectSource = subjectPool.shortlist ?? subjectPool.candidates
    const targetSource = targetPool.shortlist ?? targetPool.candidates
    if (subjectSource.length === 0 || targetSource.length === 0) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        }
    }

    const tuples = proposeRelationalTuples({
        subjectPool,
        targetPool,
        operationKind,
        relation,
    })

    if (tuples.length === 0) {
        // Non-empty pools but every pair was same-id
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        }
    }

    const phrase = relationPhrase ?? relationPhraseFromNormalized(relation)
    const selection = selectPlanTuple({
        candidates: tuples,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => validateRelationalPlanDryRun(candidate, dryRunContext),
        toConsultAlternative: (candidate) =>
            relationalConsultAlternative(candidate, phrase),
    })

    return mapSelection(selection, catalog)
}

function mapSelection(
    selection: SelectPlanTupleResult<RelationalIdentityPlanCandidate>,
    catalog: readonly ObjectManipulationCatalogEntry[]
): SelectRelationalFromPoolsResult {
    if (selection.verdict === 'error') {
        return {
            type: 'error',
            errorMessage: selection.reason,
        }
    }

    if (selection.verdict === 'abstain') {
        return {
            type: 'abstain',
            reason: selection.reason,
        }
    }

    if (selection.verdict === 'consult') {
        return {
            type: 'consult',
            alternatives: selection.alternatives,
        }
    }

    if (selection.verdict === 'defer') {
        // Relational v1 has no defer egress; treat as error if it appears.
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    const { candidate } = selection
    const subjectGuard = existencePresenceGuardForIdentity(candidate.subject, catalog)
    if (subjectGuard.type === 'error') {
        return {
            type: 'error',
            errorMessage: subjectGuard.reason,
        }
    }
    const targetGuard = existencePresenceGuardForIdentity(candidate.target, catalog)
    if (targetGuard.type === 'error') {
        return {
            type: 'error',
            errorMessage: targetGuard.reason,
        }
    }

    return {
        type: 'resolved',
        subjectId: candidate.subject.objectId,
        targetId: candidate.target.objectId,
        operationKind: candidate.plan.operationKind,
        relation: candidate.plan.relation,
    }
}

function relationalConsultAlternative(
    candidate: RelationalIdentityPlanCandidate,
    relationPhrase: string
): SpanResolutionConsultAlternative {
    const verb = candidate.plan.operationKind === 'dissolveRelation' ? 'take' : 'put'
    const connector = candidate.plan.operationKind === 'dissolveRelation'
        && relationPhrase === 'on'
        ? 'off'
        : relationPhrase
    return {
        objectId: candidate.subject.objectId,
        label: candidate.subject.label,
        proposedCommand: `${verb} the ${candidate.subject.label} ${connector} the ${candidate.target.label}`,
    }
}

export function relationPhraseFromNormalized(relation: NormalizedRelation): string {
    if (relation.type === 'custom') {
        return relation.relationLabel.trim() || 'near'
    }
    switch (relation.kind) {
        case 'On':
            return 'on'
        case 'Under':
            return 'under'
        case 'Against':
            return 'against'
    }
}
