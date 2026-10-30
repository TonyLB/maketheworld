import { edgeKindAndLabelFrom, isEphemeraLudicNodeTerminal, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicNodeTerminal, EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EdgeRelationEnd, EdgeRelationEntry, EdgeRelationsChange, GroundedReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'
import { edgeRelationReferents, isEdgeRefEnd } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { EphemeraLudicGraph, HostRelationalEdge } from '../../ludicGraph'
import { edgesMatch } from '../../ludicGraph'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { bindEdgeRefs } from './edgeRefs'

/**
 * Why an edge-relations change cannot be written, by code: the caller words it (the dry run, for the
 * player) or logs it (commit). `notInOneGraph`: no graph holds every thing it names (a crossing; v1
 * writes these relations in one graph only). `ambiguousGraph`: several do. `notAThing`: an end
 * grounded to something that is not a node. `alreadyPresent`: an assign whose edge already holds.
 * `nonePresent`: a dissolve with no listed edge present. `requiredAbsent`: a dissolve whose
 * `mustBePresent` entry is absent.
 */
export type EdgeRelationsRefusal = 'notInOneGraph' | 'ambiguousGraph' | 'notAThing' | 'alreadyPresent' | 'nonePresent' | 'requiredAbsent'

export type EdgeRelationsHostResult =
    | { ok: true; hostId: EphemeraMembershipHostId; graph: EphemeraLudicGraph }
    | { ok: false; refusal: EdgeRelationsRefusal }

/**
 * The one graph an edge-relations change is written in: among `candidates` (the hosts of the things
 * it names, with their graphs), the one whose graph holds every thing as a node. A member and its own
 * host's root share the host's graph, so a tag tied to its suitcase is written in the suitcase's.
 */
export const edgeRelationsHost = (
    change: EdgeRelationsChange<GroundedReferent>,
    candidates: Iterable<readonly [EphemeraMembershipHostId, EphemeraLudicGraph | undefined]>
): EdgeRelationsHostResult => {
    const nodeIds = edgeRelationReferents(change).map(({ groundedId }) => groundedId)
    if (!nodeIds.every(isEphemeraLudicNodeTerminal)) {
        return { ok: false, refusal: 'notAThing' }
    }
    const holding = new Map([...candidates].flatMap(([hostId, graph]) => (
        graph !== undefined && nodeIds.every((id) => graph.nodeIds.has(id)) ? [[hostId, graph] as const] : []
    )))
    if (holding.size !== 1) {
        return { ok: false, refusal: holding.size === 0 ? 'notInOneGraph' : 'ambiguousGraph' }
    }
    const [[hostId, graph]] = [...holding]
    return { ok: true, hostId, graph }
}

export type EdgeRelationStepsResult =
    | { ok: true; steps: MutationKernelStep[] }
    | { ok: false; refusal: EdgeRelationsRefusal }

const terminalOf = (end: EdgeRelationEnd<GroundedReferent>, refs: ReadonlyMap<string, string>): EphemeraLudicTerminalId | undefined => {
    if (isEdgeRefEnd(end)) {
        const edgeId = refs.get(end.edgeRef)
        return edgeId === undefined ? undefined : { edgeId }
    }
    return end.groundedId as EphemeraLudicNodeTerminal
}

const edgeOf = (entry: EdgeRelationEntry<GroundedReferent>, refs: ReadonlyMap<string, string>): HostRelationalEdge | undefined => {
    const from = terminalOf(entry.from, refs)
    const to = terminalOf(entry.to, refs)
    return from === undefined || to === undefined ? undefined : { from, to, ...edgeKindAndLabelFrom(entry) }
}

const relationStep = (kind: 'establishRelation' | 'dissolveRelation', hostId: EphemeraMembershipHostId, edge: HostRelationalEdge): MutationKernelStep => {
    const fields = { hostId, subjectId: edge.from, targetId: edge.to, ...relationKindAndLabelOf(edge) }
    return kind === 'establishRelation' ? { kind, ...fields } : { kind, ...fields }
}

const namesAnotherEdge = (entry: EdgeRelationEntry<GroundedReferent>): boolean => isEdgeRefEnd(entry.from) || isEdgeRefEnd(entry.to)

/**
 * The kernel steps for an edge-relations change in `hostId`'s graph (from `edgeRelationsHost`). Pure:
 * reads only the graph passed in.
 *
 * An assign establishes every entry between two things, then gives each entry that declares a ref its
 * minted id (`assignEdgeId`), then establishes the entries that name another entry's edge, which can
 * only name an id already stored. It refuses when any listed edge already holds. A ref on an entry that
 * itself names another edge is not supported (a programming error: it would need a third layer).
 *
 * A dissolve judges every entry against the graph as read, then removes the present ones in the order
 * listed. It refuses when none is present, or a `mustBePresent` one is absent.
 */
export const edgeRelationSteps = (
    change: EdgeRelationsChange<GroundedReferent>,
    hostId: EphemeraMembershipHostId,
    graph: EphemeraLudicGraph
): EdgeRelationStepsResult => {
    const refs = bindEdgeRefs(change, graph, (entry) => edgeOf(entry, new Map()))
    const stored = graph.relationalEdges
    const isStored = (edge: HostRelationalEdge | undefined) => edge !== undefined && stored.some((candidate) => edgesMatch(candidate, edge))

    if (change.primitive === 'dissolveEdgeRelations') {
        const judged = change.entries.map((entry) => {
            const edge = edgeOf(entry, refs)
            return { entry, edge: isStored(edge) ? edge : undefined }
        })
        if (judged.some(({ entry, edge }) => entry.mustBePresent && edge === undefined)) {
            return { ok: false, refusal: 'requiredAbsent' }
        }
        const present = judged.flatMap(({ edge }) => (edge === undefined ? [] : [edge]))
        if (present.length === 0) {
            return { ok: false, refusal: 'nonePresent' }
        }
        return { ok: true, steps: present.map((edge) => relationStep('dissolveRelation', hostId, edge)) }
    }

    const declared = change.entries.filter((entry) => entry.edgeRef !== undefined)
    const unknownRef = change.entries.flatMap(({ from, to }) => [from, to]).find((end) => isEdgeRefEnd(end) && !refs.has(end.edgeRef))
    if (unknownRef !== undefined || declared.some(namesAnotherEdge)) {
        throw new Error('edgeRelationSteps: an assign must declare every ref it names, on an entry between two things')
    }
    const edges = change.entries.map((entry) => ({ entry, edge: edgeOf(entry, refs)! }))
    if (edges.some(({ edge }) => isStored(edge))) {
        return { ok: false, refusal: 'alreadyPresent' }
    }
    return {
        ok: true,
        steps: [
            ...edges.filter(({ entry }) => !namesAnotherEdge(entry)).map(({ edge }) => relationStep('establishRelation', hostId, edge)),
            ...edges.flatMap(({ entry, edge }) => (
                entry.edgeRef === undefined ? [] : [{ kind: 'assignEdgeId' as const, hostId, edge, edgeId: refs.get(entry.edgeRef)! }]
            )),
            ...edges.filter(({ entry }) => namesAnotherEdge(entry)).map(({ edge }) => relationStep('establishRelation', hostId, edge)),
        ],
    }
}
