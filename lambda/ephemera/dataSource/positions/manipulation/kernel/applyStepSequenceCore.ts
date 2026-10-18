import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID, edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { coverageViolationsOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { graphFromMeta } from '../../ludicGraph'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MutationKernelStep } from './kernelStep'
import { isBystanderMove } from './bystander'
import { bindingPointsAt, settleMembership } from './settleMembership'
import { movePresenceBinding, withEntries, withoutEntries } from './movePresenceBinding'
import type { MutationKernelApplyOutcome } from './types'

/**
 * The cover index for a pointer write that is not a move (`addPresenceBinding`, `repairPresenceBinding`):
 * the entry for `host`'s binding leaves the parent binding it pointed at (`before`) and arrives at the
 * one it points at now (`after`), as a move writes it. A bystander's room is not in the footprint and
 * keeps its coverage in the characters row; a parent binding that is absent has no index to correct
 * (drift owns it).
 */
const writeCoverIndex = (
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>,
    host: EphemeraMembershipHostId,
    presence: EphemeraPresenceNodeId,
    before: EphemeraPresenceParentPointer | undefined,
    after: EphemeraPresenceParentPointer | undefined
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => {
    const next = new Map(graphs)
    const entry = { host: host as Parameters<typeof withEntries>[1][number]['host'], presence }
    const write = (parent: EphemeraPresenceParentPointer, change: typeof withEntries) => {
        if (isBystanderMove(host, parent.host)) {
            return
        }
        const parentGraph = next.get(parent.host)
        const binding = parentGraph?.presenceNodes.find(({ universalKey }) => universalKey === parent.presence)
        if (parentGraph && binding) {
            next.set(parent.host, parentGraph.replacePresenceNode({ ...binding, cover: change(binding.cover, [entry]) }))
        }
    }
    const unchanged = before?.host === after?.host && before?.presence === after?.presence
    if (before && !unchanged) {
        write(before, withoutEntries)
    }
    if (after) {
        write(after, withEntries)
    }
    return next
}

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
 * `repairPresenceBinding` (with a parent pointer) add the node at the pointer's host, `movePresenceBinding`
 * departs `from.host` and arrives at `to.host`. A node
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
 * `addPresenceBinding`/`movePresenceBinding`/`repairPresenceBinding`: a host's own presence
 * bindings --- population's mint, a move's re-point (`movePresenceBinding`, above), a departure, and
 * population's in-place repair. See `kernelStep.ts`'s doc comments.
 *
 * `createComponent`: seeds a not-yet-existing host's graph empty, holding one hostless remainder,
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
            // second mint of Base or Unplaced; a whole holds each at most once.
            const mintedId = PresenceKey(step.presenceUuid)
            if ((mintedId === BASE_PRESENCE_ID || mintedId === UNPLACED_PRESENCE_ID) && graph.presenceNodes.some((node) => node.universalKey === mintedId)) {
                throw new Error(
                    `addPresenceBinding: ${step.hostId} already holds ${mintedId} --- structural invariant violated (a whole holds each fixed root binding once)`
                )
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
                ...(step.fromHostPresence ? { fromHostPresence: step.fromHostPresence } : {}),
                cover: step.cover ?? { members: [] },
            })
            const indexed = writeCoverIndex(new Map(graphs).set(step.hostId, withNode), step.hostId, PresenceKey(step.presenceUuid) as EphemeraPresenceNodeId, undefined, step.fromHostPresence)
            const settled = settleMembership(indexed, step.hostId, {
                ...(step.fromHostPresence ? { arrived: step.fromHostPresence.host } : {}),
            })
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            settleOccupants(step.hostId, { ...(step.fromHostPresence ? { arrived: step.fromHostPresence.host } : {}) })
            continue
        }
        if (step.kind === 'movePresenceBinding') {
            const moved = movePresenceBinding(graphs, step)
            if ('reasonCode' in moved) {
                return { verdict: 'stale', reasonCode: moved.reasonCode }
            }
            const settled = settleMembership(moved.graphs, step.hostId, {
                ...(step.from ? { left: step.from.host } : {}),
                ...(step.to ? { arrived: step.to.host } : {}),
            })
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            settleOccupants(step.hostId, { ...(step.from ? { left: step.from.host } : {}), ...(step.to ? { arrived: step.to.host } : {}) })
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
            const before = graph.presenceNodes.find((node) => node.universalKey === step.presenceId)?.fromHostPresence
            const repaired = new Map(graphs).set(step.hostId, graph.replacePresenceNode({
                tag: 'Presence',
                universalKey: step.presenceId,
                ...(step.fromHostPresence ? { fromHostPresence: step.fromHostPresence } : {}),
                cover: step.cover,
            }))
            // A repair that changes the parent host leaves the old one, as a move does.
            const left = step.previousParent && step.previousParent.host !== step.fromHostPresence?.host ? step.previousParent.host : undefined
            const hostChange = { ...(left ? { left } : {}), ...(step.fromHostPresence ? { arrived: step.fromHostPresence.host } : {}) }
            const settled = settleMembership(writeCoverIndex(repaired, step.hostId, step.presenceId, before, step.fromHostPresence), step.hostId, hostChange)
            if (settled.verdict !== 'legal') {
                return settled
            }
            graphs = settled.graphs
            settleOccupants(step.hostId, hostChange)
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

    // The transient-duplicate invariant (AGENT.contract.md, "A binding's id is stable for the whole's
    // life"): two bindings of one whole under the same parent binding are legal only inside a run (a
    // split produces them, a pair of moves to one parent produces them before a join), and no run may
    // leave them behind. Checks only graphs this run wrote, so duplicates already in storage do not
    // make an unrelated run throw. A hostless binding has no pointer, so names no binding to collide on
    // here; the coverage invariant below is its case (a whole has at most one binding under "no parent").
    // A violation is a caller bug (a missing join), not a verdict, like the character check above.
    // Also at the end of the run, because a split of a hostless binding passes through two hostless
    // bindings. Coverage counts a `Remainder` as covering every unlisted member, so it adds nothing
    // for a whole that still holds one (monotoneCovers Slice 1).
    graphs.forEach((graph, hostId) => {
        if (graph === initialGraphs.get(hostId)) {
            return
        }
        const { uncovered, hostlessBindings, badUnplaced } = coverageViolationsOf({
            hostId,
            nodeIds: [...graph.nodeIds],
            presenceNodes: graph.presenceNodes,
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
                `a whole has at most one binding with no parent.`
            )
        }
        if (badUnplaced.length) {
            throw new Error(
                `applyStepSequenceCore: ${hostId} would carry ${badUnplaced.join(', ')} --- ` +
                `Unplaced has no parent and exists only while Base has one.`
            )
        }
        const presencesByParentHost = graph.presenceNodes.reduce<Record<string, string[]>>((accumulator, { fromHostPresence }) => (
            fromHostPresence
                ?{ ...accumulator, [fromHostPresence.host]: [...(accumulator[fromHostPresence.host] ?? []), fromHostPresence.presence] }
                : accumulator
        ), {})
        Object.entries(presencesByParentHost).forEach(([parentHost, presences]) => {
            const duplicate = presences.find((presence, index) => presences.indexOf(presence) !== index)
            if (duplicate) {
                throw new Error(
                    `applyStepSequenceCore: ${hostId} would carry two bindings under the same parent binding ${duplicate} on ${parentHost} ` +
                    `--- two bindings of one whole under one parent may exist only inside a run, so a join was missing.`
                )
            }
        })
    })

    return { verdict: 'legal', graphs, captures }
}
