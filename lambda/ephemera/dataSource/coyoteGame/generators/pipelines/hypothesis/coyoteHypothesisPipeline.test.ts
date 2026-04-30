jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisPlanSelection: jest.fn(),
        invokeBedrockHypothesisPhasePlanHop: jest.fn(),
    }
})

import { COYOTE_ENGINE_TEST_FIXTURES } from '../../testHarness/coyoteEngineTestFixtures'
import {
    invokeBedrockHypothesisPhasePlanHop,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
} from './invokeBedrockHypothesis'
import {
    CoyoteHypothesisPipelineAbortError,
    mapPipelineRunToGenerateHypothesisResult,
    runCoyoteHypothesisPipeline,
    validateCoyoteHypothesisHarnessOptions,
} from './coyoteHypothesisPipeline'

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const planSelectionMock = invokeBedrockHypothesisPlanSelection as jest.MockedFunction<
    typeof invokeBedrockHypothesisPlanSelection
>
const phasePlanHopMock = invokeBedrockHypothesisPhasePlanHop as jest.MockedFunction<
    typeof invokeBedrockHypothesisPhasePlanHop
>

/** Valid stage-1 JSON for parse + combine (matches generateHypothesis.test harness). */
const stageOneSeamBody = JSON.stringify({
    candidates: [
        {
            candidateId: 'candidate-1',
            executionSummary: 'Lure then strike across the straightaway lane.',
            tropeAssignments: [
                {
                    trope: 'Distraction',
                    executionDetail: 'Road Runner is guided into the strike lane first.',
                    members: [{ stableKey: 'rocket-skates', tropeFunction: 'speed lure setup prop' }],
                },
                {
                    trope: 'Finishing Move',
                    executionDetail: 'Anvil lands after the lane setup commits the target route.',
                    members: [{ stableKey: 'anvil', tropeFunction: 'terminal drop payload' }],
                },
            ],
        },
    ],
})

const hop1PlanSelectionBody = [
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
    '{"paragraphSummary":"Stage the anvil.","planIssues":[{"code":"DIRECTION_AMBIGUOUS","summary":"timing is coarse"}]}',
    '```',
].join('\n')

describe('mapPipelineRunToGenerateHypothesisResult', () => {
    it('maps abort failure with stage results to stub pipeline result', () => {
        const result = mapPipelineRunToGenerateHypothesisResult({
            ok: false,
            state: {
                stageOneResult: { success: false, errorMessage: 'Throttled' },
                planSelectionResult: null,
                phasePlanHopResult: null,
            },
            failedStepName: 'hypothesisStageOneLlm',
            failedStepIndex: 1,
            error: new CoyoteHypothesisPipelineAbortError(),
        })
        expect(result).toEqual({
            kind: 'stub',
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult: { success: false, errorMessage: 'Throttled' },
            planSelectionResult: null,
            phasePlanHopResult: null,
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
                phasePlanHopResult: {
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
            phasePlanHopResult: expect.objectContaining({ success: true }),
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
            { harness: { testOnly: 'clustering', harnessRunKind: 'runUntil' } }
        )
        expect(result.kind).toBe('harnessPartial')
        if (result.kind === 'harnessPartial') {
            expect(result.testOnly).toBe('clustering')
            expect(result.harnessRunKind).toBe('runUntil')
            expect(result.record.intent).toBe('Hypothesis: Stubbed')
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
                            uuid: 'OBJECT#rocket-skates' as `OBJECT#${string}`,
                            shortName: 'rocket skates',
                            stableKey: 'rocket-skates',
                            tropeAffinities: [
                                {
                                    trope: 'Contraption',
                                    aptness: 'High',
                                    narrowing: 'mobility',
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
            body: hop1PlanSelectionBody,
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        phasePlanHopMock.mockResolvedValue({
            success: true,
            body: '```text\nHypothesis: Done.\n```',
            usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        })
    })

    it('runUntil clustering invokes only stage-one Bedrock', async () => {
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta },
            { testOnly: 'clustering', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        const promptArg = stageOneMock.mock.calls[0][0]
        expect(promptArg.dynamicSuffix).toContain('"tropeAffinities"')
        expect(promptArg.dynamicSuffix).toContain('"environmentAffordances"')
        expect(promptArg.dynamicSuffix).toContain('"object": "long-fall"')
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(phasePlanHopMock).not.toHaveBeenCalled()
    })

    it('runUntil planSelect invokes stage one and plan selection only', async () => {
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta },
            { testOnly: 'planSelect', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(phasePlanHopMock).not.toHaveBeenCalled()
    })

    it('returns stub when plan-selection response misses required rubric section', async () => {
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
                '{"paragraphSummary":"Stage the anvil.","planIssues":[{"code":"DIRECTION_AMBIGUOUS","summary":"timing is coarse"}]}',
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const result = await runCoyoteHypothesisPipeline(
            { getGameRooms, getRoomMeta }
        )
        expect(result.kind).toBe('stub')
        expect(phasePlanHopMock).not.toHaveBeenCalled()
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
        expect(phasePlanHopMock).not.toHaveBeenCalled()
        if (result.kind === 'harnessPartial') {
            expect(result.planSelectionResult?.success).toBe(true)
        }
    })

    it('runOnly phasePlan uses inject and skips stage-one/plan-selection LLMs', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.phasePlanInject).toBeDefined()
        const inject = fixture01!.phasePlanInject!

        const result = await runCoyoteHypothesisPipeline(
            {
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
            },
            {
                testOnly: 'phasePlan',
                harnessRunKind: 'runOnly',
                injectState: {
                    roomObjectsByRoom: inject.roomObjectsByRoom,
                    combined: inject.combined,
                    hop1Handoff: inject.hop1Handoff,
                },
            }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).not.toHaveBeenCalled()
        expect(planSelectionMock).not.toHaveBeenCalled()
        expect(phasePlanHopMock).toHaveBeenCalledTimes(1)
        if (result.kind === 'harnessPartial') {
            expect(result.phasePlanHopResult?.success).toBe(true)
        }
    })
})
