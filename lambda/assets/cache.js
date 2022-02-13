import { v4 as uuidv4 } from 'uuid'
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

import { wmlGrammar, dbEntries, validatedSchema } from './wml/index.js'
import { streamToString } from '/opt/utilities/stream.js'
import {
    assetDB,
    ephemeraDB,
    mergeIntoDataRange,
    batchWriteDispatcher
} from '/opt/utilities/dynamoDB/index.js'
import { splitType } from '/opt/utilities/types.js'
import { compileCode } from "./wml/compileCode.js"

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
    const { fileName = '' } = await assetDB.getItem({
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

const pushMetaData = async (assetId, state) => {
    await ephemeraDB.putItem({
        EphemeraId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        State: state || {}
    })
}

const globalizeDBEntries = async (assetId, dbEntriesList) => {
    //
    // Pull scope-to-uuid mapping from Assets
    //
    const Items = await assetDB.query({
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
        .reduce((previous, { tag, key, isGlobal }) => {
            const prefix = tag === 'Variable' ? 'VARIABLE' : 'ROOM'
            const newEphemeraId = isGlobal
                ? `${prefix}#${key}`
                : previous[key] || `${prefix}#${uuidv4()}`
            return {
                ...previous,
                [key]: newEphemeraId
            }
        }, currentScopedToPermanentMapping)
    const globalizedDBEntries = dbEntriesList
        .map(({ tag, key, isGlobal, exits, ...rest }) => {
            if (tag === 'Room') {
                return {
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
                }    
            }
            else {
                return {
                    EphemeraId: scopedToPermanentMapping[key],
                    defaultValue: rest['default'],
                    scopedId: key
                }
            }
        })
        .filter(({ EphemeraId }) => (EphemeraId))
    return globalizedDBEntries
}

const mergeEntries = async (assetId, dbEntriesList) => {
    await Promise.all([
        // pushMetaData(assetId),
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
    const currentRoomItems = await ephemeraDB.batchGetItem(
            {
                Items: roomIDs.map((EphemeraId) => ({
                    EphemeraId,
                    DataCategory: 'Meta::Room'
                })),
                ProjectionFields: ['EphemeraId']
            }
        )
    const currentRoomIds = currentRoomItems.map(({ EphemeraId }) => (EphemeraId))
    const missingRoomIds = roomIDs.filter((roomId) => (!currentRoomIds.includes(roomId)))
    if (missingRoomIds.length > 0) {
        const charactersInPlay = await ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
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

//
// initializeVariables (a) checks each Variable ID to see whether
// it has already a Meta::Variable record defined for it, and (b) if there needs
// to be a new Meta::Variable record compiles the code for the default value
// and populates it
//
const initializeVariables = async (variableIDs, assetId) => {
    const scopedIdsByEphemeraId = variableIDs.reduce((previous, { EphemeraId, scopedId }) => ({ ...previous, [EphemeraId]: scopedId }), {})
    const currentVariableItems = (await ephemeraDB.batchGetItem(
            {
                Items: variableIDs.map(({ EphemeraId }) => ({
                    EphemeraId,
                    DataCategory: 'Meta::Variable'
                })),
                ProjectionFields: ['EphemeraId', '#value'],
                ExpressionAttributeNames: {
                    '#value': 'value'
                }
            }
        ))
    const currentVariableIds = currentVariableItems.map(({ EphemeraId }) => (EphemeraId))
    const missingVariables = variableIDs
        .filter(({ EphemeraId }) => (!currentVariableIds.includes(EphemeraId)))
        .map(({ defaultValue = 'null', ...rest }) => ({ value: compileCode(`return (${defaultValue})`)({}), ...rest }))
    await Promise.all([
        ...(currentVariableIds.map((EphemeraId) => (
            ephemeraDB.update({
                EphemeraId,
                DataCategory: 'Meta::Variable',
                UpdateExpression: 'SET scopedIdByAsset.#assetId = :scopedId',
                ExpressionAttributeNames: {
                    '#assetId': assetId
                },
                ExpressionAttributeValues: {
                    ':scopedId': scopedIdsByEphemeraId[EphemeraId]
                }
            })
        ))),
        ...(missingVariables.map(({ EphemeraId, scopedId, value }) => (
            ephemeraDB.putItem({
                EphemeraId,
                DataCategory: 'Meta::Variable',
                value,
                scopedIdByAsset: {
                    [assetId]: scopedId
                }
            })
        )))
    ])

    return [
        ...currentVariableItems,
        ...missingVariables.map(({ Ephemera, value }) => ({ Ephemera, value }))
    ]
}

export const cacheAsset = async (assetId) => {
    const fileName = await fetchAssetMetaData(assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(assetId, dbEntriesList)
    const [variableEphemera] = await Promise.all([
        initializeVariables(
            globalEntries
                .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'VARIABLE'))
                .map(({ EphemeraId, defaultValue, scopedId }) => ({ EphemeraId, defaultValue, scopedId })),
            assetId
        ),
        mergeEntries(
            assetId,
            globalEntries.filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
        ),
        initializeRooms(globalEntries
            .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])
    const variableScopeIdsByEphemeraId = globalEntries
        .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'VARIABLE'))
        .reduce((previous, { EphemeraId, scopedId }) => ({ ...previous, [EphemeraId]: scopedId }), {})
    const state = variableEphemera.reduce((previous, { EphemeraId, value }) => {
        const scopedId = variableScopeIdsByEphemeraId[EphemeraId]
        if (scopedId) {
            return {
                ...previous,
                [scopedId]: {
                    EphemeraId,
                    value
                }
            }
        }
        return previous
    }, {})
    await pushMetaData(assetId, state)
}
