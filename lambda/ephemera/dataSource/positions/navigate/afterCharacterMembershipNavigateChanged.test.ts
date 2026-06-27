jest.mock('../membership/persistRoomStackNavigate', () => ({
    persistRoomStackNavigate: jest.fn(),
}))

jest.mock('./orchestrateNavigate', () => ({
    orchestrateCharacterNavigate: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MessageBus } from '../../../messageBus/baseClasses'
import * as persistRoomStack from '../membership/persistRoomStackNavigate'
import * as orchestrateNavigate from './orchestrateNavigate'
import { afterCharacterMembershipNavigateChanged } from './afterCharacterMembershipNavigateChanged'

const persistRoomStackNavigateMock = persistRoomStack.persistRoomStackNavigate as jest.MockedFunction<
    typeof persistRoomStack.persistRoomStackNavigate
>
const orchestrateCharacterNavigateMock = orchestrateNavigate.orchestrateCharacterNavigate as jest.MockedFunction<
    typeof orchestrateNavigate.orchestrateCharacterNavigate
>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const BEAT_ANCHOR_TIME = 1_700_000_000_000

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: FROM_ROOM,
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    HomeId: FROM_ROOM,
    assets: ['primitives', 'TownCenter'],
}

describe('afterCharacterMembershipNavigateChanged', () => {
    const messageBus = { publish: jest.fn() } as unknown as MessageBus
    const getRoomAssets = jest.fn().mockResolvedValue(['ASSET#TownCenter'])
    const getCanonAssets = jest.fn().mockResolvedValue(['primitives', 'TownCenter'])

    beforeEach(() => {
        jest.clearAllMocks()
        persistRoomStackNavigateMock.mockResolvedValue(undefined)
        orchestrateCharacterNavigateMock.mockResolvedValue(undefined)
    })

    it('runs persist and orchestrate in parallel when changed with non-null to', async () => {
        let resolvePersist: () => void
        let resolveOrchestrate: () => void
        const persistStarted = new Promise<void>((resolve) => { resolvePersist = resolve })
        const orchestrateStarted = new Promise<void>((resolve) => { resolveOrchestrate = resolve })

        persistRoomStackNavigateMock.mockImplementation(async () => {
            resolvePersist!()
            await orchestrateStarted
        })
        orchestrateCharacterNavigateMock.mockImplementation(async () => {
            resolveOrchestrate!()
            await persistStarted
        })

        await afterCharacterMembershipNavigateChanged({
            characterId: CHARACTER_ID,
            characterMeta,
            result: {
                ok: true,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                changed: true,
                beatAnchorTime: BEAT_ANCHOR_TIME,
            },
            messageBus,
            getRoomAssets,
            getCanonAssets,
        })

        expect(persistRoomStackNavigateMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: TO_ROOM,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            characterAssets: ['primitives', 'TownCenter'],
            roomAssets: ['ASSET#TownCenter'],
            canonAssets: ['primitives', 'TownCenter'],
        })
        expect(orchestrateCharacterNavigateMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            characterMeta,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            beatAnchorTime: BEAT_ANCHOR_TIME,
            messageBus,
        })
    })

    it('does not reject when persist fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        persistRoomStackNavigateMock.mockRejectedValue(new Error('persist boom'))

        await expect(afterCharacterMembershipNavigateChanged({
            characterId: CHARACTER_ID,
            characterMeta,
            result: {
                ok: true,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                changed: true,
                beatAnchorTime: BEAT_ANCHOR_TIME,
            },
            messageBus,
            getRoomAssets,
            getCanonAssets,
        })).resolves.toBeUndefined()

        expect(orchestrateCharacterNavigateMock).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[mtw.ephemera.positions] persistRoomStackNavigate failed:')
        )
        consoleSpy.mockRestore()
    })

    it('skips when changed is false', async () => {
        await afterCharacterMembershipNavigateChanged({
            characterId: CHARACTER_ID,
            characterMeta,
            result: {
                ok: true,
                froms: [],
                to: TO_ROOM,
                changed: false,
            },
            messageBus,
        })

        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).not.toHaveBeenCalled()
    })

    it('skips when to is null', async () => {
        await afterCharacterMembershipNavigateChanged({
            characterId: CHARACTER_ID,
            characterMeta,
            result: {
                ok: true,
                froms: [FROM_ROOM],
                to: null,
                changed: true,
                beatAnchorTime: BEAT_ANCHOR_TIME,
            },
            messageBus,
        })

        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).not.toHaveBeenCalled()
    })

    it('skips when apply failed', async () => {
        await afterCharacterMembershipNavigateChanged({
            characterId: CHARACTER_ID,
            characterMeta,
            result: {
                ok: false,
                errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
                errorMessage: 'boom',
            },
            messageBus,
        })

        expect(persistRoomStackNavigateMock).not.toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).not.toHaveBeenCalled()
    })
})
