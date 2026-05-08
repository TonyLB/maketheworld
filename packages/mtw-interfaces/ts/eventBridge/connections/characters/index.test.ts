import {
    ConnectionsCharactersEventSerializer,
    isConnectionsCharactersConnectedEvent,
    isConnectionsCharactersDisconnectedEvent,
    isConnectionsCharactersEventUpdate
} from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const connectionsCharactersHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.connections.characters',
    streamKey: 'CHARACTER#TEST',
    timestamp: 0,
    type
})

describe('ConnectionsCharactersEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new ConnectionsCharactersEventSerializer(testEnv)

    it('serializes and deserializes Character Connected', async () => {
        const event = {
            type: 'Character Connected' as const,
            characterId: 'CHARACTER#abc' as const,
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: connectionsCharactersHeader('Character Connected')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: connectionsCharactersHeader('Character Connected')
        })
        expect(deserialized).toEqual(event)
    })

    it('serializes and deserializes Character Disconnected', async () => {
        const event = {
            type: 'Character Disconnected' as const,
            characterId: 'CHARACTER#abc' as const,
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:01:00.000Z'
        }
        const serialized = serializer.serialize({
            content: event,
            header: connectionsCharactersHeader('Character Disconnected')
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: connectionsCharactersHeader('Character Disconnected')
        })
        expect(deserialized).toEqual(event)
    })

    it('returns null for malformed Character Connected', async () => {
        const deserialized = await serializer.deserialize({
            content: { sessionId: 'session-1', characterId: 'ROOM#x' },
            header: connectionsCharactersHeader('Character Connected')
        })
        expect(deserialized).toBeNull()
    })

    it('throws on Snapshot serialization', () => {
        expect(() => serializer.serialize({
            content: {
                type: 'Character Connected',
                characterId: 'CHARACTER#abc',
                sessionId: 'session-1',
                timestamp: '2026-01-01T00:00:00.000Z'
            },
            header: connectionsCharactersHeader('Snapshot')
        })).toThrow('ConnectionsCharactersEventSerializer does not support snapshot serialization')
    })
})

describe('connections characters event guards', () => {
    it('validates Character Connected', () => {
        expect(isConnectionsCharactersConnectedEvent({
            type: 'Character Connected',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsCharactersConnectedEvent({
            type: 'Character Connected',
            characterId: 'ROOM#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(false)
    })

    it('validates Character Disconnected', () => {
        expect(isConnectionsCharactersDisconnectedEvent({
            type: 'Character Disconnected',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsCharactersDisconnectedEvent({
            type: 'Character Disconnected',
            characterId: 'CHARACTER#abc',
            sessionId: '',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(false)
    })

    it('validates union update guard', () => {
        expect(isConnectionsCharactersEventUpdate({
            type: 'Character Connected',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsCharactersEventUpdate({
            type: 'Character Disconnected',
            characterId: 'CHARACTER#abc',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z'
        })).toBe(true)
        expect(isConnectionsCharactersEventUpdate({ type: 'Unknown Event' })).toBe(false)
    })
})
