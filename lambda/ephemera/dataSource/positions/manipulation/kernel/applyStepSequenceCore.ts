import { edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyTransferSet } from '../../ludicGraph/expandValidate/applyTransferSet'
import type { MutationKernelStep } from './kernelStep'
import type { MutationKernelApplyOutcome } from './types'

// LP4g: widened from EphemeraObjectId/graph.objectIds to the full terminal-kind set,
// via the kind-indifferent nodeIds getter LP4 built for exactly this purpose.
const findHostOf = (
    id: EphemeraLudicTerminalPrimitive,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): EphemeraMembershipHostId | undefined => {
    for (const [hostId, graph] of graphs) {
        if (graph.nodeIds.has(id)) {
            return hostId
        }
    }
    return undefined
}

/**
 * BD-27c's shared, pure apply core: walks an ordered `MutationKernelStep[]` once, dispatching per specific
 * primitive (never per `kind` grouping, mirroring the Synthesize executor's own `commandExpand`
 * dispatch). Applying the array in-order (not resorting it) is what makes the sequencing contract
 * hold: a paired `dissolveRelation` step always mutates the graph map before a following
 * `transferMembership` step reads it, because the worklist that produced this array already
 * guaranteed that order.
 *
 * `transferMembership` (BD-36-generalized, and object-lifecycle-Migrate-row-widened): dispatches by
 * shape on `fromHostIds`/`toHostId`. **Real transfer** (`fromHostIds` has exactly one member,
 * `toHostId` non-null): the whole `entityIds` set --- objects and characters together --- routes
 * through `applyTransferSet` (LP4h: it dispatches by kind itself, `removeObject`/`addObject` for
 * objects and `removeCharacter`/`addCharacter` for characters, so no separate character swap is
 * needed here; only objects get the full boundary-edge legality machinery, since a character can
 * never carry a relational edge, BD-36's widening deferred). **Pure remove** (`toHostId === null`):
 * splits `entityIds` by kind (still needed here, unlike the real-transfer branch above) and for each
 * host
 * in `fromHostIds`, a presence-check then `removeObject`/`removeCharacter` directly --- no
 * boundary-sweep here, since the caller is responsible for having already seeded explicit
 * `dissolveRelation` steps for every edge the entity carried (an object-lifecycle route uses
 * `boundaryEdgeOutcomes` on a singleton set, collapsing every outcome to "sever it", since there's
 * no destination to carry into or defer against); a residual edge means `removeObject` throws, the
 * fail-loud contract BD-33 wants. **Pure add** (`fromHostIds` empty): `addObject`/`addCharacter`
 * onto `destGraph` only --- a freshly spawned entity has no prior edges, so no assert is needed.
 *
 * `establishRelation`/`dissolveRelation`: derives the shared host live from the graph map (BD-33
 * assert-and-throw --- these steps carry no host field), throws on mismatch, else applies the patch.
 *
 * Structural-invariant violations (BD-33's host mismatch; `RelationalEdgeStillReferencedError` from
 * inside `applyTransferSet`/`removeObject`/`removeCharacter`) throw, uniformly in both modes --- not
 * a `MutationKernelApplyOutcome` verdict. Legitimate legality outcomes (stale candidate, `Custom`-edge defer,
 * `unresolvedDissolveEdge`) return through the discriminated result.
 *
 * `capture` (PB-J): snapshots `graphs.get(hostId).characterIds` into the returned `captures` map and
 * moves on --- the one step kind that never touches `graphs`. Reading the map at the step's own
 * position (not resorted, same as every other step here) is what makes the snapshot positional rather
 * than terminal. A host missing from the map --- not locked into the footprint --- is the same
 * `hostNotInFootprint` illegality every other host-lookup miss in this function already returns.
 */
export const applyStepSequenceCore = (
    steps: readonly MutationKernelStep[],
    initialGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): MutationKernelApplyOutcome => {
    const graphs = new Map(initialGraphs)
    const captures = new Map<string, readonly EphemeraCharacterId[]>()

    for (const step of steps) {
        if (step.kind === 'capture') {
            const hostGraph = graphs.get(step.hostId)
            if (!hostGraph) {
                return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
            }
            captures.set(step.captureId, [...hostGraph.characterIds])
            continue
        }

        if (step.kind === 'transferMembership') {
            const fromHostIds = [...step.fromHostIds]
            const toHostId = step.toHostId

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

            // Real transfer: exactly the shape the two already-migrated player routes produce.
            if (fromHostIds.length === 1 && toHostId !== null) {
                const [fromHostId] = fromHostIds as [EphemeraMembershipHostId]
                const sourceGraph = graphs.get(fromHostId)
                const destGraph = graphs.get(toHostId)
                if (!sourceGraph || !destGraph) {
                    return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
                }

                for (const id of step.entityIds) {
                    if (!sourceGraph.nodeIds.has(id) || destGraph.nodeIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                }

                let nextSourceGraph = sourceGraph
                let nextDestGraph = destGraph

                if (step.entityIds.size > 0) {
                    // LP4h: applyTransferSet dispatches both objects and characters itself --- no
                    // separate character add/remove loop needed here.
                    const outcome = applyTransferSet(nextSourceGraph, nextDestGraph, step.entityIds)
                    if (outcome.verdict === 'illegal') {
                        return { verdict: 'illegal', reasonCode: outcome.reasonCode }
                    }
                    if (outcome.verdict === 'defer') {
                        return { verdict: 'defer', decidable: outcome.decidable, reasonCode: outcome.reasonCode }
                    }
                    nextSourceGraph = outcome.sourceGraph
                    nextDestGraph = outcome.destGraph
                }

                graphs.set(fromHostId, nextSourceGraph)
                graphs.set(toHostId, nextDestGraph)
                continue
            }

            // Pure remove (no destination) or pure add (no departure hosts): each entity id is
            // added/removed on its own host independently --- there is no boundary-sweep or
            // carry-closure to run here (the caller already seeded explicit `dissolveRelation`
            // steps for a pure remove; a pure add is a freshly-spawned entity with no prior edges).
            for (const fromHostId of fromHostIds) {
                const sourceGraph = graphs.get(fromHostId)
                if (!sourceGraph) {
                    return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
                }
                let nextSourceGraph = sourceGraph
                for (const id of objectIds) {
                    if (!nextSourceGraph.objectIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                    nextSourceGraph = nextSourceGraph.removeObject(id)
                }
                for (const id of characterIds) {
                    if (!nextSourceGraph.characterIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                    nextSourceGraph = nextSourceGraph.removeCharacter(id)
                }
                graphs.set(fromHostId, nextSourceGraph)
            }

            if (toHostId !== null) {
                const destGraph = graphs.get(toHostId)
                if (!destGraph) {
                    return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
                }
                let nextDestGraph = destGraph
                for (const id of objectIds) {
                    if (nextDestGraph.objectIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                    nextDestGraph = nextDestGraph.addObject(id)
                }
                for (const id of characterIds) {
                    if (nextDestGraph.characterIds.has(id)) {
                        return { verdict: 'illegal', reasonCode: 'staleTransferCandidate' }
                    }
                    nextDestGraph = nextDestGraph.addCharacter(id)
                }
                graphs.set(toHostId, nextDestGraph)
            }
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
                ...edgeKindAndLabelFrom(step),
            },
            op: step.kind === 'establishRelation' ? 'add' : 'remove',
        })
        graphs.set(subjectHost, patched)
    }

    return { verdict: 'legal', graphs, captures }
}
