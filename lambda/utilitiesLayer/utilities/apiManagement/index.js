import apiManagement, { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import { ephemeraDB } from '../dynamoDB/index.js'
import { forceDisconnect } from './forceDisconnect.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const queueInitial = {
    messages: []
}

const queueReducer = (state, action) => {
    const { messages } = state
    return {
        messages: [
            ...messages,
            action
        ]
    }
}

export const socketQueueFactory = () => {
    let globalMessageQueue = queueInitial
    let messageQueueByConnection = {}

    return {
        clear: () => {
            globalMessageQueue = { messages: [] }
            messageQueueByConnection = {}
        },
        send: ({ ConnectionId, Message }) => {
            messageQueueByConnection[ConnectionId] = queueReducer(
                messageQueueByConnection[ConnectionId] || queueInitial,
                Message
            )
        },
        sendAll: (Message) => {
            globalMessageQueue = queueReducer(globalMessageQueue, Message)
        },
        flush: async () => {
            const deliver = async (ConnectionId) => {
                const deliverMessage = async (message) => {
                    await apiClient.send(new PostToConnectionCommand({
                        ConnectionId,
                        Data: JSON.stringify(message)
                    }))    
                }
                try {
                    await Promise.all([
                        ...globalMessageQueue.messages,
                        ...((messageQueueByConnection[ConnectionId] || { messages: [] }).messages || [])
                    ].map(deliverMessage))
                }
                catch (err) {
                    if (err.name === 'GoneException') {
                        await forceDisconnect(ConnectionId)
                    }
                    else {
                        throw err
                    }
                }

            }
            if (globalMessageQueue.messages.length) {
                const { connections = {} } = await ephemeraDB.getItem({
                    EphemeraId: 'Global',
                    DataCategory: 'Connections',
                    ProjectionFields: ['connections']
                })
                await Promise.all(Object.keys(connections).map(deliver))
            }
            else {
                await Promise.all(Object.keys(messageQueueByConnection).map(deliver))
            }
            globalMessageQueue = { messages: [] }
            messageQueueByConnection = {}

        }
    }
}