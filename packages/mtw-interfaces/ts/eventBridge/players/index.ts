import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'

/**
 * `mtw.players` contracts. `Player Connected` fires once per authenticated WebSocket connect
 * (`lambda/authentication/connect.ts`), driving guest-character confirm/repair in `lambda/ephemera`.
 */
export type PlayerConnectedEvent = {
    type: 'Player Connected'
    player: string
    connectionId: string
    sessionId: string
    timestamp: number
}

export type PlayersEventUpdate = PlayerConnectedEvent

export type PlayerConnectedEventExternal = {
    type: 'Player Connected'
    player: string
    connectionId: string
    sessionId: string
    timestamp?: number
}

export type PlayersEventExternal = PlayerConnectedEventExternal

export const isPlayerConnectedEvent = (event: any): event is PlayerConnectedEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Player Connected' &&
        typeof event.player === 'string' &&
        event.player.length > 0 &&
        typeof event.connectionId === 'string' &&
        event.connectionId.length > 0 &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.timestamp === 'number'
    )
)

export const isPlayersEventUpdate = (event: unknown): event is PlayersEventUpdate => (
    isPlayerConnectedEvent(event)
)

export class PlayersEventSerializer implements DataSourceEventSerializer<PlayersEventUpdate, PlayersEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {
        void env
    }

    serialize(params: {
        content: PlayersEventUpdate;
        header: StreamingEventHeader;
    }): PlayersEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('PlayersEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'Player Connected' && isPlayerConnectedEvent(content)) {
            return {
                type: 'Player Connected',
                player: content.player,
                connectionId: content.connectionId,
                sessionId: content.sessionId,
                timestamp: content.timestamp
            }
        }
        throw new Error(`Unknown players event type: ${header.type}`)
    }

    async deserialize(params: {
        content: any;
        header: StreamingEventHeader;
    }): Promise<PlayersEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === 'Player Connected') {
            if (
                typeof content?.player !== 'string' ||
                content.player.length === 0 ||
                typeof content?.connectionId !== 'string' ||
                content.connectionId.length === 0 ||
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0
            ) {
                return null
            }
            return {
                type: 'Player Connected',
                player: content.player,
                connectionId: content.connectionId,
                sessionId: content.sessionId,
                timestamp: typeof content.timestamp === 'number' ? content.timestamp : Date.now()
            }
        }
        return null
    }
}
