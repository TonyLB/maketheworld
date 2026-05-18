jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingJobs: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
    },
}))

import { THINKING_JOB_COMPLETED_HEADER_TYPE } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'
import { allJobSchedulesCompleted, maybeCompleteThinkingJob } from './maybeCompleteThinkingJob'

const generationId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const workItemIdA = '11111111-2222-3333-4444-555555555555'
const workItemIdB = '22222222-3333-4444-5555-666666666666'

const completedSchedule = (workItemId: string, segment: 'candidates' | 'planSelect') => ({
    schemaVersion: 1,
    generationId,
    workItemId,
    segment,
    scheduleStatus: 'completed' as const,
})

const scheduledSchedule = (workItemId: string, segment: 'candidates' | 'planSelect') => ({
    ...completedSchedule(workItemId, segment),
    scheduleStatus: 'scheduled' as const,
})

const runningSnapshotAllComplete = {
    generationId,
    jobStatus: 'running' as const,
    schemaVersion: 1,
    workItemIds: [workItemIdA, workItemIdB],
    schedules: [
        completedSchedule(workItemIdA, 'candidates'),
        completedSchedule(workItemIdB, 'planSelect'),
    ],
}

const metaJobRow = {
    EphemeraId: `JOB#${generationId}`,
    DataCategory: 'Meta::Job',
    schemaVersion: 1,
    generationId,
    jobStatus: 'running',
}

describe('allJobSchedulesCompleted', () => {
    it('returns false when workItemIds is empty', () => {
        expect(
            allJobSchedulesCompleted({
                generationId,
                jobStatus: 'running',
                workItemIds: [],
                schedules: [completedSchedule(workItemIdA, 'candidates')],
            })
        ).toBe(false)
    })

    it('returns false when an adjacency id has no completed schedule', () => {
        expect(
            allJobSchedulesCompleted({
                ...runningSnapshotAllComplete,
                schedules: [completedSchedule(workItemIdA, 'candidates')],
            })
        ).toBe(false)
    })

    it('returns false when a schedule is cancelled', () => {
        expect(
            allJobSchedulesCompleted({
                ...runningSnapshotAllComplete,
                schedules: [
                    completedSchedule(workItemIdA, 'candidates'),
                    { ...completedSchedule(workItemIdB, 'planSelect'), scheduleStatus: 'cancelled' },
                ],
            })
        ).toBe(false)
    })

    it('returns true when every workItemId has scheduleStatus completed', () => {
        expect(allJobSchedulesCompleted(runningSnapshotAllComplete)).toBe(true)
    })
})

describe('maybeCompleteThinkingJob', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue(runningSnapshotAllComplete)
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(metaJobRow)
        ;(ephemeraDB.optimisticUpdate as jest.Mock).mockResolvedValue(undefined)
    })

    it('noops when not all schedules are completed', async () => {
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue({
            ...runningSnapshotAllComplete,
            schedules: [scheduledSchedule(workItemIdA, 'candidates'), completedSchedule(workItemIdB, 'planSelect')],
        })

        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('noop')
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('noops when job is already completed', async () => {
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue({
            ...runningSnapshotAllComplete,
            jobStatus: 'completed',
        })

        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('noop')
        expect(ephemeraDB.getItem).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('noops when job is failed even if all schedules completed', async () => {
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue({
            ...runningSnapshotAllComplete,
            jobStatus: 'failed',
        })

        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('noop')
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('noops when Meta::Job row is missing', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(undefined)

        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('noop')
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('noops when Meta::Job prior status is not active', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({ ...metaJobRow, jobStatus: 'completed' })

        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('noop')
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('completes job, invalidates cache, and streams Job Completed', async () => {
        const outcome = await maybeCompleteThinkingJob({ generationId, streamEvent })

        expect(outcome).toBe('completed')
        expect(ephemeraDB.optimisticUpdate).toHaveBeenCalledTimes(1)
        const updateCall = (ephemeraDB.optimisticUpdate as jest.Mock).mock.calls[0][0]
        expect(updateCall.Key).toEqual({
            EphemeraId: `JOB#${generationId}`,
            DataCategory: 'Meta::Job',
        })
        expect(updateCall.priorFetch).toEqual(metaJobRow)
        expect(updateCall.updateKeys).toEqual(['jobStatus', 'completedAt', 'schemaVersion', 'deleteAt'])
        const draft: Record<string, unknown> = { ...metaJobRow }
        updateCall.updateReducer(draft)
        expect(draft.jobStatus).toBe('completed')
        expect(draft.completedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
        expect(draft.deleteAt).toEqual(expect.any(Number))

        expect(internalCache.ThinkingJobs.invalidate).toHaveBeenCalledWith(generationId)

        expect(streamEvent).toHaveBeenCalledTimes(1)
        const streamCall = streamEvent.mock.calls[0][0]
        expect(streamCall.streamKey).toBe('global')
        expect(streamCall.header).toEqual({ type: THINKING_JOB_COMPLETED_HEADER_TYPE })
        expect(streamCall.update).toMatchObject({
            schemaVersion: 1,
            generationId,
            jobStatus: 'completed',
            schedules: runningSnapshotAllComplete.schedules,
        })
        expect(streamCall.update.completedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
        expect(streamCall.update.completedAt).toBe(draft.completedAt)
    })
})
