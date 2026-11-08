import { v4 as uuidv4 } from 'uuid'
import type { EphemeraConceptId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraConceptId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraHostingKind, EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID, admissibleHostingKinds } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { nodeFromId } from '../../ludicGraph'
import { childParentBindingIdOf, unpointedBindingOf, bindingHasParentOn, parentsOf } from '../../ludicGraph/presenceParent'
import { defaultHostingKind } from '../kernel/settleMembership'
import type { MutationKernelAddPresenceBindingStep, MutationKernelRepairPresenceBindingStep, MutationKernelSetHostingKindStep, MutationKernelStep } from '../kernel/kernelStep'

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
        step: { kind: 'addPresenceBinding', hostId: parentId, fromHostPresences: [], presenceUuid: 'Base' },
        graph: parentGraph.addPresenceNode({
            tag: 'Presence',
            universalKey: BASE_PRESENCE_ID,
            fromHostPresences: [],
            cover: { members: [] },
        }),
    }
}

/**
 * A caller's choices for one placement. `hostingKind` is below. `bindingName` names the child's
 * binding when it takes a further one (a first is always `Base`), in place of a fresh `uuidv4()`: a
 * fixture builder passes one so a scene builds the same each time; cache-time population passes none.
 */
export type ContainmentPopulationOptions = {
    hostingKind?: EphemeraHostingKind
    bindingName?: string
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
 *   goes through the same checks, with its kind below. A live binding of the wrong shape is
 *   therefore not repaired for Objects --- acceptable, since repair would also move a live Object.
 * - **Containment kind**: `options.hostingKind` if the caller passes one, else `defaultHostingKind`'s, the kind
 *   a move's arrival gives (`PartOf` for a Room or Feature, `In` for an Object, `Held` for an Object
 *   under a Character, the pairing rule's where a Concept is on either side). Cache-time population
 *   passes none, since authored WML has no surface for a membership kind; a fixture builder passes one
 *   to place a thing `On` its host. Either way the kind must be one `admissibleHostingKinds` allows for
 *   the two sides, or this throws: only code chooses a kind, so an illegal one is a programmer error.
 *   The kind is a field of the child's node in the parent's graph, not an edge. A `setHostingKind`
 *   step is emitted only if `parentGraph` does not already hold `childId` with that kind; the binding
 *   steps above add the node with the arrival default, so the step is idempotent, and skipping it when
 *   nothing changed is what keeps a fully-populated `cacheAsset` rerun from committing a transaction at
 *   all. Rooms and Features are `PartOf`, never `In` (2026-09-05): Room-in-Area and
 *   Feature-in-Room/Feature are fixed/authored nestings, not the mobile placement `In` is for.
 */
export const containmentPopulationSteps = (
    parentId: EphemeraMembershipHostId,
    childId: EphemeraRoomId | EphemeraFeatureId | EphemeraObjectId | EphemeraConceptId,
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph,
    { hostingKind = defaultHostingKind(childId, parentId), bindingName }: ContainmentPopulationOptions = {}
): MutationKernelStep[] => {
    const admissible = admissibleHostingKinds(nodeFromId(parentId).tag, nodeFromId(childId).tag)
    if (!admissible.includes(hostingKind)) {
        throw new Error(`containmentPopulationSteps: hosting kind ${hostingKind} is not legal for ${childId} in ${parentId}; admissible: ${admissible.join(', ')}`)
    }

    // An authored Object is placed only if it has no live host anywhere: population reruns for
    // every child a parent lists, so without this a player-moved or author-repositioned Object would
    // be put back or doubled. Any binding with a parent pointer on its own graph means it is live.
    if (isEphemeraObjectId(childId) && childGraph.presenceNodes.some((node) => parentsOf(node).length > 0)) {
        return []
    }

    const steps: MutationKernelStep[] = []

    // The parent binding children sit under: the parent's PRESENCE#Base, whatever else it holds (a
    // Room's or Area's hostless remainder is its Base; any other parent's is `rootStep`'s, applied to
    // `parentGraph` by the caller). Base is the stable lookup for a context-free add, and authored
    // placement is one (WML names a parent by component key, never a binding). A parent with no Base
    // is the defect `lacksBase` reports, so population refuses: nothing is written. Not a move's
    // `destinationBindingOf`, which takes a non-room host's only binding whatever it is called.
    const parentPresence = childParentBindingIdOf(parentGraph)
    if (!parentPresence) {
        console.warn(`[mtw.ephemera.positions] containment population skipped: ${parentId} has no PRESENCE#Base for ${childId} to name`)
        return []
    }
    const fromHostPresence: EphemeraPresenceParentPointer = { host: parentId, presence: parentPresence }
    // A room's binding into its Area is a carve-out with no members, so the bucket is the room itself.
    const wantedCover = isEphemeraRoomId(childId) && isEphemeraAreaId(parentId) ? { members: [] } : undefined

    const existing = childGraph.presenceNodes.find((node) => bindingHasParentOn(node, parentId))
    // A first placement re-points a hostless root rather than minting beside it, so the child's own
    // children keep naming it. A Room's remainder never moves: it gets an Area carve-out instead. A
    // Concept's Base stays hostless too (it covers members present nowhere, like a design library),
    // so a Concept takes a further binding under its parent.
    const unplacedRoot = existing || isEphemeraRoomId(childId) || isEphemeraConceptId(childId) ? undefined : unpointedBindingOf(childGraph)
    if (unplacedRoot) {
        const placeStep: MutationKernelRepairPresenceBindingStep = {
            kind: 'repairPresenceBinding',
            hostId: childId,
            presenceId: unplacedRoot.universalKey,
            fromHostPresences: [fromHostPresence],
            cover: unplacedRoot.cover,
        }
        steps.push(placeStep)
    } else if (!existing) {
        const bindingStep: MutationKernelAddPresenceBindingStep = {
            kind: 'addPresenceBinding',
            hostId: childId,
            fromHostPresences: [fromHostPresence],
            ...(wantedCover ? { cover: wantedCover } : {}),
            // a child holding no binding yet gets its Base placed (every host holds one); a further binding is the caller's name, else a new id
            presenceUuid: childGraph.presenceNodes.length === 0 ? 'Base' : bindingName ?? uuidv4(),
        }
        steps.push(bindingStep)
    } else if (
        parentsOf(existing).find((parent) => parent.host === parentId)?.presence !== fromHostPresence.presence ||
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
            // swap the parent on this host; parents on other hosts stay (a shared binding)
            fromHostPresences: [...parentsOf(existing).filter((parent) => parent.host !== parentId), fromHostPresence],
            cover: wantedCover ?? existing.cover,
        }
        steps.push(repairStep)
    }

    if (parentGraph.hostingKindOf(childId) !== hostingKind) {
        const kindStep: MutationKernelSetHostingKindStep = {
            kind: 'setHostingKind',
            hostId: parentId,
            memberId: childId,
            hostingKind,
        }
        steps.push(kindStep)
    }

    return steps
}
