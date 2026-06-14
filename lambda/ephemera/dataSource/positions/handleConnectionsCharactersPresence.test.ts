import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import * as membership from './membership/applyCharacterRoomMembership'

jest.mock('./membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

const applyCharacterRoomMembershipMock = membership.applyCharacterRoomMembership as jest.MockedFunction<
    typeof membership.applyCharacterRoomMembership
>

describe('handleConnectionsCharactersPresence', () => {
    const messageBus = { publish: jest.fn() } as any

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

            expect(messageBus.publish).toHaveBeenCalledTimes(1)
            expect(messageBus.publish).toHaveBeenCalledWith({
                type: 'CheckLocation',
                characterId: 'CHARACTER#alpha',
                forceMove: true,
                arriveMessage: ' has connected.',
                suppressArrival: false,
            })
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('routes disconnect through applyCharacterRoomMembership with targetRoomId null', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                from: 'ROOM#roomA',
                to: null,
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                { characterId: 'CHARACTER#alpha', targetRoomId: null },
                { messageBus }
            )
        })

        it('does not perform inline persistence when membership apply is a no-op', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                from: null,
                to: null,
                changed: false,
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus })

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledTimes(1)
            expect(messageBus.publish).not.toHaveBeenCalled()
        })
    })
})
