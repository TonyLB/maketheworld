import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomActiveCharacter } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
 * TEMP slice 1 --- projects flat `activeCharacters` into a play position graph.
 * Slice 2 swaps backing read to stored `Meta::Room.positionGraph`.
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

export const projectCharacterGraphFromRoomEndpoint = (
    characterId: EphemeraCharacterId,
    roomEndpoint: EphemeraRoomId | null
): PlayPositionGraph => ({
    nodes: [characterNodeReference(characterId)],
    edges: [],
    roomEndpoint,
})

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
