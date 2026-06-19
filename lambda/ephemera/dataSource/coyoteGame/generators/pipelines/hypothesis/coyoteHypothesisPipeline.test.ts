jest.mock('./invokeBedrockHypothesis', () => {
    const actual = jest.requireActual('./invokeBedrockHypothesis')
    return {
        ...actual,
        invokeBedrockHypothesisStageOne: jest.fn(),
        invokeBedrockHypothesisPlanSelection: jest.fn(),
        invokeBedrockHypothesisNarrativeBeat: jest.fn(),
    }
})

jest.mock('../../../../apiEphemera', () => ({
    sendPutThinkingJobCreate: jest.fn(),
    sendPutThinkingSchedule: jest.fn(),
    sendPutThinkingJobError: jest.fn(),
}))

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('@tonylb/mtw-gateways/ts/ephemera/thinking', () => {
    const actual = jest.requireActual('@tonylb/mtw-gateways/ts/ephemera/thinking')
    return {
        ...actual,
        thinkingDeleteAtFromTerminalIso: jest.fn(() => 1735689600),
    }
})
jest.mock('../../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingResults: {
            invalidate: jest.fn(),
        },
    },
}))

import {
    THINKING_RESULT_HEADER_TYPE,
    isThinkingResultEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import * as apiEphemera from '../../../../apiEphemera'
import internalCache from '../../../../../internalCache'
import { ephemeraThinkingResultsDataSource } from '../../../../thinking/results/index'
import type { StreamingEventMessage } from '../../../../../messageBus/baseClasses'
import { EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY } from './hypothesisThinkingPersistence'

import { COYOTE_ENGINE_TEST_FIXTURES } from '../../testHarness/coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import { coyoteSnapshotDepsFromRoomObjects } from './coyoteSnapshotTestHelpers'
import {
    invokeBedrockHypothesisNarrativeBeat,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
} from './invokeBedrockHypothesis'
import {
    mapPipelineRunToGenerateHypothesisResult,
    runCoyoteHypothesisPipeline,
    validateCoyoteHypothesisHarnessOptions,
} from './coyoteHypothesisPipeline'
import { NARRATIVE_BEAT_NO_GIMMICK_HANDOFF_LINE } from './narrativeBeats/buildNarrativeBeatPrompt'

const DEFAULT_PIPELINE_ROOM_OBJECTS = {
    'ROOM#VORTEX': [
        {
            objectId: 'OBJECT#anvil' as `OBJECT#${string}`,
            shortName: 'anvil',
            stableKey: 'anvil',
            tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'drop zone' }],
        },
        {
            objectId: 'OBJECT#birdseed' as `OBJECT#${string}`,
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
    'ROOM#STRAIGHTAWAY': [],
} satisfies Partial<Record<`ROOM#${string}`, CoyoteRoomObjectsByRoom[`ROOM#${string}`]>>

const emptySnapshotDeps = () => coyoteSnapshotDepsFromRoomObjects(async () => [], {})

const stageOneMock = invokeBedrockHypothesisStageOne as jest.MockedFunction<
    typeof invokeBedrockHypothesisStageOne
>
const planSelectionMock = invokeBedrockHypothesisPlanSelection as jest.MockedFunction<
    typeof invokeBedrockHypothesisPlanSelection
>
const narrativeBeatMock = invokeBedrockHypothesisNarrativeBeat as jest.MockedFunction<
    typeof invokeBedrockHypothesisNarrativeBeat
>

const sendPutThinkingJobCreate = apiEphemera.sendPutThinkingJobCreate as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobCreate
>
const sendPutThinkingSchedule = apiEphemera.sendPutThinkingSchedule as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingSchedule
>
const sendPutThinkingJobError = apiEphemera.sendPutThinkingJobError as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobError
>

const mockMessageBus = () => ({
    publish: jest.fn(),
})

const findCoyoteThinkingResultMessages = (publish: jest.Mock): StreamingEventMessage[] =>
    publish.mock.calls
        .map((call) => call[0] as StreamingEventMessage)
        .filter(
            (msg) =>
                msg?.type === 'StreamingEvent' &&
                msg.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY &&
                msg.header?.type === THINKING_RESULT_HEADER_TYPE
        )

const thinkingResultSegmentsFromBus = async (publish: jest.Mock): Promise<string[]> => {
    const segments: string[] = []
    for (const msg of findCoyoteThinkingResultMessages(publish)) {
        const content = await msg.getContent()
        if (isThinkingResultEvent(content)) {
            segments.push(content.segment)
        }
    }
    return segments
}

const thinkingResultsOkFromBus = async (
    publish: jest.Mock
): Promise<Array<{ segment: string; ok: boolean }>> => {
    const results: Array<{ segment: string; ok: boolean }> = []
    for (const msg of findCoyoteThinkingResultMessages(publish)) {
        const content = await msg.getContent()
        if (isThinkingResultEvent(content)) {
            results.push({ segment: content.segment, ok: content.ok })
        }
    }
    return results
}

const schedulePutsByStatus = (status: string) =>
    sendPutThinkingSchedule.mock.calls
        .map((call) => call[2])
        .filter((payload) => payload.scheduleStatus === status)

const expectCompletedSchedulePutsMatchBootstrap = (segments: string[]) => {
    const completed = schedulePutsByStatus('completed')
    expect(completed).toHaveLength(segments.length)
    expect(completed.map((p) => p.segment)).toEqual(segments)
    for (const segment of segments) {
        const scheduled = sendPutThinkingSchedule.mock.calls.find(
            (call) => call[2].segment === segment && call[2].scheduleStatus === 'scheduled'
        )?.[2]
        const done = completed.find((p) => p.segment === segment)
        expect(scheduled).toBeDefined()
        expect(done).toBeDefined()
        expect(done!.generationId).toBe(scheduled!.generationId)
        expect(done!.workItemId).toBe(scheduled!.workItemId)
    }
}

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
            abort: true,
            state: {
                stageOneResult: { success: false, errorMessage: 'Throttled' },
                planSelectionResult: null,
                narrativeBeatResult: null,
            },
            failedStepName: 'hypothesisCandidatesLlm',
            failedStepIndex: 1,
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
                abort: false,
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

describe('runCoyoteHypothesisPipeline thinking bootstrap', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>().mockResolvedValue(['VORTEX'])
    const snapshotDeps = coyoteSnapshotDepsFromRoomObjects(getGameRooms, {})

    beforeEach(() => {
        jest.clearAllMocks()
        stageOneMock.mockResolvedValue({
            success: false,
            errorMessage: 'stop after bootstrap',
        })
    })

    it('bootstraps three segments on full production run', async () => {
        const bus = mockMessageBus()
        await runCoyoteHypothesisPipeline({ ...snapshotDeps, messageBus: bus })
        expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
        expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(3)
        expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(3)
        expect(sendPutThinkingJobCreate.mock.calls[0]).toHaveLength(3)
        expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
    })

    it('bootstraps one segment for runUntil candidates', async () => {
        const bus = mockMessageBus()
        await runCoyoteHypothesisPipeline(
            { ...snapshotDeps, messageBus: bus },
            { testOnly: 'candidates', harnessRunKind: 'runUntil' }
        )
        expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(1)
        expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
    })

    it('bootstraps planSelect only for runOnly planSelect', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.planSelectInject).toBeDefined()
        const inject = fixture01!.planSelectInject!
        planSelectionMock.mockResolvedValue({
            success: true,
            body: planSelectOutputBody,
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const bus = mockMessageBus()
        await runCoyoteHypothesisPipeline(
            {
                ...emptySnapshotDeps(),
                messageBus: bus,
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
        expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(1)
        expect(sendPutThinkingSchedule.mock.calls[0][2].segment).toBe('planSelect')
    })
})

describe('runCoyoteHypothesisPipeline harness modes', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()

    const pipelineDeps = () => ({
        ...coyoteSnapshotDepsFromRoomObjects(getGameRooms, DEFAULT_PIPELINE_ROOM_OBJECTS),
        messageBus: mockMessageBus(),
    })

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
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
            pipelineDeps(),
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
            pipelineDeps(),
            { testOnly: 'planSelect', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')
        expect(stageOneMock).toHaveBeenCalledTimes(1)
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
        expect(narrativeBeatMock).not.toHaveBeenCalled()
    })

    it('emits three Thinking Result events on full successful run', async () => {
        const bus = mockMessageBus()
        const result = await runCoyoteHypothesisPipeline({ ...pipelineDeps(), messageBus: bus })
        expect(result.kind).toBe('full')

        const thinkingMsgs = findCoyoteThinkingResultMessages(bus.publish)
        expect(thinkingMsgs).toHaveLength(3)
        expect(await thinkingResultSegmentsFromBus(bus.publish)).toEqual([
            'candidates',
            'planSelect',
            'narrativeBeats',
        ])

        const candidatesContent = await thinkingMsgs[0].getContent()
        expect(isThinkingResultEvent(candidatesContent)).toBe(true)
        if (isThinkingResultEvent(candidatesContent)) {
            expect(candidatesContent.ok).toBe(true)
            expect(candidatesContent.verbose).toMatchObject({
                combined: expect.objectContaining({ candidates: expect.any(Array) }),
                stageOneBody: stageOneSeamBody,
            })
        }

        expectCompletedSchedulePutsMatchBootstrap(['candidates', 'planSelect', 'narrativeBeats'])
    })

    it('runUntil candidates emits one Thinking Result for candidates only', async () => {
        const bus = mockMessageBus()
        await runCoyoteHypothesisPipeline(
            { ...pipelineDeps(), messageBus: bus },
            { testOnly: 'candidates', harnessRunKind: 'runUntil' }
        )
        expect(findCoyoteThinkingResultMessages(bus.publish)).toHaveLength(1)
        expect(await thinkingResultSegmentsFromBus(bus.publish)).toEqual(['candidates'])
        expectCompletedSchedulePutsMatchBootstrap(['candidates'])
    })

    it('runUntil planSelect emits candidates and planSelect results', async () => {
        const bus = mockMessageBus()
        await runCoyoteHypothesisPipeline(
            { ...pipelineDeps(), messageBus: bus },
            { testOnly: 'planSelect', harnessRunKind: 'runUntil' }
        )
        expect(findCoyoteThinkingResultMessages(bus.publish)).toHaveLength(2)
        expect(await thinkingResultSegmentsFromBus(bus.publish)).toEqual(['candidates', 'planSelect'])
        expectCompletedSchedulePutsMatchBootstrap(['candidates', 'planSelect'])
    })

    it('runOnly planSelect emits planSelect result only', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.planSelectInject).toBeDefined()
        const inject = fixture01!.planSelectInject!
        const bus = mockMessageBus()

        await runCoyoteHypothesisPipeline(
            {
                ...emptySnapshotDeps(),
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
                messageBus: bus,
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
        expect(findCoyoteThinkingResultMessages(bus.publish)).toHaveLength(1)
        expect(await thinkingResultSegmentsFromBus(bus.publish)).toEqual(['planSelect'])
        expectCompletedSchedulePutsMatchBootstrap(['planSelect'])
    })

    it('emits planSelect failure result and job error when plan-select aborts before handoff', async () => {
        planSelectionMock.mockResolvedValue({
            success: true,
            body: [
                '```json',
                JSON.stringify({
                    paragraphSummary: 'Stage the anvil.',
                    planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
                }),
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const bus = mockMessageBus()
        const result = await runCoyoteHypothesisPipeline({ ...pipelineDeps(), messageBus: bus })
        expect(result.kind).toBe('stub')

        expect(await thinkingResultsOkFromBus(bus.publish)).toEqual([
            { segment: 'candidates', ok: true },
            { segment: 'planSelect', ok: false },
        ])

        const generationId = sendPutThinkingJobCreate.mock.calls[0][2].generationId
        const planSelectWorkItemId = sendPutThinkingSchedule.mock.calls.find(
            (call) => call[2].segment === 'planSelect'
        )?.[2].workItemId
        expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
        expect(sendPutThinkingJobError.mock.calls[0][2]).toMatchObject({
            generationId,
            jobStatus: 'failed',
            lastFailedWorkItemId: planSelectWorkItemId,
        })
        expect(sendPutThinkingJobError.mock.calls[0]).toHaveLength(3)
        expect(schedulePutsByStatus('completed')).toHaveLength(1)
        expect(schedulePutsByStatus('completed')[0].segment).toBe('candidates')
    })

    it('emits candidates failure result and job error when stage-one invoke fails', async () => {
        stageOneMock.mockResolvedValue({
            success: false,
            errorMessage: 'Throttled',
        })
        const bus = mockMessageBus()
        const result = await runCoyoteHypothesisPipeline({ ...pipelineDeps(), messageBus: bus })
        expect(result.kind).toBe('stub')

        expect(await thinkingResultsOkFromBus(bus.publish)).toEqual([{ segment: 'candidates', ok: false }])

        const generationId = sendPutThinkingJobCreate.mock.calls[0][2].generationId
        const candidatesWorkItemId = sendPutThinkingSchedule.mock.calls.find(
            (call) => call[2].segment === 'candidates'
        )?.[2].workItemId
        expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
        expect(sendPutThinkingJobError.mock.calls[0][2]).toMatchObject({
            generationId,
            jobStatus: 'failed',
            lastFailedWorkItemId: candidatesWorkItemId,
            errorCode: 'stage_one_invoke_failed',
        })
        expect(schedulePutsByStatus('completed')).toHaveLength(0)
    })

    it('runOnly planSelect emits planSelect failure and job error without stageOneResult', async () => {
        const fixture01 = COYOTE_ENGINE_TEST_FIXTURES.find((f) => f.id === 'fixture-01')
        expect(fixture01?.planSelectInject).toBeDefined()
        const inject = fixture01!.planSelectInject!
        planSelectionMock.mockResolvedValue({
            success: true,
            body: [
                '```json',
                JSON.stringify({
                    paragraphSummary: 'Stage the anvil.',
                    planIssues: [{ code: 'DIRECTION_AMBIGUOUS', summary: 'timing is coarse' }],
                }),
                '```',
            ].join('\n'),
            usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        })
        const bus = mockMessageBus()
        await expect(
            runCoyoteHypothesisPipeline(
                {
                    ...emptySnapshotDeps(),
                    roomObjectsByRoomOverride: inject.roomObjectsByRoom,
                    messageBus: bus,
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
        ).rejects.toThrow('CoyoteHypothesisPipelineAbort')
        expect(await thinkingResultsOkFromBus(bus.publish)).toEqual([{ segment: 'planSelect', ok: false }])
        expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
    })

    it('marks job failed without step result when loadRoomObjects throws', async () => {
        getGameRooms.mockRejectedValue(new Error('network'))
        const bus = mockMessageBus()
        await expect(runCoyoteHypothesisPipeline({ ...pipelineDeps(), messageBus: bus })).rejects.toThrow(
            'network'
        )
        expect(findCoyoteThinkingResultMessages(bus.publish)).toHaveLength(0)
        expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
        expect(sendPutThinkingJobError.mock.calls[0][2]).toMatchObject({
            jobStatus: 'failed',
            errorCode: 'load_room_objects_failed',
        })
        expect(sendPutThinkingJobError.mock.calls[0][2]).not.toHaveProperty('lastFailedWorkItemId')
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
        const result = await runCoyoteHypothesisPipeline(pipelineDeps())
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
        const result = await runCoyoteHypothesisPipeline(pipelineDeps())
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
                ...emptySnapshotDeps(),
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
                messageBus: mockMessageBus(),
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
                ...emptySnapshotDeps(),
                roomObjectsByRoomOverride: inject.roomObjectsByRoom,
                messageBus: mockMessageBus(),
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
        const result = await runCoyoteHypothesisPipeline(pipelineDeps())
        expect(result.kind).toBe('stub')
        if (result.kind === 'stub') {
            expect(result.record.intent).toBe('Hypothesis: Something went wrong')
        }
        expect(narrativeBeatMock).not.toHaveBeenCalled()
        expect(planSelectionMock).toHaveBeenCalledTimes(1)
    })
})

describe('pipeline thinking async persist (marshall guard)', () => {
    const getGameRooms = jest.fn<Promise<string[]>, []>()

    const pipelineDeps = () => ({
        ...coyoteSnapshotDepsFromRoomObjects(getGameRooms, DEFAULT_PIPELINE_ROOM_OBJECTS),
        messageBus: mockMessageBus(),
    })

    beforeEach(() => {
        jest.clearAllMocks()
        getGameRooms.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        stageOneMock.mockResolvedValue({
            success: true,
            body: stageOneSeamBody,
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        })
        ;(ephemeraDB.putItem as jest.Mock).mockResolvedValue(undefined)
        ;(ephemeraDB.nonCollidingPutItem as jest.Mock).mockResolvedValue(true)
    })

    it('candidates Thinking Result from pipeline survives async receiveEvents marshall', async () => {
        const bus = mockMessageBus()
        const result = await runCoyoteHypothesisPipeline(
            { ...pipelineDeps(), messageBus: bus },
            { testOnly: 'candidates', harnessRunKind: 'runUntil' }
        )
        expect(result.kind).toBe('harnessPartial')

        const thinkingMsgs = findCoyoteThinkingResultMessages(bus.publish)
        expect(thinkingMsgs).toHaveLength(1)

        const msg = thinkingMsgs[0]
        await ephemeraThinkingResultsDataSource.receiveEvents!({
            events: [
                {
                    header: msg.header,
                    getContent: msg.getContent,
                } as never,
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })

        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.nonCollidingPutItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.nonCollidingPutItem).toHaveBeenCalledWith(
            expect.objectContaining({
                verbose: expect.objectContaining({
                    roomObjectsByRoom: DEFAULT_PIPELINE_ROOM_OBJECTS,
                    combined: expect.objectContaining({ candidates: expect.any(Array) }),
                    stageOneBody: stageOneSeamBody,
                }),
            })
        )

        const content = await msg.getContent()
        expect(isThinkingResultEvent(content)).toBe(true)
        if (isThinkingResultEvent(content)) {
            expect(internalCache.ThinkingResults.invalidate).toHaveBeenCalledWith(content.workItemId)
        }
    })
})
