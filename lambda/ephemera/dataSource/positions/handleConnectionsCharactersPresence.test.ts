jest.mock('./navigate/orchestrateCharacterMove', () => ({
    orchestrateCharacterMove: jest.fn(),
}))

jest.mock('./manipulation/membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import * as orchestrateModule from './navigate/orchestrateCharacterMove'
import * as resolveConnect from './manipulation/membership/resolveConnectTargetRoom'

const orchestrateCharacterMoveMock = orchestrateModule.orchestrateCharacterMove as jest.MockedFunction<
    typeof orchestrateModule.orchestrateCharacterMove
>
const resolveConnectTargetRoomMock = resolveConnect.resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnect.resolveConnectTargetRoom
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
        orchestrateCharacterMoveMock.mockResolvedValue({
            ok: true,
            froms: [],
            to: 'ROOM#TownSquare',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
    })

    describe('handleCharacterConnected', () => {
        it('routes connect through orchestrateCharacterMove with the pre-resolved target room and characterMeta', async () => {
            await handleCharacterConnected({
                type: 'Character Connected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(resolveConnectTargetRoomMock).toHaveBeenCalledWith('CHARACTER#alpha')
            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: 'ROOM#TownSquare',
                    bundleId: expect.any(String),
                    intentKind: 'connect',
                    characterMeta,
                    messageBus,
                    streamEvent,
                })
            )
            expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CheckLocation' }))
        })

        it('still calls orchestrateCharacterMove when membership apply is a no-op', async () => {
            orchestrateCharacterMoveMock.mockResolvedValue({
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

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledTimes(1)
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('routes disconnect through orchestrateCharacterMove with a null target room and intentKind disconnect', async () => {
            orchestrateCharacterMoveMock.mockResolvedValue({
                ok: true,
                froms: ['ROOM#roomA'],
                to: null,
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
                captures: new Map([['capture:from:ROOM#roomA', ['CHARACTER#alpha']]]),
                plan: { steps: [], slots: [] },
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: null,
                    bundleId: expect.any(String),
                    intentKind: 'disconnect',
                    messageBus,
                    streamEvent,
                })
            )
        })

        it('is a no-op past the coordinator call when membership apply reports no change', async () => {
            orchestrateCharacterMoveMock.mockResolvedValue({
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

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledTimes(1)
            expect(messageBus.publish).not.toHaveBeenCalled()
        })
    })
})
