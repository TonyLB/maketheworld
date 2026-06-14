import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { RoomStackItem } from './types'

export type CharacterMetaDynamoPriorFetch = {
    RoomId?: string;
    RoomStack?: RoomStackItem[];
}

/**
 * Cache `CharacterMeta.RoomId` is normalized to `ROOM#...`; Dynamo `Meta::Character`
 * stores the short id only. Use this shape for optimistic `priorFetch` on character rows.
 */
export const dynamoRoomIdFromCachedEndpoint = (roomId: EphemeraRoomId): string => {
    const [, shortId] = splitType(roomId)
    return shortId || roomId
}

export const characterMetaDynamoPriorFetch = (
    characterMeta: Pick<CharacterMetaItem, 'RoomId' | 'RoomStack'>
): CharacterMetaDynamoPriorFetch => ({
    RoomId: dynamoRoomIdFromCachedEndpoint(characterMeta.RoomId),
    RoomStack: characterMeta.RoomStack,
})
