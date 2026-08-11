import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../index'
import { boundaryEdgeOutcomes } from './interactionUnderTransfer'

export type ApplyTransferSetOutcome =
    | { verdict: 'legal'; sourceGraph: EphemeraLudicGraph; destGraph: EphemeraLudicGraph }
    | { verdict: 'illegal'; reasonCode: 'incompleteTransferSet' | 'unresolvedDissolveEdge' }
    | { verdict: 'defer'; decidable: boolean; reasonCode: 'transferInteractionDefer' }

/**
 * BD-27c/BD-33/BD-35 Expand+Validate core for a membership transfer (BD-13): assumes any boundary
 * edge that should dissolve has already been severed by an explicit `DissolveRelationStep` earlier
 * in the same kernel-apply loop --- it does not rely on `EphemeraLudicGraph.removeObject`'s
 * silent edge-stripping (retired 2026-07-23) to make dissolution happen. A `dissolve`-classified
 * boundary edge still present at this point is therefore treated as `illegal`
 * (`unresolvedDissolveEdge`), not silently resolved.
 *
 * Never expands `transferSet` itself: a `carry` boundary outcome means the caller under-specified
 * the set --- illegal, not an invitation to grow it further.
 *
 * Renamed from `applyTransferSetAsserted` (2026-07-23): originally a new sibling module rather than
 * a change to a pre-assert-and-throw `applyTransferSet.ts` in place, back when that older function's
 * two commit-time callers (`applyObjectSetTransfer.ts`, `applyObjectRelationalChangeWithTransfer.ts`)
 * still depended on `removeObject`'s silent-strip. Both callers, `removeObject`, and the older
 * `applyTransferSet.ts` are now deleted --- this is the only implementation, so it took back the
 * plain name; only [`applyStepSequenceCore.ts`](../../manipulation/kernel/applyStepSequenceCore.ts)
 * calls it.
 */
export function applyTransferSet(
    sourceGraph: EphemeraLudicGraph,
    destGraph: EphemeraLudicGraph,
    transferSet: ReadonlySet<EphemeraObjectId>
): ApplyTransferSetOutcome {
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

    // Internal edges are stripped from sourceGraph *before* the per-object removeObject loop, since
    // removeObject throws if any relational edge --- including an internal one to a sibling not yet
    // removed --- still references the object being removed.
    let nextSourceGraph = sourceGraph
    for (const edge of internalEdges) {
        nextSourceGraph = nextSourceGraph.removeRelationalEdge(edge)
    }

    let nextDestGraph = destGraph
    for (const objectId of transferSet) {
        nextSourceGraph = nextSourceGraph.removeObject(objectId)
        nextDestGraph = nextDestGraph.addObject(objectId)
    }
    for (const edge of internalEdges) {
        nextDestGraph = nextDestGraph.addRelationalEdge(edge)
    }

    return { verdict: 'legal', sourceGraph: nextSourceGraph, destGraph: nextDestGraph }
}
