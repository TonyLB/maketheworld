import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export const collectObjectIdsFromLudicGraph = (
    graph: EphemeraLudicGraphFieldPayload | undefined
): EphemeraObjectId[] => {
    if (!graph?.nodes) {
        return []
    }
    return graph.nodes
        .filter((node): node is { tag: 'Object'; universalKey: EphemeraObjectId } => node.tag === 'Object')
        .map((node) => node.universalKey)
}

export const collectObjectIdsFromRoomLudicGraphs = (
    roomGraphs: Partial<Record<EphemeraRoomId, EphemeraLudicGraphFieldPayload | undefined>>
): EphemeraObjectId[] => {
    const ids = new Set<EphemeraObjectId>()
    for (const graph of Object.values(roomGraphs)) {
        for (const objectId of collectObjectIdsFromLudicGraph(graph)) {
            ids.add(objectId)
        }
    }
    return [...ids]
}
