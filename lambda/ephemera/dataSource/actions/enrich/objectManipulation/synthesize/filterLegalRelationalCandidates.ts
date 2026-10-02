import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph, HostRelationalEdge } from '../../../../positions/ludicGraph'
import { evaluateRelationalLegality } from '../evaluateRelationalLegality'
import type { NormalizedRelation } from '../relationKind'
import { detectRelationalCycle } from './detectRelationalCycle'
import type { ExecutorRelationalChain } from './executorTypes'

export type RelationalCandidateGraphLookup = {
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined
}

export type FilterLegalRelationalCandidatesResult =
    | { ok: true; candidates: readonly ExecutorRelationalChain[] }
    | { ok: false; reason: string }

/** `undefined` for a kind outside the ingress lane's peer kinds (a hosting kind). */
const normalizedRelationFromEdge = (edge: HostRelationalEdge): NormalizedRelation | undefined => {
    if (edge.kind === 'Custom') {
        return { type: 'custom', kind: 'Custom', relationLabel: edge.relationLabel }
    }
    if (edge.kind === 'Under' || edge.kind === 'Against') {
        return { type: 'enum', kind: edge.kind }
    }
    return undefined
}

/**
 * Checks a one-leg chain's single edge against that leg's own graph. A chain with more legs
 * (a crossing) passes unchecked, as it always has: checking every leg's graph is slice 2c's
 * behaviour change (AP-6, `AGENT.commandAttemptPipeline.planning.md`), not this function's yet.
 * The one-leg edge's endpoints must be Objects, as the ingress lane's always are.
 */
const isLegalRelationalCandidate = (
    chain: ExecutorRelationalChain,
    context: RelationalCandidateGraphLookup
): boolean => {
    if (chain.steps.length !== 1) {
        return true
    }
    const [leg] = chain.steps
    if (leg?.type !== 'edge') {
        return false
    }
    const { hostId, edge } = leg
    const subjectId = edge.from
    const targetId = edge.to
    if (typeof subjectId !== 'string' || typeof targetId !== 'string' || !isEphemeraObjectId(subjectId) || !isEphemeraObjectId(targetId)) {
        return false
    }
    const normalizedRelation = normalizedRelationFromEdge(edge)
    if (normalizedRelation === undefined) {
        return false
    }
    const graph = context.getGraph(hostId)
    if (graph === undefined) {
        return false
    }

    const legality = evaluateRelationalLegality({
        operationKind: chain.operationKind,
        subjectId,
        targetId,
        normalizedRelation,
        graph,
    })
    if (legality.type !== 'allow') {
        return false
    }

    // `On` dropped out of this ingress-lane step's `relationKind` 2026-08-22 (Channel D, CD2,
    // reduced scope) -- ingress can no longer produce it, so only `Under` needs the cycle check
    // here. `detectRelationalCycle` itself keeps its own `'On' | 'Under'` signature unchanged;
    // narrowing it (or not) for other callers is CD4's question, not this call site's.
    if (edge.kind !== 'Under') {
        return true
    }

    try {
        const simulatedGraph = graph.applyRelationalPatch({
            hostId,
            edge: {
                from: subjectId,
                to: targetId,
                kind: edge.kind,
            },
            op: chain.operationKind === 'establishRelation' ? 'add' : 'remove',
        })
        return !detectRelationalCycle(simulatedGraph, edge.kind)
    } catch {
        // evaluateRelationalLegality already confirmed this operation should be
        // applicable (both objects on graph, dissolve has a matching edge); a
        // thrown error here means the two checks disagree --- treat defensively
        // as illegal rather than let the exception escape.
        return false
    }
}

/**
 * Step 2b step 5 (BD-23): Validation of relational candidates, each an expanded chain
 * (AP-6). Grounding deliberately keeps same-object assignments rather than rejecting
 * them --- this is where that judgment actually happens, by simulating each one-leg
 * chain's edge and
 * checking the *outcome* graph for an illegal On/Under cycle (a self-relation
 * is simply a one-node cycle, caught by the same general mechanism, not a
 * bespoke subjectId === targetId rule). Supplements, rather than replaces,
 * `evaluateRelationalLegality`'s existing checks (bothObjectsOnGraph,
 * dissolve-must-match, complexRelational) --- those run first, unchanged.
 * One illegal candidate never invalidates the rest of the pool.
 */
export function filterLegalRelationalCandidates(
    candidates: readonly ExecutorRelationalChain[],
    context: RelationalCandidateGraphLookup
): FilterLegalRelationalCandidatesResult {
    const legal = candidates.filter((chain) => isLegalRelationalCandidate(chain, context))

    if (candidates.length > 0 && legal.length === 0) {
        return {
            ok: false,
            reason: 'No relational candidate in the pool passed Validation legality checks',
        }
    }

    return { ok: true, candidates: legal }
}
