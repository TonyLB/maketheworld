import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import * as kernel from '../manipulation/kernel/commitStepSequence'

jest.mock('../manipulation/kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

jest.mock('../../../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        Positions: {
            getMembershipContainers: jest.fn(),
        },
        Global: { get: jest.fn() },
        RoomAssets: { get: jest.fn().mockResolvedValue([]) },
    },
}))

import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'

const commitStepSequenceMock = kernel.commitStepSequence as jest.MockedFunction<typeof kernel.commitStepSequence>
const getRoomCharacterListMock = getRoomCharacterList as jest.MockedFunction<typeof getRoomCharacterList>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId

describe('applyCharacterRoomMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
            EphemeraId: CHARACTER_ID,
            Name: 'Test',
            HomeId: 'ROOM#VORTEX',
            assets: ['primitives'],
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
        })
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('SESSION#abcdef')
        getRoomCharacterListMock.mockImplementation(async (roomId: EphemeraRoomId) => {
            if (roomId === TO_ROOM) {
                return [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test', SessionIds: [] }]
            }
            return []
        })
    })

    it('skips side-effect bundle when membership endpoint is unchanged', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: FROM_ROOM,
            changed: false,
        })
        expect(commitStepSequenceMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.CharacterMeta.invalidate).not.toHaveBeenCalled()
        expect(getRoomCharacterListMock).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when endpoint changes: bare transferMembership step, no dissolve steps', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
            roomRosterSnapshots: {
                [FROM_ROOM]: [],
                [TO_ROOM]: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test', SessionIds: [] }],
            },
        }))

        expect(commitStepSequenceMock).toHaveBeenCalledWith(
            {
                steps: [
                    { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([FROM_ROOM]), toHostId: TO_ROOM },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
                    { kind: 'addPresencePort', hostId: CHARACTER_ID, port: expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }) },
                ],
            },
            expect.objectContaining({
                messageBus: messageBus as any,
                streamEvent,
                characterNames: new Map([[CHARACTER_ID, 'Test']]),
            })
        )

        expect(getRoomCharacterListMock).toHaveBeenCalledWith(FROM_ROOM)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.CharacterMeta.invalidate).toHaveBeenCalledWith(CHARACTER_ID)
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [expect.objectContaining({
                type: 'CharacterInPlay',
                CharacterId: CHARACTER_ID,
                RoomId: TO_ROOM,
            })],
        })
        // No dissolveRelation steps are ever constructed for a character -- HostRelationalEdge is
        // object-only, so there is nothing for this route to sweep, structurally, not just in practice.
        // Presence steps (RD-1/RD-3) are the only addition to the bare transfer.
        expect(commitStepSequenceMock.mock.calls[0][0].steps).toHaveLength(3)
    })

    it('honors compileMutationSteps when supplied, threading narrationHandledInline to the commit and captures back out (Phase 2)', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        const captures = new Map([['capture:from', [CHARACTER_ID]]])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures })

        const compiledSteps = [
            { kind: 'capture' as const, hostId: FROM_ROOM, captureId: 'capture:from' },
            { kind: 'transferMembership' as const, entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([FROM_ROOM]), toHostId: TO_ROOM },
            { kind: 'capture' as const, hostId: TO_ROOM, captureId: 'capture:to' },
        ]
        const compileMutationSteps = jest.fn().mockReturnValue(compiledSteps)

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM, compileMutationSteps, narrationHandledInline: true },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(compileMutationSteps).toHaveBeenCalledWith({ froms: [FROM_ROOM], to: TO_ROOM, changed: true })
        expect(commitStepSequenceMock).toHaveBeenCalledWith(
            { steps: compiledSteps },
            expect.objectContaining({ narratedInline: true })
        )
        expect(result).toEqual(expect.objectContaining({ ok: true, captures }))
    })

    it('defaults to a bare transferMembership step and no narratedInline dep when compileMutationSteps is not supplied', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })

        await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        const deps = commitStepSequenceMock.mock.calls[0][1]
        expect(deps).not.toHaveProperty('narratedInline')
    })

    it('runs side-effect bundle for all froms on drift scrub', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, ROOM_C])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })

        await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(commitStepSequenceMock).toHaveBeenCalledWith(
            {
                steps: [
                    {
                        kind: 'transferMembership',
                        entityIds: new Set([CHARACTER_ID]),
                        fromHostIds: new Set([FROM_ROOM, ROOM_C]),
                        toHostId: TO_ROOM,
                    },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: ROOM_C },
                    { kind: 'addPresencePort', hostId: CHARACTER_ID, port: expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }) },
                ],
            },
            expect.anything()
        )
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(FROM_ROOM)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(ROOM_C)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(TO_ROOM)
    })

    it('logs and returns when graph persist fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        commitStepSequenceMock.mockResolvedValue({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'boom',
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'boom',
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(getRoomCharacterListMock).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
