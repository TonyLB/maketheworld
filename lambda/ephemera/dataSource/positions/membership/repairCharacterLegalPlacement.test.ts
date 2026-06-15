import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn(), set: jest.fn() },
        Global: { get: jest.fn() },
        Positions: { getMembershipContainers: jest.fn() },
    },
}))

jest.mock('../../../moveCharacter/executeCharacterNavigate', () => ({
    executeCharacterNavigate: jest.fn(),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { executeCharacterNavigate } from '../../../moveCharacter/executeCharacterNavigate'
import { repairCharacterLegalPlacement } from './repairCharacterLegalPlacement'
import type { RoomStackItem } from './types'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const optimisticUpdateMock = ephemeraDB.optimisticUpdate as jest.Mock
const executeCharacterNavigateMock = executeCharacterNavigate as jest.MockedFunction<
    typeof executeCharacterNavigate
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
        executeCharacterNavigateMock.mockResolvedValue({ ok: true, froms: ['ROOM#Oubliette'], to: 'ROOM#TownSquare', changed: true })
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
        expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
    })

    it('trims ladder and relocates in-play character when top frame changes', async () => {
        setupTrimPersist([])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            updateKeys: ['RoomStack'],
        }))
        expect(executeCharacterNavigateMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })
        expect(result).toEqual({ trimmed: true, relocated: true })
    })

    it('trims ladder without relocating when top frame matches membership', async () => {
        setupTrimPersist(['draftTwo'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])

        const result = await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            messageBus,
            streamEvent,
        })

        expect(optimisticUpdateMock).toHaveBeenCalled()
        expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        expect(result).toEqual({ trimmed: true, relocated: false })
    })

    it('calls executeCharacterNavigate on forceMove when in play', async () => {
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            ...characterMeta,
            assets: ['draftOne', 'draftTwo'],
        })
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])
        executeCharacterNavigateMock.mockResolvedValue({ ok: true, froms: ['ROOM#Oubliette'], to: 'ROOM#Oubliette', changed: false })

        await repairCharacterLegalPlacement({
            characterId: CHARACTER_ID,
            forceMove: true,
            messageBus,
            streamEvent,
        })

        expect(executeCharacterNavigateMock).toHaveBeenCalledWith({
            characterId: CHARACTER_ID,
            targetRoomId: 'ROOM#Oubliette',
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
        expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        expect(result).toEqual({ trimmed: true, relocated: false })
    })

    it('publishes Perception on forceRender when in play without relocate', async () => {
        setupTrimPersist(['draftTwo'])
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Oubliette'])

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
        expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
    })
})
