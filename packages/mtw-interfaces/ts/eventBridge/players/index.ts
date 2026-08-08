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

/**
 * `Stale Session Problem` fires when `connect.ts` finds -- via the player's reverse-index pointer
 * partition -- one of the connecting player's *other* sessions past `STALE_BUFFER_MS` with no active
 * connections. Mirrors `ConnectionsSessionDisconnectProblemEvent`'s report fields. Diagnostics
 * subscribes, runs a player-scoped evaluation (not the full `staleSessionSweep`), and emits the
 * existing `Stale SessionId Finding`; `lambda/connections`' `staleSessionFinding` consumer reaps.
 */
export type PlayerStaleSessionProblemEvent = {
    type: 'Stale Session Problem'
    sessionId: string
    player: string
    sourceOperation: string
    attemptCount: number
    dedupeKey: string
    timestamp: string
}

export type PlayersEventUpdate = PlayerConnectedEvent | PlayerStaleSessionProblemEvent

export type PlayerConnectedEventExternal = {
    type: 'Player Connected'
    player: string
    connectionId: string
    sessionId: string
    timestamp?: number
}

export type PlayerStaleSessionProblemEventExternal = {
    type: 'Stale Session Problem'
    sessionId: string
    player: string
    sourceOperation: string
    attemptCount: number
    dedupeKey: string
    timestamp?: string
}

export type PlayersEventExternal = PlayerConnectedEventExternal | PlayerStaleSessionProblemEventExternal

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

export const buildStaleSessionProblemDedupeKey = (sessionId: string, attemptCount: number): string =>
    `${sessionId}::staleSessionProblem::${attemptCount}`

export const isStaleSessionProblemEvent = (event: any): event is PlayerStaleSessionProblemEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Stale Session Problem' &&
        typeof event.sessionId === 'string' &&
        event.sessionId.length > 0 &&
        typeof event.player === 'string' &&
        event.player.length > 0 &&
        typeof event.sourceOperation === 'string' &&
        event.sourceOperation.length > 0 &&
        typeof event.attemptCount === 'number' &&
        typeof event.dedupeKey === 'string' &&
        event.dedupeKey.length > 0 &&
        typeof event.timestamp === 'string'
    )
)

export const isPlayersEventUpdate = (event: unknown): event is PlayersEventUpdate => (
    isPlayerConnectedEvent(event) || isStaleSessionProblemEvent(event)
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
        if (header.type === 'Stale Session Problem' && isStaleSessionProblemEvent(content)) {
            return {
                type: 'Stale Session Problem',
                sessionId: content.sessionId,
                player: content.player,
                sourceOperation: content.sourceOperation,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
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
        if (header.type === 'Stale Session Problem') {
            if (
                typeof content?.sessionId !== 'string' ||
                content.sessionId.length === 0 ||
                typeof content?.player !== 'string' ||
                content.player.length === 0 ||
                typeof content?.sourceOperation !== 'string' ||
                content.sourceOperation.length === 0 ||
                typeof content?.attemptCount !== 'number' ||
                typeof content?.dedupeKey !== 'string' ||
                content.dedupeKey.length === 0
            ) {
                return null
            }
            return {
                type: 'Stale Session Problem',
                sessionId: content.sessionId,
                player: content.player,
                sourceOperation: content.sourceOperation,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
                timestamp: typeof content.timestamp === 'string' ? content.timestamp : new Date().toISOString()
            }
        }
        return null
    }
}
