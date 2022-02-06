import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import { ephemeraDB } from '../dynamoDB/index.js'
import { forceDisconnect } from './forceDisconnect.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

let globalMessageQueue = {
    messages: []
}
let messageQueueByConnection = {}

export const socketQueue = {
    clearQueue: () => {
        globalMessageQueue = { messages: [] }
        messageQueueByConnection = {}
    },
    send: ({ ConnectionId, Message }) => {
        if (messageQueueByConnection[ConnectionId]) {
            messageQueueByConnection[ConnectionId] = {
                messages: [
                    ...messageQueueByConnection[ConnectionId].messages,
                    Message
                ]
            }
        }
        else {
            messageQueueByConnection[ConnectionId] = {
                messages: [Message]
            }
        }
    },
    sendAll: (Message) => {
        globalMessageQueue = {
            messages: [
                ...globalMessageQueue.messages,
                Message
            ]
        }
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
                if (err instanceof GoneException) {
                    forceDisconnect(ConnectionId)
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

    }
}