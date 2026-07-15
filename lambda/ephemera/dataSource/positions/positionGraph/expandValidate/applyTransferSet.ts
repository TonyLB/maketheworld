import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraPositionGraph } from '../index'
import { boundaryEdgeOutcomes } from './interactionUnderTransfer'

export type ApplyTransferSetOutcome =
    | { verdict: 'legal'; sourceGraph: EphemeraPositionGraph; destGraph: EphemeraPositionGraph }
    | { verdict: 'illegal'; reasonCode: 'incompleteTransferSet' }
    | { verdict: 'defer'; decidable: boolean; reasonCode: 'transferInteractionDefer' }

/**
 * Expand+Validate core for a membership transfer (BD-13): given a transfer set already
 * believed complete, and the source/destination graphs, confirm the set really is
 * complete against these graphs (no unaccounted boundary edge) and produce the mutated
 * state. Shared by the compiler's sandbox (`sandboxStep.ts`, wrapping this with its own
 * locus/exit-edge check) and, in a follow-on step, the persistence kernel's commit-time
 * re-verification --- the same graph-dependent question asked at two different moments,
 * against two different snapshots of live state.
 *
 * Never expands `transferSet` itself (matches the sandbox's existing contract): a `carry`
 * boundary outcome means the caller under-specified the set --- illegal, not an invitation
 * to grow it further. Returns a reason *code*, not player-facing text, so this module has
 * zero dependency on the compiler layer's error-message vocabulary; callers translate the
 * code into whatever text or log message is appropriate for their context.
 */
export function applyTransferSet(
    sourceGraph: EphemeraPositionGraph,
    destGraph: EphemeraPositionGraph,
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

    const internalEdges = sourceGraph.relationalEdges.filter(
        (edge) => transferSet.has(edge.from) && transferSet.has(edge.to)
    )

    let nextSourceGraph = sourceGraph
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
