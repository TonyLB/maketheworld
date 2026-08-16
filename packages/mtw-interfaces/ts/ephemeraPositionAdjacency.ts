import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraFeatureId,
    type EphemeraObjectId,
    type EphemeraRoomId,
} from './baseClasses'

//
// Reverse membership adjacency index on ephemera Dynamo (positions slice 2 / S2-5).
// PK = contained component (CHARACTER# or OBJECT#); SK = POSITION#${hostEphemeraId}.
//
// I5: one row per host room; multi-room drift yields multiple rows under the same object PK;
// stored room ludicGraph wins; adjacency kept in sync at persist (S2-5).
//

export const EPHEMERA_POSITION_ADJACENCY_PREFIX = 'POSITION#' as const

/**
 * Eligible membership hosts: room, character inventory, object (recursive hosting --- a spring
 * hosted in a box), and feature (a wall hosting a niche as a PartOf member). Area is a deferred,
 * separate slice (LD-9) --- it mints a new component identity rather than widening this one.
 *
 * Admission here is not a part-of-ladder claim: widening this union does not put any of these
 * kinds into the containment ladder above the room (see AGENT.concepts.md's premise-11 warning).
 */
export type EphemeraMembershipHostId = EphemeraRoomId | EphemeraCharacterId | EphemeraObjectId | EphemeraFeatureId

export const isEphemeraMembershipHostId = (value: string): value is EphemeraMembershipHostId =>
    isEphemeraRoomId(value) || isEphemeraCharacterId(value) || isEphemeraObjectId(value) || isEphemeraFeatureId(value)

export type EphemeraPositionAdjacencyDataCategory =
    `${typeof EPHEMERA_POSITION_ADJACENCY_PREFIX}${EphemeraMembershipHostId}`

export type EphemeraPositionAdjacencyContainedId = EphemeraCharacterId | EphemeraObjectId | EphemeraFeatureId

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
    if (!isEphemeraCharacterId(row.EphemeraId) && !isEphemeraObjectId(row.EphemeraId) && !isEphemeraFeatureId(row.EphemeraId)) {
        return false
    }
    if (typeof row.DataCategory !== 'string') {
        return false
    }
    return parsePositionAdjacencyDataCategory(row.DataCategory) !== undefined
}
