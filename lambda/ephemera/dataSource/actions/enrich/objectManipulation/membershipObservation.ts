import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { referencesFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

export type ObjectManipulationPositionsReadDeps = {
    getMembershipContainers: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>
    getPositionGraph: (hostId: EphemeraMembershipHostId) => Promise<PlayPositionGraph>
}

export type MembershipObservation = {
    containers: EphemeraMembershipHostId[]
    positionGraph?: PlayPositionGraph
}

export async function observeMembershipForObject(
    objectId: EphemeraObjectId,
    deps: ObjectManipulationPositionsReadDeps
): Promise<MembershipObservation> {
    const containers = await deps.getMembershipContainers(objectId)
    if (containers.length === 1) {
        const positionGraph = await deps.getPositionGraph(containers[0])
        return { containers, positionGraph }
    }
    return { containers }
}

export function objectTouchesExitEdgeOnGraph(
    graph: PlayPositionGraph,
    objectId: EphemeraObjectId
): boolean {
    const edges = graph.edges ?? []
    for (const rawEdge of edges) {
        let exitEdge: StandardExitEdge
        try {
            exitEdge = new StandardExitEdge(rawEdge)
        } catch {
            continue
        }
        const endpointRefs = [
            ...referencesFromExitEndpoint(exitEdge.from),
            ...referencesFromExitEndpoint(exitEdge.to),
        ]
        if (endpointRefs.some((ref) => ref.universalKey === objectId)) {
            return true
        }
    }
    return false
}
