import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

import type { PlayPositionGraph } from './types'

/**
 * Slice 2 forward read: stored topology from Meta::Room.positionGraph.
 * Roster display metadata is hydrated at read time in ephemera internalCache (S2-6-H).
 */
export const projectRoomGraphFromStoredPositionGraph = (
    stored: EphemeraPlayPositionGraph
): PlayPositionGraph => {
    const nodes: StandardReferenceData[] = stored.nodes.flatMap((node) => {
        if (node.tag === 'Character') {
            return [{ tag: 'Character', universalKey: node.universalKey }]
        }
        // Object nodes typed in Phase 0; projection deferred until OBJECT# is ComponentUUID (Phase 4+).
        return []
    })
    return {
        nodes,
        edges: [],
    }
}

/** Forward-looking stub for future character inventory (container-scale play graph). */
export const projectCharacterInventoryGraphStub = (): PlayPositionGraph => ({
    nodes: [],
    edges: [],
})

export const extractCharacterIdsFromPlayPositionGraph = (
    graph: PlayPositionGraph
): EphemeraCharacterId[] => {
    const nodes = graph.nodes ?? []
    const characterIds: EphemeraCharacterId[] = []
    for (const node of nodes) {
        if (typeof node === 'string') {
            if (isEphemeraCharacterId(node)) {
                characterIds.push(node)
            }
            continue
        }
        if (node.tag === 'Character' && node.universalKey && isEphemeraCharacterId(node.universalKey)) {
            characterIds.push(node.universalKey)
        }
    }
    return characterIds
}
