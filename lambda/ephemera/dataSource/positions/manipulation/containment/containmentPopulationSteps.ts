import { v4 as uuidv4 } from 'uuid'
import type { EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID, ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { childParentBindingIdOf, unpointedBindingOf, parentHostOf, parentOf } from '../../ludicGraph/presenceParent'
import type { ExecutorEstablishRelationStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { MutationKernelAddPresenceBindingStep, MutationKernelRepairPresenceBindingStep, MutationKernelStep } from '../kernel/kernelStep'

/**
 * A parent's root binding, the one its children name (`childParentBindingIdOf`). A Room or Area
 * keeps exactly one hostless remainder for good (the room rule, PR-21(f), extended to Areas),
 * whether or not anything is contained in it. Any other parent (a Feature, an authored Object) with
 * no binding at all gets a hostless remainder too, which its own placement later re-points rather
 * than re-mints, so its children's pointers stay valid. Returns the step that mints it and the
 * graph as it will read once minted, so the parent's children (computed against that graph) point
 * at the same root; a parent that already has one is unchanged.
 */
export const rootStep = (
    parentId: EphemeraMembershipHostId,
    parentGraph: EphemeraLudicGraph
): { step?: MutationKernelAddPresenceBindingStep; graph: EphemeraLudicGraph } => {
    const hasRoot = isEphemeraRoomId(parentId) || isEphemeraAreaId(parentId)
        ? Boolean(childParentBindingIdOf(parentGraph) ?? unpointedBindingOf(parentGraph))
        : parentGraph.presenceNodes.length > 0
    if (hasRoot) {
        return { graph: parentGraph }
    }
    return {
        step: { kind: 'addPresenceBinding', hostId: parentId, presenceUuid: 'Base' },
        graph: parentGraph.addPresenceNode({
            tag: 'Presence',
            universalKey: BASE_PRESENCE_ID,
            cover: { members: [] },
        }),
    }
}

/**
 * The pure step-computer for cache-time containment authoring (Room-in-Area, Feature-in-Room,
 * Feature-in-Feature); the contract it implements is in `../../AGENT.contract.md`'s
 * `Component Updated` ingress section. Takes both graphs
 * already fetched, so the idempotency obligation --- a re-cached parent or a drift-finding heal reruns over
 * state that already reflects a prior write --- is met by checking current state here rather than relying on
 * the reducer to absorb a replay (`addPresenceBinding` is not safe to replay unconditionally --- see this
 * directory's callers). Membership is not a step of its own: the binding steps below carry the parent
 * pointer, and applying one adds the child's node to the parent (`settleMembership.ts`), if absent.
 *
 * Independent checks, not a single all-or-nothing branch, because a cache rerun can land in
 * any partially-populated state (e.g. a prior run committed the binding but not the node, or
 * `cacheAsset` retried after a partial failure):
 *
 * - **Presence binding** (three states): absent (no binding of `childGraph` points at `parentId`)
 *   is a first placement --- a child holding a hostless remainder (minted as a parent's root) has
 *   it re-pointed in place (`repairPresenceBinding`, keeping the id), otherwise one is added; a Room
 *   always adds its Area carve-out, since its remainder never moves. Present in the wrong shape (a
 *   pointer not naming the parent's binding, a room's remainder at its Area) emits
 *   `repairPresenceBinding`, in place and keeping the id, as does a correct binding whose node the
 *   parent lacks; correct, with the node in place, emits nothing. The parent's own
 *   root is `rootStep`'s, minted once per parent before any child is computed.
 * - **Authored Objects** (`positions/AGENT.contract.md`, `Component Updated`): an Object child is skipped outright if its own graph holds any
 *   binding with a parent pointer (it is live somewhere, so a rerun must not move it); otherwise it
 *   goes through the same checks, with an `In` edge. A live binding of the wrong shape is
 *   therefore not repaired for Objects --- acceptable, since repair would also move a live Object.
 * - **Containment edge**: emitted only if `parentGraph` carries no edge of the child's kind (`PartOf`, or `In` for an Object) from `childId` to
 *   `parentId` already. `establishRelation`'s `op: 'add'` is already idempotent-safe on an existing
 *   edge (`EphemeraLudicGraph.applyRelationalPatch`) --- this check isn't load-bearing for
 *   correctness --- but skipping it when nothing changed is what keeps a fully-populated `cacheAsset`
 *   rerun from committing a transaction at all, rather than three no-op writes every time. Rooms and
 *   Features are always `PartOf`, never `In` (2026-09-05): Room-in-Area and Feature-in-Room/Feature are
 *   fixed/authored nestings, not the mobile placement `In` is for.
 *
 * The containment-edge check compares terminals with `ephemeraLudicTerminalsEqual`, not `===`
 * (2026-09-11, closing PQ-10). It is a **hardening, not a fix**: a `PartOf` terminal cannot be
 * port-qualified today, by two independent arguments --- containment is root-incident within a
 * graph (`AGENT.concepts.md`, the star topology), and `PartOf` is a *hosting* kind under AB-54,
 * so it never crosses a boundary and has no port to qualify. Both are constructor disciplines
 * rather than enforced invariants, and the star one is explicitly documented as *dropped rather
 * than defended* if multi-level nesting in one graph arrives --- so the raw `===` was correct by
 * coincidence of the current writers, not by type. Equality is the right relation here rather
 * than `ephemeraLudicTerminalRefersTo`: a *port* of the child being part of the parent would be
 * a different edge, not this one.
 */
export const containmentPopulationSteps = (
    parentId: EphemeraMembershipHostId,
    childId: EphemeraRoomId | EphemeraFeatureId | EphemeraObjectId,
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph
): MutationKernelStep[] => {
    // An authored Object is placed only if it has no live host anywhere: population reruns for
    // every child a parent lists, so without this a player-moved or author-repositioned Object would
    // be put back or doubled. Any binding with a parent pointer on its own graph means it is live.
    if (isEphemeraObjectId(childId) && childGraph.presenceNodes.some((node) => parentOf(node))) {
        return []
    }

    const steps: MutationKernelStep[] = []

    // The parent binding children sit under: a Room's or Area's hostless remainder, else the
    // parent's only binding (its root is `rootStep`'s, applied to `parentGraph` by the caller). A
    // parent with several bindings names none, and authored placement cannot say which the child
    // sits in (WML names a parent by component key), so population refuses: nothing is written.
    const parentPresence = childParentBindingIdOf(parentGraph)
    if (!parentPresence) {
        console.warn(`[mtw.ephemera.positions] containment population skipped: ${parentId} has ${parentGraph.presenceNodes.length} bindings, none for ${childId} to name`)
        return []
    }
    const fromHostPresence: EphemeraPresenceParentPointer = { host: parentId, presence: parentPresence }
    // A room's binding into its Area is a carve-out with no members, so the bucket is the room itself.
    const wantedCover = isEphemeraRoomId(childId) && isEphemeraAreaId(parentId) ? { members: [] } : undefined

    const existing = childGraph.presenceNodes.find((node) => parentHostOf(node) === parentId)
    // A first placement re-points a hostless root rather than minting beside it, so the child's own
    // children keep naming it. A Room's remainder never moves: it gets an Area carve-out instead.
    const unplacedRoot = existing || isEphemeraRoomId(childId) ? undefined : unpointedBindingOf(childGraph)
    if (unplacedRoot) {
        const placeStep: MutationKernelRepairPresenceBindingStep = {
            kind: 'repairPresenceBinding',
            hostId: childId,
            presenceId: unplacedRoot.universalKey,
            fromHostPresence,
            cover: unplacedRoot.cover,
        }
        steps.push(placeStep)
    } else if (!existing) {
        const bindingStep: MutationKernelAddPresenceBindingStep = {
            kind: 'addPresenceBinding',
            hostId: childId,
            fromHostPresence,
            ...(wantedCover ? { cover: wantedCover } : {}),
            // a child holding no binding yet gets its Base placed (every whole holds one); a further binding is a new id
            presenceUuid: childGraph.presenceNodes.length === 0 ? 'Base' : uuidv4(),
        }
        steps.push(bindingStep)
    } else if (
        existing.fromHostPresence?.presence !== fromHostPresence.presence ||
        (wantedCover && existing.cover.members.length > 0) ||
        !parentGraph.nodeIds.has(childId)
    ) {
        // Wrong shape (a pointer not naming the parent's binding, or a room's remainder at its Area), or a
        // correct binding whose node the parent lacks (a partially populated state): rewrite in place, same
        // id, so no child pointer is orphaned; the step settles membership, so the node is added. A correct
        // binding with its node in place falls through and emits nothing.
        const repairStep: MutationKernelRepairPresenceBindingStep = {
            kind: 'repairPresenceBinding',
            hostId: childId,
            presenceId: existing.universalKey,
            fromHostPresence,
            cover: wantedCover ?? existing.cover,
        }
        steps.push(repairStep)
    }

    // Objects are mobile, so they sit `In` their authored parent; Rooms and Features nest `PartOf`.
    const relationKind = isEphemeraObjectId(childId) ? 'In' : 'PartOf'
    const hasContainmentEdge = parentGraph.relationalEdges.some(
        (edge) =>
            edge.kind === relationKind &&
            ephemeraLudicTerminalsEqual(edge.from, childId) &&
            ephemeraLudicTerminalsEqual(edge.to, parentId)
    )
    if (!hasContainmentEdge) {
        const edgeStep: ExecutorEstablishRelationStep = {
            kind: 'establishRelation',
            subjectId: childId,
            targetId: parentId,
            hostId: parentId,
            relationKind,
        }
        steps.push(edgeStep)
    }

    return steps
}
