jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: {
            get: jest.fn(),
        },
        AffordanceCache: {
            getAffordanceRow: jest.fn(),
        },
        Positions: {
            getMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../affordanceCache/ensureAffordanceTopology', () => ({
    ensureAffordanceTopology: jest.fn(),
}))

jest.mock('../perception/kickRoomHeaderBroadcast', () => ({
    resolveCharacterRoomPerspectiveForRoom: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import internalCache from '../../internalCache'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import {
    getRoomExitTargetsForCharacter,
    normalizeExitName,
} from './roomExitTargetsForCharacter'

const characterId = 'CHARACTER#Nav' as EphemeraCharacterId
const roomId = 'ROOM#Start' as EphemeraRoomId
const perspectiveKey = 'PERSPECTIVE#test'
const perspective = { assetStack: ['ASSET#base'] as AssetUUID[] }

const ensureMock = ensureAffordanceTopology as jest.MockedFunction<typeof ensureAffordanceTopology>
const resolvePerspectiveMock = resolveCharacterRoomPerspectiveForRoom as jest.MockedFunction<
    typeof resolveCharacterRoomPerspectiveForRoom
>
const getAffordanceRowMock = internalCache.AffordanceCache.getAffordanceRow as jest.Mock
const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.Mock

describe('normalizeExitName', () => {
    it('trims, lowercases, and collapses whitespace', () => {
        expect(normalizeExitName('  North   Door  ')).toBe('north door')
    })
})

describe('getRoomExitTargetsForCharacter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ensureMock.mockResolvedValue(undefined)
    })

    it('returns empty result when character has no room', async () => {
        getMembershipContainersMock.mockResolvedValue([])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            assets: [],
        } as any)

        const result = await getRoomExitTargetsForCharacter(characterId)

        expect(result).toEqual({ fromRoomId: null, toRoomIds: [], exits: [] })
        expect(resolvePerspectiveMock).not.toHaveBeenCalled()
        expect(ensureMock).not.toHaveBeenCalled()
    })

    it('returns empty exits when filtered perspective is empty', async () => {
        getMembershipContainersMock.mockResolvedValue([roomId])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            assets: [],
        } as any)
        resolvePerspectiveMock.mockResolvedValue(null)

        const result = await getRoomExitTargetsForCharacter(characterId)

        expect(result).toEqual({ fromRoomId: roomId, toRoomIds: [], exits: [] })
        expect(ensureMock).not.toHaveBeenCalled()
    })

    it('hydrates topology and maps projected exits for navigation', async () => {
        getMembershipContainersMock.mockResolvedValue([roomId])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            assets: ['ASSET#personal'],
        } as any)
        resolvePerspectiveMock.mockResolvedValue({ perspective, perspectiveKey })
        getAffordanceRowMock.mockResolvedValue(
            createAffordanceCacheRow({
                roomId,
                perspectiveKey,
                assetStack: ['ASSET#base'],
                catalogVersion: 1,
                hydratedCatalogVersion: 1,
                topology: {
                    roomUniversalKey: roomId,
                    exits: [
                        {
                            reference: { tag: 'Room', universalKey: 'ROOM#East' },
                            payload: 'East   Stair',
                        },
                        {
                            reference: { tag: 'Room', universalKey: 'ROOM#West' },
                            payload: 'West Door',
                        },
                    ],
                },
            })
        )

        const result = await getRoomExitTargetsForCharacter(characterId)

        expect(ensureMock).toHaveBeenCalledWith({ roomId, perspective })
        expect(getAffordanceRowMock).toHaveBeenCalledWith(roomId, perspectiveKey)
        expect(result.fromRoomId).toBe(roomId)
        expect(result.exits).toEqual([
            { normalizedName: 'east stair', toRoomId: 'ROOM#East' },
            { normalizedName: 'west door', toRoomId: 'ROOM#West' },
        ])
        expect(result.toRoomIds).toEqual(['ROOM#East', 'ROOM#West'])
    })

    it('throws when affordance row is missing after ensure', async () => {
        getMembershipContainersMock.mockResolvedValue([roomId])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            assets: ['ASSET#personal'],
        } as any)
        resolvePerspectiveMock.mockResolvedValue({ perspective, perspectiveKey })
        getAffordanceRowMock.mockResolvedValue(undefined)

        await expect(getRoomExitTargetsForCharacter(characterId)).rejects.toThrow(
            `AFFORDANCE_TOPOLOGY_NOT_READY: ${roomId} at ${perspectiveKey}`
        )
    })

    it('preserves duplicate exit labels to different rooms for ambiguousMatch resolution', async () => {
        getMembershipContainersMock.mockResolvedValue([roomId])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: characterId,
            assets: ['ASSET#personal'],
        } as any)
        resolvePerspectiveMock.mockResolvedValue({ perspective, perspectiveKey })
        getAffordanceRowMock.mockResolvedValue(
            createAffordanceCacheRow({
                roomId,
                perspectiveKey,
                assetStack: ['ASSET#base'],
                catalogVersion: 1,
                hydratedCatalogVersion: 1,
                topology: {
                    roomUniversalKey: roomId,
                    exits: [
                        {
                            reference: { tag: 'Room', universalKey: 'ROOM#NorthA' },
                            payload: 'north',
                        },
                        {
                            reference: { tag: 'Room', universalKey: 'ROOM#NorthB' },
                            payload: 'north',
                        },
                    ],
                },
            })
        )

        const result = await getRoomExitTargetsForCharacter(characterId)

        expect(result.exits).toEqual([
            { normalizedName: 'north', toRoomId: 'ROOM#NorthA' },
            { normalizedName: 'north', toRoomId: 'ROOM#NorthB' },
        ])
        expect(result.toRoomIds).toEqual(['ROOM#NorthA', 'ROOM#NorthB'])
    })
})
