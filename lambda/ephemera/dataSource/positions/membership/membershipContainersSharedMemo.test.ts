import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createPositionsCacheHandler } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import { getRoomExitTargetsForCharacter } from '../../actions/roomExitTargetsForCharacter'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: null as unknown,
        CharacterMeta: { get: jest.fn() },
        AffordanceCache: { getAffordanceRow: jest.fn() },
    },
}))

jest.mock('../../affordanceCache/ensureAffordanceTopology', () => ({
    ensureAffordanceTopology: jest.fn(),
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    resolveCharacterRoomPerspectiveForRoom: jest.fn(),
}))

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: { transactWrite: jest.fn() },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

import internalCache from '../../../internalCache'
import { resolveCharacterRoomPerspectiveForRoom } from '../../perception/kickRoomHeaderBroadcast'

const CHARACTER_ID = 'CHARACTER#SharedMemo' as EphemeraCharacterId
const ROOM_ID = 'ROOM#Start' as EphemeraRoomId

describe('membership containers shared memo (slice 1c)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
            EphemeraId: CHARACTER_ID,
            assets: [],
        })
        ;(resolveCharacterRoomPerspectiveForRoom as jest.Mock).mockResolvedValue(null)
    })

    it('reuses reverse memo within invocation when parse and apply both read containers', async () => {
        const querySpy = jest.fn().mockResolvedValue([{
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_ID),
        }])
        const getItemSpy = jest.fn()
        internalCache.Positions = createPositionsCacheHandler({
            getItem: getItemSpy,
            query: querySpy,
        }) as typeof internalCache.Positions

        await getRoomExitTargetsForCharacter(CHARACTER_ID)
        await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_ID },
            {
                messageBus: { publish: jest.fn() } as any,
                streamEvent: jest.fn(),
                getMembershipContainers: async (characterId) => {
                    const containers = await internalCache.Positions.getMembershipContainers(characterId)
                    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
                },
                kernelPersist: { transactWrite: jest.fn() },
            }
        )

        expect(querySpy).toHaveBeenCalledTimes(1)
        expect(getItemSpy).not.toHaveBeenCalled()
    })
})
