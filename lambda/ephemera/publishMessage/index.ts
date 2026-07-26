import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isPublishWorldLineMessage, isPublishCommandTranscriptMessage, PublishMessage, MessageBus, PublishTarget, isPerceptionPublishMessage, isPublishCoyoteGameHelpMessage, isPublishCoyoteGameHypothesisMessage } from "../messageBus/baseClasses"
import getCurrentTimestamp from '../internalUtils/dateUtil'
import { unique } from '@tonylb/mtw-utilities/ts/lists'
import internalCache from '../internalCache'
import { messageDeltaDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { apiClient } from '../apiClient'
import { TargetResolver, ResolvableTarget } from '@tonylb/mtw-sessions/ts/targetResolver'
import { CacheCharacterSessionsData } from '../internalCache/characterSessions'
import { CacheSessionConnectionsData } from '@tonylb/mtw-sessions/ts/sessionCache'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RoomCharacterListItem } from '../internalCache/baseClasses'
import { getRoomCharacterList } from '../internalCache/hydrateRoomRoster'
import { batchMessages, normalizeConnectionId } from './batchMessages'

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

class PublishMessageTargetResolver extends TargetResolver {
    private CharacterSessions: CacheCharacterSessionsData
    private getRoomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>
    constructor(internalCache: {
        CharacterSessions: CacheCharacterSessionsData
        SessionConnections: CacheSessionConnectionsData
        getRoomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>
    }) {
        super(internalCache)
        this.CharacterSessions = internalCache.CharacterSessions
        this.getRoomCharacterList = internalCache.getRoomCharacterList
    }

    /**
     * Extracts ROOM# targets (excluding exclusions)
     */
    private extractRoomTargets(targets: PublishTarget[]): `ROOM#${string}`[] {
        return targets
            .filter((target): target is `ROOM#${string}` => target.startsWith('ROOM#'))
    }

    /**
     * Extracts ROOM# exclusion targets
     */
    private extractRoomExclusions(targets: PublishTarget[]): `ROOM#${string}`[] {
        return targets
            .filter(target => target.startsWith('!ROOM#'))
            .map(target => target.slice(1) as `ROOM#${string}`)
    }

    /**
     * Extracts CHARACTER# targets (excluding exclusions)
     */
    private extractCharacterTargets(targets: PublishTarget[]): `CHARACTER#${string}`[] {
        return targets
            .filter((target): target is `CHARACTER#${string}` => target.startsWith('CHARACTER#'))
    }

    /**
     * Extracts CHARACTER# exclusion targets
     */
    private extractCharacterExclusions(targets: PublishTarget[]): `CHARACTER#${string}`[] {
        return targets
            .filter(target => target.startsWith('!CHARACTER#'))
            .map(target => target.slice(1) as `CHARACTER#${string}`)
    }

    async resolveRoomTargets(targets: PublishTarget[]): Promise<Exclude<PublishTarget, `ROOM#${string}` | `!ROOM#${string}`>[]> {
        const roomTargets = this.extractRoomTargets(targets)
        const roomExclusions = this.extractRoomExclusions(targets)
        const otherTargets = targets.filter((target) => (!target.startsWith('ROOM#') && !target.startsWith('!ROOM#'))) as Exclude<PublishTarget, `ROOM#${string}` | `!ROOM#${string}`>[]

        const [roomCharacters, roomExclusionCharacters] = await Promise.all([
            (async () => {
                const nestedReturns = await Promise.all(
                    roomTargets.map((roomTarget) => (this.getRoomCharacterList(roomTarget)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ EphemeraId }) => (EphemeraId)).flat(1)
            })(),
            (async () => {
                const nestedReturns = await Promise.all(
                    roomExclusions.map((roomExclusion) => (this.getRoomCharacterList(roomExclusion)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ EphemeraId }) => (EphemeraId)).flat(1).map((ephemeraId) => (`!${ephemeraId}` as const))
            })()
        ])

        return [...roomCharacters, ...roomExclusionCharacters, ...otherTargets]
    }
    

    async resolveToCharacterTargets(targets: PublishTarget[]): Promise<`CHARACTER#${string}`[]> {
        const roomTargets = this.extractRoomTargets(targets)
        const roomExclusions = this.extractRoomExclusions(targets)
        const characterTargets = this.extractCharacterTargets(targets)
        const characterExclusions = this.extractCharacterExclusions(targets)
        const [charactersFromRooms, characterExclusionsFromRooms] = await Promise.all([
            (async () => {
                const nestedReturns = await Promise.all(
                    roomTargets.map((roomTarget) => (this.getRoomCharacterList(roomTarget)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ EphemeraId }) => (EphemeraId))
            })(),
            (async () => {
                const nestedReturns = await Promise.all(
                    roomExclusions.map((roomExclusion) => (this.getRoomCharacterList(roomExclusion)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ EphemeraId }) => (EphemeraId))
            })()
        ])

        return unique([...charactersFromRooms, ...characterExclusionsFromRooms, ...characterTargets])
            .filter((characterId) => (![...characterExclusions, ...characterExclusionsFromRooms].includes(characterId)))

    }

    async resolvePublishTargets(targets: PublishTarget[]): Promise<`CONNECTION#${string}`[]> {
        const roomTargets = this.extractRoomTargets(targets)
        const roomExclusions = this.extractRoomExclusions(targets)
        const characterTargets = this.extractCharacterTargets(targets)
        const characterExclusions = this.extractCharacterExclusions(targets)
        const otherTargets = targets.filter((target) => (!target.startsWith('ROOM#') && !target.startsWith('CHARACTER#') && !target.startsWith('!ROOM#') && !target.startsWith('!CHARACTER#'))) as ResolvableTarget[]

        const [roomSessions, roomExclusionSessions, characterSessions, characterExclusionSessions] = await Promise.all([
            (async () => {
                const nestedReturns = await Promise.all(
                    roomTargets.map((roomTarget) => (this.getRoomCharacterList(roomTarget)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ SessionIds }) => (SessionIds.map((sessionId) => (`SESSION#${sessionId}` as const)))).flat(1)
            })(),
            (async () => {
                const nestedReturns = await Promise.all(
                    roomExclusions.map((roomExclusion) => (this.getRoomCharacterList(roomExclusion)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map(({ SessionIds }) => (SessionIds)).flat(1).map((sessionId) => (`!SESSION#${sessionId}` as const))
            })(),
            (async () => {
                const nestedReturns = await Promise.all(
                    characterTargets.map((characterTarget) => (this.CharacterSessions.get(characterTarget)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map((sessionId) => (`SESSION#${sessionId}` as const))
            })(),
            (async () => {
                const nestedReturns = await Promise.all(
                    characterExclusions.map((characterExclusion) => (this.CharacterSessions.get(characterExclusion)))
                )
                return nestedReturns.map((nestedReturn) => (nestedReturn ?? [])).flat(1).map((sessionId) => (`!SESSION#${sessionId}` as const))
            })(),
        ])

        const aggregateArguments: ResolvableTarget[] = [...roomSessions, ...roomExclusionSessions, ...characterSessions, ...characterExclusionSessions, ...otherTargets]
        return await super.resolve(aggregateArguments)
    }
}

const flushImmediateMessages = async (messagesByConnectionId: Record<string, any[]>): Promise<void> => {
    await Promise.all(
        Object.entries(messagesByConnectionId)
            .map(async ([ConnectionId, messageList]) => {
                const sortedMessages = messageList
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
                return Promise.all(sortedMessages.length
                    ? batchMessages(sortedMessages).map((messageBatch) => (
                        apiClient.send(
                            normalizeConnectionId(ConnectionId),
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
}

export const publishMessage = async ({ payloads }: { payloads: PublishMessage[], messageBus?: MessageBus }): Promise<void> => {
    const baseTime = getCurrentTimestamp()
    const mapper = new PublishMessageTargetResolver({
        CharacterSessions: internalCache.CharacterSessions,
        SessionConnections: internalCache.SessionConnections,
        getRoomCharacterList,
    })

    let dbPromises: Promise<void>[] = []
    let messagesByConnectionId: Record<string, any[]> = {}

    const offsetsByMessageId = internalCache.OrchestrateMessages.allOffsets()
    const pastOffsets = Math.max(-1, ...Object.values(offsetsByMessageId)) + 1

    const enqueueWireRow = (connectionId: string, row: Record<string, unknown>) => {
        if (!(connectionId in messagesByConnectionId)) {
            messagesByConnectionId[connectionId] = []
        }
        messagesByConnectionId[connectionId].push(row)
    }

    const pushToQueues = async <T extends { Targets: PublishTarget[]; CreatedTime: number; MessageId: string; }>(
        { Targets, ...rest }: T
    ) => {
        if (Targets.length) {
            const characterTargets = await mapper.resolveToCharacterTargets(Targets)
            const sessionOrConnectionExclusions = Targets.filter((target) => (target.startsWith('!SESSION#') || target.startsWith('!CONNECTION#')))
            const sessionOrConnectionTargets = Targets.filter((target) => (target.startsWith('SESSION#') || target.startsWith('CONNECTION#') || target.startsWith('!')))

            dbPromises.push(publishMessageDynamoDB({
                Targets: characterTargets,
                ...rest
            }))

            await Promise.all(characterTargets.map(async (target) => {
                const connections = await mapper.resolvePublishTargets([...sessionOrConnectionExclusions, target])
                connections.forEach((connectionId) => {
                    enqueueWireRow(connectionId, {
                        Target: target,
                        ...rest
                    })
                })
            }))

            const bareSessionTargets = await mapper.resolvePublishTargets(sessionOrConnectionTargets)
            bareSessionTargets.forEach((connectionId) => {
                enqueueWireRow(connectionId, rest)
            })
        }
        else {
            const connectionId = await internalCache.Global.get("ConnectionId")
            if (connectionId) {
                enqueueWireRow(connectionId, rest)
            }
        }
    }

    await Promise.all(payloads.map(async (payload, index) => {
        const computedCreatedTime = baseTime + (payload.messageGroupId ? offsetsByMessageId[payload.messageGroupId] ?? pastOffsets + index : pastOffsets + index)
        if (isPublishWorldLineMessage(payload) || isPublishCoyoteGameHypothesisMessage(payload) || isPublishCommandTranscriptMessage(payload)) {
            const CreatedTime = payload.createdTime !== undefined ? payload.createdTime : computedCreatedTime
            const MessageId = payload.messageId ?? `MESSAGE#${uuidv4()}`
            await pushToQueues({
                Targets: payload.targets,
                MessageId,
                CreatedTime,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
        //
        // Character name on the wire matches MessageCharacterInfo (`DisplayName` in
        // @tonylb/mtw-interfaces) and the internal publish payload field `name`.
        //
        if (isCharacterMessage(payload)) {
            const { fileURL } = await internalCache.CharacterMeta.get(payload.characterId)
            await pushToQueues({
                Targets: payload.targets,
                MessageId: `MESSAGE#${uuidv4()}`,
                CreatedTime: computedCreatedTime,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
                DisplayName: payload.name,
                CharacterId: payload.characterId,
                Color: payload.color,
                fileURL
            })
        }
        if (isPerceptionPublishMessage(payload)) {
            const CreatedTime = payload.createdTime !== undefined ? payload.createdTime : computedCreatedTime
            await pushToQueues({
                Targets: payload.targets,
                MessageId: payload.messageId ?? `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
                wmlContent: payload.wmlContent,
                metaData: payload.metaData
            })
        }
        if (isPublishCoyoteGameHelpMessage(payload)) {
            const CreatedTime = payload.createdTime !== undefined ? payload.createdTime : computedCreatedTime
            await pushToQueues({
                Targets: payload.targets,
                MessageId: payload.messageId ?? `MESSAGE#${uuidv4()}`,
                CreatedTime,
                DisplayProtocol: payload.displayProtocol,
            })
        }
    }))

    await Promise.all([
        ...dbPromises,
        flushImmediateMessages(messagesByConnectionId),
    ])
}

export default publishMessage
