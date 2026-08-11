import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMetaCharacter,
    EphemeraMetaRoom,
    EphemeraLudicGraphFieldPayload,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type EphemeraPositionsReadDB = {
    getItem<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string; DataCategory: string }
        ProjectionFields?: string[]
        getAllFields?: boolean
    }): Promise<Item | undefined>
    query?<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string }
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, string>
    }): Promise<Item[]>
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

export async function getRoomPositionGraphFromDynamo(
    db: EphemeraPositionsReadDB,
    roomId: EphemeraRoomId
): Promise<EphemeraLudicGraphFieldPayload | undefined> {
    const row = await db.getItem<Pick<EphemeraMetaRoom, 'positionGraph'>>({
        Key: {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
        },
        ProjectionFields: ['positionGraph'],
    })
    return row?.positionGraph
}

export async function getCharacterPositionGraphFromDynamo(
    db: EphemeraPositionsReadDB,
    characterId: EphemeraCharacterId
): Promise<EphemeraLudicGraphFieldPayload | undefined> {
    const row = await db.getItem<Pick<EphemeraMetaCharacter, 'positionGraph'>>({
        Key: {
            EphemeraId: characterId,
            DataCategory: 'Meta::Character',
        },
        ProjectionFields: ['positionGraph'],
    })
    return row?.positionGraph
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
    if (typeof roomId === 'string' && roomId.length > 0) {
        if (isEphemeraRoomId(roomId)) {
            return roomId
        }
        const normalized = `ROOM#${roomId}` as EphemeraRoomId
        if (isEphemeraRoomId(normalized)) {
            return normalized
        }
    }
    return null
}

export const isPositionsComponentId = (
    componentId: string
): componentId is EphemeraCharacterId | EphemeraRoomId =>
    isEphemeraCharacterId(componentId) || isEphemeraRoomId(componentId)
