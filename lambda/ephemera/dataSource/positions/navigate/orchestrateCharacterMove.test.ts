jest.mock('../manipulation/membership/orchestrateCharacterRoomMembership', () => ({
    orchestrateCharacterRoomMembership: jest.fn(),
}))

jest.mock('../manipulation/membership/persistRoomStackNavigate', () => ({
    persistRoomStackNavigate: jest.fn(),
}))

jest.mock('./presentCharacterMove', () => ({
    presentCharacterMove: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        RoomAssets: { get: jest.fn() },
        Global: { get: jest.fn() },
    },
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import * as membership from '../manipulation/membership/orchestrateCharacterRoomMembership'
import * as persistRoomStack from '../manipulation/membership/persistRoomStackNavigate'
import * as presentCharacterMove from './presentCharacterMove'
import { orchestrateCharacterMove } from './orchestrateCharacterMove'
import { MessageBus } from '../../../messageBus/baseClasses'

const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
>

const orchestrateCharacterRoomMembershipMock = membership.orchestrateCharacterRoomMembership as jest.MockedFunction<
    typeof membership.orchestrateCharacterRoomMembership
>
const persistRoomStackNavigateMock = persistRoomStack.persistRoomStackNavigate as jest.MockedFunction<
    typeof persistRoomStack.persistRoomStackNavigate
>
const presentCharacterMoveMock = presentCharacterMove.presentCharacterMove as jest.MockedFunction<
    typeof presentCharacterMove.presentCharacterMove
>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const BEAT_ANCHOR_TIME = 1_700_000_000_000
const PLAN = { steps: [], slots: [] }

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    RoomId: FROM_ROOM,
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    Name: 'Test',
    HomeId: FROM_ROOM,
    assets: ['primitives', 'TownCenter'],
}

describe('orchestrateCharacterMove', () => {
    const messageBusPublish = jest.fn()
    const messageBusMock = { publish: messageBusPublish } as unknown as MessageBus
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const getRoomAssets = jest.fn().mockResolvedValue(['ASSET#TownCenter'])
    const getCanonAssets = jest.fn().mockResolvedValue(['primitives', 'TownCenter'])

    beforeEach(() => {
        jest.clearAllMocks()
        characterMetaGetMock.mockResolvedValue(characterMeta)
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            plan: PLAN,
        })
        persistRoomStackNavigateMock.mockResolvedValue(undefined)
        presentCharacterMoveMock.mockResolvedValue(undefined)
    })

    it('navigate: fetches characterMeta, calls the membership coordinator with a resolveHeaderSlot closure, and runs persist + present in parallel', async () => {
        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            intentFromRoomId: FROM_ROOM,
            messageBus: messageBusMock,
            streamEvent,
            getRoomAssets,
            getCanonAssets,
        })

        expect(characterMetaGetMock).toHaveBeenCalledWith(CHARACTER_ID)
        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
            {
                characterId: CHARACTER_ID,
                targetRoomId: TO_ROOM,
                bundleId: expect.any(String),
                intentKind: 'navigate',
                intentFromRoomId: FROM_ROOM,
                exitName: undefined,
                resolveHeaderSlot: expect.any(Function),
            },
            expect.objectContaining({
                messageBus: messageBusMock,
                streamEvent,
            })
        )
        expect(persistRoomStackNavigateMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            characterAssets: characterMeta.assets,
            roomAssets: ['ASSET#TownCenter'],
            canonAssets: ['primitives', 'TownCenter'],
        })
        expect(presentCharacterMoveMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            bundleId: expect.any(String),
            plan: PLAN,
            captures: undefined,
            messageBus: messageBusMock,
        })
    })

    it('home: same shape as navigate, distinguished only by intentKind', async () => {
        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'home',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
            expect.objectContaining({ intentKind: 'home' }),
            expect.anything()
        )
        expect(presentCharacterMoveMock).toHaveBeenCalled()
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
        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
            expect.objectContaining({ intentKind: 'connect', resolveHeaderSlot: expect.any(Function) }),
            expect.anything()
        )
    })

    it('disconnect: passes no resolveHeaderSlot, never fetches characterMeta, and presents directly with no ladder persist', async () => {
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: [FROM_ROOM],
            to: null,
            changed: true,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            plan: PLAN,
        })

        await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: null,
            intentKind: 'disconnect',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(characterMetaGetMock).not.toHaveBeenCalled()
        expect(orchestrateCharacterRoomMembershipMock).toHaveBeenCalledWith(
            {
                characterId: CHARACTER_ID,
                targetRoomId: null,
                bundleId: expect.any(String),
                intentKind: 'disconnect',
                intentFromRoomId: undefined,
                exitName: undefined,
                resolveHeaderSlot: undefined,
            },
            expect.anything()
        )
        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(presentCharacterMoveMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            characterMeta: undefined,
            to: null,
            bundleId: expect.any(String),
            plan: PLAN,
            captures: undefined,
            messageBus: messageBusMock,
        })
    })

    it('no-op move: still returns the coordinator result without running persist or present', async () => {
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: [FROM_ROOM],
            to: FROM_ROOM,
            changed: false,
        })

        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: FROM_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual(expect.objectContaining({ ok: true, changed: false }))
        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(presentCharacterMoveMock).not.toHaveBeenCalled()
    })

    it('failed apply: returns the error result without running persist or present', async () => {
        orchestrateCharacterRoomMembershipMock.mockResolvedValue({
            ok: false,
            errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
            errorMessage: 'boom',
        })

        const result = await orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
        })

        expect(result).toEqual({ ok: false, errorCode: 'HOST_EFFECTS_TRANSACT_FAILED', errorMessage: 'boom' })
        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(presentCharacterMoveMock).not.toHaveBeenCalled()
    })

    it('does not reject when the ladder persist fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        persistRoomStackNavigateMock.mockRejectedValue(new Error('persist boom'))

        await expect(orchestrateCharacterMove({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            intentKind: 'navigate',
            messageBus: messageBusMock,
            streamEvent,
            getRoomAssets,
            getCanonAssets,
        })).resolves.toEqual(expect.objectContaining({ ok: true, changed: true }))

        expect(presentCharacterMoveMock).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[mtw.ephemera.positions] persistRoomStackNavigate failed:')
        )
        consoleSpy.mockRestore()
    })
})
