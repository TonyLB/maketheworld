jest.mock('../manipulation/kernel/commitAndPresentStepSequence', () => ({
    commitAndPresentStepSequence: jest.fn(),
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    getCharacterRoomPerspectiveKey: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        Positions: { getMembershipContainers: jest.fn() },
    },
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import * as composer from '../manipulation/kernel/commitAndPresentStepSequence'
import { getCharacterRoomPerspectiveKey } from '../../perception/kickRoomHeaderBroadcast'
import { orchestrateCharacterMove } from './orchestrateCharacterMove'
import { MessageBus } from '../../../messageBus/baseClasses'

const characterMetaGetMock = internalCache.CharacterMeta.get as jest.Mock
const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.Mock
const commitAndPresentMock = composer.commitAndPresentStepSequence as jest.MockedFunction<
    typeof composer.commitAndPresentStepSequence
>
const perspectiveKeyMock = getCharacterRoomPerspectiveKey as jest.Mock

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const BEAT_ANCHOR_TIME = 1_700_000_000_000

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    Name: 'Test',
    HomeId: FROM_ROOM,
    assets: ['primitives', 'TownCenter'],
}

describe('orchestrateCharacterMove', () => {
    const messageBusMock = { publish: jest.fn() } as unknown as MessageBus
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        characterMetaGetMock.mockResolvedValue(characterMeta)
        getMembershipContainersMock.mockResolvedValue([FROM_ROOM])
        perspectiveKeyMock.mockResolvedValue('perspective-key')
        commitAndPresentMock.mockResolvedValue({
            ok: true,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            steps: [],
            captures: new Map(),
            nextPresentationIndex: 3,
        } as any)
    })

    const lastPlan = () => commitAndPresentMock.mock.calls[0][0]

    it('navigate: builds the plan once and hands it to the composer with commit and perceive deps', async () => {
        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            intentFromRoomId: FROM_ROOM,
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual({ ok: true, froms: [FROM_ROOM], to: TO_ROOM, changed: true })
        expect(characterMetaGetMock).toHaveBeenCalledWith(CHARACTER_ID)
        expect(commitAndPresentMock).toHaveBeenCalledTimes(1)

        // buildCharacterMoveOp always narrates, so the plan brackets the transfer with captures; the
        // header is a describe step carrying the resolved binding.
        expect(lastPlan().steps).toEqual([
            { kind: 'capture', hostId: FROM_ROOM, captureId: 'capture:from:ROOM#VORTEX' },
            { kind: 'transferMembership', entityId: CHARACTER_ID, fromHostIds: new Set([FROM_ROOM]), toHostId: TO_ROOM },
            { kind: 'removePresenceBinding', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
            { kind: 'addPresenceBinding', hostId: CHARACTER_ID, fromHostId: TO_ROOM, presenceUuid: expect.any(String) },
            { kind: 'capture', hostId: TO_ROOM, captureId: 'capture:to' },
            expect.objectContaining({ kind: 'narrate' }),
            { kind: 'describe', referentId: TO_ROOM, referentKind: 'room', header: { perspectiveKey: 'perspective-key', assets: ['primitives', 'TownCenter'] } },
            expect.objectContaining({ kind: 'narrate' }),
        ])
        expect(commitAndPresentMock).toHaveBeenCalledWith(
            expect.anything(),
            CHARACTER_ID,
            {
                commit: expect.objectContaining({
                    messageBus: messageBusMock,
                    streamEvent,
                    characterNames: new Map([[CHARACTER_ID, 'Test']]),
                }),
                perceive: expect.objectContaining({ messageBus: messageBusMock }),
            }
        )
    })

    it('home: same shape as navigate, distinguished only by intentKind', async () => {
        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'home',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(commitAndPresentMock).toHaveBeenCalledTimes(1)
        expect(lastPlan().steps).toContainEqual(expect.objectContaining({ kind: 'describe', referentId: TO_ROOM }))
    })

    it('connect: uses a pre-fetched characterMeta without re-fetching', async () => {
        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'connect',
            characterMeta,
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(characterMetaGetMock).not.toHaveBeenCalled()
        expect(commitAndPresentMock).toHaveBeenCalledTimes(1)
    })

    it('disconnect: resolves no header and compiles no describe step', async () => {
        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: null,
            intentKind: 'disconnect',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual({ ok: true, froms: [FROM_ROOM], to: null, changed: true })
        expect(perspectiveKeyMock).not.toHaveBeenCalled()
        expect(lastPlan().steps.some((step) => step.kind === 'describe')).toBe(false)
    })

    it('drift scrub: captures and unbinds every prior container', async () => {
        getMembershipContainersMock.mockResolvedValue([FROM_ROOM, ROOM_C])

        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(lastPlan().steps).toEqual(expect.arrayContaining([
            { kind: 'capture', hostId: FROM_ROOM, captureId: 'capture:from:ROOM#VORTEX' },
            { kind: 'capture', hostId: ROOM_C, captureId: 'capture:from:ROOM#TestThree' },
            { kind: 'transferMembership', entityId: CHARACTER_ID, fromHostIds: new Set([FROM_ROOM, ROOM_C]), toHostId: TO_ROOM },
            { kind: 'removePresenceBinding', hostId: CHARACTER_ID, fromHostId: FROM_ROOM },
            { kind: 'removePresenceBinding', hostId: CHARACTER_ID, fromHostId: ROOM_C },
        ]))
    })

    it('no-op move: reads only the containers, then returns unchanged', async () => {
        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: FROM_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual({ ok: true, froms: [], to: FROM_ROOM, changed: false })
        expect(characterMetaGetMock).not.toHaveBeenCalled()
        expect(perspectiveKeyMock).not.toHaveBeenCalled()
        expect(commitAndPresentMock).not.toHaveBeenCalled()
        expect(messageBusMock.publish).not.toHaveBeenCalled()
    })

    it('failed commit: logs and returns the error result', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        commitAndPresentMock.mockResolvedValue({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'boom',
        } as any)

        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'boom' })
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('boom'))
        consoleSpy.mockRestore()
    })
})
