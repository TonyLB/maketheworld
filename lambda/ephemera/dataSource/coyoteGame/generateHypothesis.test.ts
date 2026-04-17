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
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
        })
    })

    it('fetches room-local objects for all Coyote Game rooms', async () => {
        await generateHypothesis({ getGameRooms, getRoomMeta })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(getRoomMeta).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX')
        expect(getRoomMeta).toHaveBeenNthCalledWith(2, 'ROOM#STRAIGHTAWAY')
    })

    it('uses room object override without consulting room meta deps', async () => {
        await generateHypothesis({
            getGameRooms,
            getRoomMeta,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': ['anvil'],
                'ROOM#BRIDGE': ['portable hole', 'birdseed'],
            },
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(invokeBedrockHypothesisMock).toHaveBeenCalledTimes(1)
        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('VORTEX: anvil')
        expect(fullPrompt).toContain('BRIDGE: portable hole, birdseed')
    })

    it('falls back to stub output when Bedrock fails', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
    })
})
