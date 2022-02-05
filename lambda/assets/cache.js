import { marshall } from "@aws-sdk/util-dynamodb"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

import { wmlGrammar, dbEntries, validatedSchema } from './wml/index.js'
import { streamToString } from '/opt/utilities/stream.js'
import {
    putEphemera,
    assetGetItem,
    assetQuery,
    ephemeraQuery,
    mergeIntoDataRange,
    batchGetDispatcher,
    batchWriteDispatcher
} from '/opt/utilities/dynamoDB/index.js'

const params = { region: process.env.AWS_REGION }
const { TABLE_PREFIX, S3_BUCKET } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

const fetchAssetMetaData = async (assetId) => {
    const { fileName = '' } = await assetGetItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['fileName']
    })
    return fileName
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

const pushMetaData = async (assetId) => {
    await putEphemera({
        Item: {
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset'
        }
    })
}

const globalizeDBEntries = async (assetId, dbEntriesList) => {
    //
    // Pull scope-to-uuid mapping from Assets
    //
    const Items = await assetQuery({
        IndexName: 'DataCategoryIndex',
        DataCategory: `ASSET#${assetId}`,
        ProjectionFields: ['AssetId', 'scopedId']
    })
    //
    // Derive all existing scope-to-uuid mappings from stored data
    //
    const currentScopedToPermanentMapping = Items
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

const mergeEntries = async (assetId, dbEntriesList) => {
    await Promise.all([
        pushMetaData(assetId),
        mergeIntoDataRange({
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
const initializeRooms = async (roomIDs) => {
    const currentRoomItems = await batchGetDispatcher(
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
        const charactersInPlay = await ephemeraQuery({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Connection',
            ExpressionAttributeNames: {
                "#name": "Name"
            },
            ProjectionFields: ['EphemeraId', 'RoomId', '#name', 'Connected', 'ConnectionId']
        })
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
        await batchWriteDispatcher({
            table: ephemeraTable,
            items: Object.values(newRoomsById)
                .map((item) => ({
                    PutRequest: { Item: marshall(item) }
                }))
        })
    }
}

export const cacheAsset = async (assetId) => {
    const fileName = await fetchAssetMetaData(assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(assetId, dbEntriesList)
    await Promise.all([
        mergeEntries(assetId, globalEntries),
        initializeRooms(globalEntries.map(({ EphemeraId }) => EphemeraId))
    ])
}
