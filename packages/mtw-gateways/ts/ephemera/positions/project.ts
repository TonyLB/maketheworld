import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

import type { PlayLudicGraph } from './types'

/**
 * Forward read: stored topology from any eligible host Meta::*.ludicGraph.
 * Roster display metadata is hydrated at read time in ephemera internalCache (S2-6-H).
 */
export const projectComponentGraphFromStoredLudicGraph = (
    stored: EphemeraLudicGraphFieldPayload
): PlayLudicGraph => {
    const nodes: StandardReferenceData[] = stored.nodes.flatMap((node): StandardReferenceData[] => {
        if (node.tag === 'Character') {
            return [{ tag: 'Character', universalKey: node.universalKey }]
        }
        if (node.tag === 'Object') {
            return [{ tag: 'Object', universalKey: node.universalKey }]
        }
        return []
    })
    const relationalEdges = (stored.edges ?? []).filter(isEphemeraLudicRelationalEdgeData)
    return {
        nodes,
        edges: relationalEdges.length > 0
            ? relationalEdges as unknown as PlayLudicGraph['edges']
            : [],
    }
}

export const extractCharacterIdsFromPlayLudicGraph = (
    graph: PlayLudicGraph
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

export const extractObjectIdsFromPlayLudicGraph = (
    graph: PlayLudicGraph
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
