import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import * as membership from './membership/applyCharacterRoomMembership'
import * as resolveConnect from './membership/resolveConnectTargetRoom'
import * as navigateTail from './navigate/afterCharacterMembershipNavigateChanged'

jest.mock('./membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

jest.mock('./membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

jest.mock('./navigate/afterCharacterMembershipNavigateChanged', () => ({
    afterCharacterMembershipNavigateChanged: jest.fn(),
}))

const applyCharacterRoomMembershipMock = membership.applyCharacterRoomMembership as jest.MockedFunction<
    typeof membership.applyCharacterRoomMembership
>
const resolveConnectTargetRoomMock = resolveConnect.resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnect.resolveConnectTargetRoom
>
const afterCharacterMembershipNavigateChangedMock = navigateTail.afterCharacterMembershipNavigateChanged as jest.MockedFunction<
    typeof navigateTail.afterCharacterMembershipNavigateChanged
>

describe('handleConnectionsCharactersPresence', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const characterMeta = {
        EphemeraId: 'CHARACTER#alpha' as const,
        Name: 'Alpha',
        RoomId: 'ROOM#TownSquare' as const,
        RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TownSquare' }],
        HomeId: 'ROOM#VORTEX' as const,
        assets: [],
        Pronouns: 'they/them',
    }

    beforeEach(() => {
        jest.clearAllMocks()
        resolveConnectTargetRoomMock.mockResolvedValue({
            targetRoomId: 'ROOM#TownSquare',
            characterMeta,
            trimmedRoomStack: characterMeta.RoomStack,
        })
        afterCharacterMembershipNavigateChangedMock.mockResolvedValue(undefined)
    })

    describe('handleCharacterConnected', () => {
        it('routes connect through membership apply and navigate tail with pre-apply characterMeta', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: [],
                to: 'ROOM#TownSquare',
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
            })

            await handleCharacterConnected({
                type: 'Character Connected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(resolveConnectTargetRoomMock).toHaveBeenCalledWith('CHARACTER#alpha')
            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                { characterId: 'CHARACTER#alpha', targetRoomId: 'ROOM#TownSquare' },
                { messageBus, streamEvent }
            )
            expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalledWith({
                characterId: 'CHARACTER#alpha',
                characterMeta,
                result: expect.objectContaining({
                    ok: true,
                    changed: true,
                    to: 'ROOM#TownSquare',
                }),
                messageBus,
            })
            expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CheckLocation' }))
        })

        it('still invokes tail helper when membership apply is a no-op', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: [],
                to: 'ROOM#TownSquare',
                changed: false,
            })

            await handleCharacterConnected({
                type: 'Character Connected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledTimes(1)
            expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalled()
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('routes disconnect through applyCharacterRoomMembership with targetRoomId null', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: ['ROOM#roomA'],
                to: null,
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                { characterId: 'CHARACTER#alpha', targetRoomId: null },
                { messageBus, streamEvent }
            )
        })

        it('does not perform inline persistence when membership apply is a no-op', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: [],
                to: null,
                changed: false,
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledTimes(1)
            expect(messageBus.publish).not.toHaveBeenCalled()
        })
    })
})
