import {
    PlayersEventSerializer,
    isPlayerConnectedEvent,
    isPlayersEventUpdate,
    isStaleSessionProblemEvent,
    buildStaleSessionProblemDedupeKey
} from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const playersHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.players',
    streamKey: 'PLAYER#TEST',
    timestamp: 0,
    type
})

describe('PlayersEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new PlayersEventSerializer(testEnv)

    it('serializes and deserializes Player Connected', async () => {
        const event = {
            type: 'Player Connected' as const,
            player: 'player-one',
            connectionId: 'conn-1',
            sessionId: 'session-1',
            timestamp: 1700000000000
        }
        const serialized = serializer.serialize({
            content: event,
            header: playersHeader('Player Connected')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: playersHeader('Player Connected')
        })
        expect(deserialized).toEqual(event)
    })

    it('defaults timestamp when missing on deserialize', async () => {
        const deserialized = await serializer.deserialize({
            content: { player: 'player-one', connectionId: 'conn-1', sessionId: 'session-1' },
            header: playersHeader('Player Connected')
        })
        expect(deserialized).toMatchObject({
            type: 'Player Connected',
            player: 'player-one',
            connectionId: 'conn-1',
            sessionId: 'session-1'
        })
        expect(typeof deserialized?.timestamp).toBe('number')
    })

    it('returns null for malformed Player Connected', async () => {
        const deserialized = await serializer.deserialize({
            content: { connectionId: 'conn-1', sessionId: 'session-1' },
            header: playersHeader('Player Connected')
        })
        expect(deserialized).toBeNull()
    })

    it('returns null on Snapshot deserialize', async () => {
        const deserialized = await serializer.deserialize({
            content: {},
            header: playersHeader('Snapshot')
        })
        expect(deserialized).toBeNull()
    })

    it('throws on Snapshot serialization', () => {
        expect(() => serializer.serialize({
            content: {
                type: 'Player Connected',
                player: 'player-one',
                connectionId: 'conn-1',
                sessionId: 'session-1',
                timestamp: 1700000000000
            },
            header: playersHeader('Snapshot')
        })).toThrow('PlayersEventSerializer does not support snapshot serialization')
    })

    it('serializes and deserializes Stale Session Problem', async () => {
        const event = {
            type: 'Stale Session Problem' as const,
            sessionId: 'session-stale',
            player: 'player-one',
            sourceOperation: 'connect',
            attemptCount: 1,
            dedupeKey: 'session-stale::staleSessionProblem::1',
            timestamp: '2026-08-08T00:00:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: playersHeader('Stale Session Problem')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: playersHeader('Stale Session Problem')
        })
        expect(deserialized).toEqual(event)
    })

    it('defaults timestamp when missing on Stale Session Problem deserialize', async () => {
        const deserialized = await serializer.deserialize({
            content: {
                sessionId: 'session-stale',
                player: 'player-one',
                sourceOperation: 'connect',
                attemptCount: 1,
                dedupeKey: 'session-stale::staleSessionProblem::1'
            },
            header: playersHeader('Stale Session Problem')
        })
        expect(deserialized).toMatchObject({
            type: 'Stale Session Problem',
            sessionId: 'session-stale',
            player: 'player-one'
        })
        expect(typeof deserialized?.timestamp).toBe('string')
    })

    it('returns null for malformed Stale Session Problem', async () => {
        const deserialized = await serializer.deserialize({
            content: { player: 'player-one' },
            header: playersHeader('Stale Session Problem')
        })
        expect(deserialized).toBeNull()
    })
})

describe('players event guards', () => {
    it('validates Player Connected', () => {
        expect(isPlayerConnectedEvent({
            type: 'Player Connected',
            player: 'player-one',
            connectionId: 'conn-1',
            sessionId: 'session-1',
            timestamp: 1700000000000
        })).toBe(true)
        expect(isPlayerConnectedEvent({
            type: 'Player Connected',
            player: '',
            connectionId: 'conn-1',
            sessionId: 'session-1',
            timestamp: 1700000000000
        })).toBe(false)
    })

    it('validates union update guard', () => {
        expect(isPlayersEventUpdate({
            type: 'Player Connected',
            player: 'player-one',
            connectionId: 'conn-1',
            sessionId: 'session-1',
            timestamp: 1700000000000
        })).toBe(true)
        expect(isPlayersEventUpdate({
            type: 'Stale Session Problem',
            sessionId: 'session-stale',
            player: 'player-one',
            sourceOperation: 'connect',
            attemptCount: 1,
            dedupeKey: 'session-stale::staleSessionProblem::1',
            timestamp: '2026-08-08T00:00:00.000Z'
        })).toBe(true)
        expect(isPlayersEventUpdate({ type: 'Unknown Event' })).toBe(false)
    })

    it('validates Stale Session Problem', () => {
        expect(isStaleSessionProblemEvent({
            type: 'Stale Session Problem',
            sessionId: 'session-stale',
            player: 'player-one',
            sourceOperation: 'connect',
            attemptCount: 1,
            dedupeKey: 'session-stale::staleSessionProblem::1',
            timestamp: '2026-08-08T00:00:00.000Z'
        })).toBe(true)
        expect(isStaleSessionProblemEvent({
            type: 'Stale Session Problem',
            sessionId: '',
            player: 'player-one',
            sourceOperation: 'connect',
            attemptCount: 1,
            dedupeKey: 'session-stale::staleSessionProblem::1',
            timestamp: '2026-08-08T00:00:00.000Z'
        })).toBe(false)
    })

    it('builds the dedupe key from sessionId and attemptCount', () => {
        expect(buildStaleSessionProblemDedupeKey('session-stale', 1)).toBe('session-stale::staleSessionProblem::1')
    })
})
