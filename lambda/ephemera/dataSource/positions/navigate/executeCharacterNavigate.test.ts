jest.mock('../membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

jest.mock('./orchestrateNavigate', () => ({
    orchestrateCharacterNavigate: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
    },
}))

import internalCache from '../../../internalCache'
import * as membership from '../membership/applyCharacterRoomMembership'
import * as orchestrateNavigate from './orchestrateNavigate'
import { executeCharacterNavigate } from './executeCharacterNavigate'
import { MessageBus } from '../../../messageBus/baseClasses'

const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
>

const applyCharacterRoomMembershipMock = membership.applyCharacterRoomMembership as jest.MockedFunction<
    typeof membership.applyCharacterRoomMembership
>
const orchestrateCharacterNavigateMock = orchestrateNavigate.orchestrateCharacterNavigate as jest.MockedFunction<
    typeof orchestrateNavigate.orchestrateCharacterNavigate
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
        applyCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#TestTwo',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        orchestrateCharacterNavigateMock.mockResolvedValue(undefined)
    })

    it('calls applyCharacterRoomMembership then orchestration when changed', async () => {
        await executeCharacterNavigate({
            characterId: 'CHARACTER#Test',
            targetRoomId: 'ROOM#TestTwo',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
            { characterId: 'CHARACTER#Test', targetRoomId: 'ROOM#TestTwo' },
            expect.objectContaining({
                messageBus: messageBusMock,
                streamEvent,
            })
        )
        expect(orchestrateCharacterNavigateMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Test',
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#TestTwo',
            beatAnchorTime: 1_700_000_000_000,
            messageBus: messageBusMock,
        }))
    })

    it('skips orchestration when membership apply is a no-op', async () => {
        applyCharacterRoomMembershipMock.mockResolvedValue({
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

        expect(applyCharacterRoomMembershipMock).toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).not.toHaveBeenCalled()
    })
})
