import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../../positions/positionGraph'
import type { RelationalOperationKind } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { existencePresenceGuardForIdentity } from './existencePresenceGuard'
import type { RelationalIdentityPlanCandidate } from './identityPlanCandidate'
import { proposeRelationalTuples } from './proposeRelationalTuples'
import type { NormalizedRelation } from './relationKind'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { evaluateSandboxPlan } from './sandboxPlan'
import { buildSandboxState } from './sandboxState'
import {
    selectPlanTuple,
    type SelectPlanTupleResult,
} from './selectIdentityPlanTuple'
import type { SpanCandidatePool, SpanResolutionConsultAlternative } from './spanResolution'
import { expandSameHost } from './synthesize/expandSameHost'
import type { DryRunOutcome } from './validatePlanDryRun'

/**
 * Candidate host graphs for relational host selection (BD-15/16 slice 4c) --- both
 * optional since either the room or the acting character's own inventory graph may
 * be unavailable (e.g. a roomless character, or one holding neither object).
 */
export type RelationalDryRunContext = {
    roomGraph?: EphemeraPositionGraph
    characterGraph?: EphemeraPositionGraph
}

export type SelectRelationalFromPoolsResult =
    | {
        type: 'resolved'
        subjectId: EphemeraObjectId
        targetId: EphemeraObjectId
        operationKind: RelationalOperationKind
        relation: NormalizedRelation
        hostId: EphemeraMembershipHostId
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
    dryRunContext: RelationalDryRunContext
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
        dryRun: (candidate) => sandboxRelationalDryRun(candidate, dryRunContext.roomGraph, dryRunContext.characterGraph),
        toConsultAlternative: (candidate) =>
            relationalConsultAlternative(candidate, phrase),
    })

    return mapSelection(selection, catalog)
}

/**
 * Production dry-run via the sandbox (`evaluateSandboxPlan`/`applyRelationalStep`),
 * promoting the pattern `sandboxSelectorReadiness.test.ts` proved out. Host selection
 * (BD-15/16 slice 4c) reuses `expandSameHost` (Slice 2) directly against whichever
 * candidate graphs are available --- the same `satisfied`/`repaired`/`defer`/`error`
 * classification Pipeline B's Synthesize stage already has, tested, rather than a
 * second implementation of the same rule. `negate: false` always --- Pipeline A has
 * no `Assertion`/negate concept. `repaired` (a genuine cross-host fix, e.g. "put tray
 * on table" when the tray is held) needs compound atomic apply (C2, not yet built),
 * so it's declined cleanly here, not attempted. Discards `outcome.state` deliberately
 * --- this is a per-candidate legality probe during selection, not a commit; only the
 * resolved candidate's effect should ever persist, and that persistence happens later,
 * through the real kernel path, not here.
 */
const sandboxRelationalDryRun = (
    candidate: RelationalIdentityPlanCandidate,
    roomGraph?: EphemeraPositionGraph,
    characterGraph?: EphemeraPositionGraph
): DryRunOutcome => {
    const graphsByHost = new Map<EphemeraMembershipHostId, EphemeraPositionGraph>()
    if (roomGraph) {
        graphsByHost.set(roomGraph.hostId, roomGraph)
    }
    if (characterGraph) {
        graphsByHost.set(characterGraph.hostId, characterGraph)
    }

    const getCurrentHost = (id: EphemeraObjectId): EphemeraMembershipHostId | undefined => {
        for (const graph of graphsByHost.values()) {
            if (graph.objectIds.has(id)) {
                return graph.hostId
            }
        }
        return undefined
    }
    const getGraph = (hostId: EphemeraMembershipHostId): EphemeraPositionGraph | undefined => graphsByHost.get(hostId)

    const sameHostResult = expandSameHost(
        {
            subjectId: candidate.subject.objectId,
            objectId: candidate.target.objectId,
            relationKind: candidate.plan.relation.kind,
            negate: false,
        },
        getCurrentHost,
        getGraph
    )

    if (sameHostResult.verdict === 'error') {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.notOnHostGraph,
        }
    }
    if (sameHostResult.verdict === 'repaired') {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.crossHostRepairNotYetSupported,
        }
    }
    if (sameHostResult.verdict === 'defer') {
        return {
            verdict: 'defer',
            decidable: sameHostResult.decidable,
            reason: sameHostResult.reason,
        }
    }

    const { hostId } = sameHostResult
    const state = buildSandboxState([...graphsByHost.values()])
    const outcome = evaluateSandboxPlan(state, [{ kind: 'relational', candidate, hostId }])

    return outcome.verdict === 'legal'
        ? { verdict: 'legal', decidable: true, hostId }
        : { verdict: outcome.verdict, decidable: outcome.decidable, reason: outcome.reason }
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
        // Non-null: a 'resolved' verdict only reaches here from a legal dry run, which
        // always sets `hostId` (sandboxRelationalDryRun above) --- the type just doesn't
        // encode that invariant across the DryRunOutcome/SelectPlanTupleResult boundary.
        hostId: selection.dryRun.hostId!,
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
