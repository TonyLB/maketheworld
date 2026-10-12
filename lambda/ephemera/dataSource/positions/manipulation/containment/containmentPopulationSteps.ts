import { v4 as uuidv4 } from 'uuid'
import type { EphemeraFeatureId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalsEqual, remainderCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { childParentBindingIdOf, hostlessRemainderOf, parentHostOf } from '../../ludicGraph/presenceParent'
import type { ExecutorEstablishRelationStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { MutationKernelAddPresenceBindingStep, MutationKernelRepairPresenceBindingStep, MutationKernelStep, MutationKernelTransferStep } from '../kernel/kernelStep'

/**
 * The room rule's root (PR-21(f)): every room keeps exactly one hostless remainder, the root of its
 * presence tree, whether or not anything is contained in it or it sits in an Area. Returns the step
 * that mints it and the graph as it will read once minted, so the room's children (computed against
 * that graph) point at the same remainder; a room that already has one, or a non-room, is unchanged.
 */
export const roomRootStep = (
    parentId: EphemeraMembershipHostId,
    parentGraph: EphemeraLudicGraph
): { step?: MutationKernelAddPresenceBindingStep; graph: EphemeraLudicGraph } => {
    if (!isEphemeraRoomId(parentId) || hostlessRemainderOf(parentGraph)) {
        return { graph: parentGraph }
    }
    const presenceUuid = uuidv4()
    return {
        step: { kind: 'addPresenceBinding', hostId: parentId, presenceUuid },
        graph: parentGraph.addPresenceNode({
            tag: 'Presence',
            universalKey: PresenceKey(presenceUuid) as EphemeraPresenceNodeId,
            cover: remainderCover(),
        }),
    }
}

/**
 * The pure step-computer for cache-time containment authoring (Room-in-Area, Feature-in-Room,
 * Feature-in-Feature); the contract it implements is in `../../AGENT.contract.md`'s
 * `Component Updated` ingress section. Takes both graphs
 * already fetched, so the idempotency obligation --- a re-cached parent or a drift-finding heal reruns over
 * state that already reflects a prior write --- is met by checking current state here rather than relying on
 * the reducer to absorb a replay (neither `transferMembership`'s pure-add branch nor
 * `addPresenceBinding` is safe to replay unconditionally --- see this directory's callers).
 *
 * Three independent checks, not a single all-or-nothing branch, because a cache rerun can land in
 * any partially-populated state (e.g. a prior run committed the node-add but failed before the
 * presence binding, or `cacheAsset` retried after a partial failure):
 *
 * - **Node membership**: emitted only if `childId` is not already a node of `parentGraph`.
 * - **Presence binding** (three states): absent (no binding of `childGraph` points at `parentId`)
 *   adds one; present in the wrong shape (a pointer not naming the parent's binding, a room's remainder at its Area)
 *   emits `repairPresenceBinding`, in place and keeping the id; correct emits nothing. A room
 *   parent's remainder is `roomRootStep`'s, minted once per parent before any child is computed.
 * - **Containment edge**: emitted only if `parentGraph` carries no `PartOf` edge from `childId` to
 *   `parentId` already. `establishRelation`'s `op: 'add'` is already idempotent-safe on an existing
 *   edge (`EphemeraLudicGraph.applyRelationalPatch`) --- this check isn't load-bearing for
 *   correctness --- but skipping it when nothing changed is what keeps a fully-populated `cacheAsset`
 *   rerun from committing a transaction at all, rather than three no-op writes every time. Always
 *   `PartOf`, never `In` (2026-09-05): Room-in-Area and Feature-in-Room/Feature are fixed/authored
 *   nestings, not the mobile placement `In` is for.
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
    childId: EphemeraRoomId | EphemeraFeatureId,
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph
): MutationKernelStep[] => {
    const steps: MutationKernelStep[] = []

    if (!parentGraph.nodeIds.has(childId)) {
        const nodeStep: MutationKernelTransferStep = {
            kind: 'transferMembership',
            entityId: childId,
            fromHostIds: new Set(),
            toHostId: parentId,
        }
        steps.push(nodeStep)
    }

    // The parent binding children sit under: a room's hostless remainder (`roomRootStep`, applied
    // to `parentGraph` by the caller), else the parent's only binding. An Area holds none, and a
    // Feature parent not yet bound names none; the pointer then carries the host alone and a later
    // run repairs it once the parent binding exists.
    const parentPresence = isEphemeraAreaId(parentId) ? undefined : childParentBindingIdOf(parentGraph)
    const fromHostPresence: EphemeraPresenceParentPointer = parentPresence ? { host: parentId, presence: parentPresence } : { host: parentId }
    // A room's binding into its Area is a carve-out with no members, so the bucket is the room itself.
    const wantedCover = isEphemeraRoomId(childId) && isEphemeraAreaId(parentId) ? { members: [] } : undefined

    const existing = childGraph.presenceNodes.find((node) => parentHostOf(node) === parentId)
    if (!existing) {
        const bindingStep: MutationKernelAddPresenceBindingStep = {
            kind: 'addPresenceBinding',
            hostId: childId,
            fromHostPresence,
            ...(wantedCover ? { cover: wantedCover } : {}),
            presenceUuid: uuidv4(),
        }
        steps.push(bindingStep)
    } else if (
        existing.fromHostPresence?.presence !== fromHostPresence.presence ||
        (wantedCover && existing.cover.members.length > 0)
    ) {
        // Wrong shape (a pointer not naming the parent's binding, or a room's remainder at its Area): rewrite in place,
        // same id, so no child pointer is orphaned. A correct binding falls through and emits nothing.
        const repairStep: MutationKernelRepairPresenceBindingStep = {
            kind: 'repairPresenceBinding',
            hostId: childId,
            presenceId: existing.universalKey,
            fromHostPresence,
            cover: wantedCover ?? existing.cover,
        }
        steps.push(repairStep)
    }

    const hasContainmentEdge = parentGraph.relationalEdges.some(
        (edge) =>
            edge.kind === 'PartOf' &&
            ephemeraLudicTerminalsEqual(edge.from, childId) &&
            ephemeraLudicTerminalsEqual(edge.to, parentId)
    )
    if (!hasContainmentEdge) {
        const edgeStep: ExecutorEstablishRelationStep = {
            kind: 'establishRelation',
            subjectId: childId,
            targetId: parentId,
            hostId: parentId,
            relationKind: 'PartOf',
        }
        steps.push(edgeStep)
    }

    return steps
}
