// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

import { putCharacterInPlay } from './charactersInPlay.js'
import { addCharacterToRoom, removeCharacterFromRoom } from './charactersInRoom.js'
import { denormalizeCharacter, denormalizeRoom } from './denormalize.js'
import { queueClear, queueState, queueFlush } from './feedbackQueue.js'
import { fetchEphemera } from './fetch.js'
import { healGlobalConnections, healCharacter } from './selfHealing/index.js'

import { processCharacterEvent } from './characterHandlers/index.js'
import { processPlayerEvent } from './playerHandlers/index.js'
import { splitType } from './utilities/index.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const REGION = process.env.AWS_REGION

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const dbClient = new DynamoDBClient({ region: REGION })

const splitPermanentId = (PermanentId) => {
    const sections = PermanentId.split('#')
    if (!(sections.length > 1)) {
        return [PermanentId]
    }
    else {
        return [sections[0], sections.slice(1).join('#')]
    }
}

// const updateDispatcher = ({ Updates = [] }) => {
//     const outputs = Updates.map((update) => {
//         if (update.putCharacterInPlay) {
//             return putCharacterInPlay(update.putCharacterInPlay)
//         }
//         if (update.addCharacterToRoom) {
//             return addCharacterToRoom(update.addCharacterToRoom)
//         }
//         if (update.removeCharacterFromRoom) {
//             return removeCharacterFromRoom(update.removeCharacterFromRoom)
//         }
//         return Promise.resolve([])
//     })

//     return Promise.all(outputs)
// }

const denormalizeDispatcher = ({ PermanentId, data }) => {
    const [type, payload] = splitPermanentId(PermanentId)
    switch(type) {
        case 'CHARACTER':
            return denormalizeCharacter({ CharacterId: payload, data })
        case 'ROOM':
            return denormalizeRoom({ RoomId: payload, data })
        default:
            return Promise({})
    }
}

const postRecords = async (Records) => {
    let connections = {}
    try {
        const { Item = {} } = await dbClient.send(new GetItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: 'Global',
                DataCategory: 'Connections'
            }),
            ProjectionExpression: 'connections'
        }))
        connections = unmarshall(Item).connections
    }
    catch(e) {
        connections = await healGlobalConnections(dbClient)
    }
    //
    // TODO: Filter Records to find the types of records we should report back to the users as
    // ephemera updates, and aggregate them into a list to send in a single bolus
    //
    const unmarshalledRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
    const characterRecords = unmarshalledRecords
        .filter(({ data: { newImage } }) => ((newImage.EphemeraId ?? '').startsWith('CHARACTERINPLAY#') && newImage.DataCategory === 'Connection'))
        .map(({ data: { newImage } }) => {
            const { EphemeraId, Name, RoomId, Connected } = newImage
            return {
                type: 'CharacterInPlay',
                CharacterId: splitType(EphemeraId)[1],
                Name,
                RoomId,
                Connected
            }
        })
    //
    // TODO: Figure out what Room information needs to be transmitted from Ephemera changes to the
    // client side of the fence (if any)
    //

    const updates = [
        ...characterRecords
    ]
    if (updates.length) {
        try {
            await Promise.all(
                Object.keys(connections).map((ConnectionId) => (
                    apiClient.send(new PostToConnectionCommand({
                        ConnectionId,
                        Data: JSON.stringify({
                            messageType: 'Ephemera',
                            updates
                        }, null, 4)
                    }))
                ))
                //
                // TODO: Process errors to find connections that can be pruned
                // from the current-open listing
                //
            )    
        }
        catch (e) {}
    }

}

//
// dispatchRecords breaks incoming records into relevant categories, pre-processes
// the data-structure, and then dispatches them (either in groups or individually)
// to their handlers.  It returns a Promise.all of the individual async calls.
//
const dispatchRecords = (Records) => {
    //
    // Break out CharacterInPlay# records for processing
    //
    const characterRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
        //
        // TODO: Once processing is localized, consider refactoring 'Connection' to 'Meta::Character'
        //
        .filter(({ data }) => (
            (data.oldImage.DataCategory === 'Connection') ||
            (data.newImage.DataCategory === 'Connection'))
        )
        .map(({ eventName, data }) => {
            const { DataCategory: oldDC, ...oldImage } = data.oldImage
            const { DataCategory: newDC, ...newImage } = data.newImage
            return { eventName, data: { oldImage, newImage } }
        })

    const playerRecords = Records
        .map(({ eventName, dynamodb }) => ({
            eventName,
            data: {
                oldImage: unmarshall(dynamodb.OldImage || {}),
                newImage: unmarshall(dynamodb.NewImage || {})
            }
        }))
        .filter(({ data }) => (
            ((data.oldImage.EphemeraId || '').startsWith('PLAYER#')) ||
            ((data.newImage.EphemeraId || '').startsWith('PLAYER#')))
        )
        .map(({ eventName, data }) => {
            return { eventName, data: { oldImage: data.oldImage, newImage: data.newImage } }
        })
    //
    // TODO: Create function to parse through the entirety of the set of records, and
    // figure out what records need to be forwarded as Ephemera updates to whom.
    //
    return Promise.all([
        ...characterRecords.map(processCharacterEvent(dbClient)),
        ...playerRecords.map(processPlayerEvent({ dbClient })),
        postRecords(Records)
    ])
}

export const handler = async (event, context) => {

    const { action = 'NO-OP', directCall = false, Records, ...payload } = event

    if (Records && Records.length) {
        await dispatchRecords(Records)
    }
    else {
        queueClear()
        switch(action) {
            
            case 'denormalize':
                const denormalize = await denormalizeDispatcher(payload)
                if (queueState()) {
                    await queueFlush()
                }
                return denormalize

            case 'healGlobal':
                await healGlobalConnections(dbClient)
                break;

            case 'heal':
                await healCharacter(dbClient, event.CharacterId)
                break;

            default:
                context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
        }
    }
}