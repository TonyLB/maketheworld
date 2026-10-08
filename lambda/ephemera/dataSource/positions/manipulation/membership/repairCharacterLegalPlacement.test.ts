import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn(), set: jest.fn() },
        Global: { get: jest.fn() },
        Positions: { getMembershipContainers: jest.fn() },
        RoomAssets: { get: jest.fn() },
    },
}))

jest.mock('../../navigate/orchestrateCharacterMove', () => ({
    orchestrateCharacterMove: jest.fn(),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'
import { orchestrateCharacterMove } from '../../navigate/orchestrateCharacterMove'
import { repairCharacterLegalPlacement } from './repairCharacterLegalPlacement'
import type { RoomStackItem } from '../../../characters/roomStack/types'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const optimisticUpdateMock = ephemeraDB.optimisticUpdate as jest.Mock
const orchestrateCharacterMoveMock = orchestrateCharacterMove as jest.MockedFunction<
    typeof orchestrateCharacterMove
>

const CHARACTER_ID = 'CHARACTER#Test' as const
const streamEvent = jest.fn().mockResolvedValue(undefined)
const messageBus = { publish: jest.fn() } as any

const fullStack: RoomStackItem[] = [
    { asset: 'primitives', RoomId: 'VORTEX' },
    { asset: 'TownCenter', RoomId: 'TownSquare' },
    { asset: 'draftOne', RoomId: 'Laboratory' },
    { asset: 'draftTwo', RoomId: 'Oubliette' },
]

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: 'ROOM#Oubliette' as const,
    RoomStack: fullStack,
    HomeId: 'ROOM#VORTEX' as const,
    assets: [] as string[],
    Pronouns: 'they/them',
}

const setupTrimPersist = (assets: string[]): void => {
    internalCacheMock.CharacterMeta.get.mockResolvedValue({ ...characterMeta, assets })
    internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
    optimisticUpdateMock.mockImplementation(async ({ updateReducer, successCallback }) => {
        const prior = { RoomStack: fullStack }
        const next = produce(prior, updateReducer)
        successCallback?.(next, prior)
        return next
    })
}

describe('repairCharacterLegalPlacement', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        orchestrateCharacterMoveMock.mockResolvedValue({ ok: true, froms: ['ROOM#Oubliette'], to: 'ROOM#TownSquare', changed: true })
    })

    it('no-ops when all ladder assets remain accessible', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            assets: ['draftOne', 'draftTwo'],
        })
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(result).toEqual({ trimmed: false, relocated: false })
        expect(optimisticUpdateMock).not.toHaveBeenCalled()
        expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
    })

    it('trims ladder and relocates in-play character when top frame changes', async () => {
        setupTrimPersist([])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])
        internalCacheMock.RoomAssets.get.mockResolvedValue(['ASSET#draftTwo'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            updateKeys: ['RoomStack'],
        }))
        expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: 'ROOM#TownSquare',
            intentKind: 'navigate',
            messageBus,
            streamEvent,
        })
        expect(result).toEqual({ trimmed: true, relocated: true })
    })

    it('trims ladder without relocating when top frame matches membership', async () => {
        setupTrimPersist(['draftTwo'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])
        internalCacheMock.RoomAssets.get.mockResolvedValue(['ASSET#draftTwo'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalled()
        expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
        expect(result).toEqual({ trimmed: true, relocated: false })
    })

    it('does not relocate when the current room is still accessible even though the trimmed ladder top differs (CH-1)', async () => {
        // Current room (ROOM#Market) is reachable through a new asset the ladder hasn't
        // caught up to yet --- a lagging ladder must not trigger a false "relocate back".
        setupTrimPersist(['marketAsset'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Market'])
        internalCacheMock.RoomAssets.get.mockResolvedValue(['ASSET#marketAsset'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalled()
        expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
        expect(result).toEqual({ trimmed: true, relocated: false })
    })

    it('relocates to the trimmed ladder top when the current room is no longer accessible (CH-1)', async () => {
        setupTrimPersist(['draftTwo'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Laboratory'])
        internalCacheMock.RoomAssets.get.mockResolvedValue(['ASSET#draftOne'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: 'ROOM#Oubliette',
            intentKind: 'navigate',
            messageBus,
            streamEvent,
        })
        expect(result).toEqual({ trimmed: true, relocated: true })
    })

    it('calls orchestrateCharacterMove on forceMove when in play', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            assets: ['draftOne', 'draftTwo'],
        })
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])
        orchestrateCharacterMoveMock.mockResolvedValue({ ok: true, froms: ['ROOM#Oubliette'], to: 'ROOM#Oubliette', changed: false })

        await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            forceMove: true,
            messageBus,
            streamEvent,
        })

        expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: 'ROOM#Oubliette',
            intentKind: 'navigate',
            messageBus,
            streamEvent,
        })
    })

    it('trims only when character is out of play', async () => {
        setupTrimPersist([])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue([])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalled()
        expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
        expect(result).toEqual({ trimmed: true, relocated: false })
    })

    it('publishes Perception on forceRender when in play without relocate', async () => {
        setupTrimPersist(['draftTwo'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])
        internalCacheMock.RoomAssets.get.mockResolvedValue(['ASSET#draftTwo'])

        await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            forceRender: true,
            messageBus,
            streamEvent,
        })

        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'Perception',
            characterId: CHARACTER_ID,
            ephemeraId: 'ROOM#Oubliette',
        })
        expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
    })
})
