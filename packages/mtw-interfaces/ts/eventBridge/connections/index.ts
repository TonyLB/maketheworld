import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import { EphemeraCharacterId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type ConnectionsSessionDisconnectEvent = {
    type: 'Session Disconnect'
    sessionId: string
    timestamp: string
}

export type ConnectionsSessionDisconnectProblemEvent = {
    type: 'Session Disconnect Problem'
    sessionId: string
    player?: string
    sourceOperation: string
    attemptCount: number
    dedupeKey: string
    timestamp: string
}

export type ConnectionsCharacterRegisteredEvent = {
    type: 'Character Registered'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp: string
}

export type ConnectionsEventUpdate =
    | ConnectionsSessionDisconnectEvent
    | ConnectionsSessionDisconnectProblemEvent
    | ConnectionsCharacterRegisteredEvent

export type ConnectionsSessionDisconnectEventExternal = {
    type: 'Session Disconnect'
    sessionId: string
    timestamp?: string
}

export type ConnectionsSessionDisconnectProblemEventExternal = {
    type: 'Session Disconnect Problem'
    sessionId: string
    player?: string
    sourceOperation: string
    attemptCount: number
    dedupeKey: string
    timestamp?: string
}

export type ConnectionsCharacterRegisteredEventExternal = {
    type: 'Character Registered'
    characterId: EphemeraCharacterId
    sessionId: string
    timestamp?: string
}

export type ConnectionsEventExternal =
    | ConnectionsSessionDisconnectEventExternal
    | ConnectionsSessionDisconnectProblemEventExternal
    | ConnectionsCharacterRegisteredEventExternal

export const isSessionDisconnectEvent = (event: any): event is ConnectionsSessionDisconnectEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Session Disconnect' &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0
    )
)

export const isSessionDisconnectProblemEvent = (event: any): event is ConnectionsSessionDisconnectProblemEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Session Disconnect Problem' &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.sourceOperation === 'string' &&
        event.sourceOperation.length > 0 &&
        typeof event.attemptCount === 'number' &&
        Number.isFinite(event.attemptCount) &&
        typeof event.dedupeKey === 'string' &&
        event.dedupeKey.length > 0 &&
        (typeof event.player === 'undefined' || typeof event.player === 'string')
    )
)

export const isCharacterRegisteredEvent = (event: any): event is ConnectionsCharacterRegisteredEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Character Registered' &&
        typeof event.characterId === 'string' &&
        isEphemeraCharacterId(event.characterId) &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.timestamp === 'string' &&
        event.timestamp.length > 0
    )
)

export const isConnectionsEventUpdate = (event: unknown): event is ConnectionsEventUpdate => (
    isSessionDisconnectEvent(event) || isSessionDisconnectProblemEvent(event) || isCharacterRegisteredEvent(event)
)

export class ConnectionsEventSerializer implements DataSourceEventSerializer<ConnectionsEventUpdate, ConnectionsEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {
        void env
    }

    serialize(params: {
        content: ConnectionsEventUpdate;
        header: StreamingEventHeader;
    }): ConnectionsEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('ConnectionsEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'Session Disconnect' && isSessionDisconnectEvent(content)) {
            return {
                type: 'Session Disconnect',
                sessionId: content.sessionId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Session Disconnect Problem' && isSessionDisconnectProblemEvent(content)) {
            return {
                type: 'Session Disconnect Problem',
                sessionId: content.sessionId,
                ...(content.player ? { player: content.player } : {}),
                sourceOperation: content.sourceOperation,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Character Registered' && isCharacterRegisteredEvent(content)) {
            return {
                type: 'Character Registered',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp
            }
        }
        throw new Error(`Unknown connections event type: ${header.type}`)
    }

    async deserialize(params: {
        content: any;
        header: StreamingEventHeader
    }): Promise<ConnectionsEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === 'Session Disconnect') {
            if (typeof content?.sessionId !== 'string' || content.sessionId.length === 0) {
                return null
            }
            return {
                type: 'Session Disconnect',
                sessionId: content.sessionId,
                timestamp: content.timestamp || new Date().toISOString()
            }
        }
        if (header.type === 'Session Disconnect Problem') {
            if (
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0 ||
                typeof content?.sourceOperation !== 'string' ||
                content.sourceOperation.length === 0 ||
                typeof content?.attemptCount !== 'number' ||
                !Number.isFinite(content.attemptCount) ||
                typeof content?.dedupeKey !== 'string' ||
                content.dedupeKey.length === 0 ||
                !(typeof content?.player === 'undefined' || typeof content?.player === 'string')
            ) {
                return null
            }
            return {
                type: 'Session Disconnect Problem',
                sessionId: content.sessionId,
                ...(content.player ? { player: content.player } : {}),
                sourceOperation: content.sourceOperation,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
                timestamp: content.timestamp || new Date().toISOString()
            }
        }
        if (header.type === 'Character Registered') {
            if (
                typeof content?.characterId !== 'string' ||
                !isEphemeraCharacterId(content.characterId) ||
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0
            ) {
                return null
            }
            return {
                type: 'Character Registered',
                characterId: content.characterId,
                sessionId: content.sessionId,
                timestamp: content.timestamp || new Date().toISOString()
            }
        }
        return null
    }
}
