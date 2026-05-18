jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        putItem: jest.fn(),
        nonCollidingPutItem: jest.fn(),
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))
jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingJobs: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        ThinkingSchedules: {
            invalidate: jest.fn(),
        },
    },
}))
jest.mock('./cancelThinkingScheduleWithRetention', () => ({
    cancelThinkingScheduleWithRetention: jest.fn(),
}))

import internalCache from '../../../internalCache'

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { cancelThinkingScheduleWithRetention } from './cancelThinkingScheduleWithRetention'
import { persistThinkingJobError } from './persistThinkingJobError'

const baseError = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jobStatus: 'failed' as const,
    failedAt: '2026-01-01T00:00:00.000Z',
}

const existingJobRow = {
    EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    DataCategory: 'Meta::Job',
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jobStatus: 'running',
    createdAt: '2025-12-31T00:00:00.000Z',
}

const scheduledWorkItem = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    scheduleStatus: 'scheduled' as const,
    enqueuedAt: '2025-12-31T00:00:00.000Z',
}

const jobSnapshot = {
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jobStatus: 'running' as const,
    schemaVersion: 1,
    completedAt: null,
    workItemIds: [scheduledWorkItem.workItemId],
    schedules: [scheduledWorkItem],
}

describe('persistThinkingJobError', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue(jobSnapshot)
        ;(cancelThinkingScheduleWithRetention as jest.Mock).mockResolvedValue(undefined)
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(existingJobRow)
        ;(ephemeraDB.optimisticUpdate as jest.Mock).mockResolvedValue(undefined)
    })

    it('returns invalidPayload when content is not a ThinkingJobErrorEvent', async () => {
        const out = await persistThinkingJobError({ foo: 1 })
        expect(out).toBe('invalidPayload')
        expect(ephemeraDB.getItem).not.toHaveBeenCalled()
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
    })

    it('skips optimisticUpdate when Meta::Job row is missing', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(undefined)
        const out = await persistThinkingJobError(baseError)
        expect(out).toBe('written')
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
    })

    it('skips optimisticUpdate when row has no generationId', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({ EphemeraId: 'JOB#x', DataCategory: 'Meta::Job' })
        await persistThinkingJobError(baseError)
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
    })

    it('optimisticUpdates Meta::Job with priorFetch and required fields', async () => {
        const out = await persistThinkingJobError(baseError)
        expect(out).toBe('written')
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                DataCategory: 'Meta::Job',
            },
            getAllFields: true,
        })
        expect(ephemeraDB.optimisticUpdate).toHaveBeenCalledTimes(1)
        const call = (ephemeraDB.optimisticUpdate as jest.Mock).mock.calls[0][0]
        expect(call.Key).toEqual({
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'Meta::Job',
        })
        expect(call.priorFetch).toEqual(existingJobRow)
        expect(call.updateKeys).toEqual(['jobStatus', 'failedAt', 'schemaVersion', 'deleteAt'])
        const draft: Record<string, unknown> = { ...existingJobRow }
        call.updateReducer(draft)
        expect(draft).toMatchObject({
            jobStatus: 'failed',
            failedAt: baseError.failedAt,
            schemaVersion: 1,
            deleteAt: expect.any(Number),
        })
        expect(internalCache.ThinkingJobs.invalidate).toHaveBeenCalledWith(baseError.generationId)
    })

    it('includes optional keys in updateKeys and reducer when present on event', async () => {
        await persistThinkingJobError({
            ...baseError,
            errorCode: 'E_TEST',
            errorMessage: 'boom',
            lastFailedWorkItemId: '11111111-2222-3333-4444-555555555555',
        })
        const call = (ephemeraDB.optimisticUpdate as jest.Mock).mock.calls[0][0]
        expect(call.updateKeys).toEqual([
            'jobStatus',
            'failedAt',
            'schemaVersion',
            'deleteAt',
            'errorCode',
            'errorMessage',
            'lastFailedWorkItemId',
        ])
        const draft: Record<string, unknown> = { ...existingJobRow }
        call.updateReducer(draft)
        expect(draft).toMatchObject({
            errorCode: 'E_TEST',
            errorMessage: 'boom',
            lastFailedWorkItemId: '11111111-2222-3333-4444-555555555555',
        })
    })

    it('cancels in-flight schedules before updating Meta::Job', async () => {
        await persistThinkingJobError(baseError)
        expect(cancelThinkingScheduleWithRetention).toHaveBeenCalledWith(
            scheduledWorkItem,
            baseError.failedAt
        )
    })

    it('does not cancel completed or cancelled schedules', async () => {
        ;(internalCache.ThinkingJobs.get as jest.Mock).mockResolvedValue({
            ...jobSnapshot,
            schedules: [
                { ...scheduledWorkItem, scheduleStatus: 'completed' },
                { ...scheduledWorkItem, workItemId: '22222222-3333-4444-5555-666666666666', scheduleStatus: 'cancelled' },
            ],
        })
        await persistThinkingJobError(baseError)
        expect(cancelThinkingScheduleWithRetention).not.toHaveBeenCalled()
    })
})
