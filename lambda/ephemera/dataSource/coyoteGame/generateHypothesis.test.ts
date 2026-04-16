jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: { get: jest.fn() },
        ComponentEphemeraMeta: { get: jest.fn() },
    },
}))

import internalCache from '../../internalCache'
import { generateHypothesis } from './generateHypothesis'

const coyoteGameGetMock = internalCache.CoyoteGame.get as jest.MockedFunction<typeof internalCache.CoyoteGame.get>
const componentMetaGetMock = internalCache.ComponentEphemeraMeta.get as jest.MockedFunction<typeof internalCache.ComponentEphemeraMeta.get>

describe('generateHypothesis', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        coyoteGameGetMock.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        componentMetaGetMock.mockImplementation(async (roomId) => {
            if (roomId === 'ROOM#VORTEX') {
                return {
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room',
                    objects: [
                        { uuid: 'OBJECT#anvil', shortName: 'anvil' },
                        { uuid: 'OBJECT#rocket-skates', shortName: 'rocket skates' },
                    ],
                }
            }
            return {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                objects: [],
            }
        })
    })

    it('returns stub RenderTree', async () => {
        await expect(generateHypothesis()).resolves.toEqual(['Hypothesis: Stubbed'])
    })

    it('fetches room-local objects for all Coyote Game rooms', async () => {
        await generateHypothesis()

        expect(coyoteGameGetMock).toHaveBeenCalledWith('gameRooms')
        expect(componentMetaGetMock).toHaveBeenCalledTimes(2)
        expect(componentMetaGetMock).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX')
        expect(componentMetaGetMock).toHaveBeenNthCalledWith(2, 'ROOM#STRAIGHTAWAY')
    })
})
