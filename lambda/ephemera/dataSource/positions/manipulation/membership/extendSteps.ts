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
 * to divide. The binding extended keeps its id and every `ConnectedTo` edge it already has, and the
 * fresh piece hangs off it alone: extending an end lengthens the string, and extending a middle binding
 * makes a branch. Inserting a binding into a stretch (splitting an edge) is not something this does.
 *
 * The two pieces are adjacent siblings, which the contraction rule merges, so the kernel's end-of-run
 * check refuses an extend left unmoved; the caller follows with a move of the new binding in the same
 * sequence.
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
 * the original's parents with an empty cover, connected to the original by `ConnectedTo`. A planner
 * that must name the new binding before the extend has committed (the move that follows it in one
 * attempt) reads this instead of the live graph. The edge is overlaid because the planner's
 * contraction rule reads it: without it the new binding would look bare, and merge into any sibling.
 */
export const withExtendedBinding = (
    graph: EphemeraLudicGraph,
    binding: EphemeraLudicGraphStructureNode,
    presenceUuid: string
): EphemeraLudicGraph => {
    const fresh = PresenceKey(presenceUuid) as EphemeraPresenceNodeId
    return graph
        .addPresenceNode({
            tag: 'Presence',
            universalKey: fresh,
            fromHostPresences: binding.fromHostPresences,
            cover: { members: [] },
        })
        .addRelationalEdge({
            from: { owner: graph.hostId, port: binding.universalKey },
            to: { owner: graph.hostId, port: fresh },
            kind: 'ConnectedTo',
        })
}
