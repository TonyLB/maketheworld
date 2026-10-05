import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { referencesFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardLudicNavigationEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/ludicEdge'

import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

export type ObjectManipulationPositionsReadDeps = {
    getMembershipContainers: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>
    getLudicGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export function objectTouchesExitEdgeOnGraph(
    graph: EphemeraLudicGraph,
    objectId: EphemeraObjectId
): boolean {
    const envelope = graph.toPlayEnvelope()
    const edges = envelope.edges ?? []
    for (const rawEdge of edges) {
        let exitEdge: StandardLudicNavigationEdge
        try {
            exitEdge = new StandardLudicNavigationEdge(rawEdge)
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
