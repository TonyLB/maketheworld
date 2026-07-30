jest.mock('./membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

jest.mock('./membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

jest.mock('./membership/orchestrateCharacterDisconnect', () => ({
    orchestrateCharacterDisconnect: jest.fn(),
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
import * as membership from './membership/applyCharacterRoomMembership'
import * as resolveConnect from './membership/resolveConnectTargetRoom'
import * as disconnectTail from './membership/orchestrateCharacterDisconnect'
import * as navigateTail from './navigate/afterCharacterMembershipNavigateChanged'

const applyCharacterRoomMembershipMock = membership.applyCharacterRoomMembership as jest.MockedFunction<
    typeof membership.applyCharacterRoomMembership
>
const resolveConnectTargetRoomMock = resolveConnect.resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnect.resolveConnectTargetRoom
>
const orchestrateCharacterDisconnectMock = disconnectTail.orchestrateCharacterDisconnect as jest.MockedFunction<
    typeof disconnectTail.orchestrateCharacterDisconnect
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
        orchestrateCharacterDisconnectMock.mockResolvedValue(undefined)
    })

    describe('handleCharacterConnected', () => {
        it('routes connect through membership apply (with a compiled Move op) and navigate tail with pre-apply characterMeta', async () => {
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
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: 'ROOM#TownSquare',
                    narrationHandledInline: true,
                    compileMutationSteps: expect.any(Function),
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
                    intentKind: 'connect',
                    messageBus,
                })
            )
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

        it('the compiled compileMutationSteps callback yields only mutation steps (transfer/capture-to; no capture-from since connect has no froms)', async () => {
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

            const compileMutationSteps = applyCharacterRoomMembershipMock.mock.calls[0][0].compileMutationSteps!
            const steps = compileMutationSteps({ froms: [], to: 'ROOM#TownSquare', changed: true })

            expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'capture'])
        })
    })

    describe('handleCharacterDisconnected', () => {
        it('routes disconnect through membership apply (with a compiled Move op), then presents narration via orchestrateCharacterDisconnect', async () => {
            applyCharacterRoomMembershipMock.mockResolvedValue({
                ok: true,
                froms: ['ROOM#roomA'],
                to: null,
                changed: true,
                beatAnchorTime: 1_700_000_000_000,
                captures: new Map([['capture:from:ROOM#roomA', ['CHARACTER#alpha']]]),
            })

            await handleCharacterDisconnected({
                type: 'Character Disconnected',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }, { messageBus, streamEvent })

            expect(characterMetaGetMock).toHaveBeenCalledWith('CHARACTER#alpha')
            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    targetRoomId: null,
                    narrationHandledInline: true,
                    compileMutationSteps: expect.any(Function),
                }),
                { messageBus, streamEvent }
            )
            expect(orchestrateCharacterDisconnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#alpha',
                    characterName: 'Alpha',
                    froms: ['ROOM#roomA'],
                    bundleId: expect.any(String),
                    captures: expect.any(Map),
                    messageBus,
                })
            )
        })

        it('does not present narration when membership apply is a no-op', async () => {
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
            expect(orchestrateCharacterDisconnectMock).not.toHaveBeenCalled()
            expect(messageBus.publish).not.toHaveBeenCalled()
        })
    })
})
