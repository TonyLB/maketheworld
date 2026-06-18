import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export const positionGraphCacheKey = (componentId: EphemeraCharacterId | EphemeraRoomId): string =>
    `${componentId}::positionGraph`

export const membershipContainersCacheKey = (componentId: EphemeraPositionAdjacencyContainedId): string =>
    `${componentId}::membershipContainers`
