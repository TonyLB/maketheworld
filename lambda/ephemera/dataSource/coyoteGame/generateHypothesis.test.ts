jest.mock('./invokeBedrockHypothesis', () => ({
    __esModule: true,
    invokeBedrockHypothesis: jest.fn(),
}))

import { generateHypothesis } from './generateHypothesis'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

const invokeBedrockHypothesisMock = invokeBedrockHypothesis as jest.MockedFunction<typeof invokeBedrockHypothesis>

describe('generateHypothesis', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()
    const getRoomMeta = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        getRoomMeta.mockImplementation(async (roomId: string) => {
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
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: true,
            body: 'Hypothesis: You are trying to drop something on the Road Runner.',
        })
    })

    it('returns model output when Bedrock succeeds', async () => {
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual(
            'Hypothesis: You are trying to drop something on the Road Runner.'
        )
    })

    it('fetches room-local objects for all Coyote Game rooms', async () => {
        await generateHypothesis({ getGameRooms, getRoomMeta })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(getRoomMeta).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX')
        expect(getRoomMeta).toHaveBeenNthCalledWith(2, 'ROOM#STRAIGHTAWAY')
    })

    it('falls back to stub output when Bedrock fails', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual('Hypothesis: Stubbed')
    })
})
