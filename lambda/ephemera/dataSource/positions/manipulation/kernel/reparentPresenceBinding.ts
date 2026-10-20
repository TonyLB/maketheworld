import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { parentsOf } from '../../ludicGraph/presenceParent'
import { isBystanderMove } from './bystander'
import { writeCoverIndex } from './presenceStepWrites'
import type { MutationKernelReparentPresenceBindingStep } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

const keyOf = (parent: ParentBinding): string => `${parent.host}|${parent.presence}`

/**
 * Reparent (Framework F): one binding gains and/or loses parents; its cover and its children do not
 * change. Each lost parent must still be in the stored set (`presenceBindingMoved`), and each gained
 * parent's binding must exist (`destinationBindingMissing`; a bystander's room is not in the footprint).
 * A gain already held is a no-op. The parents' covers are the index and are written here. Leaving the
 * binding parentless, or alongside another binding under a gained parent, is legal inside the run and
 * settled at its end (F-R1, F-R3). Returns the set before and after for the caller's membership settle.
 */
export const reparentPresenceBinding = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelReparentPresenceBindingStep
): { graphs: Graphs; before: ParentBinding[]; after: ParentBinding[] } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.presence)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    const before = parentsOf(node)
    const heldKeys = new Set(before.map(keyOf))
    const lose = step.lose ?? []
    const gain = step.gain ?? []
    if (lose.some((parent) => !heldKeys.has(keyOf(parent)))) {
        return { reasonCode: 'presenceBindingMoved' }
    }
    for (const parent of gain) {
        if (isBystanderMove(step.hostId, parent.host)) {
            continue
        }
        const destination = graphs.get(parent.host)
        if (!destination) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        if (!destination.presenceNodes.some(({ universalKey }) => universalKey === parent.presence)) {
            return { reasonCode: 'destinationBindingMissing' }
        }
    }
    const lostKeys = new Set(lose.map(keyOf))
    const after = [...new Map([
        ...before.filter((parent) => !lostKeys.has(keyOf(parent))),
        ...gain.map(({ host, presence }) => ({ host, presence })),
    ].map((parent) => [keyOf(parent), parent])).values()]
    const next: Graphs = new Map(graphs).set(step.hostId, graph.replacePresenceNode({ ...node, fromHostPresences: after }))
    return { graphs: writeCoverIndex(next, step.hostId, step.presence, before, after), before, after }
}
