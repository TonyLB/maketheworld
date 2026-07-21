/**
 * Regression: affordance topology slice from getRoomExitTargetsForCharacter preserves duplicate
 * labels to different rooms, feeding ambiguousMatch resolution (D5, D34).
 */
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

import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import internalCache from '../../internalCache'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { discriminateIntent } from './discriminateIntent'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'

const characterId = 'CHARACTER#Nav' as EphemeraCharacterId
const roomId = 'ROOM#Start' as EphemeraRoomId
const perspectiveKey = 'PERSPECTIVE#test'
const perspective = { assetStack: ['ASSET#base'] as AssetUUID[] }

const resolvePerspectiveMock = resolveCharacterRoomPerspectiveForRoom as jest.MockedFunction<
    typeof resolveCharacterRoomPerspectiveForRoom
>
const getAffordanceRowMock = internalCache.AffordanceCache.getAffordanceRow as jest.Mock
const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.Mock

describe('room exit ambiguousMatch regression (topology slice -> discriminateIntent)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ensureAffordanceTopology as jest.Mock).mockResolvedValue(undefined)
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
    })

    it('maps duplicate topology exit labels through nav slice: deterministic exit resolution still detects the ambiguity, falls through to classify (iteration 7, Sub-iteration 1: classify no longer re-resolves NavigationIntent, so the specific ambiguousMatch error is an accepted regression until Sub-iteration 2 --- deterministicChecks.ts and exitResolution.ts, which compute the ambiguity, are unchanged and untouched by this test)', async () => {
        const exitContext = await getRoomExitTargetsForCharacter(characterId)

        expect(exitContext.exits).toEqual([
            { normalizedName: 'north', toRoomId: 'ROOM#NorthA' },
            { normalizedName: 'north', toRoomId: 'ROOM#NorthB' },
        ])

        const result = await discriminateIntent(
            {
                command: 'go north',
                roomExits: exitContext.exits.map(({ normalizedName, toRoomId }) => ({
                    normalizedName,
                    targetId: toRoomId,
                })),
            },
            {
                invokeBedrockParseCommandImpl: jest.fn().mockResolvedValue({
                    success: true,
                    body: '{"type":"Command","confidence":0.88}',
                }),
            }
        )

        // Deterministic navigation (maybeDeterministicNavigationResult) still detects the
        // ambiguity via resolveExitLabelToTargetId and falls through (returns null) rather than
        // guessing -- unchanged. What changed: classify no longer emits NavigationIntent for
        // classify to re-resolve into a specific ambiguousMatch Error, so an ambiguous exact exit
        // name now reaches Command -> Parse -> classifySkeletonFamily, which finds neither a
        // membership nor relational shape and terminalizes as Unimplemented.
        expect(result.type).not.toBe('Navigation')
    })
})
