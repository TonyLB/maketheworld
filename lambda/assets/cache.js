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
import { recalculateComputes } from '/opt/utilities/executeCode/index.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'

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

export const fetchAssetMetaData = async (assetId) => {
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
    const dbEntryItems = dbEntries(schema)
    return Object.entries(dbEntryItems).map(([key, rest]) => ({ key, ...rest }))
}

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const pushMetaData = async (assetId, state, dependencies, actions) => {
    await ephemeraDB.putItem({
        EphemeraId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        State: state || {},
        Dependencies: dependencies || {
            room: [],
            computed: []
        },
        Actions: actions || {}
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
            let prefix = ''
            switch(tag) {
                case 'Variable':
                    prefix = 'VARIABLE'
                    break
                case 'Action':
                    prefix = 'ACTION'
                    break
                default:
                    prefix = 'ROOM'
            }
            const newEphemeraId = isGlobal
                ? `${prefix}#${key}`
                : previous[key] || `${prefix}#${uuidv4()}`
            return {
                ...previous,
                [key]: newEphemeraId
            }
        }, currentScopedToPermanentMapping)
    const globalizedDBEntries = dbEntriesList
        .map(({ tag, key, isGlobal, appearances, ...rest }) => {
            switch(tag) {
                case 'Room':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        appearances: appearances.map(({ exits, render, ...rest }) => {
                            const remappedExits = (exits && exits.length > 0)
                                ? exits
                                    .map(({ to, ...other }) => ({ to: splitType(scopedToPermanentMapping[to])[1], ...other }))
                                    .filter(({ to }) => (to))
                                : undefined
                            const remappedRender = (render && render.length > 0)
                                ? render.map((item) => {
                                    if (typeof item === 'string') {
                                        return item
                                    }
                                    switch(item.tag) {
                                        case 'Link':
                                            const { to, ...rest } = item
                                            return {
                                                    ...rest,
                                                    toAction: to,
                                                    toAssetId: assetId
                                                }
                                        default:
                                            return item
                                    }        
                                })
                                : undefined
                            return {
                                exits: remappedExits,
                                render: remappedRender,
                                ...rest
                            }
                        }).map(({ conditions, render, exits, name }) => ({ conditions, render, exits, name })),
                        ...rest
                    }    
                case 'Variable':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        defaultValue: rest['default'],
                        scopedId: key
                    }
                case 'Action':
                    return {
                        EphemeraId: scopedToPermanentMapping[key],
                        src: rest.src,
                        scopedId: key
                    }
                default:
                    return {}
            }
        })
        .filter(({ EphemeraId }) => (EphemeraId))
    return globalizedDBEntries
}

const mergeEntries = async (assetId, dbEntriesList) => {
    await Promise.all([
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

export const cacheAsset = async (assetId) => {
    const fileName = await fetchAssetMetaData(assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(assetId, dbEntriesList)
    const [{ State: currentState = {} } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        mergeEntries(
            assetId,
            globalEntries.filter(({ EphemeraId }) => (['ROOM'].includes(splitType(EphemeraId)[0])))
        ),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(globalEntries
            .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])
    const programScopeIdsByEphemeraId = globalEntries
        .filter(({ EphemeraId }) => (['VARIABLE', 'ACTION'].includes(splitType(EphemeraId)[0])))
        .reduce((previous, { EphemeraId, scopedId }) => ({ ...previous, [EphemeraId]: scopedId }), {})

    const computeDependencies = dbEntriesList
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, dependencies }) => (
            dependencies.reduce((accumulator, dependency) => ({
                ...accumulator,
                [dependency]: {
                    computed: [
                        ...(accumulator[dependency]?.computed || []),
                        key
                    ]
                }
            }), previous)
        ), {})

    const dependencies = globalEntries
        .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances.reduce((accumulator, { conditions = [] }) => (
                conditions.reduce((innerAccumulator, { dependencies = [] }) => (
                    dependencies.reduce((innermostAccumulator, dependency) => ({
                        ...innermostAccumulator,
                        [dependency]: {
                            ...(innermostAccumulator[dependency] || {}),
                            room: [...(new Set([
                                ...(innermostAccumulator[dependency]?.room || []),
                                splitType(EphemeraId)[1]
                            ]))]
                        }
                    }), innerAccumulator)
                ), accumulator)
            ), previous)
        ), computeDependencies)

    const variableState = dbEntriesList
        .filter(({ tag }) => (tag === 'Variable'))
        .reduce((previous, { key, default: defaultValue }) => {
            if (previous[key]?.value !== undefined) {
                return previous
            }
            const defaultEvaluation = evaluateCode(`return (${defaultValue})`)({})
            return {
                ...previous,
                [key]: {
                    value: defaultEvaluation
                }
            }
        }, currentState)

    const uncomputedState = dbEntriesList
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), variableState)

    const { state } = recalculateComputes(
        uncomputedState,
        dependencies,
        Object.entries(variableState)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )

    const actions = dbEntriesList
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await pushMetaData(
        assetId,
        state,
        dependencies,
        actions
    )
}
