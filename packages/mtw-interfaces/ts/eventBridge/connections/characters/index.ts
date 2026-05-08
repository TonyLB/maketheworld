import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import { EphemeraCharacterId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * `mtw.connections.characters` contracts. Payload `sessionId` tags the session edge tied to the
 * publish that crossed the aggregate 0<->1 boundary; it is not proof of sole membership or unique
 * causality. See AGENT.implementation.md (Connections character presence delivery semantics).
 */
export type ConnectionsCharactersConnectedEvent = {
    type: 'Character Connected'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp: string
}

export type ConnectionsCharactersDisconnectedEvent = {
    type: 'Character Disconnected'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp: string
}

export type ConnectionsCharactersEventUpdate =
    | ConnectionsCharactersConnectedEvent
    | ConnectionsCharactersDisconnectedEvent

export type ConnectionsCharactersConnectedEventExternal = {
    type: 'Character Connected'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp?: string
}

export type ConnectionsCharactersDisconnectedEventExternal = {
    type: 'Character Disconnected'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp?: string
}

export type ConnectionsCharactersEventExternal =
    | ConnectionsCharactersConnectedEventExternal
    | ConnectionsCharactersDisconnectedEventExternal

export const isConnectionsCharactersConnectedEvent = (event: any): event is ConnectionsCharactersConnectedEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Character Connected' &&
        typeof event.characterId === 'string' &&
        isEphemeraCharacterId(event.characterId) &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.timestamp === 'string' &&
        event.timestamp.length > 0
    )
)

export const isConnectionsCharactersDisconnectedEvent = (event: any): event is ConnectionsCharactersDisconnectedEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Character Disconnected' &&
        typeof event.characterId === 'string' &&
        isEphemeraCharacterId(event.characterId) &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.timestamp === 'string' &&
        event.timestamp.length > 0
    )
)

export const isConnectionsCharactersEventUpdate = (event: unknown): event is ConnectionsCharactersEventUpdate => (
    isConnectionsCharactersConnectedEvent(event) || isConnectionsCharactersDisconnectedEvent(event)
)

export class ConnectionsCharactersEventSerializer implements DataSourceEventSerializer<
    ConnectionsCharactersEventUpdate,
    ConnectionsCharactersEventExternal
> {
    constructor(private readonly env: DataSourceEnvironment) {
        void env
    }

    serialize(params: {
        content: ConnectionsCharactersEventUpdate;
        header: StreamingEventHeader;
    }): ConnectionsCharactersEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('ConnectionsCharactersEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'Character Connected' && isConnectionsCharactersConnectedEvent(content)) {
            return {
                type: 'Character Connected',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Character Disconnected' && isConnectionsCharactersDisconnectedEvent(content)) {
            return {
                type: 'Character Disconnected',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp
            }
        }
        throw new Error(`Unknown connections characters event type: ${header.type}`)
    }

    async deserialize(params: {
        content: any;
        header: StreamingEventHeader;
    }): Promise<ConnectionsCharactersEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === 'Character Connected') {
            if (
                typeof content?.characterId !== 'string' ||
                !isEphemeraCharacterId(content.characterId) ||
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0
            ) {
                return null
            }
            return {
                type: 'Character Connected',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp || new Date().toISOString()
            }
        }
        if (header.type === 'Character Disconnected') {
            if (
                typeof content?.characterId !== 'string' ||
                !isEphemeraCharacterId(content.characterId) ||
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0
            ) {
                return null
            }
            return {
                type: 'Character Disconnected',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp || new Date().toISOString()
            }
        }
        return null
    }
}
