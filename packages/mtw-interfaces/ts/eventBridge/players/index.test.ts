import {
    PlayersEventSerializer,
    isPlayerConnectedEvent,
    isPlayersEventUpdate
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
        expect(isPlayersEventUpdate({ type: 'Unknown Event' })).toBe(false)
    })
})
