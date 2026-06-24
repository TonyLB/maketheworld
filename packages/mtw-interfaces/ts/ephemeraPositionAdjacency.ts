import {
    isEphemeraCharacterId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraObjectId,
    type EphemeraRoomId,
} from './baseClasses'

//
// Reverse membership adjacency index on ephemera Dynamo (positions slice 2 / S2-5).
// PK = contained component (CHARACTER# or OBJECT#); SK = POSITION#${hostEphemeraId}.
//
// I5: one row per host room; multi-room drift yields multiple rows under the same object PK;
// stored room positionGraph wins; adjacency kept in sync at persist (S2-5).
//

export const EPHEMERA_POSITION_ADJACENCY_PREFIX = 'POSITION#' as const

/** v1 eligible membership hosts (room + character inventory; OBJECT# / AREA# later). */
export type EphemeraMembershipHostId = EphemeraRoomId | EphemeraCharacterId

export const isEphemeraMembershipHostId = (value: string): value is EphemeraMembershipHostId =>
    isEphemeraRoomId(value) || isEphemeraCharacterId(value)

export type EphemeraPositionAdjacencyDataCategory =
    `${typeof EPHEMERA_POSITION_ADJACENCY_PREFIX}${EphemeraMembershipHostId}`

export type EphemeraPositionAdjacencyContainedId = EphemeraCharacterId | EphemeraObjectId

export type EphemeraPositionAdjacencyRow = {
    EphemeraId: EphemeraPositionAdjacencyContainedId;
    DataCategory: EphemeraPositionAdjacencyDataCategory;
}

export const buildPositionAdjacencyDataCategory = (
    hostComponentId: EphemeraMembershipHostId
): EphemeraPositionAdjacencyDataCategory =>
    `${EPHEMERA_POSITION_ADJACENCY_PREFIX}${hostComponentId}`

export const parsePositionAdjacencyDataCategory = (
    dataCategory: string
): EphemeraMembershipHostId | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_POSITION_ADJACENCY_PREFIX)) {
        return undefined
    }
    const hostComponentId = dataCategory.slice(EPHEMERA_POSITION_ADJACENCY_PREFIX.length)
    if (!isEphemeraMembershipHostId(hostComponentId)) {
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
): EphemeraMembershipHostId | undefined => {
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
    if (typeof row.EphemeraId !== 'string') {
        return false
    }
    if (!isEphemeraCharacterId(row.EphemeraId) && !isEphemeraObjectId(row.EphemeraId)) {
        return false
    }
    if (typeof row.DataCategory !== 'string') {
        return false
    }
    return parsePositionAdjacencyDataCategory(row.DataCategory) !== undefined
}
