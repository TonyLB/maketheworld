import { DataSource } from "@tonylb/mtw-lambda-patterns/ts/dataSource"
import { createNodeDataSourceEnvironment } from "@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment"
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import {
    ConnectionsCharacterRegisteredEvent,
    ConnectionsSessionDisconnectEvent
} from "@tonylb/mtw-interfaces/ts/eventBridge/connections"
import {
    ConnectionsCharactersEventSerializer,
    type ConnectionsCharactersEventUpdate
} from "@tonylb/mtw-interfaces/ts/eventBridge/connections/characters"
import messageBus from "../messageBus"
import { isConnectionsCharactersSubscribedEnvelope, type ConnectionsCharactersIncomingEvent } from "./charactersSubscribedEvents"

type StreamEventFn = (params: {
    update: ConnectionsCharactersEventUpdate
    streamKey: string
    header: { type: string }
}) => Promise<void>

export const processConnectionsCharactersSubscribedEvents = async (
    events: Array<any>,
    streamEvent: StreamEventFn
): Promise<void> => {
    await Promise.all(events.map(async (envelope) => {
        const { header } = envelope ?? {}
        if (!header || typeof header !== "object") {
            return
        }

        const content = await envelope.getContent()
        if (!content || typeof content !== "object") {
            return
        }

        if (header.type === "Character Registered") {
            const event = content as ConnectionsCharacterRegisteredEvent
            const characterId = event.characterId
            const row = await connectionDB.getItem<{ sessions?: string[] }>({
                Key: {
                    ConnectionId: characterId,
                    DataCategory: "Meta::Character"
                },
                ProjectionFields: ["sessions"]
            })
            const sessions = Array.isArray(row?.sessions) ? row?.sessions : []
            if (sessions.length === 0) {
                await streamEvent({
                    streamKey: characterId,
                    header: { type: "Character Connected" },
                    update: {
                        type: "Character Connected",
                        characterId,
                        sessionId: event.sessionId,
                        timestamp: event.timestamp
                    }
                })
            }
            return
        }

        if (header.type === "Session Disconnect") {
            const event = content as ConnectionsSessionDisconnectEvent
            const candidateCharacterIds = Array.isArray(event.characterIds) ? event.characterIds : []
            const uniqueCandidateCharacterIds = [...new Set(candidateCharacterIds)]

            await Promise.all(uniqueCandidateCharacterIds.map(async (characterId) => {
                const row = await connectionDB.getItem<{ sessions?: string[] }>({
                    Key: {
                        ConnectionId: characterId,
                        DataCategory: "Meta::Character"
                    },
                    ProjectionFields: ["sessions"]
                })
                const sessions = Array.isArray(row?.sessions) ? row?.sessions : []

                // Teardown already removed `sessionId` from Meta::Character.sessions, so the remaining sessions
                // list is the post-teardown truth for whether the character is fully disconnected.
                if (sessions.length === 0) {
                    await streamEvent({
                        streamKey: characterId,
                        header: { type: "Character Disconnected" },
                        update: {
                            type: "Character Disconnected",
                            characterId,
                            sessionId: event.sessionId,
                            timestamp: event.timestamp
                        }
                    })
                }
            }))
            return
        }
    }))
}

export const connectionsCharactersEventSerializer = new ConnectionsCharactersEventSerializer(createNodeDataSourceEnvironment())

export const connectionsCharactersDataSource = new DataSource<
    never,
    ConnectionsCharactersEventUpdate,
    ConnectionsCharactersIncomingEvent,
    any,
    "ConnectionId"
>({
    dynamo: connectionDB as any,
    sns: {
        send: async () => undefined
    },
    messageBus: messageBus,
    primaryKeyName: "ConnectionId",
    dataSourceKey: "mtw.connections.characters",
    feedbackTopicArn: process.env.FEEDBACK_TOPIC ?? "",
    replayable: false,
    eventSerializer: connectionsCharactersEventSerializer,
    subscribedEventTypeGuard: isConnectionsCharactersSubscribedEnvelope as any,
    receiveEvents: async ({ events, streamEvent }) => {
        await processConnectionsCharactersSubscribedEvents(events, streamEvent as StreamEventFn)
    }
})

connectionsCharactersDataSource.subscribe()

