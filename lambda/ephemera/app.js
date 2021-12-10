// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const { LambdaClient } = require('@aws-sdk/client-lambda')
const { v4: uuidv4 } = require('uuid')

const REGION = process.env.AWS_REGION

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const messageTable = `${TABLE_PREFIX}_messages`

const lambdaClient = new LambdaClient({ region: REGION })
const dbClient = new DynamoDBClient({ region: REGION })

const { putCharacterInPlay } = require('./charactersInPlay')
const { addCharacterToRoom, removeCharacterFromRoom } = require('./charactersInRoom')
const { denormalizeCharacter, denormalizeRoom } = require('./denormalize')
const { queueClear, queueState, queueFlush } = require('./feedbackQueue')
const { fetchEphemera } = require('./fetch')
const { healGlobalConnections } = require('./selfHealing')

const { processCharacterEvent } = require('./characterHandlers')

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

// const postRecords = (Records) => {
//     try {
//         const { Item = {} } = await dbClient.send(new GetItemCommand({
//             TableName: ephemeraTable,
//             Key: marshall({
//                 EphemeraId: 'Global',
//                 DataCategory: 'Connections'
//             }),
//             ProjectionExpression: 'connections'
//         }))
//         const { connections } = unmarshall(Item)
        
//     }
//     catch(e) {
//         //
//         // TODO: Create self-healing functions for denormalized data structures
//         // like Global::Connections
//         //
//     }
// }

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
    //
    // TODO: Create function to parse through the entirety of the set of records, and
    // figure out what records need to be forwarded as Ephemera updates to whom.
    //
    return Promise.all(
        characterRecords.map(processCharacterEvent({ dbClient, lambdaClient }))
    )
}

exports.handler = async (event, context) => {

    const { action = 'NO-OP', directCall = false, Records, ...payload } = event

    if (Records && Records.length) {
        await dispatchRecords(Records)
    }
    else {
        queueClear()
        switch(action) {
            
            // case 'fetchEphemera':
            //     return fetchEphemera(payload.RequestId)

            // case 'updateEphemera':
            //     await updateDispatcher(payload)
            //     const updates = queueState()
            //     if (directCall) {
            //         await queueFlush()
            //     }
            //     return updates

            case 'denormalize':
                const denormalize = await denormalizeDispatcher(payload)
                if (queueState()) {
                    await queueFlush()
                }
                return denormalize

            case 'heal':
                await healGlobalConnections(dbClient)
                break;

            default:
                context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
        }
    }
}