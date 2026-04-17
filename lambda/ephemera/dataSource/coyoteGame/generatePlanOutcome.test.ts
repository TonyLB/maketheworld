jest.mock('./invokeBedrockHypothesis', () => ({
    __esModule: true,
    invokeBedrockHypothesis: jest.fn(),
}))

import { generatePlanOutcome } from './generatePlanOutcome'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

const invokeBedrockHypothesisMock = invokeBedrockHypothesis as jest.MockedFunction<typeof invokeBedrockHypothesis>

describe('generatePlanOutcome', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()
    const getRoomMeta = jest.fn()
    const getIntent = jest.fn<Promise<string>, []>()

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        getRoomMeta.mockImplementation(async (roomId: string) => {
            if (roomId === 'ROOM#VORTEX') {
                return {
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room',
                    objects: [{ uuid: 'OBJECT#anvil', shortName: 'anvil' }],
                }
            }
            return {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                objects: [],
            }
        })
        getIntent.mockResolvedValue('Hypothesis: It looks like you are trying to drop the anvil.')
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: true,
            body: 'Outcome: The anvil drops on your own foot while the Road Runner speeds past, unbothered.',
        })
    })

    it('returns RenderTree from model output when Bedrock succeeds', async () => {
        await expect(
            generatePlanOutcome({ getGameRooms, getRoomMeta, getIntent })
        ).resolves.toEqual([
            'Outcome: The anvil drops on your own foot while the Road Runner speeds past, unbothered.',
        ])
    })

    it('loads staged objects, hypothesis, and passes prompt to Bedrock', async () => {
        await generatePlanOutcome({ getGameRooms, getRoomMeta, getIntent })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getIntent).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(invokeBedrockHypothesisMock).toHaveBeenCalledTimes(1)
        const promptArg = invokeBedrockHypothesisMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullPrompt = promptArg.invariantPrefix + promptArg.dynamicSuffix
        expect(fullPrompt).toContain('VORTEX: anvil')
        expect(fullPrompt).toContain('Hypothesis: It looks like you are trying to drop the anvil.')
        expect(invokeBedrockHypothesisMock.mock.calls[0][1]).toEqual({ maxTokens: 384 })
    })

    it('falls back to stub when Bedrock fails', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generatePlanOutcome({ getGameRooms, getRoomMeta, getIntent })).resolves.toEqual([
            'Outcome: Stubbed',
        ])
    })

    it('falls back to stub when body does not start with Outcome:', async () => {
        invokeBedrockHypothesisMock.mockResolvedValue({
            success: true,
            body: 'The trap fails.',
        })

        await expect(generatePlanOutcome({ getGameRooms, getRoomMeta, getIntent })).resolves.toEqual([
            'Outcome: Stubbed',
        ])
    })
})
