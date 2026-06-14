import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { createPositionsCacheHandler } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import { getRoomExitTargetsForCharacter } from '../../actions/roomExitTargetsForCharacter'
import { updatePositionGraphs } from './updatePositionGraphs'

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
        const querySpy = jest.fn().mockResolvedValue([])
        const getItemSpy = jest.fn().mockResolvedValue({ RoomId: ROOM_ID })
        internalCache.Positions = createPositionsCacheHandler({
            getItem: getItemSpy,
            query: querySpy,
        }) as typeof internalCache.Positions

        await getRoomExitTargetsForCharacter(CHARACTER_ID)
        await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_ID },
            {
                getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
                transactWrite: jest.fn(),
                getCharacterMeta: async () => ({
                    EphemeraId: CHARACTER_ID,
                    Name: 'Shared',
                    RoomId: ROOM_ID,
                    HomeId: ROOM_ID,
                    assets: [],
                    RoomStack: [],
                }),
            }
        )

        expect(querySpy).toHaveBeenCalledTimes(1)
        expect(getItemSpy).toHaveBeenCalledTimes(1)
        expect(getItemSpy).toHaveBeenCalledWith({
            Key: { EphemeraId: CHARACTER_ID, DataCategory: 'Meta::Character' },
            ProjectionFields: ['RoomId'],
        })
    })
})
