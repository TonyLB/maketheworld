import { edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyTransferSet } from '../../ludicGraph/expandValidate/applyTransferSet'
import type { MutationKernelStep } from './kernelStep'
import type { MutationKernelApplyOutcome } from './types'

/**
 * The hosts (plural) an id currently appears on as a node. A node can legitimately be a member of
 * more than one locked graph at once: an AB-54 hosting kind (`On`/`In`/`PartOf`) makes a host object both an ordinary member of
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
 * `establishRelation`/`dissolveRelation` carry their own `hostId`, computed once at Expansion
 * (`expandSameHost`'s resolved host; each `buildCrossingLegs` leg's own placement); this function's
 * job is to confirm that carried value against live footprint state, not to derive a host from
 * scratch.
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
 * `transferMembership` (BD-36) dispatches by shape on `fromHostIds`/`toHostId`. **Real transfer**
 * (`fromHostIds` has exactly one member, `toHostId` non-null): the whole `entityIds` set --- objects
 * and characters together --- routes through `applyTransferSet` (it dispatches by kind itself,
 * `removeObject`/`addObject` for objects and `removeCharacter`/`addCharacter` for characters, so no
 * separate character swap is needed here; only objects get the full boundary-edge legality
 * machinery, since a character can never carry a relational edge). **Room/Feature/Area never
 * relocate**, so a Room/Feature id reaching this branch **throws** before `applyTransferSet` ---
 * which has no dispatch for either kind --- is ever called; a caller bug is a structural-invariant
 * violation, so it belongs on the throw side of the split described below. **Pure remove**
 * (`toHostId === null`) and **pure add** (`fromHostIds` empty) share one kind-agnostic loop over
 * `nodeIds`/`addNode`/`removeNode` (`EphemeraLudicGraph`'s own kind dispatch, RD-4) rather than one
 * loop per entity kind: a presence-check then
 * `removeNode`/`addNode` for each host --- no boundary-sweep here, since the caller is responsible
 * for having already seeded explicit `dissolveRelation` steps for every edge the entity carried (an
 * object-lifecycle route uses `boundaryEdgeOutcomes` on a singleton set, collapsing every outcome to
 * "sever it", since there's no destination to carry into or defer against); a residual edge means
 * `removeNode`'s underlying `removeObject`/`removeCharacter`/`removeRoom`/`removeFeature` throws, the
 * fail-loud contract BD-33 wants. A freshly spawned/authored entity has no prior edges, so pure add
 * needs no assert.
 *
 * `establishRelation`/`dissolveRelation`: confirms the step's own carried `hostId` 
 * against live graph state (BD-33 assert-and-throw), throws on mismatch, else applies the patch.
 *
 * Structural-invariant violations (BD-33's host mismatch; `RelationalEdgeStillReferencedError` from
 * inside `applyTransferSet`/`removeObject`/`removeCharacter`; a Room/Feature id in a real transfer;
 * the end-of-sequence character presence check below) throw, uniformly in both modes --- not a
 * `MutationKernelApplyOutcome` verdict. Legitimate outcomes return through the discriminated result,
 * and there are only two non-`legal` ones: `stale` (stale candidate, host outside the locked
 * footprint) and `repairable` (`unresolvedDissolveEdge`; an interaction edge that would have to be
 * severed; a `Custom` edge, whose named repair is the classification this layer cannot perform).
 * This function has no verdict meaning "the world forbids this" because it makes no such judgment
 * --- it checks mechanism, and legality is the enrich tier's question. See `types.ts`.
 *
 * `addPresencePort`/`removePresencePort` (RD-2): the moved entity's own presence
 * binding, one step per add or remove rather than one step replacing whatever was there --- see
 * `kernelStep.ts`'s doc comments. `removePresencePort` is a plain filter-by-`fromHostId`, so
 * removing an absent binding is a silent no-op.
 *
 * `capture`: snapshots `graphs.get(hostId).characterIds` into the returned `captures` map and
 * moves on --- the one step kind that never touches `graphs`. Reading the map at the step's own
 * position (not resorted, same as every other step here) is what makes the snapshot positional rather
 * than terminal. A host missing from the map --- not locked into the footprint --- is the same
 * `stale`/`hostNotInFootprint` outcome every other host-lookup miss in this function already returns.
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
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            captures.set(step.captureId, [...hostGraph.characterIds])
            continue
        }

        if (step.kind === 'transferMembership') {
            const fromHostIds = [...step.fromHostIds]
            const toHostId = step.toHostId

            // Real transfer: exactly the shape the two already-migrated player routes produce.
            if (fromHostIds.length === 1 && toHostId !== null) {
                // Room/Feature/Area are hosts that never relocate, so a Room/Feature id reaching a
                // real (single-from, single-to) transfer is a caller bug --- `applyTransferSet` has
                // no dispatch for either kind, and every caller emits a pure add for them instead
                // (see `kernelStep.ts`'s doc comment). The Throw-vs-verdict rule stated at the head
                // of this file puts structural-invariant violations outside the result type, so this
                // throws rather than returning a verdict; `commitStepSequence`'s BD-31 collapse
                // throws from inside the same reducer and lands in the same catch.
                const hasRoomOrFeature = [...step.entityIds].some((id) => isEphemeraRoomId(id) || isEphemeraFeatureId(id))
                if (hasRoomOrFeature) {
                    throw new Error(
                        `transferMembership carries a Room or Feature id into a real transfer --- structural invariant violated (Room/Feature/Area are hosts that never relocate; step 3's callers emit a pure add for them)`
                    )
                }

                const [fromHostId] = fromHostIds as [EphemeraMembershipHostId]
                const sourceGraph = graphs.get(fromHostId)
                const destGraph = graphs.get(toHostId)
                if (!sourceGraph || !destGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }

                for (const id of step.entityIds) {
                    if (!sourceGraph.nodeIds.has(id) || destGraph.nodeIds.has(id)) {
                        return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                    }
                }

                let nextSourceGraph = sourceGraph
                let nextDestGraph = destGraph

                if (step.entityIds.size > 0) {
                    // applyTransferSet dispatches both objects and characters itself --- no
                    // separate character add/remove loop needed here. Safe cast: the guard above
                    // already confirmed entityIds contains no Room/Feature id.
                    const outcome = applyTransferSet(
                        nextSourceGraph,
                        nextDestGraph,
                        step.entityIds as ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
                    )
                    // `applyTransferSet` names the offending edge but not the host it sits on ---
                    // it is handed two graphs and knows neither's id. Supply `fromHostId` here:
                    // boundary edges are found on the *source* graph, so that is where a repair
                    // step would have to be aimed. `repairKind` passes through untouched --- mapping
                    // reason codes back to repair kinds here would re-derive at the boundary exactly
                    // what the layer below already knew.
                    if (outcome.verdict === 'repairable') {
                        return {
                            verdict: 'repairable',
                            reasonCode: outcome.reasonCode,
                            authority: outcome.authority,
                            repair: {
                                kind: outcome.repairKind,
                                hostId: fromHostId,
                                edge: outcome.edge,
                            },
                        }
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
            // One loop over `nodeIds`/`addNode`/`removeNode` covers all four entity kinds ---
            // `EphemeraLudicGraph.addNode`/`removeNode` (RD-4) is the
            // kind-dispatch, so this branch doesn't have to re-derive it per kind.
            for (const fromHostId of fromHostIds) {
                const sourceGraph = graphs.get(fromHostId)
                if (!sourceGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }
                let nextSourceGraph = sourceGraph
                for (const id of step.entityIds) {
                    if (!nextSourceGraph.nodeIds.has(id)) {
                        return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                    }
                    nextSourceGraph = nextSourceGraph.removeNode(id)
                }
                graphs.set(fromHostId, nextSourceGraph)
            }

            if (toHostId !== null) {
                const destGraph = graphs.get(toHostId)
                if (!destGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }
                let nextDestGraph = destGraph
                for (const id of step.entityIds) {
                    if (nextDestGraph.nodeIds.has(id)) {
                        return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                    }
                    nextDestGraph = nextDestGraph.addNode(id)
                }
                graphs.set(toHostId, nextDestGraph)
            }
            continue
        }

        if (step.kind === 'addPresencePort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            graphs.set(step.hostId, graph.addPort(step.port))
            continue
        }
        if (step.kind === 'removePresencePort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            // A silent no-op when no `Present` port carries this `fromHostId` --- deliberate
            // (RD-2): it is what lets the compiler emit one of these per departure host without
            // knowing which one, if any, actually held the port.
            const withoutBinding = graph.ports
                .filter((port) => port.kind === 'Present' && port.fromHostId === step.fromHostId)
                .reduce((current, port) => current.removePort(port.portId), graph)
            graphs.set(step.hostId, withoutBinding)
            continue
        }

        // a crossing port's own add/remove, by portId (not at-most-one --- see
        // `MutationKernelAddCrossingPortStep`'s doc comment).
        if (step.kind === 'addCrossingPort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            graphs.set(step.hostId, graph.addPort(step.port))
            continue
        }
        if (step.kind === 'removeCrossingPort') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
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
            return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
        }
        const { subjectHosts, targetHosts } = confirmCarriedHost(step.subjectId, step.targetId, step.hostId, graphs)
        if (subjectHosts.length === 0 || targetHosts.length === 0) {
            return { verdict: 'stale', reasonCode: 'staleRelationalCandidate' }
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

    // RD-2's other half: at-most-one presence stopped being reducer-enforced when `setPresencePort`
    // split into add/remove, so it is re-enforced here for the one kind still restricted to it
    // (RD-1, AGENT.contract.md's "a character's membership host is a ROOM, and only a ROOM ...
    // it lifts when that work does"). Objects get no such check, deliberately --- multi-presence is
    // the point of this whole plan. End-of-sequence, not per-step: the compiler emits remove-then-
    // add, so a per-step check would make the invariant depend on emission order. This is a
    // structural-invariant violation (BD-33's category, `types.ts`'s "Throw vs. verdict"), not a
    // `MutationKernelApplyOutcome` verdict, and a ratchet on new writes, not a repair --- a
    // character already carrying a stale or duplicate port before this sequence ran is untouched.
    [...graphs.entries()]
        .filter(([hostId]) => isEphemeraCharacterId(hostId))
        .forEach(([hostId, graph]) => {
            const presenceCount = graph.ports.filter((port) => port.kind === 'Present').length
            if (presenceCount > 1) {
                throw new Error(
                    `applyStepSequenceCore: character ${hostId} would carry ${presenceCount} presence ports --- ` +
                    `violates the single-hosted restriction in AGENT.contract.md ("A character's membership host is a ROOM, and only a ROOM ... it lifts when that work does"). ` +
                    `If that restriction has been lifted, this validator should be removed, not bypassed.`
                )
            }
        })

    return { verdict: 'legal', graphs, captures }
}
