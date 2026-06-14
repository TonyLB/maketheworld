import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraRoomActiveCharacter } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type EphemeraPositionsReadDB = {
    getItem<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string; DataCategory: string }
        ProjectionFields?: string[]
        getAllFields?: boolean
    }): Promise<Item | undefined>
}

type CharacterMetaRoomProjection = {
    EphemeraId: EphemeraCharacterId;
    RoomId?: EphemeraRoomId;
}

export async function getRoomActiveCharactersFromDynamo(
    db: EphemeraPositionsReadDB,
    roomId: EphemeraRoomId
): Promise<EphemeraRoomActiveCharacter[]> {
    const row = await db.getItem<Pick<EphemeraMetaRoom, 'activeCharacters'>>({
        Key: {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
        },
        ProjectionFields: ['activeCharacters'],
    })
    return row?.activeCharacters ?? []
}

export async function getCharacterRoomIdFromDynamo(
    db: EphemeraPositionsReadDB,
    characterId: EphemeraCharacterId
): Promise<EphemeraRoomId | null> {
    const row = await db.getItem<CharacterMetaRoomProjection>({
        Key: {
            EphemeraId: characterId,
            DataCategory: 'Meta::Character',
        },
        ProjectionFields: ['RoomId'],
    })
    const roomId = row?.RoomId
    if (roomId && isEphemeraRoomId(roomId)) {
        return roomId
    }
    return null
}

export const isPositionsComponentId = (
    componentId: string
): componentId is EphemeraCharacterId | EphemeraRoomId =>
    isEphemeraCharacterId(componentId) || isEphemeraRoomId(componentId)
