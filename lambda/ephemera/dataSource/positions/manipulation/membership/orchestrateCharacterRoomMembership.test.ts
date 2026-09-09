import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orchestrateCharacterRoomMembership } from './orchestrateCharacterRoomMembership'
import * as kernel from '../kernel/commitStepSequence'

jest.mock('../kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

jest.mock('../../../../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))

jest.mock('../../../../internalCache', () => ({
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

import internalCache from '../../../../internalCache'
import { getRoomCharacterList } from '../../../../internalCache/hydrateRoomRoster'

const commitStepSequenceMock = kernel.commitStepSequence as jest.MockedFunction<typeof kernel.commitStepSequence>
const getRoomCharacterListMock = getRoomCharacterList as jest.MockedFunction<typeof getRoomCharacterList>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId
const BUNDLE_ID = 'BUNDLE#test'

describe('orchestrateCharacterRoomMembership', () => {
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

        const result = await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM, bundleId: BUNDLE_ID, intentKind: 'navigate' },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            changed: false,
            froms: [],
            to: FROM_ROOM,
        })
        expect(commitStepSequenceMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.CharacterMeta.invalidate).not.toHaveBeenCalled()
        expect(getRoomCharacterListMock).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when endpoint changes: builds+compiles the op once via planCharacterMoveTransfer, commits capture+transfer+presence steps', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        const captures = new Map([['capture:from:ROOM#VORTEX', [CHARACTER_ID]]])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures })

        const result = await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM, bundleId: BUNDLE_ID, intentKind: 'navigate' },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
            captures,
            plan: expect.objectContaining({ steps: expect.any(Array), slots: expect.any(Array) }),
            roomRosterSnapshots: {
                [FROM_ROOM]: [],
                [TO_ROOM]: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test', SessionIds: [] }],
            },
        }))

        // buildCharacterMoveOp always narrates, so the compiled plan always carries capture-from/
        // capture-to steps (mutation-kind, so they commit) bracketing the transfer -- this is the
        // shape every real character-route caller already produced pre-3e (compileMutationSteps was
        // supplied by all four call sites), not a widened commit.
        expect(commitStepSequenceMock).toHaveBeenCalledWith(
            {
                steps: [
                    { kind: 'capture', hostId: FROM_ROOM, captureId: 'capture:from:ROOM#VORTEX' },
                    { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([FROM_ROOM]), toHostId: TO_ROOM },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
                    { kind: 'addPresencePort', hostId: CHARACTER_ID, port: expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }) },
                    { kind: 'capture', hostId: TO_ROOM, captureId: 'capture:to' },
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
    })

    it('resolves the header slot before commit when resolveHeaderSlot is supplied, and bakes it into the plan', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })

        const headerSlot = { slotId: 'SLOT#header', expectedPublishType: 'PerceptionMessage' as const, componentId: TO_ROOM, perspectiveKey: 'pk', targets: [CHARACTER_ID], contentStream: 'render' as const, format: 'header' as const }
        const resolveHeaderSlot = jest.fn().mockResolvedValue(headerSlot)

        const result = await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM, bundleId: BUNDLE_ID, intentKind: 'connect', resolveHeaderSlot },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(resolveHeaderSlot).toHaveBeenCalledWith(TO_ROOM)
        if (!result.ok) { throw new Error('expected ok:true') }
        expect(result.plan?.slots).toEqual(expect.arrayContaining([headerSlot]))
    })

    it('does not call resolveHeaderSlot for a no-op move', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        const resolveHeaderSlot = jest.fn()

        await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM, bundleId: BUNDLE_ID, intentKind: 'navigate', resolveHeaderSlot },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(resolveHeaderSlot).not.toHaveBeenCalled()
    })

    it('runs side-effect bundle for all froms on drift scrub', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, ROOM_C])
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })

        await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM, bundleId: BUNDLE_ID, intentKind: 'navigate' },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(commitStepSequenceMock).toHaveBeenCalledWith(
            {
                steps: [
                    { kind: 'capture', hostId: FROM_ROOM, captureId: 'capture:from:ROOM#VORTEX' },
                    { kind: 'capture', hostId: ROOM_C, captureId: 'capture:from:ROOM#TestThree' },
                    {
                        kind: 'transferMembership',
                        entityIds: new Set([CHARACTER_ID]),
                        fromHostIds: new Set([FROM_ROOM, ROOM_C]),
                        toHostId: TO_ROOM,
                    },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
                    { kind: 'removePresencePort', hostId: CHARACTER_ID, fromHostId: ROOM_C },
                    { kind: 'addPresencePort', hostId: CHARACTER_ID, port: expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }) },
                    { kind: 'capture', hostId: TO_ROOM, captureId: 'capture:to' },
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

        const result = await orchestrateCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM, bundleId: BUNDLE_ID, intentKind: 'navigate' },
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
