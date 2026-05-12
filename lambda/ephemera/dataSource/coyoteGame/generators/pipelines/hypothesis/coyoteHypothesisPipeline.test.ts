jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisPlanSelection: jest.fn(),
        invokeBedrockHypothesisNarrativeBeat: jest.fn(),
    }
})

import { COYOTE_ENGINE_TEST_FIXTURES } from '../../testHarness/coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import {
    invokeBedrockHypothesisNarrativeBeat,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
} from './invokeBedrockHypothesis'
import {
    CoyoteHypothesisPipelineAbortError,
    mapPipelineRunToGenerateHypothesisResult,
    runCoyoteHypothesisPipeline,
    validateCoyoteHypothesisHarnessOptions,
} from './coyoteHypothesisPipeline'
import { NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE } from './narrativeBeats/buildNarrativeBeatPrompt'

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const planSelectionMock = invokeBedrockHypothesisPlanSelection as jest.MockedFunction<
    typeof invokeBedrockHypothesisPlanSelection
>
const narrativeBeatMock = invokeBedrockHypothesisNarrativeBeat as jest.MockedFunction<
    typeof invokeBedrockHypothesisNarrativeBeat
>

/** Valid stage-1 JSON for parse + combine (matches generateHypothesis.test harness). */
const stageOneSeamBody = JSON.stringify({
    candidates: [
        {
            candidateId: 'candidate-1',
            gimmick: 'deliver damage',
            executionSummary: 'Birdseed lure then terminal drop.',
            tropeAssignments: {
                Bait: {
                    executionDetail: 'Road Runner stops for birdseed in the lane.',
                    members: [{ stableKey: 'birdseed-0', tropeFunction: 'lane bait' }],
                },
                'Finishing Move': {
                    executionDetail: 'Anvil lands after the lane setup commits the target route.',
                    members: [{ stableKey: 'anvil', tropeFunction: 'terminal drop payload' }],
                },
            },
        },
    ],
})

const PLAN_SELECT_SELECTED_CANDIDATE = {
    candidateId: 'candidate-1',
    gimmick: 'deliver damage',
    executionSummary: 'Birdseed lure then terminal drop.',
    tropeAssignments: {
        Bait: {
            executionDetail: 'Road Runner stops for birdseed in the lane.',
            members: [
                {
                    stableKey: 'birdseed-0',
                    shortName: 'birdseed',
                    room: 'CLIFFBASE',
                    tropeFunction: 'lane bait',
                },
            ],
        },
        'Finishing Move': {
            executionDetail: 'Anvil lands after the lane setup commits the target route.',
            members: [
                {
                    stableKey: 'anvil',
                    shortName: 'anvil',
                    room: 'CLIFFBASE',
                    tropeFunction: 'terminal drop payload',
                },
            ],
        },
    },
    outliers: [] as const,
}

/** Winner id not in combine pool; no gimmick --- narrative hop still runs (graceful degradation). */
const PLAN_SELECT_SELECTED_CANDIDATE_NO_CANONICAL_MERGE = {
    candidateId: 'candidate-unknown',
    executionSummary: 'Birdseed lure then terminal drop.',
    tropeAssignments: PLAN_SELECT_SELECTED_CANDIDATE.tropeAssignments,
    outliers: [] as const,
}

const planSelectOutputBody = [
    '## Intent conflicts',
    '- candidate-1 may misread intent: trigger timing remains coarse.',
    '',
    '## Rubric comparison',
    '- candidate-1 has best coverage/coherence for available props.',
    '',
    '## Winner selection',
    '- Winner: candidate-1.',
    '',
    '```json',
    JSON.stringify({
        paragraphSummary: 'Stage the anvil.',
        planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
        selectedCandidate: PLAN_SELECT_SELECTED_CANDIDATE,
    }),
    '```',
].join('\n')

describe('mapPipelineRunToGenerateHypothesisResult', () => {
    it('maps abort failure with stage results to stub pipeline result', () => {
        const result = mapPipelineRunToGenerateHypothesisResult({
            ok: false,
            state: {
                stageOneResult: { success: false, errorMessage: 'Throttled' },
                planSelectionResult: null,
                narrativeBeatResult: null,
            },
            failedStepName: 'hypothesisCandidatesLlm',
            failedStepIndex: 1,
            error: new CoyoteHypothesisPipelineAbortError(),
        })
        expect(result).toEqual({
            kind: 'stub',
            record: { intent: 'Hypothesis: Something went wrong' },
            stageOneResult: { success: false, errorMessage: 'Throttled' },
            planSelectionResult: null,
            narrativeBeatResult: null,
        })
    })

    it('rethrows when failure is not an intentional abort', () => {
        expect(() =>
            mapPipelineRunToGenerateHypothesisResult({
                ok: false,
                state: {},
                failedStepName: 'loadRoomObjects',
                failedStepIndex: 0,
                error: new Error('network'),
            })
        ).toThrow('network')
    })

    it('maps successful run state to full pipeline result', () => {
        const result = mapPipelineRunToGenerateHypothesisResult({
            ok: true,
            state: {
                stageOneResult: {
                    success: true,
                    body: '{}',
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                planSelectionResult: {
                    success: true,
                    body: '{"paragraphSummary":"x","planIssues":[{"code":"ROLE_CONFLICT","summary":"x"}]}',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
                narrativeBeatResult: {
                    success: true,
                    body: 'Hypothesis: Test.',
                    usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
                },
                record: { intent: 'Hypothesis: Test.' },
            },
        })
        expect(result.kind).toBe('full')
        expect(result).toMatchObject({
            record: { intent: 'Hypothesis: Test.' },
            stageOneResult: expect.objectContaining({ success: true }),
            planSelectionResult: expect.objectContaining({ success: true }),
            narrativeBeatResult: expect.objectContaining({ success: true }),
        })
    })

    it('maps harness success context to harnessPartial', () => {
        const result = mapPipelineRunToGenerateHypothesisResult(
            {
                ok: true,
                state: {
                    stageOneResult: {
                        success: true,
                        body: '{}',
                        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                    },
                },
            },
            { harness: { testOnly: 'candidates', harnessRunKind: 'runUntil' } }
        )
        expect(result.kind).toBe('harnessPartial')
        if (result.kind === 'harnessPartial') {
            expect(result.testOnly).toBe('candidates')
            expect(result.harnessRunKind).toBe('runUntil')
            expect(result.record.intent).toBe('Hypothesis: Something went wrong')
            expect(result.stageOneResult?.success).toBe(true)
        }
    })
})

describe('validateCoyoteHypothesisHarnessOptions', () => {
    it('throws when runUntil includes injectState', () => {
        expect(() =>
            validateCoyoteHypothesisHarnessOptions({
                testOnly: 'planSelect',
                harnessRunKind: 'runUntil',
                injectState: { combined: { candidates: [] } },
            })
        ).toThrow('injectState')
    })

    it('throws when runOnly planSelect lacks inject fields', () => {
        expect(() =>
            validateCoyoteHypothesisHarnessOptions({
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                injectState: {},
            })
        ).toThrow('runOnly planSelect')
    })

    it('throws when runOnly narrativeBeats inject omits selectedCandidate', () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.planSelectInject).toBeDefined()
        expect(() =>
            validateCoyoteHypothesisHarnessOptions({
                testOnly: 'narrativeBeats',
                harnessRunKind: 'runOnly',
                injectState: {
                    roomObjectsByRoom: fixture01!.roomObjectsByRoom as CoyoteRoomObjectsByRoom,
                    planSelectOutput: {
                        paragraphSummary: 'x',
                        planIssues: [],
                    },
                },
            })
        ).toThrow('selectedCandidate')
    })
})

describe('runCoyoteHypothesisPipeline harness modes', () => {
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
                            tropeAffinities: [
                                {
                                    trope: 'Bait',
                                    aptness: 'High',
                                    narrowing: 'lane lure',
                                    environmentAffordances: [{ object: 'long-fall', roles: ['Finishing Move'] }],
                                },
                            ],
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
            body: '```text\nHypothesis: Done.\n```',
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
    })

    it('runUntil candidates invokes only stage-one Bedrock', async () => {
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta },
            { testOnly: 'candidates', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        const promptArg = stageOneMock.mock.calls[0][0]
        expect(promptArg.dynamicSuffix).toContain('"tropeAffinities"')
        expect(promptArg.dynamicSuffix).toContain('"environmentAffordances"')
        expect(promptArg.dynamicSuffix).toContain('"object": "long-fall"')
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('runUntil planSelect invokes stage one and plan selection only', async () => {
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta },
            { testOnly: 'planSelect', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('continues full pipeline when plan-selection rubric markdown section is missing but JSON is valid', async () => {
        planSelectionMock.mockResolvedValue({
            success: true,
            body: [
                '## Intent conflicts',
                '- conflict listed',
                '',
                '## Winner selection',
                '- Winner: candidate-1.',
                '',
                '```json',
                JSON.stringify({
                    paragraphSummary: 'Stage the anvil.',
                    planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
                    selectedCandidate: PLAN_SELECT_SELECTED_CANDIDATE,
                }),
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta }
        )
        expect(result.kind).toBe('full')
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
    })

    it('continues to narrative beat when winner candidateId has no combine row and gimmick is absent', async () => {
        planSelectionMock.mockResolvedValue({
            success: true,
            body: [
                '## Intent conflicts',
                '- candidate-unknown may misread intent.',
                '',
                '## Rubric comparison',
                '- candidate-unknown selected.',
                '',
                '## Winner selection',
                '- Winner: candidate-unknown.',
                '',
                '```json',
                JSON.stringify({
                    paragraphSummary: 'Stage the anvil.',
                    planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
                    selectedCandidate: PLAN_SELECT_SELECTED_CANDIDATE_NO_CANONICAL_MERGE,
                }),
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const result = await runCoyoteHypothesisPipeline({ getGameRooms, getRoomMeta })
        expect(result.kind).toBe('full')
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
        const narrativeParts = narrativeBeatMock.mock.calls[0][0]
        const narrativePrompt = narrativeParts.invariantPrefix + narrativeParts.dynamicSuffix
        expect(narrativePrompt).toContain(NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE)
        expect(narrativePrompt).not.toMatch(/- gimmick: deliver damage/)
    })

    it('runOnly planSelect uses inject and skips upstream LLMs', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.planSelectInject).toBeDefined()
        const inject = fixture01!.planSelectInject!

        const result = await runCoyoteHypothesisPipeline(
            {
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
            },
            {
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                injectState: {
                    roomObjectsByRoom: inject.roomObjectsByRoom,
                    combined: inject.combined,
                },
            }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).not.toHaveBeenCalled()
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).not.toHaveBeenCalled()
        if (result.kind === 'harnessPartial') {
            expect(result.planSelectionResult?.success).toBe(true)
        }
    })

    it('runOnly narrativeBeats uses inject and skips stage-one/plan-selection LLMs', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.narrativeBeatsInject).toBeDefined()
        const inject = fixture01!.narrativeBeatsInject!

        const result = await runCoyoteHypothesisPipeline(
            {
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
            },
            {
                testOnly: 'narrativeBeats',
                harnessRunKind: 'runOnly',
                injectState: {
                    roomObjectsByRoom: inject.roomObjectsByRoom,
                    planSelectOutput: inject.planSelectOutput,
                },
            }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).not.toHaveBeenCalled()
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(narrativeBeatMock).toHaveBeenCalledTimes(1)
        if (result.kind === 'harnessPartial') {
            expect(result.narrativeBeatResult?.success).toBe(true)
        }
    })

    it('aborts to stub when plan-select JSON omits selectedCandidate', async () => {
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
                JSON.stringify({
                    paragraphSummary: 'Stage the anvil.',
                    planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
                }),
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const result = await runCoyoteHypothesisPipeline({ getGameRooms, getRoomMeta })
        expect(result.kind).toBe('stub')
        if (result.kind === 'stub') {
            expect(result.record.intent).toBe('Hypothesis: Something went wrong')
        }
        expect(narrativeBeatMock).not.toHaveBeenCalled()
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
    })
})
