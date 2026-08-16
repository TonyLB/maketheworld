import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export const ludicGraphCacheKey = (componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId): string =>
    `${componentId}::ludicGraph`

export const membershipContainersCacheKey = (componentId: EphemeraPositionAdjacencyContainedId): string =>
    `${componentId}::membershipContainers`
