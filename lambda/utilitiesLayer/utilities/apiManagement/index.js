import { apiClient } from './apiManagementClient.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { forceDisconnect } from './forceDisconnect.js'

const queueInitial = {
    messages: {},
    otherSends: []
}

const queueReducer = (state, action) => {
    const { messages, otherSends } = state
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
                otherSends
            }
        default:
            return {
                messages,
                otherSends: [
                    ...otherSends,
                    action
                ]
            }
    }
}

const queueSerialize = ({ messages = [], otherSends = []}) => {
    return [
        ...(Object.keys(messages).length
            ? [{
                messageType: 'Messages',
                messages: Object.values(messages)
                    .reduce((previous, targets) => ([ ...previous, ...(Object.values(targets)) ]), [])
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
            }]
            : []
        ),
        ...otherSends
    ]
}

const queueHasContent = ({ messages, otherSends }) => (
    (Object.keys(messages).length) || (otherSends.length)
)

export const socketQueueFactory = () => {
    let globalMessageQueue = queueInitial
    let messageQueueByConnection = {}

    return {
        clear: () => {
            globalMessageQueue = queueInitial
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
                    await apiClient.send({
                        ConnectionId,
                        Data: JSON.stringify(message)
                    })
                }
                try {
                    await Promise.all([
                        ...queueSerialize(globalMessageQueue),
                        ...(messageQueueByConnection[ConnectionId]
                            ? queueSerialize(messageQueueByConnection[ConnectionId])
                            : []
                        )
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
            if (queueHasContent(globalMessageQueue)) {
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
            globalMessageQueue = queueInitial
            messageQueueByConnection = {}

        }
    }
}