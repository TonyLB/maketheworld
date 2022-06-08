import { apiClient } from './apiManagementClient.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { forceDisconnect } from './forceDisconnect.js'
import { unique } from '../lists.js'

const queueInitial = {
    messages: {},
    messageMeta: {},
    ephemera: [],
    ephemeraMeta: {},
    otherSends: []
}

const queueReducer = (state, action) => {
    const { messages, otherSends, messageMeta, ephemera, ephemeraMeta } = state
    switch(action.messageType || '') {
        case 'Messages':
            return {
                messages: (action.messages || [])
                    .reduce((previous, { MessageId, Target, ...rest }) => ({
                        ...previous,
                        [MessageId]: {
                            ...(previous[MessageId] || {}),
                            [Target]: { MessageId, Target, ...rest }
                        }
                    }), messages),
                messageMeta: {
                    ...messageMeta,
                    LastSync: action.LastSync,
                    RequestId: action.RequestId
                },
                ephemera,
                ephemeraMeta,
                otherSends
            }
        case 'Ephemera':
            return {
                messages,
                messageMeta,
                ephemera: [
                    ...ephemera,
                    ...action.updates
                ],
                ephemeraMeta: {
                    ...ephemeraMeta,
                    RequestId: action.RequestId
                },
                otherSends
            }
        default:
            return {
                messages,
                messageMeta,
                ephemera,
                ephemeraMeta,
                otherSends: [
                    ...otherSends,
                    action
                ]
            }
    }
}

const batchMessages = (messages = [])  => {
    //
    // API Gateway Websockets deliver a maximum of 32KB per data frame (with a maximum of 128k across multiple frames,
    // but I don't think that's needed for an application with a large number of individually small messages)
    //
    const MAX_BATCH_SIZE = 20000
    const lengthOfMessage = (message) => (JSON.stringify(message).length)
    const { batchedMessages = [], currentBatch = [] } = messages.reduce((previous, message) => {
        const newLength = lengthOfMessage(message)
        const proposedLength = previous.currentLength + newLength
        if (proposedLength > MAX_BATCH_SIZE) {
            return {
                batchedMessages: [...previous.batchedMessages, previous.currentBatch],
                currentBatch: [message],
                currentLength: newLength
            }
        }
        else {
            return {
                batchedMessages: previous.batchedMessages,
                currentBatch: [...previous.currentBatch, message],
                currentLength: proposedLength
            }
        }
    }, { batchedMessages: [], currentBatch: [], currentLength: 0 })
    return currentBatch.length ? [...batchedMessages, currentBatch] : batchedMessages
}

const queueSerialize = ({ messages = [], messageMeta = {}, ephemera = [], ephemeraMeta = {}, otherSends = []}) => {
    const sortedMessages = Object.values(messages)
        .reduce((previous, targets) => ([ ...previous, ...(Object.values(targets)) ]), [])
        .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
    return [
        ...(sortedMessages.length
            ? batchMessages(sortedMessages).map((messageBatch) => ({
                messageType: 'Messages',
                ...messageMeta,
                messages: messageBatch
            }))
            : []
        ),
        ...(ephemera.length
            ? [{
                messageType: 'Ephemera',
                ...ephemeraMeta,
                updates: ephemera
            }]
            : []
        ),
        ...otherSends
    ]
}

const queueHasContent = ({ messages, ephemera, otherSends }) => (
    (Object.keys(messages).length) || (ephemera.length) || (otherSends.length)
)

export class SocketQueue extends Object {
    constructor() {
        super()
        this.globalMessageQueue = queueInitial
        this.forceConnections = []
        this.messageQueueByConnection = {}
        this.messageQueueByPlayer = {}
    }

    clear() {
        this.globalMessageQueue = queueInitial
        this.messageQueueByConnection = {}
        this.messageQueueByPlayer = {}
    }
    send({ ConnectionId, Message }) {
        this.messageQueueByConnection[ConnectionId] = queueReducer(
            this.messageQueueByConnection[ConnectionId] || queueInitial,
            Message
        )
    }
    sendPlayer({ PlayerName, Message }) {
        this.messageQueueByPlayer[PlayerName] = queueReducer(
            this.messageQueueByPlayer[PlayerName] || queueInitial,
            Message
        )
    }
    sendAll(Message, options) {
        const { forceConnections = [] } = options || {}
        this.globalMessageQueue = queueReducer(this.globalMessageQueue, Message)
        this.forceConnections = unique(this.forceConnections, forceConnections)
    }
    async flush() {
        const deliver = (connections = {}) => async (ConnectionId) => {
            const deliverMessage = async (message) => {
                await apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify(message)
                })
            }
            try {
                const connectionMessages = this.messageQueueByConnection[ConnectionId]
                    ? queueSerialize(this.messageQueueByConnection[ConnectionId])
                    : []
                const playerMessages = (connections[ConnectionId] && this.messageQueueByPlayer[connections[ConnectionId]])
                    ? queueSerialize(this.messageQueueByPlayer[connections[ConnectionId]])
                    : []
                await Promise.all([
                    ...queueSerialize(this.globalMessageQueue),
                    ...connectionMessages,
                    ...playerMessages
                ].map(deliverMessage))
            }
            catch (err) {
                if (err.name === 'GoneException' || err.name === 'BadRequestException') {
                    await forceDisconnect(ConnectionId)
                }
                else {
                    console.log(`Error: ${err.name}`)
                    throw err
                }
            }

        }
        if (queueHasContent(this.globalMessageQueue) || Object.values(this.messageQueueByPlayer).find((queue) => (queueHasContent(queue)))) {
            const { connections = {} } = await ephemeraDB.getItem({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                ProjectionFields: ['connections']
            })
            await Promise.all(
                [
                    ...Object.keys(connections),
                    ...this.forceConnections
                ].map(deliver(connections))
            )
        }
        else {
            await Promise.all(Object.keys(this.messageQueueByConnection).map(deliver()))
        }
        this.globalMessageQueue = queueInitial
        this.forceConnections = []
        this.messageQueueByConnection = {}
        this.messageQueueByPlayer = {}

    }
}
