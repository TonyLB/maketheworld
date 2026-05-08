import {
    ConnectionsEventSerializer,
    isCharacterRegisteredEvent,
    isConnectionsEventUpdate,
    isSessionDisconnectEvent,
    isSessionDisconnectProblemEvent
} from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const connectionsHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.connections',
    streamKey: 'global',
    timestamp: 0,
    type
})

describe('ConnectionsEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new ConnectionsEventSerializer(testEnv)

    it('serializes and deserializes Session Disconnect', async () => {
        const event = {
            type: 'Session Disconnect' as const,
            sessionId: 'session-1',
            characterIds: ['CHARACTER#abc'] as EphemeraCharacterId[],
            timestamp: '2026-01-01T00:00:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: connectionsHeader('Session Disconnect')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: connectionsHeader('Session Disconnect')
        })
        expect(deserialized).toEqual(event)
    })

    it('serializes and deserializes Session Disconnect Problem', async () => {
        const event = {
            type: 'Session Disconnect Problem' as const,
            sessionId: 'session-1',
            player: 'alice',
            sourceOperation: 'checkSession',
            attemptCount: 3,
            dedupeKey: 'session-1::checkSession::3',
            timestamp: '2026-01-01T00:01:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: connectionsHeader('Session Disconnect Problem')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: connectionsHeader('Session Disconnect Problem')
        })
        expect(deserialized).toEqual(event)
    })

    it('returns null for malformed Session Disconnect Problem', async () => {
        const deserialized = await serializer.deserialize({
            content: { sessionId: 'session-1', sourceOperation: 'checkSession', dedupeKey: 'x' },
            header: connectionsHeader('Session Disconnect Problem')
        })
        expect(deserialized).toBeNull()
    })

    it('serializes and deserializes Character Registered', async () => {
        const event = {
            type: 'Character Registered' as const,
            characterId: 'CHARACTER#abc' as const,
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:02:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: connectionsHeader('Character Registered')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: connectionsHeader('Character Registered')
        })
        expect(deserialized).toEqual(event)
    })

    it('returns null for malformed Character Registered', async () => {
        const deserialized = await serializer.deserialize({
            content: { sessionId: 'session-1', characterId: 'ROOM#x' },
            header: connectionsHeader('Character Registered')
        })
        expect(deserialized).toBeNull()
    })

    it('throws on Snapshot serialization', () => {
        expect(() => serializer.serialize({
            content: {
                type: 'Session Disconnect',
                sessionId: 'session-1',
                timestamp: '2026-01-01T00:00:00.000Z'
            },
            header: connectionsHeader('Snapshot')
        })).toThrow('ConnectionsEventSerializer does not support snapshot serialization')
    })
})

describe('connections event guards', () => {
    it('validates Session Disconnect', () => {
        expect(isSessionDisconnectEvent({
            type: 'Session Disconnect',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isSessionDisconnectEvent({
            type: 'Session Disconnect',
            sessionId: 'session-1',
            characterIds: ['CHARACTER#abc'],
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isSessionDisconnectEvent({ type: 'Session Disconnect', sessionId: '' })).toBe(false)
        expect(isSessionDisconnectEvent({
            type: 'Session Disconnect',
            sessionId: 'session-1',
            characterIds: ['ROOM#abc'],
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(false)
    })

    it('validates Session Disconnect Problem', () => {
        expect(isSessionDisconnectProblemEvent({
            type: 'Session Disconnect Problem',
            sessionId: 'session-1',
            player: 'alice',
            sourceOperation: 'checkSession',
            attemptCount: 1,
            dedupeKey: 'key',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isSessionDisconnectProblemEvent({
            type: 'Session Disconnect Problem',
            sessionId: 'session-1',
            sourceOperation: 'checkSession',
            attemptCount: '1',
            dedupeKey: 'key'
        })).toBe(false)
    })

    it('validates Character Registered', () => {
        expect(isCharacterRegisteredEvent({
            type: 'Character Registered',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isCharacterRegisteredEvent({
            type: 'Character Registered',
            characterId: 'ROOM#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(false)
    })

    it('validates union update guard', () => {
        expect(isConnectionsEventUpdate({
            type: 'Session Disconnect',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsEventUpdate({
            type: 'Session Disconnect Problem',
            sessionId: 'session-1',
            sourceOperation: 'checkSession',
            attemptCount: 2,
            dedupeKey: 'key',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsEventUpdate({
            type: 'Character Registered',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsEventUpdate({ type: 'Unknown Event' })).toBe(false)
    })
})
