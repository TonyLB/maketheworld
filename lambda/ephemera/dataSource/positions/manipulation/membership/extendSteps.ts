import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentsOf } from '../../ludicGraph/presenceParent'
import type { MutationKernelStep } from '../kernel/kernelStep'

/**
 * Extend: adds a second presence binding to a whole, in place, connected to the first by `ConnectedTo`.
 * The split leaves both pieces under the original's parents, so nothing anyone sees changes; the
 * `establishRelation` joins the two bindings in the whole's own graph. A pure function of the binding
 * passed in (no graph reads).
 *
 * The fresh piece takes an empty cover: this assumes a partless whole, whose extent holds no contents
 * to divide. It also assumes the binding carries no `ConnectedTo` edge yet, so the extension hangs off
 * it alone; extending the middle of an already-extended whole must say which piece keeps which edge,
 * and nothing here does.
 *
 * Two bindings under one parent binding is a state the kernel's end-of-run check refuses, so the
 * caller follows with a move of the new binding in the same sequence.
 */
export const extendSteps = (args: {
    hostId: EphemeraMembershipHostId
    binding: EphemeraLudicGraphStructureNode
    presenceUuid: string
}): MutationKernelStep[] => {
    const { hostId, binding, presenceUuid } = args
    const parents = parentsOf(binding)
    return [
        {
            kind: 'splitPresenceBinding',
            hostId,
            presence: binding.universalKey,
            pieces: [
                { presence: binding.universalKey, parents, cover: binding.cover },
                { presenceUuid, parents, cover: { members: [] } },
            ],
        },
        {
            kind: 'establishRelation',
            hostId,
            subjectId: { owner: hostId, port: binding.universalKey },
            targetId: { owner: hostId, port: PresenceKey(presenceUuid) as EphemeraPresenceNodeId },
            relationKind: 'ConnectedTo',
        },
    ]
}

/**
 * The object's graph as it will stand once `extendSteps` commits: the fresh binding is present under
 * the original's parents with an empty cover. A planner that must name the new binding before the
 * extend has committed (the move that follows it in one attempt) reads this instead of the live graph.
 * `ConnectedTo` is not overlaid: nothing the planner reads depends on it.
 */
export const withExtendedBinding = (
    graph: EphemeraLudicGraph,
    binding: EphemeraLudicGraphStructureNode,
    presenceUuid: string
): EphemeraLudicGraph => graph.addPresenceNode({
    tag: 'Presence',
    universalKey: PresenceKey(presenceUuid) as EphemeraPresenceNodeId,
    fromHostPresences: binding.fromHostPresences,
    cover: { members: [] },
})
