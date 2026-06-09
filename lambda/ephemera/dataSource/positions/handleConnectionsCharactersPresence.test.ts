import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        RoomCharacterList: { set: jest.fn() },
    },
}))

describe('handleConnectionsCharactersPresence', () => {
    const messageBus = { send: jest.fn() } as any

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('handleCharacterConnected', () => {
        it('queues CheckLocation with forceMove and the connect arrival message', async () => {
            await handleCharacterConnected({
                type: 'Character Connected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(messageBus.send).toHaveBeenCalledTimes(1)
            expect(messageBus.send).toHaveBeenCalledWith({
                type: 'CheckLocation',
                characterId: 'CHARACTER#alpha',
                forceMove: true,
                arriveMessage: ' has connected.',
                suppressArrival: false,
            })
            expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('removes the character from Meta::Room.activeCharacters and emits departure + RoomUpdate when the projection actually changes', async () => {
            ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
                EphemeraId: 'CHARACTER#alpha',
                Name: 'Alpha',
                RoomId: 'ROOM#roomA',
            })
            ;(ephemeraDB.optimisticUpdate as jest.Mock).mockImplementation(async ({ updateReducer, successCallback }) => {
                const draft: any = {
                    activeCharacters: [
                        { EphemeraId: 'CHARACTER#alpha', DisplayName: 'Alpha' },
                        { EphemeraId: 'CHARACTER#beta', DisplayName: 'Beta' },
                    ],
                }
                updateReducer(draft)
                successCallback?.({ activeCharacters: draft.activeCharacters })
                return undefined
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(ephemeraDB.optimisticUpdate).toHaveBeenCalledTimes(1)
            const optimisticUpdateCall = (ephemeraDB.optimisticUpdate as jest.Mock).mock.calls[0][0]
            expect(optimisticUpdateCall.Key).toEqual({
                EphemeraId: 'ROOM#roomA',
                DataCategory: 'Meta::Room',
            })
            expect(optimisticUpdateCall.updateKeys).toEqual(['activeCharacters'])

            expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith('ROOM#roomA')
            expect(internalCache.AffordanceRoomDeliverable.invalidate).toHaveBeenCalledWith('ROOM#roomA')
            expect(internalCache.RoomCharacterList.set).toHaveBeenCalledWith({
                key: 'ROOM#roomA',
                value: [{ EphemeraId: 'CHARACTER#beta', DisplayName: 'Beta' }],
            })

            expect(messageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['ROOM#roomA', '!CHARACTER#alpha'],
                displayProtocol: 'WorldMessage',
                message: ['Alpha has disconnected.'],
            })
            expect(messageBus.send).toHaveBeenCalledWith({
                type: 'RoomUpdate',
                roomId: 'ROOM#roomA',
            })
        })

        it('does not publish departure or RoomUpdate when the character is already absent (idempotency gate)', async () => {
            ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
                EphemeraId: 'CHARACTER#alpha',
                Name: 'Alpha',
                RoomId: 'ROOM#roomA',
            })
            ;(ephemeraDB.optimisticUpdate as jest.Mock).mockImplementation(async ({ updateReducer, successCallback }) => {
                const draft: any = {
                    activeCharacters: [
                        { EphemeraId: 'CHARACTER#beta', DisplayName: 'Beta' },
                    ],
                }
                updateReducer(draft)
                successCallback?.({ activeCharacters: draft.activeCharacters })
                return undefined
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(ephemeraDB.optimisticUpdate).toHaveBeenCalledTimes(1)
            // Cache invalidations still happen so a stale read does not leak the prior projection.
            expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith('ROOM#roomA')
            expect(internalCache.AffordanceRoomDeliverable.invalidate).toHaveBeenCalledWith('ROOM#roomA')
            expect(internalCache.RoomCharacterList.set).toHaveBeenCalledWith({
                key: 'ROOM#roomA',
                value: [{ EphemeraId: 'CHARACTER#beta', DisplayName: 'Beta' }],
            })

            expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PublishMessage' }))
            expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RoomUpdate' }))
        })

        it('returns early without DB calls when CharacterMeta has no RoomId', async () => {
            ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
                EphemeraId: 'CHARACTER#alpha',
                Name: 'Alpha',
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
            expect(messageBus.send).not.toHaveBeenCalled()
        })
    })
})
