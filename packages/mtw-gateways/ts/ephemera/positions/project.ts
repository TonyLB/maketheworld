import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

import type { PlayLudicGraph } from './types'

/**
 * Projection *down* to the authored (WML) shape: `rootId`, `ports`, non-Character/Object nodes and
 * non-relational edges have no representation in `StandardLudicGraphData` and are dropped.
 *
 * **Not a read-path adapter.** This ran on every cache load until 2026-09-03, which silently
 * emptied `ports` for every consumer of `internalCache.Positions` --- ports are minted at runtime
 * (`uuidv4`) and have no authored counterpart, so the authoring type structurally cannot carry
 * one. The gateway now caches `EphemeraLudicGraphFieldPayload` as fetched, and this projection
 * runs only where a caller explicitly asks for the authored envelope (`toPlayEnvelope`).
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

/**
 * Node-list id extraction, shape-agnostic: accepts either the stored payload or the authored
 * envelope, since both carry `nodes` as `{ tag, universalKey }` (the envelope additionally
 * tolerates bare-string references). Named without "Play" because the stored payload is the
 * primary input --- a caller holding a Dynamo row should read it directly rather than projecting
 * down to the authored shape first only to read the half that survives.
 */
export const extractCharacterIdsFromLudicGraph = (
    graph: PlayLudicGraph | EphemeraLudicGraphFieldPayload
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

/** @see extractCharacterIdsFromLudicGraph --- same shape-agnostic contract. */
export const extractObjectIdsFromLudicGraph = (
    graph: PlayLudicGraph | EphemeraLudicGraphFieldPayload
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
