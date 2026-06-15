import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { extractCharacterIdsFromPlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraPlayPositionGraph,
    EphemeraPlayPositionGraphNode,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export const characterNode = (universalKey: EphemeraCharacterId): EphemeraPlayPositionGraphNode => ({
    tag: 'Character',
    universalKey,
})

export const seedGraphFromActiveCharacters = (
    activeCharacters: EphemeraRoomActiveCharacter[]
): EphemeraPlayPositionGraph => ({
    nodes: activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId)),
    edges: [],
})

export const graphCharacterIds = (graph: EphemeraPlayPositionGraph): Set<EphemeraCharacterId> =>
    new Set(graph.nodes.map((node) => node.universalKey))

export const removeCharacterFromGraph = (
    graph: EphemeraPlayPositionGraph,
    characterId: EphemeraCharacterId
): EphemeraPlayPositionGraph => ({
    ...graph,
    nodes: graph.nodes.filter((node) => node.universalKey !== characterId),
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

/** Topology-only stored graph from a play position graph read (no roster meta). */
export const playPositionGraphToStoredTopology = (
    graph: PlayPositionGraph
): EphemeraPlayPositionGraph => ({
    nodes: extractCharacterIdsFromPlayPositionGraph(graph).map(characterNode),
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
