import { v4 as uuidv4 } from 'uuid'

import { SocketQueue } from '../apiManagement/index.js'
import { publishMessage, ephemeraDB } from '../dynamoDB/index.js'
import { splitType } from '../types.js'

export const deliverRenders = async ({
    renderOutputs,
    RequestId,
    options: {
        roomProtocol = 'RoomUpdate',
        featureProtocol = 'FeatureDescription',
        characterProtocol = 'CharacterDescription'
    } = {}
}) => {

    const allCharacterIds = [...(new Set(renderOutputs.map(({ CharacterId }) => (CharacterId))))]

    const fetchConnectionsByCharacterId = async (CharacterId) => {
        const queryItems = await ephemeraDB.query({
            EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
            KeyConditionExpression: 'begins_with(DataCategory, :connection)',
            ExpressionAttributeValues: {
                ':connection': 'CONNECTION#'
            },
            ProjectionFields: ['DataCategory']
        })
        return { [CharacterId]: queryItems.map(({ DataCategory }) => (splitType(DataCategory)[1])) }
    }
    const connectionsQueryResults = await Promise.all(allCharacterIds.map(fetchConnectionsByCharacterId))
    const connectionsByCharacterId = Object.assign({}, ...connectionsQueryResults)

    const socketQueue = new SocketQueue()

    const messagesToPublish = []

    renderOutputs.forEach((message) => {
        const { tag, type, EphemeraId, ...restOfMessage } = message
        if (type === 'Map') {
            (connectionsByCharacterId[message.CharacterId] || []).forEach((ConnectionId) => {
                socketQueue.send({
                    ConnectionId,
                    Message: {
                        messageType: 'Ephemera',
                        RequestId,
                        updates: [{
                            type,
                            EphemeraId,
                            ...restOfMessage
                        }]
                    }
                })
            })
        }
        else {
            switch(tag) {
                case 'Room':
                    messagesToPublish.push({
                        DisplayProtocol: roomProtocol,
                        ...restOfMessage
                    })
                    break
                case 'Feature':
                    messagesToPublish.push({
                        DisplayProtocol: featureProtocol,
                        ...restOfMessage
                    })
                    break
                case 'Character':
                    messagesToPublish.push({
                        DisplayProtocol: characterProtocol,
                        ...restOfMessage,
                    })
            }
        }
    })

    await Promise.all([
        socketQueue.flush(),
        ...(messagesToPublish
            .map(({ EphemeraId, CharacterId, Targets = [], tag, type, ...roomMessage }) => {
                const aggregateTargets = [
                    ...Targets,
                    ...(Targets.length === 0 ? [`CHARACTER#${CharacterId}`] : [])
                ]
                const selectedCharacterId = (Targets.length === 0) ? undefined : CharacterId
                return publishMessage({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    Targets: aggregateTargets,
                    CharacterId: selectedCharacterId,
                    CreatedTime: Date.now(),
                    ...roomMessage
                })
            })
        )
    ])
}