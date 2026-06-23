import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    extractCharacterIdsFromPlayPositionGraph,
    extractObjectIdsFromPlayPositionGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraPlayPositionGraph,
    EphemeraPlayPositionGraphNode,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export const characterNode = (universalKey: EphemeraCharacterId): EphemeraPlayPositionGraphNode => ({
    tag: 'Character',
    universalKey,
})

export const objectNode = (universalKey: EphemeraObjectId): EphemeraPlayPositionGraphNode => ({
    tag: 'Object',
    universalKey,
})

export const seedGraphFromActiveCharacters = (
    activeCharacters: EphemeraRoomActiveCharacter[]
): EphemeraPlayPositionGraph => ({
    nodes: activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId)),
    edges: [],
})

export const graphCharacterIds = (graph: EphemeraPlayPositionGraph): Set<EphemeraCharacterId> =>
    new Set(
        graph.nodes
            .filter((node): node is { tag: 'Character'; universalKey: EphemeraCharacterId } => node.tag === 'Character')
            .map((node) => node.universalKey)
    )

export const graphObjectIds = (graph: EphemeraPlayPositionGraph): Set<EphemeraObjectId> =>
    new Set(
        graph.nodes
            .filter((node): node is { tag: 'Object'; universalKey: EphemeraObjectId } => node.tag === 'Object')
            .map((node) => node.universalKey)
    )

export const removeCharacterFromGraph = (
    graph: EphemeraPlayPositionGraph,
    characterId: EphemeraCharacterId
): EphemeraPlayPositionGraph => ({
    ...graph,
    nodes: graph.nodes.filter((node) => !(node.tag === 'Character' && node.universalKey === characterId)),
})

export const removeObjectFromGraph = (
    graph: EphemeraPlayPositionGraph,
    objectId: EphemeraObjectId
): EphemeraPlayPositionGraph => ({
    ...graph,
    nodes: graph.nodes.filter((node) => !(node.tag === 'Object' && node.universalKey === objectId)),
})

export const addCharacterToGraph = (
    graph: EphemeraPlayPositionGraph,
    characterId: EphemeraCharacterId
): EphemeraPlayPositionGraph => {
    if (graphCharacterIds(graph).has(characterId)) {
        return graph
    }
    return {
        ...graph,
        nodes: [...graph.nodes, characterNode(characterId)],
    }
}

export const addObjectToGraph = (
    graph: EphemeraPlayPositionGraph,
    objectId: EphemeraObjectId
): EphemeraPlayPositionGraph => {
    if (graphObjectIds(graph).has(objectId)) {
        return graph
    }
    return {
        ...graph,
        nodes: [...graph.nodes, objectNode(objectId)],
    }
}

/** Topology-only stored graph from a play position graph read (no roster meta). */
export const playPositionGraphToStoredTopology = (
    graph: PlayPositionGraph
): EphemeraPlayPositionGraph => ({
    nodes: [
        ...extractCharacterIdsFromPlayPositionGraph(graph).map(characterNode),
        ...extractObjectIdsFromPlayPositionGraph(graph).map(objectNode),
    ],
    edges: [],
})

export const effectiveRoomPositionGraph = (meta: {
    positionGraph?: EphemeraPlayPositionGraph;
    activeCharacters?: EphemeraRoomActiveCharacter[];
} | Record<string, unknown>): EphemeraPlayPositionGraph => {
    const record = meta as {
        positionGraph?: EphemeraPlayPositionGraph;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    }
    if (record.positionGraph) {
        return record.positionGraph
    }
    return seedGraphFromActiveCharacters(record.activeCharacters ?? [])
}

export const effectiveCharacterPositionGraph = (meta: {
    positionGraph?: EphemeraPlayPositionGraph;
} | Record<string, unknown>): EphemeraPlayPositionGraph => {
    const record = meta as { positionGraph?: EphemeraPlayPositionGraph }
    return record.positionGraph ?? { nodes: [], edges: [] }
}
