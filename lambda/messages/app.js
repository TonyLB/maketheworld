import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

import { splitType } from '/opt/utilities/types.js'
import { batchGetDispatcher, batchWriteDispatcher } from '/opt/utilities/dynamoDB/index.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const messageTable = `${process.env.TABLE_PREFIX}_messages`
const deltaTable = `${process.env.TABLE_PREFIX}_message_delta`
const ephemeraTable = `${process.env.TABLE_PREFIX}_ephemera`

export const handler = async (event, context) => {
    const { action, Records } = event

    //
    // Check whether message is being called from DBStream (in which case Events will be present)
    //
    if (Records.length) {
        const metaRecords = Records
            .filter(({ eventName }) => (eventName === 'INSERT'))
            .map(({ dynamodb }) => (unmarshall(dynamodb.NewImage || {})))
            .filter(({ DataCategory, Targets }) => (DataCategory === 'Meta::Message' && Targets && Targets.length > 0))
            .map(({ DataCategory, ...rest }) => (rest))
        if (metaRecords.length) {
            const allTargets = Object.keys(metaRecords
                .reduce((previous, { Targets }) => (
                    Targets.reduce((accumulate, target) => ({ ...accumulate, [target]: true }), previous
                )), {}))
            //
            // First-pass:  Separate character targets from room targets
            //
            const { characterTargets, roomTargets } = allTargets.map(splitType).reduce((previous, [type, id]) => {
                switch(type) {
                    case 'NOT-CHARACTER':
                        return previous
                    case 'CHARACTER':
                        return {
                            ...previous,
                            characterTargets: {
                                ...previous.characterTargets,
                                [id]: { id }
                            }
                        }
                    case 'ROOM':
                        return {
                            ...previous,
                            roomTargets: {
                                ...previous.roomTargets,
                                [id]: { id }
                            }
                        }
                    default:
                        return previous
                }
            }, { characterTargets: {}, roomTargets: {} })
            //
            // Second-pass:  Pull active characters and connections from room ephemera
            //
            let resolvedTargetMap = { }
            if (Object.keys(roomTargets).length) {
                const roomEphemera = await batchGetDispatcher({
                    table: ephemeraTable,
                    items: Object.values(roomTargets)
                        .map(({ id }) => (marshall({
                            EphemeraId: `ROOM#${id}`,
                            DataCategory: 'Meta::Room'
                        }))),
                    projectionExpression: 'EphemeraId, activeCharacters'
                })
                //
                // Mutate resolvedTargetMap to keep a running mapping of ID and connectionId
                //
                roomEphemera.forEach(({ EphemeraId: RoomId, activeCharacters = {} }) => {
                    const resolvedContents = Object.values(activeCharacters).map(
                        ({ EphemeraId: characterInPlayId, ConnectionId }) => ({
                            id: `CHARACTER#${splitType(characterInPlayId)[1]}`,
                            ConnectionId
                        }))
                    resolvedContents.forEach(({ id, ConnectionId }) => {
                        resolvedTargetMap[id] = [{ id, ConnectionId }]
                    })
                    resolvedTargetMap[RoomId] = resolvedContents
                })
            }
            //
            // Third-pass: Pull connections (if available) for any character that we haven't found
            // the ConnectionId for in checking rooms.
            //
            //
            // TODO:  It might be worth maintaining a denormalized CharacterID -> Connection map in
            // Global x Connections record, to avoid having to BatchGet when mapping multiple
            // targets
            //
            if (Object.keys(characterTargets).find((id) => (resolvedTargetMap[`CHARACTER#${id}`] === undefined))) {
                const characterEphemera = await batchGetDispatcher({
                    table: ephemeraTable,
                    items: Object.keys(characterTargets)
                        .map((id) => (marshall({
                            EphemeraId: `CHARACTERINPLAY#${id}`,
                            DataCategory: 'Connection'
                        }))),
                    projectionExpression: 'EphemeraId, ConnectionId'
                })
                characterEphemera
                    .filter(({ EphemeraId, ConnectionId }) => (EphemeraId && ConnectionId))
                    .forEach(({ EphemeraId, ConnectionId }) => {
                        const id = `CHARACTER#${splitType(EphemeraId)[1]}`
                        resolvedTargetMap[id] = [{ id, ConnectionId }]
                    })
            }

            const epochTime = Date.now()
            const { messageItems, deltaItems, broadcastPayloads } = metaRecords.reduce(
                (previous, { Targets, CreatedTime, MessageId, ...rest }) => {
                    const aggregateTargets = Targets
                        .reduce((previous, item) => {
                            const [type, id] = splitType(item)
                            switch(type) {
                                case 'NOT-CHARACTER':
                                    return previous.filter((checkItem) => (checkItem.id !== `CHARACTER#${id}`))
                                default:
                                    return [...previous, ...(resolvedTargetMap[item] || [{ id: item }])]
                            }
                        }, [])
                    const deduplicatedDBTargets = [...new Set(aggregateTargets.map(({ id }) => (id)))]
                    const { messageItems, deltaItems } = deduplicatedDBTargets.reduce(
                        (
                            { messageItems: prevMessage, deltaItems: prevDelta },
                            target
                        ) => ({
                            messageItems: [
                                ...prevMessage,
                                {
                                    PutRequest: {
                                        Item: marshall({
                                            MessageId,
                                            DataCategory: target,
                                            CreatedTime: CreatedTime || epochTime,
                                            ...rest
                                        }, { removeUndefinedValues: true })
                                    }
                                }
                            ],
                            //
                            // Save sync data only for characters
                            //
                            deltaItems: splitType(target)[0] === 'CHARACTER'
                                ? [
                                    ...prevDelta,
                                    {
                                        PutRequest: {
                                            Item: marshall({
                                                Target: target,
                                                DeltaId: `${CreatedTime || epochTime}::${MessageId}`,
                                                RowId: MessageId,
                                                CreatedTime: CreatedTime || epochTime,
                                                ...rest
                                            }, { removeUndefinedValues: true })
                                        }
                                    }
                                ] : prevDelta
                        }), previous)
                    const broadcastPayloads = aggregateTargets
                        .filter(({ ConnectionId }) => (ConnectionId))
                        .reduce((prevBroadcast, { id: target, ConnectionId }) => ({
                            ...prevBroadcast,
                            [ConnectionId]: [
                                ...(prevBroadcast[ConnectionId] || []),
                                {
                                    MessageId,
                                    CreatedTime: CreatedTime || epochTime,
                                    Target: splitType(target)[1],
                                    ...rest
                                }
                            ]
                        }), previous.broadcastPayloads)
                    return { messageItems, deltaItems, broadcastPayloads }
                }, { messageItems: [], deltaItems: [], broadcastPayloads: {} })
            const broadcastPromise = Promise.all(
                Object.entries(broadcastPayloads)
                    .map(([ConnectionId, messages]) => (apiClient.send(new PostToConnectionCommand({
                        ConnectionId,
                        Data: JSON.stringify({
                            messageType: 'Messages',
                            messages
                        })
                    }))))
            )
            await Promise.all([
                batchWriteDispatcher({ table: messageTable, items: messageItems }),
                batchWriteDispatcher({ table: deltaTable, items: deltaItems }),
                broadcastPromise
            ])
        }
    }
    else {
        context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}
