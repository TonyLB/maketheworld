import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isWorldMessage, PublishMessage, MessageBus, isRoomUpdatePublishMessage } from "../messageBus/baseClasses"
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import internalCache from '../internalCache'
import { messageDB, messageDeltaDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { RoomCharacterListItem } from '../internalCache/baseClasses'
import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

const batchMessages = (messages: any[] = [])  => {
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

const publishMessageDynamoDB = async <T extends { MessageId: string; CreatedTime: number; Targets: string[] }>({ MessageId, CreatedTime, Targets, ...rest }: T): Promise<void> => {
    await Promise.all([
        messageDB.putItem({
            MessageId,
            DataCategory: 'Meta::Message',
            CreatedTime,
            Targets,
            ...rest
        }),
        ...(Targets
            .filter((target) => (splitType(target)[0] === 'CHARACTER'))
            .map(async (target) => (messageDeltaDB.putItem({
                Target: target,
                DeltaId: `${CreatedTime}::${MessageId}`,
                RowId: MessageId,
                CreatedTime,
                ...rest
            })))
        )
    ])
}

class PublishMessageTargetMapper {
    activeCharactersByRoomId: Record<string, RoomCharacterListItem[]> = {}
    connectionsByCharacterId: Record<string, string[]> = {}

    async initialize(payloads: PublishMessage[]) {
        const allRoomTargets = payloads.reduce<string[]>((previous, { targets }) => (
            targets
                .filter((target) => (splitType(target)[0] === 'ROOM'))
                .reduce<string[]>((accumulator, target) => (unique(accumulator, [target]) as string[]), previous)
        ), [] as string[])
        const allCharacterTargets = payloads.reduce<string[]>((previous, { targets }) => (
            targets
                .filter((target) => (splitType(target)[0] === 'CHARACTER'))
                .reduce<string[]>((accumulator, target) => (unique(accumulator, [target]) as string[]), previous)
        ), [] as string[])
    
        this.activeCharactersByRoomId = Object.assign({} as Record<string, RoomCharacterListItem[]>,
            ...(await Promise.all(allRoomTargets.map((roomId) => (internalCache.RoomCharacterList.get(roomId).then((activeCharacters) => ({ [roomId]: activeCharacters }))))))
        )
    
        this.connectionsByCharacterId = {}
        Object.values(this.activeCharactersByRoomId).forEach((characterList) => {
            characterList.forEach(({ EphemeraId, ConnectionIds }) => {
                const characterId = splitType(EphemeraId)[1]
                if (characterId) {
                    if (characterId in this.connectionsByCharacterId) {
                        this.connectionsByCharacterId[characterId] = unique(this.connectionsByCharacterId[characterId], ConnectionIds) as string[]
                    }
                    else {
                        this.connectionsByCharacterId[characterId] = ConnectionIds
                    }
                }
            })
        })
    
        const unmappedCharacters = allCharacterTargets.filter((characterId) => (!(characterId in this.connectionsByCharacterId)))
        await Promise.all(
            unmappedCharacters.map((characterId) => (
                internalCache.CharacterConnections.get(characterId)
                    .then((connections) => {
                        this.connectionsByCharacterId[characterId] = connections || []
                    })
                ))
        )
    }

    remap(targets: string[]): string[] {
        const roomTargets = targets.filter((target) => (splitType(target)[0] === 'ROOM'))
        const nonRoomTargets = targets.filter((target) => (splitType(target)[0] === 'CHARACTER'))
        const excludeTargets = targets.filter((target) => (splitType(target)[0] === 'NOT-CHARACTER')).map((value) => (value.slice(4)))
        const mappedRoomTargetGroups = roomTargets
                .map((target) => ((this.activeCharactersByRoomId[target] || []).map(({ EphemeraId }) => (EphemeraId))))
        return (unique(nonRoomTargets, ...mappedRoomTargetGroups) as string[])
            .filter((characterId) => (!excludeTargets.includes(characterId)))
    }

    characterConnections(characterId: string): string[] {
        return this.connectionsByCharacterId[characterId] || []
    }
}

export const publishMessage = async ({ payloads }: { payloads: PublishMessage[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()
    const mapper = new PublishMessageTargetMapper()
    await mapper.initialize(payloads)

    //
    // TODO: Replace ad-hoc remappedTarget generation below with references to the
    // connections mapping created in aggregate
    //

    //
    // TODO: Accumulate messages by target character ID, and send them to the APIClient
    //

    let dbPromises: Promise<void>[] = []
    let messagesByConnectionId: Record<string, any[]> = {}

    const pushToQueues = <T extends { Targets: string[]; CreatedTime: number; MessageId: string; }>({ Targets, ...rest }: T) => {
        const remappedTargets = mapper.remap(Targets)
        dbPromises.push(publishMessageDynamoDB({
            Targets: remappedTargets,
            ...rest
        }))
        remappedTargets.forEach((target) => {
            const [type, id] = splitType(target)
            if (type === 'CHARACTER') {
                const connections = mapper.characterConnections(id) || []
                connections.forEach((connectionId) => {
                    if (!(connectionId in messagesByConnectionId)) {
                        messagesByConnectionId[connectionId] = []
                    }
                    messagesByConnectionId[connectionId].push({
                        Target: target,
                        ...rest
                    })
                })
            }
        })
    }

    payloads.forEach((payload, index) => {
        if (isWorldMessage(payload)) {
            pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
        if (isCharacterMessage(payload)) {
            pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
                Name: payload.name,
                CharacterId: payload.characterId,
                Color: payload.color
            })
        }
        if (isRoomUpdatePublishMessage(payload)) {
            pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                DisplayProtocol: payload.displayProtocol,
                RoomId: payload.RoomId,
                Characters: payload.Characters
            })
        }
    })

    await Promise.all([
        ...dbPromises,
        ...(Object.entries(messagesByConnectionId)
            .map(async ([ConnectionId, messageList]) => {
                const sortedMessages = messageList
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
                return Promise.all(sortedMessages.length
                    ? batchMessages(sortedMessages).map((messageBatch) => (
                        apiClient.send({
                            ConnectionId,
                            Data: JSON.stringify({
                                messageType: 'Messages',
                                messages: messageBatch
                            })
                        })
                    ))
                    : []
                )
            })
        )
    ])
}

export default publishMessage
