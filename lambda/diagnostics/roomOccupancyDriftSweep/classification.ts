import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    extractCharacterIdsFromPlayPositionGraph,
    projectComponentGraphFromStoredPositionGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'

const asTrimmedString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

export const normalizeRoomId = (value: unknown): string | undefined => {
    const roomId = asTrimmedString(value)
    if (!roomId) {
        return undefined
    }
    return roomId.startsWith('ROOM#') ? roomId : `ROOM#${roomId}`
}

export const listGraphCharacterIds = (positionGraph: unknown): string[] => {
    if (!isEphemeraPositionGraphFieldPayload(positionGraph)) {
        return []
    }
    return extractCharacterIdsFromPlayPositionGraph(
        projectComponentGraphFromStoredPositionGraph(positionGraph)
    )
}

/**
 * Graph-forward occupancy drift for one room.
 * Per character node on the room positionGraph:
 * - drift when no live sessions (ghost on graph), or
 * - drift when in-play but membership adjacency does not list this roomId.
 *
 * Stale adjacency without a graph node is not visible to this room-forward scan (explicit gap).
 */
export const roomHasOccupancyDrift = (args: {
    roomId: string
    graphCharacterIds: string[]
    adjacencySessionsByCharacter: Map<string, Set<string>>
    membershipContainersByCharacter: Map<string, string[]>
}): boolean => {
    const {
        roomId,
        graphCharacterIds,
        adjacencySessionsByCharacter,
        membershipContainersByCharacter,
    } = args
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) {
        return false
    }

    for (const characterId of graphCharacterIds) {
        if (!isEphemeraCharacterId(characterId)) {
            continue
        }
        const sessions = adjacencySessionsByCharacter.get(characterId)
        const hasSessions = Boolean(sessions && sessions.size > 0)
        if (!hasSessions) {
            return true
        }
        const containers = membershipContainersByCharacter.get(characterId) ?? []
        const normalizedContainers = containers
            .map((containerId) => normalizeRoomId(containerId))
            .filter((containerId): containerId is string => Boolean(containerId))
        if (!normalizedContainers.includes(normalizedRoomId)) {
            return true
        }
    }
    return false
}
