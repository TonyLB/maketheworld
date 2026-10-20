import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { EphemeraPresenceCoverEntry, EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { bindingHasParent, parentsOf } from '../../ludicGraph/presenceParent'
import { withEntries } from './endOfRunRules'
import { writeCoverIndex } from './presenceStepWrites'
import type { MutationKernelSplitPresenceBindingStep, PresenceBindingPiece } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

const parentKey = (parent: ParentBinding): string => `${parent.host}|${parent.presence}`
const entryKey = (entry: EphemeraPresenceCoverEntry): string => `${entry.host}|${entry.presence}`

/**
 * Split (Framework F): the binding becomes `pieces`, exactly one of which names it and keeps its id; the
 * rest are new. Pieces' parents and covers are subsets of the original's, may overlap, and together equal
 * it. Each child entry swaps the original for every piece that covers it, and the parents' covers are
 * rewritten per piece. Two pieces under one parent is legal until the run's end. The parent hosts do
 * not change (the pieces' parents together are the original's), so membership does not either.
 */
export const splitPresenceBinding = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelSplitPresenceBindingStep
): { graphs: Graphs } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.presence)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    const keeping = step.pieces.filter((piece) => piece.presence !== undefined)
    if (keeping.length !== 1 || keeping[0].presence !== step.presence || step.pieces.some((piece) => (piece.presence === undefined) === (piece.presenceUuid === undefined))) {
        return { reasonCode: 'splitKeepNotOne' }
    }
    const idOf = (piece: PresenceBindingPiece): EphemeraPresenceNodeId => piece.presence ?? PresenceKey(piece.presenceUuid!) as EphemeraPresenceNodeId
    const ids = step.pieces.map(idOf)
    if (new Set(ids).size !== ids.length || step.pieces.some((piece) => piece.presenceUuid !== undefined && graph.presenceNodes.some(({ universalKey }) => universalKey === idOf(piece)))) {
        return { reasonCode: 'splitIdCollision' }
    }

    const originalParents = parentsOf(node)
    const parentKeys = new Set(originalParents.map(parentKey))
    const entryKeys = new Set(node.cover.members.map(entryKey))
    if (step.pieces.some((piece) => piece.parents.some((parent) => !parentKeys.has(parentKey(parent))) || piece.cover.members.some((entry) => !entryKeys.has(entryKey(entry))))) {
        return { reasonCode: 'splitPieceNotSubset' }
    }
    const coveredParents = new Set(step.pieces.flatMap((piece) => piece.parents.map(parentKey)))
    const coveredEntries = new Set(step.pieces.flatMap((piece) => piece.cover.members.map(entryKey)))
    if ([...parentKeys].some((key) => !coveredParents.has(key)) || [...entryKeys].some((key) => !coveredEntries.has(key))) {
        return { reasonCode: 'splitPartsNotCovered' }
    }

    const nodeOf = (piece: PresenceBindingPiece): EphemeraLudicGraphStructureNode => ({
        tag: 'Presence',
        universalKey: idOf(piece),
        fromHostPresences: piece.parents.map(({ host, presence }) => ({ host, presence })),
        cover: withEntries({ members: [] }, piece.cover.members),
    })
    const pieceNodes = step.pieces.map(nodeOf)
    let nextHost = graph.replacePresenceNode(pieceNodes.find(({ universalKey }) => universalKey === step.presence)!)
    pieceNodes.filter(({ universalKey }) => universalKey !== step.presence).forEach((piece) => {
        nextHost = nextHost.addPresenceNode(piece)
    })
    let next: Graphs = new Map(graphs).set(step.hostId, nextHost)

    // Children: each entry of the original's cover now sits under every piece that covers it.
    for (const entry of node.cover.members) {
        const childHost = entry.host as EphemeraMembershipHostId
        const childGraph = next.get(childHost)
        if (!childGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
        if (!child) {
            return { reasonCode: 'presenceBindingMissing' }
        }
        if (!bindingHasParent(child, { host: step.hostId, presence: step.presence })) {
            return { reasonCode: 'presenceBindingMoved' }
        }
        const remaining = parentsOf(child).filter((parent) => !(parent.host === step.hostId && parent.presence === step.presence))
        const under = step.pieces.filter((piece) => piece.cover.members.some((member) => entryKey(member) === entryKey(entry))).map((piece) => ({ host: step.hostId, presence: idOf(piece) }))
        next = new Map(next).set(childHost, childGraph.replacePresenceNode({ ...child, fromHostPresences: [...remaining, ...under] }))
    }

    // The cover index: the original's entry leaves the parents its kept piece does not keep, and each new
    // piece's entry arrives at its parents.
    const kept = step.pieces.find((piece) => piece.presence !== undefined)!
    next = writeCoverIndex(next, step.hostId, step.presence, originalParents, kept.parents)
    for (const piece of step.pieces.filter((candidate) => candidate.presenceUuid !== undefined)) {
        next = writeCoverIndex(next, step.hostId, idOf(piece), [], piece.parents)
    }
    return { graphs: next }
}
