jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../guestCharacter', () => ({
    confirmGuestCharacter: jest.fn().mockResolvedValue(undefined),
}))

import { confirmGuestCharacter } from '../../guestCharacter'
import messageBus from '../../messageBus'
import { ephemeraPlayersDataSource } from './index'
import { isPlayersPlayerConnectedEnvelope } from './subscribedEvents'

const mockConfirmGuestCharacter = confirmGuestCharacter as jest.MockedFunction<typeof confirmGuestCharacter>

describe('mtw.ephemera.players DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('is bus-only with the Players subscription guard', () => {
        expect(ephemeraPlayersDataSource.dataSourceKey).toBe('mtw.ephemera.players')
        expect(ephemeraPlayersDataSource.replayable).toBe(false)
        expect(ephemeraPlayersDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraPlayersDataSource.subscribedEventTypeGuard).toBe(isPlayersPlayerConnectedEnvelope)
        expect(typeof ephemeraPlayersDataSource.receiveEvents).toBe('function')
    })

    it('receiveEvents confirms the guest character for a validated Player Connected payload', async () => {
        const playerConnectedEvent = {
            type: 'Player Connected' as const,
            player: 'player-one',
            connectionId: 'conn-1',
            sessionId: 'session-1',
            timestamp: 1700000000000,
        }
        await ephemeraPlayersDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: 'mtw.players',
                        streamKey: 'PLAYER#player-one',
                        timestamp: 1700000000000,
                        type: 'Player Connected',
                    },
                    getContent: async () => playerConnectedEvent,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(mockConfirmGuestCharacter).toHaveBeenCalledWith('player-one', messageBus)
    })

    it('receiveEvents skips invalid getContent payloads', async () => {
        await ephemeraPlayersDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: 'mtw.players',
                        streamKey: 'PLAYER#player-one',
                        timestamp: 1700000000000,
                        type: 'Player Connected',
                    },
                    getContent: async () => ({ not: 'a player connected event' }),
                } as never,
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(mockConfirmGuestCharacter).not.toHaveBeenCalled()
    })
})
