import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    extractCharacterIdsFromPlayPositionGraph,
    extractObjectIdsFromPlayPositionGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraPositionGraphFieldPayload,
    EphemeraPositionGraphNode,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { extractRelationalEdgesFromGraph, toStoredRelationalEdge } from '../manipulation/relational/relationalEdges'

export const characterNode = (universalKey: EphemeraCharacterId): EphemeraPositionGraphNode => ({
    tag: 'Character',
    universalKey,
})

export const objectNode = (universalKey: EphemeraObjectId): EphemeraPositionGraphNode => ({
    tag: 'Object',
    universalKey,
})

export const seedGraphFromActiveCharacters = (
    activeCharacters: EphemeraRoomActiveCharacter[]
): EphemeraPositionGraphFieldPayload => ({
    nodes: activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId)),
    edges: [],
})

export const graphCharacterIds = (graph: EphemeraPositionGraphFieldPayload): Set<EphemeraCharacterId> =>
    new Set(
        graph.nodes
            .filter((node): node is { tag: 'Character'; universalKey: EphemeraCharacterId } => node.tag === 'Character')
            .map((node) => node.universalKey)
    )

export const graphObjectIds = (graph: EphemeraPositionGraphFieldPayload): Set<EphemeraObjectId> =>
    new Set(
        graph.nodes
            .filter((node): node is { tag: 'Object'; universalKey: EphemeraObjectId } => node.tag === 'Object')
            .map((node) => node.universalKey)
    )

export const removeCharacterFromGraph = (
    graph: EphemeraPositionGraphFieldPayload,
    characterId: EphemeraCharacterId
): EphemeraPositionGraphFieldPayload => ({
    ...graph,
    nodes: graph.nodes.filter((node) => !(node.tag === 'Character' && node.universalKey === characterId)),
})

export const removeObjectFromGraph = (
    graph: EphemeraPositionGraphFieldPayload,
    objectId: EphemeraObjectId
): EphemeraPositionGraphFieldPayload => ({
    ...graph,
    nodes: graph.nodes.filter((node) => !(node.tag === 'Object' && node.universalKey === objectId)),
})

export const addCharacterToGraph = (
    graph: EphemeraPositionGraphFieldPayload,
    characterId: EphemeraCharacterId
): EphemeraPositionGraphFieldPayload => {
    if (graphCharacterIds(graph).has(characterId)) {
        return graph
    }
    return {
        ...graph,
        nodes: [...graph.nodes, characterNode(characterId)],
    }
}

export const addObjectToGraph = (
    graph: EphemeraPositionGraphFieldPayload,
    objectId: EphemeraObjectId
): EphemeraPositionGraphFieldPayload => {
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
): EphemeraPositionGraphFieldPayload => {
    const relationalEdges = extractRelationalEdgesFromGraph(graph).map(toStoredRelationalEdge)
    return {
        nodes: [
            ...extractCharacterIdsFromPlayPositionGraph(graph).map(characterNode),
            ...extractObjectIdsFromPlayPositionGraph(graph).map(objectNode),
        ],
        ...(relationalEdges.length > 0 ? { edges: relationalEdges } : {}),
    }
}

export const effectiveRoomPositionGraph = (meta: {
    positionGraph?: EphemeraPositionGraphFieldPayload;
    activeCharacters?: EphemeraRoomActiveCharacter[];
} | Record<string, unknown>): EphemeraPositionGraphFieldPayload => {
    const record = meta as {
        positionGraph?: EphemeraPositionGraphFieldPayload;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    }
    if (record.positionGraph) {
        return record.positionGraph
    }
    return seedGraphFromActiveCharacters(record.activeCharacters ?? [])
}

export const effectiveCharacterPositionGraph = (meta: {
    positionGraph?: EphemeraPositionGraphFieldPayload;
} | Record<string, unknown>): EphemeraPositionGraphFieldPayload => {
    const record = meta as { positionGraph?: EphemeraPositionGraphFieldPayload }
    return record.positionGraph ?? { nodes: [], edges: [] }
}
