import { apiClient } from './apiManagementClient.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { forceDisconnect } from './forceDisconnect.js'

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

const queueSerialize = ({ messages = [], messageMeta = {}, ephemera = [], ephemeraMeta = {}, otherSends = []}) => {
    return [
        ...(Object.keys(messages).length
            ? [{
                messageType: 'Messages',
                ...messageMeta,
                messages: Object.values(messages)
                    .reduce((previous, targets) => ([ ...previous, ...(Object.values(targets)) ]), [])
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
            }]
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

const queueHasContent = ({ messages, otherSends }) => (
    (Object.keys(messages).length) || (otherSends.length)
)

export class SocketQueue extends Object {
    constructor() {
        super()
        this.globalMessageQueue = queueInitial
        this.messageQueueByConnection = {}
    }

    clear() {
        this.globalMessageQueue = queueInitial
        this.messageQueueByConnection = {}
    }
    send({ ConnectionId, Message }) {
        this.messageQueueByConnection[ConnectionId] = queueReducer(
            this.messageQueueByConnection[ConnectionId] || queueInitial,
            Message
        )
    }
    sendAll(Message) {
        this.globalMessageQueue = queueReducer(this.globalMessageQueue, Message)
    }
    async flush() {
        const deliver = async (ConnectionId) => {
            const deliverMessage = async (message) => {
                await apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify(message)
                })
            }
            try {
                await Promise.all([
                    ...queueSerialize(this.globalMessageQueue),
                    ...(this.messageQueueByConnection[ConnectionId]
                        ? queueSerialize(this.messageQueueByConnection[ConnectionId])
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
        if (queueHasContent(this.globalMessageQueue)) {
            const { connections = {} } = await ephemeraDB.getItem({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                ProjectionFields: ['connections']
            })
            await Promise.all(Object.keys(connections).map(deliver))
        }
        else {
            await Promise.all(Object.keys(this.messageQueueByConnection).map(deliver))
        }
        this.globalMessageQueue = queueInitial
        this.messageQueueByConnection = {}

    }
}
