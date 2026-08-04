import { isPlayersPlayerConnectedEnvelope } from './subscribedEvents'

const playerConnectedEvent = {
    type: 'Player Connected' as const,
    player: 'player-one',
    connectionId: 'conn-1',
    sessionId: 'session-1',
    timestamp: 1700000000000,
}

describe('isPlayersPlayerConnectedEnvelope', () => {
    it('matches a Player Connected envelope from mtw.players', () => {
        expect(isPlayersPlayerConnectedEnvelope({
            header: {
                dataSourceKey: 'mtw.players',
                streamKey: 'PLAYER#player-one',
                timestamp: 1700000000000,
                type: 'Player Connected',
            },
            getContent: async () => playerConnectedEvent,
        })).toBe(true)
    })

    it('rejects a mismatched dataSourceKey', () => {
        expect(isPlayersPlayerConnectedEnvelope({
            header: {
                dataSourceKey: 'mtw.connections',
                streamKey: 'PLAYER#player-one',
                timestamp: 1700000000000,
                type: 'Player Connected',
            },
            getContent: async () => playerConnectedEvent,
        })).toBe(false)
    })

    it('rejects a mismatched type', () => {
        expect(isPlayersPlayerConnectedEnvelope({
            header: {
                dataSourceKey: 'mtw.players',
                streamKey: 'PLAYER#player-one',
                timestamp: 1700000000000,
                type: 'Something Else',
            },
            getContent: async () => playerConnectedEvent,
        })).toBe(false)
    })
})
