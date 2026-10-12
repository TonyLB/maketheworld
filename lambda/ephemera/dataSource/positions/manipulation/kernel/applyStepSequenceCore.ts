import { edgeKindAndLabelFrom, remainderCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { graphFromMeta } from '../../ludicGraph'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyDeparture, applyTransfer } from '../../ludicGraph/expandValidate/applyTransfer'
import { childParentBindingIdOf, parentHostOf } from '../../ludicGraph/presenceParent'
import type { EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ApplyDepartureOutcome, ApplyTransferOutcome } from '../../ludicGraph/expandValidate/applyTransfer'
import type { MutationKernelMovePresenceBindingStep, MutationKernelStep } from './kernelStep'
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
/**
 * Fills in which of the parent's bindings a new binding sits under, when the step named only the
 * parent host (a move: the compiler has no prior-state read). The parent graph is in the
 * footprint (the transfer puts the destination there), so the read is free and happens inside the
 * lock; unresolved --- no binding, or several --- leaves `presence` unset rather than guessing.
 */
const withParentPresence = (
    pointer: EphemeraPresenceParentPointer,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): EphemeraPresenceParentPointer => {
    const parentGraph = graphs.get(pointer.host)
    const presence = pointer.presence ?? (parentGraph ? childParentBindingIdOf(parentGraph) : undefined)
    return presence ? { host: pointer.host, presence } : { host: pointer.host }
}

/**
 * A move's presence write (`MutationKernelMovePresenceBindingStep`): re-point the named binding at
 * the named destination binding, keeping its id and cover (PR-21(e)). `undefined` is the `stale`
 * reason: the binding is gone, no longer sits under `from`, or the destination binding is gone.
 */
const movePresenceBinding = (
    graph: EphemeraLudicGraph,
    step: MutationKernelMovePresenceBindingStep,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): { graph: EphemeraLudicGraph } | { reasonCode: string } => {
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.presence)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    const stored = node.fromHostPresence
    const sitsUnderFrom = step.from === null
        ? !stored
        : stored?.host === step.from.host && stored.presence === step.from.presence
    if (!sitsUnderFrom) {
        return { reasonCode: 'presenceBindingMoved' }
    }
    const destination = graphs.get(step.to.host)
    if (!destination) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    if (!destination.presenceNodes.some(({ universalKey }) => universalKey === step.to.presence)) {
        return { reasonCode: 'destinationBindingMissing' }
    }
    return {
        graph: graph.replacePresenceNode({
            ...node,
            fromHostPresence: { host: step.to.host, presence: step.to.presence },
        }),
    }
}

/**
 * A whole's departure (`MutationKernelReleasePresenceBindingsStep`): every binding that carries a
 * parent pointer is removed when a hostless one remains; otherwise the first keeps its id and cover
 * with the pointer stripped, so a whole never drops below one binding.
 */
const releasePresenceBindings = (graph: EphemeraLudicGraph): EphemeraLudicGraph => {
    const parented = graph.presenceNodes.filter((node) => node.fromHostPresence)
    if (parented.length === 0) {
        return graph
    }
    if (graph.presenceNodes.length > parented.length) {
        return parented.reduce((current, node) => current.removePresenceNode(node.universalKey), graph)
    }
    const [kept, ...rest] = parented
    const { fromHostPresence: _departed, ...hostless } = kept
    return rest
        .reduce((current, node) => current.removePresenceNode(node.universalKey), graph)
        .replacePresenceNode(hostless)
}

/**
 * Membership counts bindings: a mover is a member of a host while **some binding of it points at that
 * host**. Read from the mover's own graph as it stands when the transfer runs (the compiler emits a
 * move's presence writes ahead of its transfer), so a transfer drops the node from a departure host
 * only with the mover's last binding there, and adds it at an arrival host only for its first. A
 * mover whose own graph is not in the footprint (hand-built sequences) has no bindings to read, so
 * membership there is the old unconditional host-level transfer.
 */
const bindingPointsAt = (
    entityId: EphemeraLudicTerminalId,
    hostId: EphemeraMembershipHostId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): boolean => (
    typeof entityId === 'string'
        && (graphs.get(entityId as EphemeraMembershipHostId)?.presenceNodes ?? []).some((node) => parentHostOf(node) === hostId)
)

const withDest = (departure: ApplyDepartureOutcome, destGraph: EphemeraLudicGraph): ApplyTransferOutcome => (
    departure.verdict === 'repairable' ? departure : { verdict: 'legal', sourceGraph: departure.sourceGraph, destGraph }
)

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
 * (`fromHostIds` has exactly one member, `toHostId` non-null): the entity --- object or
 * character --- routes through `applyTransfer` (it dispatches by kind itself,
 * `removeObject`/`addObject` for objects and `removeCharacter`/`addCharacter` for characters, so no
 * separate character swap is needed here; only objects get the full boundary-edge legality
 * machinery, since a character can never carry a relational edge). **Room/Feature/Area never
 * relocate**, so a Room/Feature id reaching this branch **throws** before `applyTransfer` ---
 * which has no dispatch for either kind --- is ever called; a caller bug is a structural-invariant
 * violation, so it belongs on the throw side of the split described below. **Pure remove**
 * (`toHostId === null`) and **pure add** (`fromHostIds` empty) share one kind-agnostic loop over
 * `nodeIds`/`addNode`/`removeNode` (`EphemeraLudicGraph`'s own kind dispatch) rather than one
 * loop per entity kind: a presence-check then
 * `removeNode`/`addNode` for each host --- no boundary-sweep here, since the caller is responsible
 * for having already seeded explicit `dissolveRelation` steps for every edge the entity carried; a
 * residual edge means
 * `removeNode`'s underlying `removeObject`/`removeCharacter`/`removeRoom`/`removeFeature` throws, the
 * fail-loud contract BD-33 wants. A freshly spawned/authored entity has no prior edges, so pure add
 * needs no assert.
 *
 * `establishRelation`/`dissolveRelation`: confirms the step's own carried `hostId` 
 * against live graph state (BD-33 assert-and-throw), throws on mismatch, else applies the patch.
 *
 * Structural-invariant violations (BD-33's host mismatch; `RelationalEdgeStillReferencedError` from
 * inside `applyTransfer`/`removeObject`/`removeCharacter`; a Room/Feature id in a real transfer;
 * the end-of-sequence character presence check below) throw, uniformly in both modes --- not a
 * `MutationKernelApplyOutcome` verdict. Legitimate outcomes return through the discriminated result,
 * and there are only two non-`legal` ones: `stale` (stale candidate, host outside the locked
 * footprint) and `repairable` (`unresolvedDissolveEdge`; an interaction edge that would have to be
 * severed; a `Custom` edge, whose named repair is the classification this layer cannot perform).
 * This function has no verdict meaning "the world forbids this" because it makes no such judgment
 * --- it checks mechanism, and legality is the enrich tier's question. See `types.ts`.
 *
 * `addPresenceBinding`/`movePresenceBinding`/`releasePresenceBindings`/`repairPresenceBinding`: a host's own presence
 * bindings --- population's mint, a move's re-point (`movePresenceBinding`, above), a departure, and
 * population's in-place repair. See `kernelStep.ts`'s doc comments.
 *
 * `createComponent`: seeds a not-yet-existing host's graph empty, holding one hostless remainder,
 * so the component is born with a binding. Throws if the host is already in `graphs`.
 *
 * `destroyComponent`: drops the host from the outcome, so `commitStepSequence` deletes its row.
 * Throws if the host's graph still holds anything but its own root and its own presence bindings.
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
                // real (single-from, single-to) transfer is a caller bug --- `applyTransfer` has
                // no dispatch for either kind, and every caller emits a pure add for them instead
                // (see `kernelStep.ts`'s doc comment). The Throw-vs-verdict rule stated at the head
                // of this file puts structural-invariant violations outside the result type, so this
                // throws rather than returning a verdict; `commitStepSequence`'s BD-31 collapse
                // throws from inside the same reducer and lands in the same catch.
                if (isEphemeraRoomId(step.entityId) || isEphemeraFeatureId(step.entityId)) {
                    throw new Error(
                        `transferMembership carries a Room or Feature id into a real transfer --- structural invariant violated (Room/Feature/Area are hosts that never relocate; step 3's callers emit a pure add for them)`
                    )
                }
                const entityId = step.entityId

                const [fromHostId] = fromHostIds as [EphemeraMembershipHostId]
                const sourceGraph = graphs.get(fromHostId)
                const destGraph = graphs.get(toHostId)
                if (!sourceGraph || !destGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }

                const leaves = !bindingPointsAt(entityId, fromHostId, graphs)
                const alreadyAtDest = destGraph.nodeIds.has(entityId)
                // Arriving where the node already is stays stale unless another binding of the mover
                // is what put it there (this move's own pointer, plus an earlier one).
                const arrives = !alreadyAtDest
                if ((leaves && !sourceGraph.nodeIds.has(entityId)) || (alreadyAtDest && !bindingPointsAt(entityId, toHostId, graphs))) {
                    return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                }

                // applyTransfer dispatches both objects and characters itself --- no separate
                // character add/remove needed here.
                const outcome: ApplyTransferOutcome = leaves && arrives
                    ? applyTransfer(sourceGraph, destGraph, entityId)
                    : leaves
                        ? withDest(applyDeparture(sourceGraph, entityId), destGraph)
                        : { verdict: 'legal', sourceGraph, destGraph: arrives ? destGraph.addNode(entityId) : destGraph }
                // `applyTransfer` names the offending edge but not the host it sits on --- it is
                // handed two graphs and knows neither's id. Supply `fromHostId` here: boundary
                // edges are found on the *source* graph, so that is where a repair step would have
                // to be aimed. `repairKind` passes through untouched --- mapping reason codes back
                // to repair kinds here would re-derive at the boundary exactly what the layer below
                // already knew.
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

                graphs.set(fromHostId, outcome.sourceGraph)
                graphs.set(toHostId, outcome.destGraph)
                continue
            }

            // Pure remove (no destination) or pure add (no departure hosts): the entity is
            // added/removed on each host independently --- there is no boundary sweep to run
            // here (the caller already seeded explicit `dissolveRelation`
            // steps for a pure remove; a pure add is a freshly-spawned entity with no prior edges).
            // `nodeIds`/`addNode`/`removeNode` cover all four entity kinds ---
            // `EphemeraLudicGraph.addNode`/`removeNode` is the
            // kind-dispatch, so this branch doesn't have to re-derive it per kind.
            for (const fromHostId of fromHostIds) {
                const sourceGraph = graphs.get(fromHostId)
                if (!sourceGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }
                if (!sourceGraph.nodeIds.has(step.entityId)) {
                    return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                }
                // Still a member while another binding of the mover points here.
                if (bindingPointsAt(step.entityId, fromHostId, graphs)) {
                    continue
                }
                graphs.set(fromHostId, sourceGraph.removeNode(step.entityId))
            }

            if (toHostId !== null) {
                const destGraph = graphs.get(toHostId)
                if (!destGraph) {
                    return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
                }
                if (destGraph.nodeIds.has(step.entityId)) {
                    return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
                }
                graphs.set(toHostId, destGraph.addNode(step.entityId))
            }
            continue
        }

        if (step.kind === 'createComponent') {
            // The created host is never fetched, so it is in `graphs` only if an earlier step in
            // this sequence already created it: a caller bug, not a stale world.
            if (graphs.has(step.hostId)) {
                throw new Error(
                    `createComponent: ${step.hostId} is already in the footprint --- structural invariant violated (a component is created once, and never over a fetched host)`
                )
            }
            graphs.set(step.hostId, graphFromMeta({}, step.hostId).addPresenceNode({
                tag: 'Presence',
                universalKey: PresenceKey(step.presenceUuid),
                cover: remainderCover(),
            }))
            continue
        }

        if (step.kind === 'destroyComponent') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            // Contents must leave first (earlier in this sequence, or in an earlier commit): deleting
            // the host's row would strand them. A structural invariant, so a throw rather than a verdict.
            const heldIds = [...graph.nodeIds].filter((id) => id !== step.hostId && !graph.presenceNodes.some((node) => node.universalKey === id))
            const leftBehind = [
                ...(heldIds.length > 0 ? [`${heldIds.length} hosted node(s) (${heldIds.join(', ')})`] : []),
                ...(graph.relationalEdges.length > 0 ? [`${graph.relationalEdges.length} relational edge(s)`] : []),
                ...(graph.ports.length > 0 ? [`${graph.ports.length} port(s)`] : []),
            ]
            if (leftBehind.length > 0) {
                throw new Error(
                    `destroyComponent: ${step.hostId} still holds ${leftBehind.join(', ')} --- structural invariant violated (contents must leave before their host is destroyed)`
                )
            }
            graphs.delete(step.hostId)
            continue
        }

        if (step.kind === 'addPresenceBinding') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            // presenceNodes Slice 7a (PN-23): mints the presence node directly, with no port
            // record --- `EphemeraPresencePort` is retired, and `presenceUuid` (minted at
            // compile time, `presenceBindingStepsForMove.ts`) becomes the node's `universalKey`
            // suffix on its own. A sole remainder by default -- nothing here computes real bucket
            // membership; that is future work, not a migration of anything that exists today (no
            // `Present` edge was ever written to derive it from).
            const withNode = graph.addPresenceNode({
                tag: 'Presence',
                universalKey: PresenceKey(step.presenceUuid),
                ...(step.fromHostPresence ? { fromHostPresence: withParentPresence(step.fromHostPresence, graphs) } : {}),
                cover: step.cover ?? remainderCover(),
            })
            graphs.set(step.hostId, withNode)
            continue
        }
        if (step.kind === 'movePresenceBinding') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            const moved = movePresenceBinding(graph, step, graphs)
            if ('reasonCode' in moved) {
                return { verdict: 'stale', reasonCode: moved.reasonCode }
            }
            graphs.set(step.hostId, moved.graph)
            continue
        }
        if (step.kind === 'releasePresenceBindings') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            graphs.set(step.hostId, releasePresenceBindings(graph))
            continue
        }
        // Stubs (presenceMoves Slices 3 and 4). A join is deliberately a no-op: a multi-binding move
        // leaves its bindings side by side until it has a body.
        if (step.kind === 'joinPresenceBindings') {
            continue
        }
        if (step.kind === 'splitPresenceBinding') {
            return { verdict: 'stale', reasonCode: 'notImplemented' }
        }

        if (step.kind === 'repairPresenceBinding') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            if (!graph.presenceNodes.some((node) => node.universalKey === step.presenceId)) {
                return { verdict: 'stale', reasonCode: 'presenceBindingMissing' }
            }
            graphs.set(step.hostId, graph.replacePresenceNode({
                tag: 'Presence',
                universalKey: step.presenceId,
                ...(step.fromHostPresence ? { fromHostPresence: step.fromHostPresence } : {}),
                cover: step.cover,
            }))
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

    // At-most-one presence stopped being reducer-enforced when `setPresencePort` split into
    // add/remove, so it is re-enforced here for the one kind still restricted to it: characters,
    // per AGENT.contract.md's "a character's membership host is a ROOM, and only a ROOM ... it
    // lifts when that work does". Objects get no such check, deliberately --- multi-presence for
    // objects is the point. End-of-sequence, not per-step, so the invariant never depends on
    // emission order. A move re-points a character's one binding and a disconnect keeps it
    // hostless, so an offline character still has exactly one. This is a
    // structural-invariant violation (BD-33's category, `types.ts`'s "Throw vs. verdict"), not a
    // `MutationKernelApplyOutcome` verdict, and a ratchet on new writes, not a repair --- a
    // character already carrying a stale or duplicate binding before this sequence ran is
    // untouched. Counts presence NODES (presenceNodes Slice 7a) rather than presence ports,
    // which no longer exist.
    [...graphs.entries()]
        .filter(([hostId]) => isEphemeraCharacterId(hostId))
        .forEach(([hostId, graph]) => {
            const presenceCount = graph.presenceNodes.length
            if (presenceCount > 1) {
                throw new Error(
                    `applyStepSequenceCore: character ${hostId} would carry ${presenceCount} presence bindings --- ` +
                    `violates the single-hosted restriction in AGENT.contract.md ("A character's membership host is a ROOM, and only a ROOM ... it lifts when that work does"). ` +
                    `If that restriction has been lifted, this validator should be removed, not bypassed.`
                )
            }
        })

    return { verdict: 'legal', graphs, captures }
}
