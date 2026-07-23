import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../positionGraph'
import { applyTransferSetAsserted } from '../../positionGraph/expandValidate/applyTransferSetAsserted'
import type { KernelStep } from './kernelStep'
import type { KernelApplyOutcome } from './types'

const findHostOf = (
    id: EphemeraObjectId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>
): EphemeraMembershipHostId | undefined => {
    for (const [hostId, graph] of graphs) {
        if (graph.objectIds.has(id)) {
            return hostId
        }
    }
    return undefined
}

/**
 * BD-27c's shared, pure apply core: walks an ordered `KernelStep[]` once, dispatching per specific
 * primitive (never per `kind` grouping, mirroring the Synthesize executor's own `commandExpand`
 * dispatch). Applying the array in-order (not resorting it) is what makes the sequencing contract
 * hold: a paired `dissolveRelation` step always mutates the graph map before a following
 * `transferMembership` step reads it, because the worklist that produced this array already
 * guaranteed that order.
 *
 * `transferMembership` (BD-36-generalized): splits `entityIds` by kind. The object subset routes
 * through `applyTransferSetAsserted` unchanged (full boundary-edge legality machinery). The
 * character subset needs none of that --- a character can never carry a relational edge (BD-36's
 * widening is explicitly deferred) --- so it's a direct `removeCharacterAsserted`/`addCharacter`
 * swap with only stale-candidate presence checks.
 *
 * `establishRelation`/`dissolveRelation`: derives the shared host live from the graph map (BD-33
 * assert-and-throw --- these steps carry no host field), throws on mismatch, else applies the patch.
 *
 * Structural-invariant violations (BD-33's host mismatch; `RelationalEdgeStillReferencedError` from
 * inside `applyTransferSetAsserted`) throw, uniformly in both modes --- not a `KernelApplyOutcome`
 * verdict. Legitimate legality outcomes (stale candidate, `Custom`-edge defer,
 * `unresolvedDissolveEdge`) return through the discriminated result.
 */
export const applyStepSequenceCore = (
    steps: readonly KernelStep[],
    initialGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>
): KernelApplyOutcome => {
    const graphs = new Map(initialGraphs)

    for (const step of steps) {
        if (step.kind === 'transferMembership') {
            const sourceGraph = graphs.get(step.fromHostId)
            const destGraph = graphs.get(step.toHostId)
            if (!sourceGraph || !destGraph) {
                return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
            }

            const objectIds = new Set<EphemeraObjectId>()
            const characterIds = new Set<EphemeraCharacterId>()
            for (const id of step.entityIds) {
                if (isEphemeraObjectId(id)) {
                    objectIds.add(id)
                }
                else if (isEphemeraCharacterId(id)) {
                    characterIds.add(id)
                }
            }

            for (const id of characterIds) {
                if (!sourceGraph.characterIds.has(id) || destGraph.characterIds.has(id)) {
                    return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                }
            }

            let nextSourceGraph = sourceGraph
            let nextDestGraph = destGraph

            if (objectIds.size > 0) {
                for (const id of objectIds) {
                    if (!nextSourceGraph.objectIds.has(id) || nextDestGraph.objectIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                }
                const outcome = applyTransferSetAsserted(nextSourceGraph, nextDestGraph, objectIds)
                if (outcome.verdict === 'illegal') {
                    return { verdict: 'illegal', reasonCode: outcome.reasonCode }
                }
                if (outcome.verdict === 'defer') {
                    return { verdict: 'defer', decidable: outcome.decidable, reasonCode: outcome.reasonCode }
                }
                nextSourceGraph = outcome.sourceGraph
                nextDestGraph = outcome.destGraph
            }

            for (const id of characterIds) {
                // No boundary-sweep, no carry-closure --- HostRelationalEdge is object-only
                // (BD-36's widening deferred), so a character can never have a relational edge.
                nextSourceGraph = nextSourceGraph.removeCharacterAsserted(id)
                nextDestGraph = nextDestGraph.addCharacter(id)
            }

            graphs.set(step.fromHostId, nextSourceGraph)
            graphs.set(step.toHostId, nextDestGraph)
            continue
        }

        // establishRelation / dissolveRelation: derive shared host from live graph state,
        // throw on mismatch (BD-33 assert-and-throw), else apply the patch there.
        const subjectHost = findHostOf(step.subjectId, graphs)
        const targetHost = findHostOf(step.targetId, graphs)
        if (subjectHost === undefined || targetHost === undefined) {
            return { verdict: 'illegal', reasonCode: 'staleRelationalCandidate' }
        }
        if (subjectHost !== targetHost) {
            throw new Error(
                `${step.subjectId}/${step.targetId} do not share a host --- structural invariant violated (sameHost should have repaired this)`
            )
        }
        const patched = graphs.get(subjectHost)!.applyRelationalPatch({
            hostId: subjectHost,
            edge: {
                from: step.subjectId,
                to: step.targetId,
                kind: step.relationKind,
                ...(step.relationLabel !== undefined ? { relationLabel: step.relationLabel } : {}),
            },
            op: step.kind === 'establishRelation' ? 'add' : 'remove',
        })
        graphs.set(subjectHost, patched)
    }

    return { verdict: 'legal', graphs }
}
