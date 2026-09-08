jest.mock('../manipulation/membership/orchestrateCharacterRoomMembership', () => ({
    orchestrateCharacterRoomMembership: jest.fn(),
}))

jest.mock('./afterCharacterMembershipNavigateChanged', () => ({
    afterCharacterMembershipNavigateChanged: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
    },
}))

import internalCache from '../../../internalCache'
import * as membership from '../manipulation/membership/orchestrateCharacterRoomMembership'
import * as navigateTail from './afterCharacterMembershipNavigateChanged'
import { executeCharacterNavigate } from './executeCharacterNavigate'
import { MessageBus } from '../../../messageBus/baseClasses'

const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
>

const orchestrateCharacterRoomMembershipMock = membership.orchestrateCharacterRoomMembership as jest.MockedFunction<
    typeof membership.orchestrateCharacterRoomMembership
>
const afterCharacterMembershipNavigateChangedMock = navigateTail.afterCharacterMembershipNavigateChanged as jest.MockedFunction<
    typeof navigateTail.afterCharacterMembershipNavigateChanged
>

describe('executeCharacterNavigate', () => {
    const messageBusPublish = jest.fn()
    const messageBusMock = { publish: messageBusPublish } as unknown as MessageBus
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        characterMetaGetMock.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            Name: 'Test',
            HomeId: 'ROOM#VORTEX',
            assets: ['primitives', 'TownCenter'],
        })
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#TestTwo',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        afterCharacterMembershipNavigateChangedMock.mockResolvedValue(undefined)
    })

    it('calls orchestrateCharacterRoomMembership then navigate tail with pre-apply characterMeta', async () => {
        await executeCharacterNavigate({
            characterId: 'CHARACTER#Test',
            targetRoomId: 'ROOM#TestTwo',
            intentFromRoomId: 'ROOM#VORTEX',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
            {
                characterId: 'CHARACTER#Test',
                targetRoomId: 'ROOM#TestTwo',
                bundleId: expect.any(String),
                intentKind: 'navigate',
                intentFromRoomId: 'ROOM#VORTEX',
                exitName: undefined,
                resolveHeaderSlot: expect.any(Function),
            },
            expect.objectContaining({
                messageBus: messageBusMock,
                streamEvent,
            })
        )
        expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalledWith({
            characterId: 'CHARACTER#Test',
            characterMeta: expect.objectContaining({ EphemeraId: 'CHARACTER#Test' }),
            result: expect.objectContaining({
                ok: true,
                changed: true,
                to: 'ROOM#TestTwo',
            }),
            bundleId: expect.any(String),
            messageBus: messageBusMock,
        })
    })

    it('still invokes tail helper when membership apply is a no-op', async () => {
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#VORTEX',
            changed: false,
        })

        await executeCharacterNavigate({
            characterId: 'CHARACTER#Test',
            targetRoomId: 'ROOM#VORTEX',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalled()
        expect(afterCharacterMembershipNavigateChangedMock).toHaveBeenCalled()
    })
})
