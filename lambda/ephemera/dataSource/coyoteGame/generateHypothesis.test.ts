jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisStageTwo: jest.fn(),
    }
})

import { generateHypothesis, generateHypothesisWithStageResults } from './generateHypothesis'
import { harnessRoomObjects } from './coyoteEngineTestFixtures'
import {
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
} from './invokeBedrockHypothesis'

/** Valid stage-1 JSON for two VORTEX objects with stableKeys matching mocks (parse + combine succeed). */
const stageOneSeamBody = JSON.stringify({
    clusters: [
        {
            clusterName: 'Combined setup',
            members: [
                { stableKey: 'anvil', intendedRole: { role: 'terminal', aptness: 0.5 } },
                { stableKey: 'rocket-skates', intendedRole: { role: 'delivery', aptness: 0.6 } },
            ],
        },
    ],
})

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const stageTwoMock = invokeBedrockHypothesisStageTwo as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageTwo
>

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
                        {
                            uuid: 'OBJECT#anvil' as `OBJECT#${string}`,
                            shortName: 'anvil',
                            stableKey: 'anvil',
                            affinities: [{ role: 'terminal', aptness: 0.5 }],
                        },
                        {
                            uuid: 'OBJECT#rocket-skates' as `OBJECT#${string}`,
                            shortName: 'rocket skates',
                            stableKey: 'rocket-skates',
                            affinities: [{ role: 'delivery', aptness: 0.6 }],
                        },
                    ],
                }
            }
            return {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                objects: [],
            }
        })
        stageOneMock.mockResolvedValue({
            success: true,
            body: stageOneSeamBody,
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        stageTwoMock.mockResolvedValue({
            success: true,
            body: 'Hypothesis: You are trying to drop something on the Road Runner.',
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
    })

    it('returns stage-2 model output when both stages succeed', async () => {
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
        })
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
    })

    it('parses stage-2 body with ## Scene analysis + fenced Hypothesis', async () => {
        stageTwoMock.mockResolvedValue({
            success: true,
            body: '## Scene analysis\nTrap setup.\n\n```text\nHypothesis: You are trying to drop something on the Road Runner.\n```',
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
            sceneAnalysis: '## Scene analysis\nTrap setup.',
        })
    })

    it('exposes stageTwoReasoningContent on pipeline result when Stage Two returns reasoning', async () => {
        stageTwoMock.mockResolvedValue({
            success: true,
            body: 'Hypothesis: With reasoning channel.',
            reasoningContent: 'plan ordering scratch',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        await expect(generateHypothesisWithStageResults({ getGameRooms, getRoomMeta })).resolves.toEqual({
            record: { intent: 'Hypothesis: With reasoning channel.' },
            stageOneResult: expect.objectContaining({ success: true }),
            stageTwoResult: expect.objectContaining({
                success: true,
                reasoningContent: 'plan ordering scratch',
            }),
            stageTwoReasoningContent: 'plan ordering scratch',
        })
    })

    it('fetches room-local objects for all Coyote Game rooms when not overridden', async () => {
        await generateHypothesis({ getGameRooms, getRoomMeta })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(getRoomMeta).toHaveBeenCalledTimes(2)
        expect(getRoomMeta).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX')
        expect(getRoomMeta).toHaveBeenNthCalledWith(2, 'ROOM#STRAIGHTAWAY')
    })

    it('uses room object override without consulting room meta deps', async () => {
        const overrideSeam = JSON.stringify({
            clusters: [
                {
                    clusterName: 'Multi-room',
                    members: [
                        { stableKey: 'anvil-0' },
                        { stableKey: 'portable-hole-0' },
                        { stableKey: 'birdseed-1' },
                    ],
                },
            ],
        })
        stageOneMock.mockResolvedValue({ success: true, body: overrideSeam })

        await generateHypothesis({
            getGameRooms,
            getRoomMeta,
            roomObjectsByRoomOverride: {
                'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                'ROOM#BRIDGE': harnessRoomObjects('bridge', ['portable hole', 'birdseed']),
            },
        })

        expect(getGameRooms).not.toHaveBeenCalled()
        expect(getRoomMeta).not.toHaveBeenCalled()
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
        const stageTwoPrompt = stageTwoMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullStageTwo = stageTwoPrompt.invariantPrefix + stageTwoPrompt.dynamicSuffix
        expect(fullStageTwo).toContain('## Combined clustering')
        expect(fullStageTwo).toContain('anvil')
        expect(fullStageTwo).toContain('portable hole')
        expect(fullStageTwo).toContain('birdseed')
        expect(fullStageTwo).not.toContain('## Current staged objects by room')
    })

    it('falls back to stub when stage 1 Bedrock fails', async () => {
        stageOneMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when stage 1 seam parse fails', async () => {
        stageOneMock.mockResolvedValue({
            success: true,
            body: 'not valid stage 1 JSON',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when stage 2 Bedrock fails', async () => {
        stageTwoMock.mockResolvedValue({
            success: false,
            errorMessage: 'Timeout',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(stageTwoMock).toHaveBeenCalledTimes(1)
    })
})
