// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { graphqlClient, gql } = require('./utilities')
const { v4: uuidv4 } = require('/opt/uuid')

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns")

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })
const snsClient = new SNSClient({ region: REGION })

const { TABLE_PREFIX, MESSAGE_SNS_ARN } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

//
// TODO:  Create an EphemeraTopic SNS endpoint, and move the import of AppSync out to there,
// where any cold-start latency is less relevant, then reroute all Ephemera updates in the
// core Lambdas out to that outlet.
//
const disconnectGQL = ({ CharacterId, RoomId }) => (gql`mutation DisconnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: false } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const connectGQL = ({ CharacterId, RoomId }) => (gql`mutation ConnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: true } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const updateWithRoomMessage = async ({ promises, CharacterId, RoomId, messageFunction = () => ('Unknown error') }) => {
    const [{ Item: CharacterItem }, { Items: RoomItems }] = await Promise.all([
        dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            })
        })),
        dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: 'RoomId = :RoomId',
            ExpressionAttributeValues: marshall({
                ':RoomId': RoomId
            }),
            IndexName: 'RoomIndex'
        })),
        ...promises
    ])
    const { Name = '' } = CharacterItem ? unmarshall(CharacterItem) : {}
    const RoomRecords = RoomItems ? RoomItems.map(unmarshall) : []
    const Characters = [ CharacterId, ...(RoomRecords.filter(({ EphemeraId, Connected }) => (EphemeraId && Connected)).map(({ EphemeraId }) => (removeType(EphemeraId))).filter((checkId) => (checkId !== CharacterId))) ]
    await snsClient.send(new PublishCommand({
        TopicArn: MESSAGE_SNS_ARN,
        Message: JSON.stringify([{
            Characters,
            DisplayProtocol: "World",
            Message: messageFunction(Name),
            MessageId: uuidv4(),
            RoomId
        }], null, 4)
    }))
}

const disconnect = async (connectionId) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        KeyConditionExpression: 'ConnectionId = :ConnectionId and begins_with(EphemeraId, :EphemeraId)',
        ExpressionAttributeValues: marshall({
            ":EphemeraId": "CHARACTERINPLAY#",
            ":ConnectionId": connectionId
        }),
        IndexName: 'ConnectionIndex'
    }))

    await Promise.all(Items
            .map(unmarshall)
            .map(({ RoomId, EphemeraId = '' }) => ({ CharacterId: removeType(EphemeraId), RoomId }))
            .map(({ CharacterId, RoomId }) => (
                //
                // TODO:  Refactor so that instead of sending individual SNS commands, the
                // handler aggregates all of the messages and sends one SNS command with the
                // whole set of simultaneous disconnects (and maybe a batch-write for the ephemera table)
                //
                updateWithRoomMessage({
                    RoomId,
                    CharacterId,
                    promises: [
                        dbClient.send(new PutItemCommand({
                            TableName: ephemeraTable,
                            Item: marshall({
                                EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                                DataCategory: 'Connection',
                                RoomId,
                                Connected: false
                            })
                        })),
                        graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId, RoomId }) })
                    ],
                    messageFunction: (Name) => (`${Name || 'Someone'} has disconnected.`)
                })
            )
        )
    )

    return { statusCode: 200 }
}

const registerCharacter = async ({ connectionId, CharacterId }) => {

    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const { Item = {} } = await dbClient.send(new GetItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        })
    }))
    const { DataCategory, RoomId, Connected } = unmarshall(Item)
    if (DataCategory) {
        const updatePromise = Promise.all([
            dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId,
                    DataCategory: 'Connection'
                }),
                UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
                ExpressionAttributeValues: marshall({
                    ":ConnectionId": connectionId,
                    ":Connected": true
                })
            })),
            graphqlClient.mutate({ mutation: connectGQL({ CharacterId, RoomId }) })
        ])
        if (Connected) {
            await updatePromise
        }
        else {
            await updateWithRoomMessage({
                RoomId,
                CharacterId,
                promises: [ updatePromise ],
                messageFunction: (Name) => (`${Name || 'Someone'} has connected.`)
            })
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "Registered", CharacterId })
        }
    }
    return { statusCode: 404 }

}

const lookPermanent = async ({ PermanentId }) => {
    // await SNS.publish({
    //     TopicArn: MESSAGE_SNS_ARN,
    //     Message: JSON.stringify([{
    //         Characters,
    //         DisplayProtocol: "World",
    //         Message: messageFunction(Name),
    //         MessageId: uuidv4(),
    //         RoomId
    //     }], null, 4)
    // }).promise()
    //
    // TODO:  Refactor controlChannel to use tree-shaken AWS SDK v3 imports
    // and include the Lambda invoke client to directly call Perception lambda
    //
}

exports.disconnect = disconnect
exports.registerCharacter = registerCharacter
exports.handler = (event) => {

    const { connectionId, routeKey } = event.requestContext
    const request = event.body && JSON.parse(event.body) || {}

    if (routeKey === '$disconnect') {
        return disconnect(connectionId)
    }
    switch(request.message) {
        case 'registercharacter':
            if (request.CharacterId) {
                return registerCharacter({ connectionId, CharacterId: request.CharacterId})
            }
            break
        //
        // TODO:  Make a better messaging protocol to distinguish meta-actions like registercharacter
        // from in-game actions like look
        //
        case 'look':
            return lookPermanent(request)
        default:
            break
    }
    return { statusCode: 200, body: JSON.stringify({}) }

}