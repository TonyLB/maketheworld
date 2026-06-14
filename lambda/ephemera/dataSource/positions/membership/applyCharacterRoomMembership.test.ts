import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import * as flatPersist from './applyCharacterMembershipFlat'

jest.mock('./applyCharacterMembershipFlat', () => ({
    applyCharacterMembershipFlat: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: { set: jest.fn(), invalidate: jest.fn() },
        Global: { get: jest.fn() },
    },
}))

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../internalCache'

const applyCharacterMembershipFlatMock = flatPersist.applyCharacterMembershipFlat as jest.MockedFunction<
    typeof flatPersist.applyCharacterMembershipFlat
>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

describe('applyCharacterRoomMembership', () => {
    const messageBus = { publish: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
            EphemeraId: CHARACTER_ID,
            Name: 'Test',
            HomeId: 'ROOM#VORTEX',
        })
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('SESSION#abcdef')
    })

    it('skips side-effect bundle when membership endpoint is unchanged', async () => {
        applyCharacterMembershipFlatMock.mockResolvedValue({
            ok: true,
            from: FROM_ROOM,
            to: FROM_ROOM,
            changed: false,
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM },
            { messageBus: messageBus as any }
        )

        expect(result).toEqual({
            ok: true,
            from: FROM_ROOM,
            to: FROM_ROOM,
            changed: false,
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.CharacterMeta.invalidate).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when endpoint changes', async () => {
        applyCharacterMembershipFlatMock.mockResolvedValue({
            ok: true,
            from: FROM_ROOM,
            to: TO_ROOM,
            changed: true,
            roomRosterSnapshots: {
                [FROM_ROOM]: [],
                [TO_ROOM]: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }],
            },
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            from: FROM_ROOM,
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith(FROM_ROOM)
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.Positions.invalidate).toHaveBeenCalledWith(FROM_ROOM)
        expect(internalCache.Positions.invalidate).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.Positions.set).toHaveBeenCalledWith({
            componentId: TO_ROOM,
            graph: expect.objectContaining({
                nodes: expect.arrayContaining([
                    expect.objectContaining({ tag: 'Character', universalKey: CHARACTER_ID }),
                ]),
            }),
        })
        expect(internalCache.CharacterMeta.invalidate).toHaveBeenCalledWith(CHARACTER_ID)
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [expect.objectContaining({
                type: 'CharacterInPlay',
                CharacterId: CHARACTER_ID,
                RoomId: TO_ROOM,
            })],
        })
    })

    it('logs and returns when flat persist fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        applyCharacterMembershipFlatMock.mockResolvedValue({
            ok: false,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: 'boom',
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: 'boom',
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
