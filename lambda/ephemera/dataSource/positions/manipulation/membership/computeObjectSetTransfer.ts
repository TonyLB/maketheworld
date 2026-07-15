import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { boundaryEdgeOutcomes } from '../../positionGraph/interactionUnderTransfer'
import type { EphemeraPositionGraph } from '../../positionGraph'

export type ObjectSetTransferPlan = {
    sourceGraph: EphemeraPositionGraph
    destGraph: EphemeraPositionGraph
}

/**
 * Pure, throwing computation shared by `applyObjectSetTransfer`'s pre-check
 * (against a preliminary fetch) and its `MultiKeyUpdate` reducer (against the
 * freshly-fetched state at commit time) --- the same function run twice against
 * two different snapshots is what lets the reducer catch a concurrent
 * modification the pre-check couldn't have seen. Throws (rather than returning
 * an error variant) so a reducer invocation aborts the whole `transactWrite`
 * synchronously; callers running this pre-transaction catch and convert to an
 * `{ok: false}` result.
 */
export const computeObjectSetTransfer = (
    sourceGraph: EphemeraPositionGraph,
    destGraph: EphemeraPositionGraph,
    objectIds: ReadonlySet<EphemeraObjectId>
): ObjectSetTransferPlan => {
    for (const id of objectIds) {
        if (!sourceGraph.objectIds.has(id)) {
            throw new Error(
                `applyObjectSetTransfer: object ${id} not present on source host ${sourceGraph.hostId} --- stale transfer candidate`
            )
        }
        if (destGraph.objectIds.has(id)) {
            throw new Error(
                `applyObjectSetTransfer: object ${id} already present on destination host ${destGraph.hostId} --- stale transfer candidate`
            )
        }
    }

    const outcomes = boundaryEdgeOutcomes(objectIds, sourceGraph)
    const badOutcome = outcomes.find((entry) => entry.outcome === 'carry' || entry.outcome === 'defer')
    if (badOutcome) {
        throw new Error(
            `applyObjectSetTransfer: boundary edge ${badOutcome.edge.from} -> ${badOutcome.edge.to} now classifies as '${badOutcome.outcome}' --- stale transfer candidate, concurrent modification detected`
        )
    }

    const internalEdges = sourceGraph.relationalEdges.filter(
        (edge) => objectIds.has(edge.from) && objectIds.has(edge.to)
    )

    let nextSource = sourceGraph
    let nextDest = destGraph
    for (const id of objectIds) {
        nextSource = nextSource.removeObject(id)
        nextDest = nextDest.addObject(id)
    }
    for (const edge of internalEdges) {
        nextDest = nextDest.addRelationalEdge(edge)
    }

    return { sourceGraph: nextSource, destGraph: nextDest }
}
