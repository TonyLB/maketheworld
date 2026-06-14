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

/**
 * Parse host room from an adjacency query item. Query projection may omit `EphemeraId`
 * (partition key only); membership is implied by the query PK.
 */
export const parseMembershipContainerFromAdjacencyQueryItem = (
    item: unknown
): EphemeraRoomId | undefined => {
    if (!item || typeof item !== 'object') {
        return undefined
    }
    const dataCategory = (item as { DataCategory?: unknown }).DataCategory
    if (typeof dataCategory !== 'string') {
        return undefined
    }
    return parsePositionAdjacencyDataCategory(dataCategory)
}

export const isEphemeraPositionAdjacencyRow = (item: unknown): item is EphemeraPositionAdjacencyRow => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const row = item as EphemeraPositionAdjacencyRow
    if (typeof row.EphemeraId !== 'string' || !isEphemeraCharacterId(row.EphemeraId)) {
        return false
    }
    if (typeof row.DataCategory !== 'string') {
        return false
    }
    return parsePositionAdjacencyDataCategory(row.DataCategory) !== undefined
}
