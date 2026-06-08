import StandardArea from './area'
import { StandardExitEdge } from '../keys/edges/exitEdge'
import { referenceFromExitEndpoint } from '../keys/edges/endpointReference'

/**
 * Participant endpoint rule: when both endpoints resolve, at least one must match
 * a ref in positionGraph.nodes. Incomplete edges (unset From and/or To) do not
 * violate this rule -- they are a separate authoring concern.
 */
export function edgeSatisfiesParticipantRule(area: StandardArea, edge: StandardExitEdge): boolean {
    const fromRef = referenceFromExitEndpoint(edge.from)
    const toRef = referenceFromExitEndpoint(edge.to)
    if (!fromRef || !toRef) {
        return true
    }
    const nodeRefs = area.positionGraph.nodes.payload
    const fromInGraph = nodeRefs.some((node) => node.sameKey(fromRef))
    const toInGraph = nodeRefs.some((node) => node.sameKey(toRef))
    return fromInGraph || toInGraph
}

export function findEdgesViolatingParticipantRule(area: StandardArea): StandardExitEdge[] {
    return area.positionGraph.edges.items.filter((edge) => !edgeSatisfiesParticipantRule(area, edge))
}

export function assertEdgeSatisfiesParticipantRule(area: StandardArea, edge: StandardExitEdge): void {
    if (!edgeSatisfiesParticipantRule(area, edge)) {
        throw new Error(
            `Area Exit ${edge.uuid} requires at least one endpoint in positionGraph.nodes`
        )
    }
}
