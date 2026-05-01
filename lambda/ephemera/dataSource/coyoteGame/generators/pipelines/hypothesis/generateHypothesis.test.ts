jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisPlanSelection: jest.fn(),
        invokeBedrockHypothesisNarrativeBeat: jest.fn(),
    }
})

import { generateHypothesis, generateHypothesisWithStageResults } from './generateHypothesis'
import { harnessRoomObjects } from '../../testHarness/coyoteEngineTestFixtures'
import {
    invokeBedrockHypothesisNarrativeBeat,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
} from './invokeBedrockHypothesis'

/** Valid stage-1 JSON for two objects in ROOM#VORTEX (seam label CLIFFBASE) with stableKeys matching mocks (parse + combine succeed). */
const stageOneSeamBody = JSON.stringify({
    candidates: [
        {
            candidateId: 'candidate-1',
            executionSummary: 'Birdseed lure then terminal drop.',
            tropeAssignments: {
                Bait: {
                    executionDetail: 'Road Runner stops for birdseed in the lane.',
                    members: [{ stableKey: 'birdseed-0', tropeFunction: 'lane bait' }],
                },
                'Finishing Move': {
                    executionDetail: 'Anvil drop is timed for the committed lane.',
                    members: [{ stableKey: 'anvil', tropeFunction: 'terminal drop payload' }],
                },
            },
        },
    ],
})

/** Hop 1 --- rubric narrative + trailing ` ```json ` handoff for hop 2. */
const planSelectOutputBody = [
    '## Intent conflicts',
    '- candidate-1 may misread intent: launch timing needs tighter trigger specificity.',
    '',
    '## Rubric comparison',
    '- candidate-1 wins on coverage/completeness/coherence balance.',
    '',
    '## Winner selection',
    '- Winner: candidate-1.',
    '',
    '```json',
    '{"paragraphSummary":"Stage the anvil and lure the Road Runner underneath.","planIssues":[{"code":"DIRECTION_AMBIGUOUS","summary":"needs rope timing"}]}',
    '```',
].join('\n')

/** Minimal phase-plan JSON validating against ROOM#VORTEX snapshot (seam label CLIFFBASE; stableKey **anvil**). */
function narrativeBeatModelBody(intentLine: string, options?: { includeSceneAnalysis?: boolean }): string {
    const phasePlan = {
        tropeSequence: ['Contraption'],
        deconflictionSummary: 'Single-lane setup avoids conflicting prop reuse.',
        phases: [
            {
                trope: 'Contraption',
                tropeBeat: 'Rig the anvil drop lane and commit trigger timing.',
                stableKeysUsed: ['anvil'],
                virtualEntities: [
                    {
                        label: 'Position bait',
                        derivedFrom: ['anvil'],
                        phaseKind: 'gathered' as const,
                    },
                ],
                achievement: 'Trap staged',
            },
        ],
    }
    const blocks = [
        '```json',
        JSON.stringify(phasePlan),
        '```',
    ]
    if (options?.includeSceneAnalysis) {
        blocks.push('', '## Scene analysis', 'Trap setup.', '')
    }
    blocks.push('```text', intentLine, '```')
    return blocks.join('\n')
}

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const planSelectionMock = invokeBedrockHypothesisPlanSelection as jest.MockedFunction<
    typeof invokeBedrockHypothesisPlanSelection
>
const narrativeBeatMock = invokeBedrockHypothesisNarrativeBeat as jest.MockedFunction<
    typeof invokeBedrockHypothesisNarrativeBeat
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
                            tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'drop zone' }],
                        },
                        {
                            uuid: 'OBJECT#birdseed' as `OBJECT#${string}`,
                            shortName: 'birdseed',
                            stableKey: 'birdseed-0',
                            tropeAffinities: [{ trope: 'Bait', aptness: 'High', narrowing: 'lane lure' }],
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
        planSelectionMock.mockResolvedValue({
            success: true,
            body: planSelectOutputBody,
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        narrativeBeatMock.mockResolvedValue({
            success: true,
            body: narrativeBeatModelBody('Hypothesis: You are trying to drop something on the Road Runner.'),
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
    })

    it('returns phase-plan hop model output when all stages succeed', async () => {
        const record = await generateHypothesis({ getGameRooms, getRoomMeta })
        expect(record.intent).toBe('Hypothesis: You are trying to drop something on the Road Runner.')
        expect(record.phasePlan?.phases).toHaveLength(1)
        expect(record.walkthrough).toBeUndefined()
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
    })

    it('passes tropeFunction rendering into phase-plan hop prompt', async () => {
        await generateHypothesis({ getGameRooms, getRoomMeta })
        const narrativeBeatPrompt = narrativeBeatMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullHop2 = narrativeBeatPrompt.invariantPrefix + narrativeBeatPrompt.dynamicSuffix
        expect(fullHop2).toContain('**tropeFunction:** lane bait')
    })

    it('parses phase-plan hop body with ## Scene analysis + fenced Hypothesis', async () => {
        narrativeBeatMock.mockResolvedValue({
            success: true,
            body: narrativeBeatModelBody(
                'Hypothesis: You are trying to drop something on the Road Runner.',
                { includeSceneAnalysis: true }
            ),
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toMatchObject({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
            walkthrough: '## Scene analysis\nTrap setup.',
        })
    })

    it('exposes narrativeBeatReasoningContent on pipeline result when narrative beat returns reasoning', async () => {
        narrativeBeatMock.mockResolvedValue({
            success: true,
            body: narrativeBeatModelBody('Hypothesis: With reasoning channel.'),
            reasoningContent: 'plan ordering scratch',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        const result = await generateHypothesisWithStageResults({ getGameRooms, getRoomMeta })
        expect(result.kind).toBe('full')
        if (result.kind !== 'full') {
            return
        }
        expect(result.record.intent).toBe('Hypothesis: With reasoning channel.')
        expect(result.stageOneResult).toEqual(expect.objectContaining({ success: true }))
        expect(result.planSelectionResult).toEqual(expect.objectContaining({ success: true }))
        expect(result.narrativeBeatResult).toEqual(
            expect.objectContaining({
                success: true,
                reasoningContent: 'plan ordering scratch',
            })
        )
        expect(result.narrativeBeatReasoningContent).toBe('plan ordering scratch')
        expect(typeof result.selectionBody).toBe('string')
        expect(typeof result.phasePlanJson).toBe('string')
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
            candidates: [
                {
                    candidateId: 'candidate-1',
                    executionSummary: 'Multi-room setup.',
                    tropeAssignments: {
                        Contraption: {
                            executionDetail: 'Setup spans rooms before final beat.',
                            members: [
                                { stableKey: 'anvil-0', tropeFunction: 'anchor payload rig' },
                                { stableKey: 'portable-hole-0', tropeFunction: 'route shaping trap surface' },
                                { stableKey: 'birdseed-1', tropeFunction: 'bait cue for lane commitment' },
                            ],
                        },
                    },
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
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
        const narrativeBeatPrompt = narrativeBeatMock.mock.calls[0][0] as {
            invariantPrefix: string
            dynamicSuffix: string
        }
        const fullHop2 = narrativeBeatPrompt.invariantPrefix + narrativeBeatPrompt.dynamicSuffix
        expect(fullHop2).toContain('## Combined clustering')
        expect(fullHop2).toContain('anvil')
        expect(fullHop2).toContain('portable hole')
        expect(fullHop2).toContain('birdseed')
        expect(fullHop2).not.toContain('## Current staged objects by room')
    })

    it('falls back to stub when stage 1 Bedrock fails', async () => {
        stageOneMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when stage 1 seam parse fails', async () => {
        stageOneMock.mockResolvedValue({
            success: true,
            body: 'not valid stage 1 JSON',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when plan-selection Bedrock fails', async () => {
        planSelectionMock.mockResolvedValue({
            success: false,
            errorMessage: 'Timeout',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('falls back to stub when planSelect output JSON parse fails', async () => {
        planSelectionMock.mockResolvedValue({
            success: true,
            body: 'No json fence here.',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('continues when planSelect rubric markdown section is missing but output JSON is valid', async () => {
        planSelectionMock.mockResolvedValue({
            success: true,
            body: [
                '## Intent conflicts',
                '- candidate-1 intent gap',
                '',
                '## Winner selection',
                '- Winner: candidate-1.',
                '',
                '```json',
                '{"paragraphSummary":"Chosen.","planIssues":[{"code":"ROLE_CONFLICT","summary":"missing role handoff"}]}',
                '```',
            ].join('\n'),
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: You are trying to drop something on the Road Runner.',
            phasePlan: {
                tropeSequence: ['Contraption'],
                deconflictionSummary: 'Single-lane setup avoids conflicting prop reuse.',
                phases: [
                    {
                        trope: 'Contraption',
                        tropeBeat: 'Rig the anvil drop lane and commit trigger timing.',
                        stableKeysUsed: ['anvil'],
                        virtualEntities: [
                            {
                                label: 'Position bait',
                                derivedFrom: ['anvil'],
                                phaseKind: 'gathered',
                            },
                        ],
                        achievement: 'Trap staged',
                    },
                ],
            },
        })
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
    })

    it('falls back to stub when phase-plan hop Bedrock fails', async () => {
        narrativeBeatMock.mockResolvedValue({
            success: false,
            errorMessage: 'Timeout',
        })

        await expect(generateHypothesis({ getGameRooms, getRoomMeta })).resolves.toEqual({
            intent: 'Hypothesis: Stubbed',
        })
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
    })

    it('keeps prose when phase-plan JSON is invalid but Hypothesis parses', async () => {
        narrativeBeatMock.mockResolvedValue({
            success: true,
            body: [
                '```json',
                '{"tropeSequence":["Contraption"],"deconflictionSummary":"x","phases":[]}',
                '```',
                '',
                '```text',
                'Hypothesis: Prose still works.',
                '```',
            ].join('\n'),
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        const record = await generateHypothesis({ getGameRooms, getRoomMeta })
        expect(record.intent).toBe('Hypothesis: Prose still works.')
        expect(record.phasePlan).toBeUndefined()
    })
})
