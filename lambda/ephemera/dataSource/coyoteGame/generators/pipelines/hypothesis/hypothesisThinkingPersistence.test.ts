import * as apiEphemera from '../../../../apiEphemera'

import {
    activeThinkingSegmentsForRun,
    bootstrapHypothesisThinkingAtRunStart,
    mintHypothesisThinkingIds,
    thinkingStreamKey,
} from './hypothesisThinkingPersistence'

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
})
