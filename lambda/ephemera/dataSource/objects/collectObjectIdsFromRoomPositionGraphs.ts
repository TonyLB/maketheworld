import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export const collectObjectIdsFromPositionGraph = (
    graph: EphemeraPositionGraphFieldPayload | undefined
): EphemeraObjectId[] => {
    if (!graph?.nodes) {
        return []
    }
    return graph.nodes
        .filter((node): node is { tag: 'Object'; universalKey: EphemeraObjectId } => node.tag === 'Object')
        .map((node) => node.universalKey)
}

export const collectObjectIdsFromRoomPositionGraphs = (
    roomGraphs: Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload | undefined>>
): EphemeraObjectId[] => {
    const ids = new Set<EphemeraObjectId>()
    for (const graph of Object.values(roomGraphs)) {
        for (const objectId of collectObjectIdsFromPositionGraph(graph)) {
            ids.add(objectId)
        }
    }
    return [...ids]
}
