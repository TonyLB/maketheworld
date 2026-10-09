import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createEphemeraLudicGraphCacheData } from '../../../../internalCache/ludicGraphCache'

import { getRoomExitTargetsForCharacter } from '../../../actions/roomExitTargetsForCharacter'
import { orchestrateCharacterMove } from '../../navigate/orchestrateCharacterMove'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: null as unknown,
        CharacterMeta: { get: jest.fn() },
        AffordanceCache: { getAffordanceRow: jest.fn() },
    },
}))

jest.mock('../../../affordanceCache/ensureAffordanceTopology', () => ({
    ensureAffordanceTopology: jest.fn(),
}))

jest.mock('../../../perception/kickRoomHeaderBroadcast', () => ({
    resolveCharacterRoomPerspectiveForRoom: jest.fn(),
    getCharacterRoomPerspectiveKey: jest.fn(),
}))

jest.mock('../kernel/commitAndPresentStepSequence', () => ({
    commitAndPresentStepSequence: jest.fn().mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map(), nextPresentationIndex: 0 }),
}))

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: { transactWrite: jest.fn() },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

import internalCache from '../../../../internalCache'
import { resolveCharacterRoomPerspectiveForRoom } from '../../../perception/kickRoomHeaderBroadcast'

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
        internalCache.Positions = createEphemeraLudicGraphCacheData({
            getItem: getItemSpy,
            query: querySpy,
        })

        await getRoomExitTargetsForCharacter(CHARACTER_ID)
        await orchestrateCharacterMove(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_ID, intentKind: 'navigate', messageBus: { publish: jest.fn() } as any, streamEvent: jest.fn() },
            { transactWrite: jest.fn() }
        )

        expect(querySpy).toHaveBeenCalledTimes(1)
        expect(getItemSpy).not.toHaveBeenCalled()
    })
})
