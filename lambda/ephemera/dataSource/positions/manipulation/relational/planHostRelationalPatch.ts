import internalCache from '../../../../internalCache'
import { EphemeraPositionGraph, edgesMatch } from '../../positionGraph'
import type { HostRelationalPatch } from '../types'
import type {
    PlanHostRelationalPatchDependencies,
    RelationalIngressArgs,
    RelationalPatchPlan,
} from './types'

const defaultGetPositionGraph = async (roomId: RelationalIngressArgs['roomId']) =>
    internalCache.Positions.getPositionGraph(roomId)

export const planHostRelationalPatch = async (
    args: RelationalIngressArgs,
    deps?: PlanHostRelationalPatchDependencies
): Promise<RelationalPatchPlan> => {
    const getPositionGraph = deps?.getPositionGraph ?? defaultGetPositionGraph
    const graph = await getPositionGraph(args.roomId)
    const observedEdge = {
        from: args.subjectId,
        to: args.targetId,
        kind: args.relationKind,
        ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
    }
    const matchingEdge = graph.relationalEdges.find((edge) => edgesMatch(edge, observedEdge))

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
