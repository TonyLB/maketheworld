import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import {
    isTransferMembershipStep,
    type EstablishRelationStep,
    type DissolveRelationStep,
    type ParsePlanStep,
} from '../parsePlanStep'
import { evaluateRelationalLegality } from '../evaluateRelationalLegality'
import type { NormalizedRelation } from '../relationKind'
import { detectRelationalCycle } from './detectRelationalCycle'

export type RelationalCandidateGraphLookup = {
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined
}

export type FilterLegalRelationalCandidatesResult =
    | { ok: true; candidates: readonly ParsePlanStep[] }
    | { ok: false; reason: string }

const normalizedRelationFromStep = (
    step: EstablishRelationStep | DissolveRelationStep
): NormalizedRelation =>
    step.relationKind === 'Custom'
        ? { type: 'custom', kind: 'Custom', relationLabel: step.relationLabel ?? '' }
        : { type: 'enum', kind: step.relationKind }

const isLegalRelationalCandidate = (
    step: EstablishRelationStep | DissolveRelationStep,
    context: RelationalCandidateGraphLookup
): boolean => {
    const graph = context.getGraph(step.hostRoomId)
    if (graph === undefined) {
        return false
    }

    const legality = evaluateRelationalLegality({
        operationKind: step.kind,
        subjectId: step.subjectId,
        targetId: step.targetId,
        normalizedRelation: normalizedRelationFromStep(step),
        graph,
    })
    if (legality.type !== 'allow') {
        return false
    }

    if (step.relationKind !== 'On' && step.relationKind !== 'Under') {
        return true
    }

    try {
        const simulatedGraph = graph.applyRelationalPatch({
            hostId: step.hostRoomId,
            edge: {
                from: step.subjectId,
                to: step.targetId,
                kind: step.relationKind,
            },
            op: step.kind === 'establishRelation' ? 'add' : 'remove',
        })
        return !detectRelationalCycle(simulatedGraph, step.relationKind)
    } catch {
        // evaluateRelationalLegality already confirmed this operation should be
        // applicable (both objects on graph, dissolve has a matching edge); a
        // thrown error here means the two checks disagree --- treat defensively
        // as illegal rather than let the exception escape.
        return false
    }
}

/**
 * Step 2b step 5 (BD-23): Validation for Grounding's joint candidate space.
 * Grounding (`groundChange.ts`) deliberately keeps same-object combinations
 * in its output rather than rejecting them --- this is where that judgment
 * actually happens, by simulating each relational candidate's edge and
 * checking the *outcome* graph for an illegal On/Under cycle (a self-relation
 * is simply a one-node cycle, caught by the same general mechanism, not a
 * bespoke subjectId === targetId rule). Supplements, rather than replaces,
 * `evaluateRelationalLegality`'s existing checks (bothObjectsOnGraph,
 * dissolve-must-match, complexRelational) --- those run first, unchanged.
 * `transferMembership` candidates pass through untouched (relational-only
 * pass); one illegal candidate never invalidates the rest of the pool.
 */
export function filterLegalRelationalCandidates(
    candidates: readonly ParsePlanStep[],
    context: RelationalCandidateGraphLookup
): FilterLegalRelationalCandidatesResult {
    const legal = candidates.filter((step) => {
        if (isTransferMembershipStep(step)) {
            return true
        }
        return isLegalRelationalCandidate(step, context)
    })

    if (candidates.length > 0 && legal.length === 0) {
        return {
            ok: false,
            reason: 'No relational candidate in the pool passed Validation legality checks',
        }
    }

    return { ok: true, candidates: legal }
}
