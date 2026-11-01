import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export const ludicGraphCacheKey = (componentId: EphemeraMembershipHostId): string =>
    `${componentId}::ludicGraph`

export const membershipContainersCacheKey = (componentId: EphemeraPositionAdjacencyContainedId): string =>
    `${componentId}::membershipContainers`
