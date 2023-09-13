import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isWorldMessage, PublishMessage, MessageBus, isRoomUpdatePublishMessage, isPublishTargetRoom, isPublishTargetCharacter, isPublishTargetExcludeCharacter, PublishTarget, isRoomDescriptionPublishMessage, isFeatureDescriptionPublishMessage, isCharacterDescriptionPublishMessage, isKnowledgeDescriptionPublishMessage } from "../messageBus/baseClasses"
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import internalCache from '../internalCache'
import { messageDeltaDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { RoomCharacterListItem } from '../internalCache/baseClasses'
import { apiClient } from '../apiClient'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
    await Promise.all(Targets
        .map(async (target) => (messageDeltaDB.putItem({
            Target: target,
            DeltaId: `${CreatedTime}::${MessageId}`,
            RowId: MessageId,
            CreatedTime,
            ...rest
        })))
    )
}

class PublishMessageTargetMapper {
    activeCharactersByRoomId: Record<EphemeraRoomId, RoomCharacterListItem[]> = {}
    connectionsByCharacterId: Record<EphemeraCharacterId, string[]> = {}

    async initialize(payloads: PublishMessage[]) {
        const allRoomTargets = payloads.reduce<EphemeraRoomId[]>((previous, { targets }) => (
            targets
                .filter(isPublishTargetRoom)
                .reduce<EphemeraRoomId[]>((accumulator, target) => (unique(accumulator, [target]) as EphemeraRoomId[]), previous)
        ), [] as EphemeraRoomId[])
        const allCharacterTargets = payloads.reduce<EphemeraCharacterId[]>((previous, { targets }) => (
            targets
                .filter(isPublishTargetCharacter)
                .reduce<EphemeraCharacterId[]>((accumulator, target) => (unique(accumulator, [target]) as EphemeraCharacterId[]), previous)
        ), [] as EphemeraCharacterId[])
    
        this.activeCharactersByRoomId = Object.assign({} as Record<string, RoomCharacterListItem[]>,
            ...(await Promise.all(allRoomTargets.map((roomId) => (internalCache.RoomCharacterList.get(roomId).then((activeCharacters) => ({ [roomId]: activeCharacters }))))))
        )
    
        this.connectionsByCharacterId = {}
        Object.values(this.activeCharactersByRoomId).forEach((characterList) => {
            characterList.forEach(({ EphemeraId, ConnectionIds }) => {
                const characterId = EphemeraId
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

    remap(targets: PublishTarget[]): EphemeraCharacterId[] {
        const roomTargets = targets.filter(isPublishTargetRoom)
        const nonRoomTargets = targets.filter(isPublishTargetCharacter)
        const excludeTargets = targets.filter(isPublishTargetExcludeCharacter).map((excludeCharacter) => (excludeCharacter.slice(1) as `CHARACTER#${string}`))
        const mappedRoomTargetGroups = roomTargets
                .map((target) => ((this.activeCharactersByRoomId[target] || []).map(({ EphemeraId }) => (EphemeraId))))
        return (unique(nonRoomTargets, ...mappedRoomTargetGroups) as EphemeraCharacterId[])
            .filter((characterId) => (!excludeTargets.includes(characterId)))
    }

    characterConnections(characterId: EphemeraCharacterId): string[] {
        return this.connectionsByCharacterId[characterId] || []
    }
}

export const publishMessage = async ({ payloads }: { payloads: PublishMessage[], messageBus?: MessageBus }): Promise<void> => {
    const baseTime = Date.now()
    const mapper = new PublishMessageTargetMapper()
    await mapper.initialize(payloads)

    let dbPromises: Promise<void>[] = []
    //
    // TODO: Constrain messageByConnectionId to appropriate message type
    //
    let messagesByConnectionId: Record<string, any[]> = {}

    const offsetsByMessageId = internalCache.OrchestrateMessages.allOffsets()
    const pastOffsets = Math.max(-1, ...Object.values(offsetsByMessageId)) + 1

    const pushToQueues = async <T extends { Targets: PublishTarget[]; CreatedTime: number; MessageId: string; }>({ Targets, ...rest }: T) => {
        if (Targets.length) {
            const remappedTargets = mapper.remap(Targets)
            dbPromises.push(publishMessageDynamoDB({
                Targets: remappedTargets,
                ...rest
            }))
            remappedTargets.forEach((target) => {
                const connections = mapper.characterConnections(target) || []
                connections.forEach((connectionId) => {
                    if (!(connectionId in messagesByConnectionId)) {
                        messagesByConnectionId[connectionId] = []
                    }
                    messagesByConnectionId[connectionId].push({
                        Target: target,
                        ...rest
                    })
                })
            })
        }
        else {
            const connectionId = await internalCache.Global.get("ConnectionId")
            if (connectionId) {
                if (!(connectionId in messagesByConnectionId)) {
                    messagesByConnectionId[connectionId] = []
                }
                messagesByConnectionId[connectionId].push(rest)
            }
        }
    }

    await Promise.all(payloads.map(async (payload, index) => {
        const CreatedTime = baseTime + (payload.messageGroupId ? offsetsByMessageId[payload.messageGroupId] ?? pastOffsets + index : pastOffsets + index)
        if (isWorldMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
        //
        // TODO: Deprecate Name and possibly Color from data that needs to be sent on a
        // CharacterMessage, and pull it instead from the internalCache along with fileURL
        //
        if (isCharacterMessage(payload)) {
            const { fileURL } = await internalCache.CharacterMeta.get(payload.characterId)
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
                Name: payload.name,
                CharacterId: payload.characterId,
                Color: payload.color,
                fileURL
            })
        }
        if (isRoomUpdatePublishMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                RoomId: payload.RoomId,
                Characters: payload.Characters
            })
        }
        if (isRoomDescriptionPublishMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                RoomId: payload.RoomId,
                Name: payload.Name,
                Description: payload.Description,
                Characters: payload.Characters,
                Exits: payload.Exits,
                assets: payload.assets
            })
        }
        if (isFeatureDescriptionPublishMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                FeatureId: payload.FeatureId,
                Name: payload.Name,
                Description: payload.Description,
                assets: payload.assets
            })
        }
        if (isKnowledgeDescriptionPublishMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                KnowledgeId: payload.KnowledgeId,
                Name: payload.Name,
                Description: payload.Description,
                assets: payload.assets
            })
        }
        if (isCharacterDescriptionPublishMessage(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                CharacterId: payload.CharacterId,
                Name: payload.Name,
                Pronouns: payload.Pronouns,
                FirstImpression: payload.FirstImpression,
                OneCoolThing: payload.OneCoolThing,
                Outfit: payload.Outfit,
                fileURL: payload.fileURL
            })
        }
    }))

    await Promise.all([
        ...dbPromises,
        ...(Object.entries(messagesByConnectionId)
            .map(async ([ConnectionId, messageList]) => {
                const sortedMessages = messageList
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
                return Promise.all(sortedMessages.length
                    ? batchMessages(sortedMessages).map((messageBatch) => (
                        apiClient.send(
                            ConnectionId,
                            {
                                messageType: 'Messages',
                                messages: messageBatch
                            }
                        )
                    ))
                    : []
                )
            })
        )
    ])
}

export default publishMessage
