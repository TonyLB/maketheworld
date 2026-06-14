import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const positionGraphCacheKey = (componentId: EphemeraCharacterId | EphemeraRoomId): string =>
    `${componentId}::positionGraph`

export const roomRosterCacheKey = (roomId: EphemeraRoomId): string =>
    `${roomId}::roomRoster`

export const membershipContainersCacheKey = (componentId: EphemeraCharacterId): string =>
    `${componentId}::membershipContainers`
