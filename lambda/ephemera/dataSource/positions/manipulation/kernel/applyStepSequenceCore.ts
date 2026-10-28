import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID, edgeKindAndLabelFrom, isHostingRelationKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { coverageViolationsOf, mergeablePairOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { graphFromMeta } from '../../ludicGraph'
import { connectedToPairsOf, parentsOf } from '../../ludicGraph/presenceParent'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MutationKernelStep } from './kernelStep'
import { isBystanderMove } from './bystander'
import { bindingPointsAt, settleMembership } from './settleMembership'
import { settleParentChange, writeCoverIndex } from './presenceStepWrites'
import { reparentPresenceBinding } from './reparentPresenceBinding'
import { joinBindings } from './joinPresenceBindings'
import { splitPresenceBinding } from './splitPresenceBinding'
import { connectedToViolation } from './connectedToLegality'
import { settleParentless } from './settleParentless'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
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
 * presence step's departure checks its boundary edges, because the worklist that produced this array
 * already guaranteed that order.
 *
 * **Membership is applied by the presence steps** (`settleMembership.ts`): `addPresenceBinding` and
 * `repairPresenceBinding` (with a parent pointer) add the node at the pointer's host, `reparentPresenceBinding`
 * departs the hosts it loses and arrives at the hosts it gains. A node
 * leaves a host only with the mover's last binding there and arrives only if absent.
 *
 * `establishRelation`/`dissolveRelation`: confirms the step's own carried `hostId` 
 * against live graph state (BD-33 assert-and-throw), throws on mismatch, else applies the patch.
 *
 * Structural-invariant violations (BD-33's host mismatch; `RelationalEdgeStillReferencedError` from
 * inside `applyDeparture`/`removeObject`/`removeCharacter`; a Room/Feature departing a host;
 * the end-of-sequence character presence check below) throw, uniformly in both modes --- not a
 * `MutationKernelApplyOutcome` verdict. Legitimate outcomes return through the discriminated result,
 * and there are only two non-`legal` ones: `stale` (stale candidate, host outside the locked
 * footprint) and `repairable` (`unresolvedDissolveEdge`; an interaction edge that would have to be
 * severed; a `Custom` edge, whose named repair is the classification this layer cannot perform).
 * This function has no verdict meaning "the world forbids this" because it makes no such judgment
 * --- it checks mechanism, and legality is the enrich tier's question. See `types.ts`.
 *
 * `addPresenceBinding`/`repairPresenceBinding` and the F steps: a host's own presence
 * bindings --- population's mint, a move's reparent and join (above), a departure, and
 * population's in-place repair. See `kernelStep.ts`'s doc comments.
 *
 * `createComponent`: seeds a not-yet-existing host's graph empty, holding one hostless Base,
 * so the component is born with a binding. Throws if the host is already in `graphs`.
 *
 * `destroyComponent`: drops the host from the outcome, so `commitStepSequence` deletes its row.
 * Throws if the host's graph still holds anything but its own root and its own presence bindings.
 *
 * `capture`: snapshots the host's occupants (`initialOccupants`, moved by the bystander steps so far) into the returned `captures` map and
 * moves on --- the one step kind that never touches `graphs`. Reading the map at the step's own
 * position (not resorted, same as every other step here) is what makes the snapshot positional rather
 * than terminal. A host missing from the map --- not locked into the footprint --- is the same
 * `stale`/`hostNotInFootprint` outcome every other host-lookup miss in this function already returns.
 */
export const applyStepSequenceCore = (
    steps: readonly MutationKernelStep[],
    initialGraphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    initialOccupants: ReadonlyMap<EphemeraMembershipHostId, readonly EphemeraCharacterId[]> = new Map()
): MutationKernelApplyOutcome => {
    let graphs = new Map(initialGraphs)
    const captures = new Map<string, readonly EphemeraCharacterId[]>()
    // Bystanders are not in their room's graph, so a capture's roster is the caller's pre-commit occupants
    // of the host, moved positionally by each bystander presence step below.
    const occupants = new Map([...initialOccupants].map(([hostId, ids]) => [hostId, new Set(ids)]))
    const settleOccupants = (moverId: EphemeraMembershipHostId, { left, arrived }: { left?: EphemeraMembershipHostId; arrived?: EphemeraMembershipHostId }): void => {
        if (!isEphemeraCharacterId(moverId)) {
            return
        }
        if (left !== undefined && left !== arrived && isBystanderMove(moverId, left) && !bindingPointsAt(moverId, left, graphs)) {
            occupants.get(left)?.delete(moverId)
        }
        if (arrived !== undefined && isBystanderMove(moverId, arrived)) {
            occupants.get(arrived)?.add(moverId)
        }
    }

    // Bindings a reparent or split may have left parentless: the fall-through rule removes the ones still so at the run's end.
    const parentlessCandidates: ParentBinding[] = []

    for (const step of steps) {
        if (step.kind === 'capture') {
            const hostOccupants = occupants.get(step.hostId)
            if (hostOccupants) {
                captures.set(step.captureId, [...hostOccupants])
                continue
            }
            return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
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
                universalKey: BASE_PRESENCE_ID,
                fromHostPresences: [],
                cover: { members: [] },
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
            // `addPresenceNode` returns silently on a duplicate key, which for a fixed id would hide a
            // second mint of Base or Unplaced; a host holds each at most once.
            const mintedId = PresenceKey(step.presenceUuid)
            if ((mintedId === BASE_PRESENCE_ID || mintedId === UNPLACED_PRESENCE_ID) && graph.presenceNodes.some((node) => node.universalKey === mintedId)) {
                throw new Error(
                    `addPresenceBinding: ${step.hostId} already holds ${mintedId} --- structural invariant violated (a host holds each fixed root binding once)`
                )
            }
            // presenceNodes Slice 7a (PN-23): mints the presence node directly, with no port
            // record --- `EphemeraPresencePort` is retired, and `presenceUuid` (minted at
            // plan time, `resolvePresenceMoves.ts`) becomes the node's `universalKey`
            // suffix on its own. An empty cover by default: the cover index (`writeCoverIndex`) adds
            // each child's entry as its pointer is written (no `Present` edge was ever written to derive it from).
            const withNode = graph.addPresenceNode({
                tag: 'Presence',
                universalKey: PresenceKey(step.presenceUuid),
                fromHostPresences: step.fromHostPresences,
                cover: step.cover ?? { members: [] },
            })
            const indexed = writeCoverIndex(new Map(graphs).set(step.hostId, withNode), step.hostId, PresenceKey(step.presenceUuid) as EphemeraPresenceNodeId, [], step.fromHostPresences)
            const arrived = [...new Set(step.fromHostPresences.map(({ host }) => host))]
            const settled = settleParentChange(indexed, step.hostId, [], arrived)
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            arrived.forEach((host) => settleOccupants(step.hostId, { arrived: host }))
            continue
        }
        if (step.kind === 'reparentPresenceBinding') {
            const reparented = reparentPresenceBinding(graphs, step)
            if ('reasonCode' in reparented) {
                return { verdict: 'stale', reasonCode: reparented.reasonCode }
            }
            const afterHosts = new Set(reparented.after.map(({ host }) => host))
            const beforeHosts = new Set(reparented.before.map(({ host }) => host))
            const left = [...beforeHosts].filter((host) => !afterHosts.has(host))
            const arrived = [...afterHosts].filter((host) => !beforeHosts.has(host))
            const settled = settleParentChange(reparented.graphs, step.hostId, left, arrived)
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            left.forEach((host) => settleOccupants(step.hostId, { left: host }))
            arrived.forEach((host) => settleOccupants(step.hostId, { arrived: host }))
            if (reparented.after.length === 0) {
                parentlessCandidates.push({ host: step.hostId, presence: step.presence })
            }
            continue
        }
        if (step.kind === 'joinPresenceBindings') {
            // Membership does not change: the joined parents' hosts are the same hosts. Children that now
            // collide are left for the producer's next join, and the run's end refuses them otherwise.
            const joined = joinBindings(graphs, step)
            if ('reasonCode' in joined) {
                return { verdict: 'stale', reasonCode: joined.reasonCode }
            }
            graphs = joined.graphs
            continue
        }
        if (step.kind === 'splitPresenceBinding') {
            const split = splitPresenceBinding(graphs, step)
            if ('reasonCode' in split) {
                return { verdict: 'stale', reasonCode: split.reasonCode }
            }
            graphs = split.graphs
            step.pieces.forEach((piece) => {
                if (piece.parents.length === 0) {
                    parentlessCandidates.push({ host: step.hostId, presence: piece.presence ?? PresenceKey(piece.presenceUuid!) as EphemeraPresenceNodeId })
                }
            })
            continue
        }
        if (step.kind === 'repairPresenceBinding') {
            const graph = graphs.get(step.hostId)
            if (!graph) {
                return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
            }
            if (!graph.presenceNodes.some((node) => node.universalKey === step.presenceId)) {
                return { verdict: 'stale', reasonCode: 'presenceBindingMissing' }
            }
            const stored = graph.presenceNodes.find((node) => node.universalKey === step.presenceId)!
            const before = parentsOf(stored)
            const repaired = new Map(graphs).set(step.hostId, graph.replacePresenceNode({
                tag: 'Presence',
                universalKey: step.presenceId,
                fromHostPresences: step.fromHostPresences,
                cover: step.cover,
            }))
            // A repair that changes the parent hosts leaves the old ones, as a move does.
            const arrived = [...new Set(step.fromHostPresences.map(({ host }) => host))]
            const left = [...new Set((step.previousParents ?? []).map(({ host }) => host))].filter((host) => !arrived.includes(host))
            const settled = settleParentChange(writeCoverIndex(repaired, step.hostId, step.presenceId, before, step.fromHostPresences), step.hostId, left, arrived)
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            left.forEach((host) => settleOccupants(step.hostId, { left: host }))
            arrived.forEach((host) => settleOccupants(step.hostId, { arrived: host }))
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
        // A hosting kind is a property of the subject's membership in this host, not an edge (HK-7):
        // establish sets it on the node that arrived with its default kind, and dissolve has nothing
        // to remove, since a node leaving a host takes its kind with it.
        if (isHostingRelationKind(step.relationKind)) {
            if (step.kind === 'establishRelation') {
                if (!isEphemeraPositionAdjacencyContainedId(step.subjectId)) {
                    throw new Error(`establishRelation ${step.relationKind} in ${step.hostId}: subject ${JSON.stringify(step.subjectId)} is not a member, and a hosting kind belongs to one`)
                }
                graphs.set(step.hostId, hostGraph.setHostingKind(step.subjectId, step.relationKind))
            }
            continue
        }
        if (step.kind === 'establishRelation' && step.relationKind === 'ConnectedTo') {
            const violation = connectedToViolation(hostGraph, step.hostId, step.subjectId, step.targetId)
            if (violation) {
                throw new Error(`ConnectedTo in ${step.hostId}: ${violation} --- structural invariant violated (ConnectedTo joins parts of one whole, in that whole's own graph)`)
            }
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

    // the fall-through and root rules at the run's end, before the checks below (a binding still parentless here is removed,
    // not refused).
    const settledParentless = settleParentless(graphs, parentlessCandidates)
    if ('reasonCode' in settledParentless) {
        return { verdict: 'stale', reasonCode: settledParentless.reasonCode }
    }
    else {
        graphs = settledParentless.graphs
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

    // The collision rule (AGENT.contract.md, "A binding's id is stable for the host's life"): two
    // bindings of one host under the same parent binding that the contraction rule merges
    // (`siblingContraction`: either is bare, or they are neighbors on a string) are legal only inside a
    // run (an extend produces them, a pair of moves to one parent produces them before a join), and no
    // run may leave them behind. Two the rule keeps apart (both with `ConnectedTo` edges, none between
    // them: a thread that passes one room twice) are legal. Checks only graphs this run wrote, so
    // duplicates already in storage do not make an unrelated run throw. A hostless binding has no
    // pointer, so names no binding to collide on here; the coverage invariant below is its case (a
    // host's hostless bindings are Base and Unplaced). A violation is a caller bug (a missing join or
    // contraction), not a verdict, like the character check above. Also at the end of the run, because
    // a split of a hostless binding passes through two hostless bindings.
    graphs.forEach((graph, hostId) => {
        if (graph === initialGraphs.get(hostId)) {
            return
        }
        const connectedTo = connectedToPairsOf(graph)
        const { uncovered, hostlessBindings, badUnplaced } = coverageViolationsOf({
            hostId,
            nodeIds: [...graph.nodeIds],
            presenceNodes: graph.presenceNodes,
            connectedTo,
        })
        if (uncovered.length) {
            throw new Error(
                `applyStepSequenceCore: ${hostId} would leave ${uncovered.join(', ')} covered by none of its bindings --- ` +
                `every component node must be listed by at least one binding's cover.`
            )
        }
        if (hostlessBindings.length) {
            throw new Error(
                `applyStepSequenceCore: ${hostId} would carry ${hostlessBindings.length} hostless bindings (${hostlessBindings.join(', ')}) --- ` +
                `a host's hostless bindings are Base and Unplaced and nothing else.`
            )
        }
        if (badUnplaced.length) {
            throw new Error(
                `applyStepSequenceCore: ${hostId} would carry ${badUnplaced.join(', ')} --- ` +
                `Unplaced has no parent.`
            )
        }
        graph.presenceNodes.forEach((binding) => {
            const parents = parentsOf(binding)
            const repeated = parents.find((parent, index) => parents.findIndex(({ host, presence }) => host === parent.host && presence === parent.presence) !== index)
            if (repeated) {
                throw new Error(
                    `applyStepSequenceCore: ${hostId} would carry ${binding.universalKey} under the same parent binding ${repeated.presence} on ${repeated.host} twice ` +
                    `--- a binding names each parent once in its parent set.`
                )
            }
        })
        const mergeable = mergeablePairOf(graph.presenceNodes, connectedTo)
        if (mergeable) {
            throw new Error(
                `applyStepSequenceCore: ${hostId} would carry two bindings under the same parent binding ${mergeable.parent.presence} on ${mergeable.parent.host} ` +
                `(${mergeable.bindings.join(', ')}) that the contraction rule merges (${mergeable.reason}) --- a join was missing.`
            )
        }
    })

    return { verdict: 'legal', graphs, captures }
}
