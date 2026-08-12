import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { referencesFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

export type ObjectManipulationPositionsReadDeps = {
    getMembershipContainers: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>
    getLudicGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type MembershipObservation = {
    containers: EphemeraMembershipHostId[]
    ludicGraph?: EphemeraLudicGraph
}

export async function observeMembershipForObject(
    objectId: EphemeraObjectId,
    deps: ObjectManipulationPositionsReadDeps
): Promise<MembershipObservation> {
    const containers = await deps.getMembershipContainers(objectId)
    if (containers.length === 1) {
        const ludicGraph = await deps.getLudicGraph(containers[0])
        return { containers, ludicGraph }
    }
    return { containers }
}

export function objectTouchesExitEdgeOnGraph(
    graph: EphemeraLudicGraph,
    objectId: EphemeraObjectId
): boolean {
    const envelope = graph.toPlayEnvelope()
    const edges = envelope.edges ?? []
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
