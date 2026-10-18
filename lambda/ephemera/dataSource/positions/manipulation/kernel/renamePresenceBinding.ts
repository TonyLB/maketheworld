import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { isBystanderMove } from './bystander'
import type { MutationKernelRenamePresenceBindingStep } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

const endsAt = (terminal: EphemeraLudicTerminalId, id: EphemeraPresenceNodeId): boolean => (
    typeof terminal === 'string' ? terminal === id : terminal.port === id
)

/**
 * A rename's write (`MutationKernelRenamePresenceBindingStep`). Writes the whole's graph, each child's
 * (its pointer names the new id) and the parent's (its cover entry names the new id), so it returns the
 * whole map. A `reasonCode` is the `stale` reason: the planner read a snapshot that may since have changed.
 */
export const renamePresenceBinding = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelRenamePresenceBindingStep
): { graphs: Graphs } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.from)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    if (graph.presenceNodes.some(({ universalKey }) => universalKey === step.to)) {
        return { reasonCode: 'renameTargetTaken' }
    }
    if (node.fromHostPresence?.host !== step.parent?.host || node.fromHostPresence?.presence !== step.parent?.presence) {
        return { reasonCode: 'presenceBindingMoved' }
    }
    if (graph.relationalEdges.some((edge) => endsAt(edge.from, step.from) || endsAt(edge.to, step.from))) {
        return { reasonCode: 'edgeEndsAtBinding' }
    }
    const cover = step.cover ?? node.cover
    for (const member of cover.members) {
        if (!isEphemeraPresenceCoverRemainder(member) && !step.childHosts.includes(member.host as EphemeraMembershipHostId)) {
            return { reasonCode: 'renameChildUnlisted' }
        }
    }

    const next: Graphs = new Map(graphs)
    next.set(step.hostId, graph.renamePresenceNode(step.from, step.to, step.cover ? { members: step.cover.members.map((member) => ({ ...member })) } : undefined))

    // Children: every binding that points at `from` now points at `to`.
    for (const childHost of step.childHosts) {
        const childGraph = next.get(childHost)
        if (!childGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        let rewritten = childGraph
        for (const child of childGraph.presenceNodes) {
            if (child.fromHostPresence?.host === step.hostId && child.fromHostPresence.presence === step.from) {
                rewritten = rewritten.replacePresenceNode({ ...child, fromHostPresence: { host: step.hostId, presence: step.to } })
            }
        }
        next.set(childHost, rewritten)
    }

    // The parent's cover index: its entry for this host's binding. A bystander's room is not in the footprint.
    if (step.parent && !isBystanderMove(step.hostId, step.parent.host)) {
        const parentGraph = next.get(step.parent.host)
        if (!parentGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const parentBinding = parentGraph.presenceNodes.find(({ universalKey }) => universalKey === step.parent!.presence)
        if (!parentBinding) {
            return { reasonCode: 'destinationBindingMissing' }
        }
        next.set(step.parent.host, parentGraph.replacePresenceNode({
            ...parentBinding,
            cover: {
                members: parentBinding.cover.members.map((member) => (
                    !isEphemeraPresenceCoverRemainder(member) && member.host === step.hostId && member.presence === step.from
                        ? { ...member, presence: step.to }
                        : { ...member }
                )),
            },
        }))
    }
    return { graphs: next }
}
