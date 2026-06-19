import {
    THINKING_RESULT_HEADER_TYPE,
    isThinkingResultEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import * as apiEphemera from '../../../../apiEphemera'
import internalCache from '../../../../../internalCache'
import type { StreamingEventMessage } from '../../../../../messageBus/baseClasses'
import * as persistModule from '../../../../thinking/results/persistThinkingResult'
import { ephemeraThinkingResultsDataSource } from '../../../../thinking/results/index'

import {
    EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
    activeThinkingSegmentsForRun,
    bootstrapHypothesisThinkingAtRunStart,
    buildCandidatesThinkingResultVerbose,
    buildHypothesisFailureVerbose,
    buildNarrativeBeatsThinkingResultVerbose,
    buildPlanSelectThinkingResultVerbose,
    deriveHypothesisFailureErrorCode,
    emitHypothesisThinkingResult,
    finalizeHypothesisThinkingOnRunFailure,
    mintHypothesisThinkingIds,
    sendCoyoteThinkingResult,
    thinkingSegmentForFailedStepName,
    thinkingStreamKey,
} from './hypothesisThinkingPersistence'

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

jest.mock('../../../../apiEphemera', () => ({
    sendPutThinkingJobCreate: jest.fn(),
    sendPutThinkingSchedule: jest.fn(),
    sendPutThinkingJobError: jest.fn(),
}))

const sendPutThinkingJobCreate = apiEphemera.sendPutThinkingJobCreate as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobCreate
>
const sendPutThinkingSchedule = apiEphemera.sendPutThinkingSchedule as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingSchedule
>
const sendPutThinkingJobError = apiEphemera.sendPutThinkingJobError as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobError
>

describe('hypothesisThinkingPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('activeThinkingSegmentsForRun', () => {
        it('returns all segments for production', () => {
            expect(activeThinkingSegmentsForRun()).toEqual(['candidates', 'planSelect', 'narrativeBeats'])
        })

        it('scopes runUntil candidates to candidates only', () => {
            expect(
                activeThinkingSegmentsForRun({ testOnly: 'candidates', harnessRunKind: 'runUntil' })
            ).toEqual(['candidates'])
        })

        it('scopes runUntil planSelect to candidates and planSelect', () => {
            expect(
                activeThinkingSegmentsForRun({ testOnly: 'planSelect', harnessRunKind: 'runUntil' })
            ).toEqual(['candidates', 'planSelect'])
        })

        it('scopes runOnly planSelect to planSelect only', () => {
            expect(
                activeThinkingSegmentsForRun({ testOnly: 'planSelect', harnessRunKind: 'runOnly' })
            ).toEqual(['planSelect'])
        })
    })

    describe('thinkingSegmentForFailedStepName', () => {
        it('maps pipeline step names to thinking segments', () => {
            expect(thinkingSegmentForFailedStepName('hypothesisCandidatesLlm')).toBe('candidates')
            expect(thinkingSegmentForFailedStepName('seamCombineRender')).toBe('candidates')
            expect(thinkingSegmentForFailedStepName('hypothesisPlanSelectionLlm')).toBe('planSelect')
            expect(thinkingSegmentForFailedStepName('parsePlanSelectionHandoff')).toBe('planSelect')
            expect(thinkingSegmentForFailedStepName('hypothesisNarrativeBeatLlm')).toBe('narrativeBeats')
            expect(thinkingSegmentForFailedStepName('parseNarrativeBeatRecord')).toBe('narrativeBeats')
            expect(thinkingSegmentForFailedStepName('loadRoomObjects')).toBeUndefined()
        })
    })

    describe('deriveHypothesisFailureErrorCode', () => {
        it('uses missing selected candidate when handoff parsed without winner', () => {
            expect(
                deriveHypothesisFailureErrorCode('parsePlanSelectionHandoff', {
                    planSelectOutput: { paragraphSummary: 'x', planIssues: [] },
                })
            ).toBe('plan_selection_missing_selected_candidate')
        })
    })

    describe('mintHypothesisThinkingIds', () => {
        it('returns distinct ids per segment', () => {
            const ids = mintHypothesisThinkingIds(['candidates', 'planSelect'])
            expect(ids.generationId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
            expect(ids.workItems.candidates).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
            expect(ids.workItems.planSelect).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
            expect(ids.workItems.candidates).not.toBe(ids.workItems.planSelect)
        })
    })

    describe('thinkingStreamKey', () => {
        it('returns JOB# prefix', () => {
            expect(thinkingStreamKey('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(
                'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            )
        })
    })

    describe('bootstrapHypothesisThinkingAtRunStart', () => {
        const makeBus = () => ({
            messageBus: {
                publish: jest.fn(),
            },
        })

        it('publishes job create and schedules for production segments', () => {
            const { messageBus } = makeBus()
            const ids = bootstrapHypothesisThinkingAtRunStart({ messageBus })

            expect(ids.workItems.candidates).toBeDefined()
            expect(ids.workItems.planSelect).toBeDefined()
            expect(ids.workItems.narrativeBeats).toBeDefined()

            expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobCreate.mock.calls[0]).toHaveLength(3)

            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(3)

            const streamKey = sendPutThinkingJobCreate.mock.calls[0][1]
            expect(streamKey).toBe(thinkingStreamKey(ids.generationId))
            expect(sendPutThinkingJobCreate.mock.calls[0][2]).toMatchObject({
                schemaVersion: 1,
                generationId: ids.generationId,
                jobStatus: 'running',
            })
        })

        it('scopes harness runUntil candidates to one work item and schedule', () => {
            const { messageBus } = makeBus()
            bootstrapHypothesisThinkingAtRunStart(
                { messageBus },
                { testOnly: 'candidates', harnessRunKind: 'runUntil' }
            )

            expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(1)
            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0][2].segment).toBe('candidates')
        })

        it('scopes harness runOnly planSelect to planSelect only', () => {
            const { messageBus } = makeBus()
            bootstrapHypothesisThinkingAtRunStart(
                { messageBus },
                { testOnly: 'planSelect', harnessRunKind: 'runOnly' }
            )

            expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(1)
            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0][2].segment).toBe('planSelect')
        })
    })

    describe('sendCoyoteThinkingResult', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('posts CoyoteGame Thinking Result envelope with load-bearing getContent', async () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates'])
            const verbose = buildCandidatesThinkingResultVerbose({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                stageOneResult: {
                    success: true,
                    body: '{"candidates":[]}',
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                combined: { candidates: [] },
            })
            const workItemId = ids.workItems.candidates!
            const generationId = ids.generationId
            const streamKey = thinkingStreamKey(generationId)

            sendCoyoteThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: 'candidates',
                    ok: true,
                    completedAt: '2026-05-15T12:00:00.000Z',
                    verbose,
                }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            const msg = findThinkingResultMessage(publish)!
            expect(msg.streamKey).toBe(streamKey)
            expect(msg.header.dataSourceKey).toBe(EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY)
            expect(msg.header.type).toBe(THINKING_RESULT_HEADER_TYPE)

            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe('candidates')
                expect(content.ok).toBe(true)
                expect(content.verbose).toMatchObject({
                    roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                    stageOneBody: '{"candidates":[]}',
                    combined: { candidates: [] },
                })
            }
        })
    })

    describe('emitHypothesisThinkingResult', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('publishes Thinking Result then completed schedule', () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])
            const workItemId = ids.workItems.planSelect!

            emitHypothesisThinkingResult(
                { messageBus: { publish } },
                ids,
                'planSelect',
                { ok: true, verbose: { planSelectOutput: { paragraphSummary: 'x', planIssues: [] } } }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            expect(findThinkingResultMessage(publish)).toBeDefined()
            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0][1]).toBe(thinkingStreamKey(ids.generationId))
            expect(sendPutThinkingSchedule.mock.calls[0][2]).toMatchObject({
                generationId: ids.generationId,
                workItemId,
                segment: 'planSelect',
                scheduleStatus: 'completed',
            })
            expect(sendPutThinkingSchedule.mock.calls[0]).toHaveLength(3)
        })
    })

    describe('finalizeHypothesisThinkingOnRunFailure', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('publishes planSelect failure result and job error', async () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates', 'planSelect'])
            const state = {
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                combined: { candidates: [] },
                stageOneResult: {
                    success: true as const,
                    body: '{}',
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                planSelectionResult: {
                    success: true as const,
                    body: '```json\n{}\n```',
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                selectionBody: '```json\n{}\n```',
            }

            finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { publish } },
                {
                    ids,
                    failedStepName: 'parsePlanSelectionHandoff',
                    failedStepIndex: 4,
                    error: new Error('CoyoteHypothesisPipelineAbort'),
                    state,
                }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError.mock.calls[0]).toHaveLength(3)
            expect(
                sendPutThinkingSchedule.mock.calls.filter((call) => call[2].scheduleStatus === 'completed')
            ).toHaveLength(0)

            const msg = findThinkingResultMessage(publish)!
            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe('planSelect')
                expect(content.ok).toBe(false)
                expect(content.errorCode).toBe('plan_selection_handoff_parse_failed')
                expect(content.workItemId).toBe(ids.workItems.planSelect)
            }

            expect(sendPutThinkingJobError.mock.calls[0][2]).toMatchObject({
                generationId: ids.generationId,
                jobStatus: 'failed',
                lastFailedWorkItemId: ids.workItems.planSelect,
            })
        })

        it('omits step result for loadRoomObjects but still marks job failed', () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates', 'planSelect', 'narrativeBeats'])

            finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { publish } },
                {
                    ids,
                    failedStepName: 'loadRoomObjects',
                    failedStepIndex: 0,
                    error: new Error('network'),
                    state: {},
                }
            )

            expect(publish).not.toHaveBeenCalled()
            expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError.mock.calls[0][2]).not.toHaveProperty('lastFailedWorkItemId')
        })

        it('runOnly planSelect scopes failure emit to planSelect segment only', async () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])

            finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { publish } },
                {
                    ids,
                    failedStepName: 'parsePlanSelectionHandoff',
                    failedStepIndex: 4,
                    error: new Error('CoyoteHypothesisPipelineAbort'),
                    state: { selectionBody: 'bad json' },
                    thinkingHarness: { testOnly: 'planSelect', harnessRunKind: 'runOnly' },
                }
            )

            const msg = findThinkingResultMessage(publish)!
            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe('planSelect')
                expect(content.ok).toBe(false)
            }
        })
    })

    describe('verbose builders bedrockPrompt', () => {
        const promptParts = { invariantPrefix: 'INV_', dynamicSuffix: 'DYN' }

        it('buildCandidatesThinkingResultVerbose includes bedrockPrompt from stageOnePromptParts', () => {
            const verbose = buildCandidatesThinkingResultVerbose({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                stageOneResult: { success: false, errorMessage: 'fail' },
                combined: { candidates: [] },
                stageOnePromptParts: promptParts,
            })
            expect(verbose.bedrockPrompt?.fullText).toBe('INV_DYN')
        })

        it('buildPlanSelectThinkingResultVerbose includes bedrockPrompt from planSelectPromptParts', () => {
            const verbose = buildPlanSelectThinkingResultVerbose({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                combined: { candidates: [] },
                planSelectionResult: { success: true, body: '{}', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                planSelectOutput: { paragraphSummary: 'x', planIssues: [] },
                selectionBody: '{}',
                planSelectPromptParts: promptParts,
            })
            expect(verbose.bedrockPrompt?.fullText).toBe('INV_DYN')
        })

        it('buildNarrativeBeatsThinkingResultVerbose includes bedrockPrompt from narrativeBeatPromptParts', () => {
            const verbose = buildNarrativeBeatsThinkingResultVerbose({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                planSelectOutput: {
                    paragraphSummary: 'x',
                    planIssues: [],
                    selectedCandidate: {
                        candidateId: 'c1',
                        executionSummary: 'summary',
                        tropeAssignments: {},
                        outliers: [],
                    },
                },
                narrativeBeatResult: { success: true, body: 'Hypothesis: test', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                record: { intent: 'Hypothesis: test' },
                narrativeBeatPromptParts: promptParts,
            })
            expect(verbose.bedrockPrompt?.fullText).toBe('INV_DYN')
        })
    })

    describe('buildHypothesisFailureVerbose', () => {
        it('builds minimal candidates verbose when stageOneResult is missing', () => {
            const verbose = buildHypothesisFailureVerbose(
                { roomObjectsByRoom: { 'ROOM#VORTEX': [] } },
                'candidates',
                'loadRoomObjects'
            )
            expect(verbose).toMatchObject({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                failedStepName: 'loadRoomObjects',
            })
        })

        it('includes bedrockPrompt on candidates fallback when stageOnePromptParts exist', () => {
            const verbose = buildHypothesisFailureVerbose(
                {
                    roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                    stageOnePromptParts: { invariantPrefix: 'A', dynamicSuffix: 'B' },
                },
                'candidates',
                'hypothesisCandidatesLlm'
            )
            expect(verbose).toMatchObject({
                failedStepName: 'hypothesisCandidatesLlm',
                bedrockPrompt: { invariantPrefix: 'A', dynamicSuffix: 'B', fullText: 'AB' },
            })
        })
    })

    describe('bus to persistThinkingResult', () => {
        beforeEach(() => {
            ;(ephemeraDB.putItem as jest.Mock).mockResolvedValue(undefined)
            ;(ephemeraDB.nonCollidingPutItem as jest.Mock).mockResolvedValue(true)
        })

        it('receiveEvents persists Coyote Thinking Result with ok false from mock bus envelope', async () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])
            const generationId = ids.generationId
            const workItemId = ids.workItems.planSelect!
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'

            sendCoyoteThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: 'planSelect',
                    ok: false,
                    completedAt,
                    errorCode: 'plan_selection_handoff_parse_failed',
                    errorMessage: 'abort',
                    verbose: { failedStepName: 'parsePlanSelectionHandoff' },
                }
            )

            const msg = publish.mock.calls[0][0] as StreamingEventMessage
            const spy = jest.spyOn(persistModule, 'persistThinkingResult').mockResolvedValue('written')
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
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    generationId,
                    workItemId,
                    segment: 'planSelect',
                    ok: false,
                    errorCode: 'plan_selection_handoff_parse_failed',
                })
            )
            spy.mockRestore()
        })

        it('receiveEvents persists Coyote Thinking Result from mock bus envelope', async () => {
            const publish = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates'])
            const generationId = ids.generationId
            const workItemId = ids.workItems.candidates!
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'
            const stageOneBody = '{"candidates":[]}'
            const verbose = buildCandidatesThinkingResultVerbose({
                roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                stageOneResult: {
                    success: true,
                    body: stageOneBody,
                    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                },
                combined: { candidates: [] },
                stageOnePromptParts: { invariantPrefix: 'INV_', dynamicSuffix: 'DYN' },
            })

            sendCoyoteThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: 'candidates',
                    ok: true,
                    completedAt,
                    verbose,
                }
            )

            const msg = publish.mock.calls[0][0] as StreamingEventMessage
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
            expect(ephemeraDB.nonCollidingPutItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    generationId,
                    workItemId,
                    segment: 'candidates',
                    ok: true,
                    completedAt,
                    verbose: expect.objectContaining({
                        roomObjectsByRoom: { 'ROOM#VORTEX': [] },
                        combined: { candidates: [] },
                        stageOneBody,
                        bedrockPrompt: expect.objectContaining({ fullText: 'INV_DYN' }),
                    }),
                })
            )
            expect(internalCache.ThinkingResults.invalidate).toHaveBeenCalledWith(workItemId)
        })
    })
})
