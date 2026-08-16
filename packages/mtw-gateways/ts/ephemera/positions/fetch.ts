import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMetaRoom,
    EphemeraLudicGraphFieldPayload,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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

/**
 * Every host kind's `ludicGraph` field is the same `EphemeraLudicGraphFieldPayload` shape
 * (MD-1(c)) --- the four exported `get*LudicGraphFromDynamo` below differ only in which
 * `DataCategory` they key on, so they're thin, type-narrowed wrappers over this one read.
 */
async function getHostLudicGraphFromDynamo(
    db: EphemeraPositionsReadDB,
    hostId: string,
    dataCategory: 'Meta::Room' | 'Meta::Character' | 'Meta::Object' | 'Meta::Feature'
): Promise<EphemeraLudicGraphFieldPayload | undefined> {
    const row = await db.getItem<{ ludicGraph?: EphemeraLudicGraphFieldPayload }>({
        Key: {
            EphemeraId: hostId,
            DataCategory: dataCategory,
        },
        ProjectionFields: ['ludicGraph'],
    })
    return row?.ludicGraph
}

export const getRoomLudicGraphFromDynamo = (
    db: EphemeraPositionsReadDB,
    roomId: EphemeraRoomId
): Promise<EphemeraLudicGraphFieldPayload | undefined> =>
    getHostLudicGraphFromDynamo(db, roomId, 'Meta::Room')

export const getCharacterLudicGraphFromDynamo = (
    db: EphemeraPositionsReadDB,
    characterId: EphemeraCharacterId
): Promise<EphemeraLudicGraphFieldPayload | undefined> =>
    getHostLudicGraphFromDynamo(db, characterId, 'Meta::Character')

export const getObjectLudicGraphFromDynamo = (
    db: EphemeraPositionsReadDB,
    objectId: EphemeraObjectId
): Promise<EphemeraLudicGraphFieldPayload | undefined> =>
    getHostLudicGraphFromDynamo(db, objectId, 'Meta::Object')

export const getFeatureLudicGraphFromDynamo = (
    db: EphemeraPositionsReadDB,
    featureId: EphemeraFeatureId
): Promise<EphemeraLudicGraphFieldPayload | undefined> =>
    getHostLudicGraphFromDynamo(db, featureId, 'Meta::Feature')

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
): componentId is EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId =>
    isEphemeraCharacterId(componentId) || isEphemeraRoomId(componentId) || isEphemeraObjectId(componentId) || isEphemeraFeatureId(componentId)
