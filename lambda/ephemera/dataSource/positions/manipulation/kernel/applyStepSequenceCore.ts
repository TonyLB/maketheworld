import { edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyTransferSet } from '../../ludicGraph/expandValidate/applyTransferSet'
import type { MutationKernelStep } from './kernelStep'
import type { MutationKernelApplyOutcome } from './types'

/**
 * The hosts (plural) an id currently appears on as a node --- LP4g's `findHostOf`, widened from a
 * single-match short-circuit. A node can legitimately be a member of more than one locked graph at
 * once: an AB-54 hosting kind (`On`/`In`/`PartOf`) makes a host object both an ordinary member of
 * whatever *it* sits in (its own container) and the self-referencing root of its own shard --- both
 * of those graphs can be in the same footprint (e.g. a `put cup on table` transfer locks the room
 * *and* the table's own shard). Returning every match, not just the first one met while walking the
 * map, is what lets the caller below tell "genuinely on two different hosts" apart from "this
 * particular id happens to be a node of two graphs, only one of which is shared with the other
 * endpoint."
 */
const hostsOf = (
    id: EphemeraLudicTerminalId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): EphemeraMembershipHostId[] => {
    if (typeof id !== 'string') {
        // A port address names its own host directly (owner) --- graph-local addressing, not
        // membership search. This is a *candidate*, not a veto: the exterior side of a
        // crossing has no port record of its own, so its port-address endpoint's owner will not
        // match the edge's carried `hostId` --- `confirmCarriedHost` skips the membership check
        // for a port-address endpoint entirely rather than trying to reconcile this candidate.
        return [id.owner]
    }
    const hosts: EphemeraMembershipHostId[] = []
    for (const [hostId, graph] of graphs) {
        if (graph.nodeIds.has(id)) {
            hosts.push(hostId)
        }
    }
    return hosts
}

/**
 * This is narrowed from a *resolver* to an *assertion*: `establishRelation`/
 * `dissolveRelation` now carry their own `hostId`, computed once at Expansion
 * (`expandSameHost`'s resolved host; each `buildCrossingLegs` leg's own placement) --- this
 * function's job is to confirm that carried value against live footprint state, not to derive it
 * from scratch the way the old intersection-based version did (see git history for that version's
 * own doc comment, which explained the AB-54 mis-resolution its intersection approach fixed; that
 * reasoning is now Expansion's problem, not commit's).
 *
 * `hostsOf` still separates two outcomes: an endpoint absent from the *entire* locked footprint
 * (legitimately stale --- the world can change between Expansion and commit, `illegal`, not a
 * throw) from an endpoint present somewhere but not on the *carried* host (a structural invariant
 * violation --- BD-33's throw, now meaning Expansion computed the wrong host rather than an
 * unresolvable intersection).
 *
 * A port-address endpoint carries no membership check here, unchanged from the old resolver's own
 * fallback: a crossing leg's exterior side lives in the *primitive* endpoint's own host,
 * referencing a port record that lives elsewhere (on its own `addCrossingPort`/`removeCrossingPort`
 * step's `hostId`, locked separately) --- there is nothing for `hostsOf`'s owner-derived candidate
 * to confirm against the carried host.
 */
const confirmCarriedHost = (
    subjectId: EphemeraLudicTerminalId,
    targetId: EphemeraLudicTerminalId,
    hostId: EphemeraMembershipHostId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): { subjectHosts: EphemeraMembershipHostId[]; targetHosts: EphemeraMembershipHostId[] } => {
    const subjectHosts = hostsOf(subjectId, graphs)
    const targetHosts = hostsOf(targetId, graphs)
    // Emptiness (an endpoint absent from the whole footprint) is the caller's `staleRelationalCandidate`
    // outcome, not this function's throw --- checked here too so a genuinely stale candidate never
    // gets misreported as a wrong-host structural violation just because it also fails the `includes` test.
    if (subjectHosts.length === 0 || targetHosts.length === 0) {
        return { subjectHosts, targetHosts }
    }
    if (typeof subjectId === 'string' && !subjectHosts.includes(hostId)) {
        throw new Error(
            `${subjectId}/${targetId} do not share host ${hostId} --- structural invariant violated (a relational step reaching here should carry the host Expansion actually resolved)`
        )
    }
    if (typeof targetId === 'string' && !targetHosts.includes(hostId)) {
        throw new Error(
            `${subjectId}/${targetId} do not share host ${hostId} --- structural invariant violated (a relational step reaching here should carry the host Expansion actually resolved)`
        )
    }
    return { subjectHosts, targetHosts }
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
 * `establishRelation`/`dissolveRelation`: confirms the step's own carried `hostId` 
 * against live graph state (BD-33 assert-and-throw), throws on mismatch, else applies the patch.
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

        if (step.kind === 'setPresencePort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
            }
            const withoutPresence = graph.ports
                .filter((port) => port.kind === 'Present')
                .reduce((current, port) => current.removePort(port.portId), graph)
            graphs.set(step.hostId, step.port ? withoutPresence.addPort(step.port) : withoutPresence)
            continue
        }

        // a crossing port's own add/remove, by portId (not at-most-one --- see
        // `MutationKernelAddCrossingPortStep`'s doc comment).
        if (step.kind === 'addCrossingPort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
            }
            graphs.set(step.hostId, graph.addPort(step.port))
            continue
        }
        if (step.kind === 'removeCrossingPort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
            }
            graphs.set(step.hostId, graph.removePort(step.portId))
            continue
        }

        // establishRelation / dissolveRelation: confirm the carried hostId against live
        // graph state, throw on mismatch (BD-33 assert-and-throw, unchanged discipline), else apply
        // the patch there. See `confirmCarriedHost`'s doc comment for the stale-vs-throw split.
        // `hostNotInFootprint` is checked before the throw-capable assertion below, since a hostId
        // absent from the footprint entirely is a footprint bug, not a wrong-host structural claim.
        const hostGraph = graphs.get(step.hostId)
        if (!hostGraph) {
            return { verdict: 'illegal', reasonCode: 'hostNotInFootprint' }
        }
        const { subjectHosts, targetHosts } = confirmCarriedHost(step.subjectId, step.targetId, step.hostId, graphs)
        if (subjectHosts.length === 0 || targetHosts.length === 0) {
            return { verdict: 'illegal', reasonCode: 'staleRelationalCandidate' }
        }
        const patched = hostGraph.applyRelationalPatch({
            hostId: step.hostId,
            edge: {
                from: step.subjectId,
                to: step.targetId,
                ...edgeKindAndLabelFrom(step),
            },
            op: step.kind === 'establishRelation' ? 'add' : 'remove',
        })
        graphs.set(step.hostId, patched)
    }

    return { verdict: 'legal', graphs, captures }
}
