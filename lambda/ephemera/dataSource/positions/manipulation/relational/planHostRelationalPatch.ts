import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../../internalCache'
import { playPositionGraphToStoredTopology } from '../../membership/positionGraphMerge'
import type { HostRelationalPatch } from '../types'
import {
    edgesMatch,
    extractRelationalEdgesFromGraph,
    type ObservedHostRelationalEdge,
} from './relationalEdges'
import type {
    PlanHostRelationalPatchDependencies,
    RelationalIngressArgs,
    RelationalPatchPlan,
} from './types'

const defaultGetPositionGraph = async (roomId: RelationalIngressArgs['roomId']): Promise<PlayPositionGraph> =>
    internalCache.Positions.getPositionGraph(roomId)

const toObservedEdge = (args: RelationalIngressArgs): ObservedHostRelationalEdge => ({
    from: args.subjectId,
    to: args.targetId,
    kind: args.relationKind,
    ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
})

export const planHostRelationalPatch = async (
    args: RelationalIngressArgs,
    deps?: PlanHostRelationalPatchDependencies
): Promise<RelationalPatchPlan> => {
    const getPositionGraph = deps?.getPositionGraph ?? defaultGetPositionGraph
    const graph = playPositionGraphToStoredTopology(await getPositionGraph(args.roomId))
    const observedEdge = toObservedEdge(args)
    const existingEdges = extractRelationalEdgesFromGraph(graph)
    const matchingEdge = existingEdges.find((edge) => edgesMatch(edge, observedEdge))

    const patch: HostRelationalPatch = {
        hostId: args.roomId,
        edge: {
            from: args.subjectId,
            to: args.targetId,
            kind: args.relationKind,
            ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
        },
        op: args.operation === 'establish' ? 'add' : 'remove',
    }

    const changed = args.operation === 'establish'
        ? !matchingEdge
        : Boolean(matchingEdge)

    return { patch, changed }
}
