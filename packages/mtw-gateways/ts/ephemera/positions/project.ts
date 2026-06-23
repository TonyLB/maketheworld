import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

import type { PlayPositionGraph } from './types'

/**
 * Forward read: stored topology from any eligible host Meta::*.positionGraph.
 * Roster display metadata is hydrated at read time in ephemera internalCache (S2-6-H).
 */
export const projectComponentGraphFromStoredPositionGraph = (
    stored: EphemeraPlayPositionGraph
): PlayPositionGraph => {
    const nodes: StandardReferenceData[] = stored.nodes.flatMap((node): StandardReferenceData[] => {
        if (node.tag === 'Character') {
            return [{ tag: 'Character', universalKey: node.universalKey }]
        }
        if (node.tag === 'Object') {
            return [{ tag: 'Object', universalKey: node.universalKey }]
        }
        return []
    })
    return {
        nodes,
        edges: [],
    }
}

export const extractCharacterIdsFromPlayPositionGraph = (
    graph: PlayPositionGraph
): EphemeraCharacterId[] =>
    (graph.nodes ?? []).flatMap((node): EphemeraCharacterId[] => {
        if (typeof node === 'string') {
            return isEphemeraCharacterId(node) ? [node] : []
        }
        if (node.tag === 'Character' && node.universalKey && isEphemeraCharacterId(node.universalKey)) {
            return [node.universalKey]
        }
        return []
    })

export const extractObjectIdsFromPlayPositionGraph = (
    graph: PlayPositionGraph
): EphemeraObjectId[] =>
    (graph.nodes ?? []).flatMap((node): EphemeraObjectId[] => {
        if (typeof node === 'string') {
            return isEphemeraObjectId(node) ? [node] : []
        }
        if (node.tag === 'Object' && node.universalKey && isEphemeraObjectId(node.universalKey)) {
            return [node.universalKey]
        }
        return []
    })
