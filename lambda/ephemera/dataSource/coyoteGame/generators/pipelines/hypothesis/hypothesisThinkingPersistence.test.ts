import {
    THINKING_RESULT_HEADER_TYPE,
    isThinkingResultEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import * as apiEphemera from '../../../../apiEphemera'
import type { StreamingEventMessage } from '../../../../../messageBus/baseClasses'
import * as persistModule from '../../../../thinking/results/persistThinkingResult'
import { ephemeraThinkingResultsDataSource } from '../../../../thinking/results/index'

import {
    EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
    activeThinkingSegmentsForRun,
    bootstrapHypothesisThinkingAtRunStart,
    buildCandidatesThinkingResultVerbose,
    buildHypothesisFailureVerbose,
    deriveHypothesisFailureErrorCode,
    emitHypothesisThinkingResult,
    finalizeHypothesisThinkingOnRunFailure,
    mintHypothesisThinkingIds,
    sendCoyoteThinkingResult,
    thinkingResultsLaneId,
    thinkingSegmentForFailedStepName,
    thinkingStreamKey,
} from './hypothesisThinkingPersistence'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

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
        const makeBus = () => {
            const flush = jest.fn().mockResolvedValue(undefined)
            return {
                messageBus: {
                    send: jest.fn(),
                    flush,
                },
                flush,
            }
        }

        it('sends job create and schedules on one bootstrap lane then flushes', async () => {
            const { messageBus, flush } = makeBus()
            const ids = await bootstrapHypothesisThinkingAtRunStart({ messageBus })

            expect(ids.workItems.candidates).toBeDefined()
            expect(ids.workItems.planSelect).toBeDefined()
            expect(ids.workItems.narrativeBeats).toBeDefined()

            expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
            const jobCreateLane = sendPutThinkingJobCreate.mock.calls[0][3]
            expect(jobCreateLane).toMatch(/^thinkingBootstrap:/)

            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(3)
            for (const call of sendPutThinkingSchedule.mock.calls) {
                expect(call[3]).toBe(jobCreateLane)
            }

            expect(flush).toHaveBeenCalledTimes(1)
            expect(flush).toHaveBeenCalledWith(jobCreateLane)

            const streamKey = sendPutThinkingJobCreate.mock.calls[0][1]
            expect(streamKey).toBe(thinkingStreamKey(ids.generationId))
            expect(sendPutThinkingJobCreate.mock.calls[0][2]).toMatchObject({
                schemaVersion: 1,
                generationId: ids.generationId,
                jobStatus: 'running',
            })
        })

        it('scopes harness runUntil candidates to one work item and schedule', async () => {
            const { messageBus } = makeBus()
            await bootstrapHypothesisThinkingAtRunStart(
                { messageBus },
                { testOnly: 'candidates', harnessRunKind: 'runUntil' }
            )

            expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobCreate.mock.calls[0][2].workItemIds).toHaveLength(1)
            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0][2].segment).toBe('candidates')
        })

        it('scopes harness runOnly planSelect to planSelect only', async () => {
            const { messageBus } = makeBus()
            await bootstrapHypothesisThinkingAtRunStart(
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
            send: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of send.mock.calls) {
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
            const send = jest.fn()
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
            const laneId = thinkingResultsLaneId(generationId)

            sendCoyoteThinkingResult(
                { send },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: 'candidates',
                    ok: true,
                    completedAt: '2026-05-15T12:00:00.000Z',
                    verbose,
                },
                laneId
            )

            expect(send).toHaveBeenCalledTimes(1)
            expect(send.mock.calls[0][1]).toBe(laneId)
            const msg = findThinkingResultMessage(send)!
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
        it('sends and flushes thinkingResults lane', async () => {
            const flush = jest.fn().mockResolvedValue(undefined)
            const send = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])
            await emitHypothesisThinkingResult(
                { messageBus: { send, flush } },
                ids,
                'planSelect',
                { ok: true, verbose: { planSelectOutput: { paragraphSummary: 'x', planIssues: [] } } }
            )
            expect(send).toHaveBeenCalledTimes(1)
            expect(flush).toHaveBeenCalledTimes(1)
            expect(flush).toHaveBeenCalledWith(thinkingResultsLaneId(ids.generationId))
        })
    })

    describe('finalizeHypothesisThinkingOnRunFailure', () => {
        const findThinkingResultMessage = (
            send: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of send.mock.calls) {
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

        it('emits planSelect failure result and job error on one lane with single flush', async () => {
            const flush = jest.fn().mockResolvedValue(undefined)
            const send = jest.fn()
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

            await finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { send, flush } },
                {
                    ids,
                    failedStepName: 'parsePlanSelectionHandoff',
                    failedStepIndex: 4,
                    error: new Error('CoyoteHypothesisPipelineAbort'),
                    state,
                }
            )

            const laneId = thinkingResultsLaneId(ids.generationId)
            expect(send).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError.mock.calls[0][3]).toBe(laneId)
            expect(flush).toHaveBeenCalledTimes(1)
            expect(flush).toHaveBeenCalledWith(laneId)

            const msg = findThinkingResultMessage(send)!
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

        it('omits step result for loadRoomObjects but still marks job failed', async () => {
            const flush = jest.fn().mockResolvedValue(undefined)
            const send = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates', 'planSelect', 'narrativeBeats'])

            await finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { send, flush } },
                {
                    ids,
                    failedStepName: 'loadRoomObjects',
                    failedStepIndex: 0,
                    error: new Error('network'),
                    state: {},
                }
            )

            expect(send).not.toHaveBeenCalled()
            expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError.mock.calls[0][2]).not.toHaveProperty('lastFailedWorkItemId')
        })

        it('runOnly planSelect scopes failure emit to planSelect segment only', async () => {
            const flush = jest.fn().mockResolvedValue(undefined)
            const send = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])

            await finalizeHypothesisThinkingOnRunFailure(
                { messageBus: { send, flush } },
                {
                    ids,
                    failedStepName: 'parsePlanSelectionHandoff',
                    failedStepIndex: 4,
                    error: new Error('CoyoteHypothesisPipelineAbort'),
                    state: { selectionBody: 'bad json' },
                    thinkingHarness: { testOnly: 'planSelect', harnessRunKind: 'runOnly' },
                }
            )

            const msg = findThinkingResultMessage(send)!
            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe('planSelect')
                expect(content.ok).toBe(false)
            }
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
    })

    describe('bus to persistThinkingResult', () => {
        it('receiveEvents persists Coyote Thinking Result with ok false from mock bus envelope', async () => {
            const send = jest.fn()
            const ids = mintHypothesisThinkingIds(['planSelect'])
            const generationId = ids.generationId
            const workItemId = ids.workItems.planSelect!
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'

            sendCoyoteThinkingResult(
                { send },
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
                },
                thinkingResultsLaneId(generationId)
            )

            const msg = send.mock.calls[0][0] as StreamingEventMessage
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
            const send = jest.fn()
            const ids = mintHypothesisThinkingIds(['candidates'])
            const generationId = ids.generationId
            const workItemId = ids.workItems.candidates!
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'

            sendCoyoteThinkingResult(
                { send },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: 'candidates',
                    ok: true,
                    completedAt,
                    verbose: { combined: { candidates: [], schemaVersion: 4 } },
                },
                thinkingResultsLaneId(generationId)
            )

            const msg = send.mock.calls[0][0] as StreamingEventMessage
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
                    segment: 'candidates',
                    ok: true,
                    completedAt,
                })
            )
            spy.mockRestore()
        })
    })
})
