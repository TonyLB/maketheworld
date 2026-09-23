import StandardArea from './area'
import { StandardLudicNavigationEdge } from '../keys/edges/ludicEdge'
import { referenceFromExitEndpoint } from '../keys/edges/endpointReference'

/**
 * Participant endpoint rule: when both endpoints resolve, at least one must match
 * a ref in ludicGraph.nodes. Incomplete edges (unset From and/or To) do not
 * violate this rule -- they are a separate authoring concern.
 *
 * Scoped to Navigation edges (today's <Exit>) -- the only kind with author-editable From/To
 * endpoints and a WML surface tag this slice.
 */
export function edgeSatisfiesParticipantRule(area: StandardArea, edge: StandardLudicNavigationEdge): boolean {
    const fromRef = referenceFromExitEndpoint(edge.from)
    const toRef = referenceFromExitEndpoint(edge.to)
    if (!fromRef || !toRef) {
        return true
    }
    const nodeRefs = area.ludicGraph.nodes.componentRefs.payload
    const fromInGraph = nodeRefs.some((node) => node.sameKey(fromRef))
    const toInGraph = nodeRefs.some((node) => node.sameKey(toRef))
    return fromInGraph || toInGraph
}

export function findEdgesViolatingParticipantRule(area: StandardArea): StandardLudicNavigationEdge[] {
    return area.ludicGraph.edges.items
        .filter((edge): edge is StandardLudicNavigationEdge => edge instanceof StandardLudicNavigationEdge)
        .filter((edge) => !edgeSatisfiesParticipantRule(area, edge))
}

export function assertEdgeSatisfiesParticipantRule(area: StandardArea, edge: StandardLudicNavigationEdge): void {
    if (!edgeSatisfiesParticipantRule(area, edge)) {
        throw new Error(
            `Area Exit ${edge.uuid} requires at least one endpoint in ludicGraph.nodes`
        )
    }
}
