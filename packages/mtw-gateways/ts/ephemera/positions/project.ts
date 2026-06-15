import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph, EphemeraRoomActiveCharacter } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

import type { PlayPositionGraph, PlayPositionRoomRosterEntry } from './types'

const toRosterEntry = (entry: EphemeraRoomActiveCharacter): PlayPositionRoomRosterEntry => {
    const record = entry as Record<string, unknown>
    return {
        EphemeraId: entry.EphemeraId,
        DisplayName: (entry.DisplayName ?? entry.Name ?? '') as string,
        SessionIds: (entry.SessionIds ?? entry.sessions ?? []) as string[],
        ...(entry.Color !== undefined ? { Color: entry.Color as PlayPositionRoomRosterEntry['Color'] } : {}),
        ...(entry.fileURL !== undefined ? { fileURL: entry.fileURL } : {}),
    }
}

const characterNodeReference = (characterId: EphemeraCharacterId): StandardReferenceData => ({
    tag: 'Character',
    universalKey: characterId,
})

/**
 * Projects flat `activeCharacters` into a play position graph (bootstrap read fallback).
 */
export const projectRoomGraphFromActiveCharacters = (
    activeCharacters: EphemeraRoomActiveCharacter[]
): PlayPositionGraph => {
    const characterRosterMeta: Partial<Record<EphemeraCharacterId, PlayPositionRoomRosterEntry>> = {}
    const nodes: StandardReferenceData[] = activeCharacters.map((entry) => {
        const rosterEntry = toRosterEntry(entry)
        characterRosterMeta[entry.EphemeraId] = rosterEntry
        return characterNodeReference(entry.EphemeraId)
    })
    return {
        nodes,
        edges: [],
        characterRosterMeta,
    }
}

/**
 * Slice 2 forward read: stored topology from Meta::Room.positionGraph.
 * Roster display metadata is hydrated at read time in ephemera internalCache (S2-6-H).
 */
export const projectRoomGraphFromStoredPositionGraph = (
    stored: EphemeraPlayPositionGraph,
    activeCharacters?: EphemeraRoomActiveCharacter[]
): PlayPositionGraph => {
    const characterRosterMeta: Partial<Record<EphemeraCharacterId, PlayPositionRoomRosterEntry>> = {}
    if (activeCharacters) {
        for (const entry of activeCharacters) {
            characterRosterMeta[entry.EphemeraId] = toRosterEntry(entry)
        }
    }
    const nodes: StandardReferenceData[] = stored.nodes.map((node) => ({
        tag: 'Character',
        universalKey: node.universalKey,
    }))
    return {
        nodes,
        edges: [],
        ...(Object.keys(characterRosterMeta).length > 0 ? { characterRosterMeta } : {}),
    }
}

export const projectCharacterGraphFromRoomEndpoint = (
    characterId: EphemeraCharacterId,
    roomEndpoint: EphemeraRoomId | null
): PlayPositionGraph => ({
    nodes: [characterNodeReference(characterId)],
    edges: [],
    roomEndpoint,
})

/** Forward-looking stub for future character inventory (container-scale play graph). */
export const projectCharacterInventoryGraphStub = (): PlayPositionGraph => ({
    nodes: [],
    edges: [],
})

export const projectMembershipContainersFromRoomEndpoint = (
    roomEndpoint: EphemeraRoomId | null
): EphemeraRoomId[] => (roomEndpoint ? [roomEndpoint] : [])

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

export const projectRoomRosterFromGraph = (graph: PlayPositionGraph): PlayPositionRoomRosterEntry[] => {
    const meta = graph.characterRosterMeta ?? {}
    const nodes = graph.nodes ?? []
    const roster: PlayPositionRoomRosterEntry[] = []
    for (const node of nodes) {
        if (typeof node === 'string') {
            const entry = meta[node as EphemeraCharacterId]
            if (entry) {
                roster.push(entry)
            }
            continue
        }
        if (node.tag === 'Character' && node.universalKey) {
            const entry = meta[node.universalKey as EphemeraCharacterId]
            if (entry) {
                roster.push(entry)
            }
        }
    }
    return roster
}

export const projectRoomGraphFromRosterEntries = (
    roster: PlayPositionRoomRosterEntry[]
): PlayPositionGraph => {
    const characterRosterMeta: Partial<Record<EphemeraCharacterId, PlayPositionRoomRosterEntry>> = {}
    const nodes: StandardReferenceData[] = roster.map((entry) => {
        characterRosterMeta[entry.EphemeraId] = entry
        return characterNodeReference(entry.EphemeraId)
    })
    return {
        nodes,
        edges: [],
        characterRosterMeta,
    }
}
