import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const positionGraphCacheKey = (componentId: EphemeraCharacterId | EphemeraRoomId): string =>
    `${componentId}::positionGraph`

export const membershipContainersCacheKey = (componentId: EphemeraCharacterId): string =>
    `${componentId}::membershipContainers`
