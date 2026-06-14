import { isEphemeraCharacterId, isEphemeraRoomId, type EphemeraCharacterId, type EphemeraRoomId } from './baseClasses'

//
// Reverse membership adjacency index on ephemera Dynamo (positions slice 2 / S2-5).
// PK = contained component; SK = POSITION#${hostEphemeraId}.
//

export const EPHEMERA_POSITION_ADJACENCY_PREFIX = 'POSITION#' as const

export type EphemeraPositionAdjacencyDataCategory =
    `${typeof EPHEMERA_POSITION_ADJACENCY_PREFIX}${EphemeraRoomId}`

export type EphemeraPositionAdjacencyRow = {
    EphemeraId: EphemeraCharacterId;
    DataCategory: EphemeraPositionAdjacencyDataCategory;
}

export const buildPositionAdjacencyDataCategory = (
    hostComponentId: EphemeraRoomId
): EphemeraPositionAdjacencyDataCategory =>
    `${EPHEMERA_POSITION_ADJACENCY_PREFIX}${hostComponentId}`

export const parsePositionAdjacencyDataCategory = (
    dataCategory: string
): EphemeraRoomId | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_POSITION_ADJACENCY_PREFIX)) {
        return undefined
    }
    const hostComponentId = dataCategory.slice(EPHEMERA_POSITION_ADJACENCY_PREFIX.length)
    if (!isEphemeraRoomId(hostComponentId)) {
        return undefined
    }
    return hostComponentId
}

export const isEphemeraPositionAdjacencyRow = (item: unknown): item is EphemeraPositionAdjacencyRow => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const row = item as EphemeraPositionAdjacencyRow
    if (!isEphemeraCharacterId(row.EphemeraId)) {
        return false
    }
    if (typeof row.DataCategory !== 'string') {
        return false
    }
    return parsePositionAdjacencyDataCategory(row.DataCategory) !== undefined
}
