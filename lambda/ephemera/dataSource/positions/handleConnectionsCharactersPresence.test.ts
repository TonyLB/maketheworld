jest.mock('./manipulation/membership/orchestrateCharacterRoomMembership', () => ({
    orchestrateCharacterRoomMembership: jest.fn(),
}))

jest.mock('./manipulation/membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

jest.mock('./navigate/presentCharacterMove', () => ({
    presentCharacterMove: jest.fn(),
}))

jest.mock('./navigate/afterCharacterMembershipNavigateChanged', () => ({
    afterCharacterMembershipNavigateChanged: jest.fn(),
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
    },
}))

import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import internalCache from '../../internalCache'
import * as membership from './manipulation/membership/orchestrateCharacterRoomMembership'
import * as resolveConnect from './manipulation/membership/resolveConnectTargetRoom'
import * as presentCharacterMoveModule from './navigate/presentCharacterMove'
import * as navigateTail from './navigate/afterCharacterMembershipNavigateChanged'

const orchestrateCharacterRoomMembershipMock = membership.orchestrateCharacterRoomMembership as jest.MockedFunction<
    typeof membership.orchestrateCharacterRoomMembership
>
const resolveConnectTargetRoomMock = resolveConnect.resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnect.resolveConnectTargetRoom
>
const presentCharacterMoveMock = presentCharacterMoveModule.presentCharacterMove as jest.MockedFunction<
    typeof presentCharacterMoveModule.presentCharacterMove
>
const afterCharacterMembershipNavigateChangedMock = navigateTail.afterCharacterMembershipNavigateChanged as jest.MockedFunction<
    typeof navigateTail.afterCharacterMembershipNavigateChanged
>
const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
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
        characterMetaGetMock.mockResolvedValue(characterMeta as any)
        afterCharacterMembershipNavigateChangedMock.mockResolvedValue(undefined)
        presentCharacterMoveMock.mockResolvedValue(undefined)
    })

    describe('handleCharacterConnected', () => {
        it('routes connect through membership apply (intentKind + resolveHeaderSlot) and navigate tail with pre-apply characterMeta', async () => {
            orchestrateCharacterRoomMembershipMock.mockResolvedValue({
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
            expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: 'ROOM#TownSquare',
                    bundleId: expect.any(String),
                    intentKind: 'connect',
                    resolveHeaderSlot: expect.any(Function),
                }),
                { messageBus, streamEvent }
            )
            expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    characterMeta,
                    result: expect.objectContaining({
                        ok: true,
                        changed: true,
                        to: 'ROOM#TownSquare',
                    }),
                    bundleId: expect.any(String),
                    messageBus,
                })
            )
            expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CheckLocation' }))
        })

        it('still invokes tail helper when membership apply is a no-op', async () => {
            orchestrateCharacterRoomMembershipMock.mockResolvedValue({
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

            expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledTimes(1)
            expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalled()
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('routes disconnect through membership apply (intentKind: disconnect), then presents narration via presentCharacterMove (to: null) with the already-compiled plan', async () => {
            const plan = { steps: [], slots: [] }
            orchestrateCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: ['ROOM#roomA'],
                to: null,
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
                captures: new Map([['capture:from:ROOM#roomA', ['CHARACTER#alpha']]]),
                plan,
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: null,
                    bundleId: expect.any(String),
                    intentKind: 'disconnect',
                }),
                { messageBus, streamEvent }
            )
            expect(presentCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    to: null,
                    plan,
                    bundleId: expect.any(String),
                    captures: expect.any(Map),
                    messageBus,
                })
            )
        })

        it('does not present narration when membership apply is a no-op', async () => {
            orchestrateCharacterRoomMembershipMock.mockResolvedValue({
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

            expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledTimes(1)
            expect(presentCharacterMoveMock).not.toHaveBeenCalled()
            expect(messageBus.publish).not.toHaveBeenCalled()
        })
    })
})
