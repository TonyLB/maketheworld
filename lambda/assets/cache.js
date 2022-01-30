import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

import { wmlGrammar, dbEntries, validatedSchema } from './wml/index.js'
import { mergeIntoDataRange, batchGetDispatcher, batchWriteDispatcher } from './utilities/dynamoDB/index.js'
import { streamToString } from './utilities/stream.js'

const params = { region: process.env.AWS_REGION }
const { TABLE_PREFIX, S3_BUCKET } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

const fetchAssetMetaData = async (dbClient, assetId) => {
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: assetsTable,
        Key: marshall({
            AssetId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset'
        }),
        ProjectionExpression: 'fileName'
    }))
    return (Item && unmarshall(Item).fileName) || ''
}

const parseWMLFile = async (fileName) => {
    const s3Client = new S3Client(params)
    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
    }))
    const contents = await streamToString(contentStream)
    //
    // TODO: Error-handling in case the files have become corrupt
    //
    const match = wmlGrammar.match(contents)
    const schema = validatedSchema(match)
    return Object.entries(dbEntries(schema)).map(([key, rest]) => ({ key, ...rest }))

}

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const pushMetaData = async (dbClient, assetId) => {
    await dbClient.send(new PutItemCommand({
        TableName: ephemeraTable,
        Item: marshall({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset'
        })
    }))
}

const globalizeDBEntries = async (dbClient, assetId, dbEntriesList) => {
    //
    // Pull scope-to-uuid mapping from Assets
    //
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: assetsTable,
        IndexName: 'DataCategoryIndex',
        KeyConditionExpression: "DataCategory = :dc",
        ExpressionAttributeValues: marshall({
            ":dc": `ASSET#${assetId}`
        }),
        ProjectionExpression: 'AssetId, scopedId'
    }))
    //
    // Derive all existing scope-to-uuid mappings from stored data
    //
    const currentScopedToPermanentMapping = Items
        .map(unmarshall)
        .reduce((previous, { scopedId, AssetId }) => ({
            ...previous,
            ...(scopedId ? { [scopedId]: AssetId } : {})
        }), {})
    //
    // Add any incoming entries that have not yet been mapped
    // NOTE:  There should be none.
    //
    const scopedToPermanentMapping = dbEntriesList
        .reduce((previous, { key, isGlobal }) => {
            const newEphemeraId = isGlobal
                ? `ROOM#${key}`
                : previous[key] || `ROOM#${uuidv4()}`
            return {
                ...previous,
                [key]: newEphemeraId
            }
        }, currentScopedToPermanentMapping)
    const globalizedDBEntries = dbEntriesList
        .map(({ key, isGlobal, exits, ...rest }) => ({
            EphemeraId: scopedToPermanentMapping[key],
            exits: exits.map(({ exits, ...rest }) => {
                    const remapped = exits
                        .map(({ to, ...other }) => ({ to: scopedToPermanentMapping[to], ...other }))
                        .filter(({ to }) => (to))
                    return {
                        exits: remapped,
                        ...rest
                    }
                })
                .filter(({ exits }) => (exits.length > 0)),
            ...rest
        }))
        .filter(({ EphemeraId }) => (EphemeraId))
    return globalizedDBEntries
}

const mergeEntries = async (dbClient, assetId, dbEntriesList) => {
    await Promise.all([
        pushMetaData(dbClient, assetId),
        mergeIntoDataRange({
            dbClient,
            table: 'ephemera',
            search: { DataCategory: `ASSET#${assetId}` },
            items: dbEntriesList,
            mergeFunction: ({ current, incoming }) => {
                if (!incoming) {
                    return 'delete'
                }
                if (!current) {
                    return incoming
                }
                if (compareEntries(current, incoming)) {
                    return 'ignore'
                }
                else {
                    return incoming
                }
            }
        })
    ])
}

//
// initializeRooms (a) checks each Room ID to see whether
// it has already has a Meta::Room record defined for it, and (b) if there needs
// to be a new Meta::Room record, looks up the position of all CharactersInPlay,
// to populate the record correctly (even though the odds are that there are
// no matches between a totally uncached room and any CharacterInPlay ... pays
// to be careful!)
//
const initializeRooms = async (dbClient, roomIDs) => {
    const currentRoomItems = await batchGetDispatcher(
            dbClient,
            {
                table: ephemeraTable,
                items: roomIDs.map((EphemeraId) => (marshall({
                    EphemeraId,
                    DataCategory: 'Meta::Room'
                }))),
                projectionExpression: 'EphemeraId'
            }
        )
    const currentRoomIds = currentRoomItems.map(({ EphemeraId }) => (EphemeraId))
    const missingRoomIds = roomIDs.filter((roomId) => (!currentRoomIds.includes(roomId)))
    if (missingRoomIds.length > 0) {
        const { Items: characterItems } = await dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            IndexName: 'DataCategoryIndex',
            KeyConditionExpression: 'DataCategory = :connect',
            ExpressionAttributeValues: marshall({
                ":connect": "Connection"
            }),
            ExpressionAttributeNames: {
                "#name": "Name"
            },
            ProjectionExpression: 'EphemeraId, RoomId, #name, Connected, ConnectionId'
        }))
        const charactersInPlay = characterItems.map(unmarshall)
        const newRoomsBase = missingRoomIds.reduce((previous, roomId) => ({
            ...previous,
            [roomId]: {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                activeCharacters: {},
                inactiveCharacters: {}
            }
        }), {})
        const insertInto = (state, target, label, { EphemeraId, ...rest }) => ({
            ...state,
            [target]: {
                ...state[target],
                [label]: {
                    ...state[target][label],
                    [EphemeraId]: {
                        EphemeraId,
                        ...rest
                    }
                }
            }
        })
        const newRoomsById = charactersInPlay.reduce((previous, { RoomId, EphemeraId, Name, Connected, ConnectionId }) => {
            const targetRoom = `ROOM#${RoomId}`
            if (previous[targetRoom]) {
                if (Connected) {
                    return insertInto(previous, targetRoom, 'activeCharacters', { EphemeraId, Name, ConnectionId })
                }
                else {
                    return insertInto(previous, targetRoom, 'inactiveCharacters', { EphemeraId, Name })
                }
            }
            else {
                return previous
            }
        }, newRoomsBase)
        await batchWriteDispatcher(dbClient, {
            table: ephemeraTable,
            items: Object.values(newRoomsById)
                .map((item) => ({
                    PutRequest: { Item: marshall(item) }
                }))
        })
    }
}

export const cacheAsset = async (assetId) => {
    const dbClient = new DynamoDBClient(params)
    const fileName = await fetchAssetMetaData(dbClient, assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(dbClient, assetId, dbEntriesList)
    await Promise.all([
        mergeEntries(dbClient, assetId, globalEntries),
        initializeRooms(dbClient, globalEntries.map(({ EphemeraId }) => EphemeraId))
    ])
}
