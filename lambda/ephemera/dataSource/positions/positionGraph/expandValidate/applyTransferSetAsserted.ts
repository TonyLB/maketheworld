import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraPositionGraph } from '../index'
import { boundaryEdgeOutcomes } from './interactionUnderTransfer'

export type ApplyTransferSetAssertedOutcome =
    | { verdict: 'legal'; sourceGraph: EphemeraPositionGraph; destGraph: EphemeraPositionGraph }
    | { verdict: 'illegal'; reasonCode: 'incompleteTransferSet' | 'unresolvedDissolveEdge' }
    | { verdict: 'defer'; decidable: boolean; reasonCode: 'transferInteractionDefer' }

/**
 * BD-27c/BD-33/BD-35 assert-and-throw sibling of `applyTransferSet` (Expand+Validate core for a
 * membership transfer, BD-13): unlike `applyTransferSet`, this function assumes any boundary edge
 * that should dissolve has already been severed by an explicit `DissolveRelationStep` earlier in
 * the same kernel-apply loop --- it does not rely on `EphemeraPositionGraph.removeObject`'s silent
 * edge-stripping to make dissolution happen. A `dissolve`-classified boundary edge still present at
 * this point is therefore treated as `illegal` (`unresolvedDissolveEdge`), not silently resolved.
 *
 * Never expands `transferSet` itself (same contract as `applyTransferSet`): a `carry` boundary
 * outcome means the caller under-specified the set --- illegal, not an invitation to grow it further.
 *
 * Transient scaffold (BD-35, 2026-07-23): a new sibling module rather than a change to
 * `applyTransferSet.ts` in place, because `applyTransferSet.ts`'s two live commit-time callers
 * (`applyObjectSetTransfer.ts`, `applyObjectRelationalChangeWithTransfer.ts`) still depend on
 * `removeObject`'s silent-strip today --- changing `applyTransferSet.ts` in place would regress
 * both live kernels' own committed tests. Only the new kernel path (`applyStepSequenceCore.ts`)
 * calls this one. A later migrate row retires `applyTransferSet.ts`, renaming this onto that name.
 */
export function applyTransferSetAsserted(
    sourceGraph: EphemeraPositionGraph,
    destGraph: EphemeraPositionGraph,
    transferSet: ReadonlySet<EphemeraObjectId>
): ApplyTransferSetAssertedOutcome {
    const boundaryOutcomes = boundaryEdgeOutcomes(transferSet, sourceGraph)

    const carryOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'carry')
    if (carryOutcome !== undefined) {
        return { verdict: 'illegal', reasonCode: 'incompleteTransferSet' }
    }

    const deferOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'defer')
    if (deferOutcome !== undefined) {
        return {
            verdict: 'defer',
            decidable: deferOutcome.edge.kind !== 'Custom',
            reasonCode: 'transferInteractionDefer',
        }
    }

    // A dissolve-classified boundary edge still present here means an explicit
    // DissolveRelationStep that should have run earlier in the same kernel-apply loop did not.
    const dissolveOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'dissolve')
    if (dissolveOutcome !== undefined) {
        return { verdict: 'illegal', reasonCode: 'unresolvedDissolveEdge' }
    }

    const internalEdges = sourceGraph.relationalEdges.filter(
        (edge) => transferSet.has(edge.from) && transferSet.has(edge.to)
    )

    // REORDERED (vs. applyTransferSet): internal edges are stripped from sourceGraph *before* the
    // per-object removeObjectAsserted loop, since removeObjectAsserted throws if any relational
    // edge --- including an internal one to a sibling not yet removed --- still references the
    // object being removed.
    let nextSourceGraph = sourceGraph
    for (const edge of internalEdges) {
        nextSourceGraph = nextSourceGraph.removeRelationalEdge(edge)
    }

    let nextDestGraph = destGraph
    for (const objectId of transferSet) {
        nextSourceGraph = nextSourceGraph.removeObjectAsserted(objectId)
        nextDestGraph = nextDestGraph.addObject(objectId)
    }
    for (const edge of internalEdges) {
        nextDestGraph = nextDestGraph.addRelationalEdge(edge)
    }

    return { verdict: 'legal', sourceGraph: nextSourceGraph, destGraph: nextDestGraph }
}
