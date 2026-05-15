jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import * as persistJobCreate from './persistThinkingJobCreate'
import * as persistJobError from './persistThinkingJobError'
import * as persistModule from './persistThinkingSchedule'
import { ephemeraThinkingSchedulingDataSource } from './index'
import { isThinkingSchedulingSubscribedEnvelope } from './subscribedEvents'

const validScheduleEvent = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    scheduleStatus: 'scheduled' as const,
}

const validJobCreate = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemIds: ['11111111-2222-3333-4444-555555555555'],
    jobStatus: 'pending' as const,
}

const validJobError = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jobStatus: 'failed' as const,
    failedAt: '2026-01-01T00:00:00.000Z',
}

describe('mtw.ephemera.thinking.scheduling DataSource', () => {
    it('is bus-only with combined api.ephemera thinking scheduling subscription guard', () => {
        expect(ephemeraThinkingSchedulingDataSource.dataSourceKey).toBe('mtw.ephemera.thinking.scheduling')
        expect(ephemeraThinkingSchedulingDataSource.replayable).toBe(false)
        expect(ephemeraThinkingSchedulingDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraThinkingSchedulingDataSource.subscribedEventTypeGuard).toBe(isThinkingSchedulingSubscribedEnvelope)
        expect(typeof ephemeraThinkingSchedulingDataSource.receiveEvents).toBe('function')
    })

    it('receiveEvents persists validated ThinkingScheduleEvent payloads', async () => {
        const spy = jest.spyOn(persistModule, 'persistThinkingSchedule').mockResolvedValue('written')
        await ephemeraThinkingSchedulingDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                        timestamp: 1,
                        type: 'Put Thinking Schedule',
                    },
                    getContent: async () => validScheduleEvent,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).toHaveBeenCalledWith(validScheduleEvent)
        spy.mockRestore()
    })

    it('receiveEvents invokes persistThinkingSchedule for Put Thinking Schedule even when payload is invalid', async () => {
        const spy = jest.spyOn(persistModule, 'persistThinkingSchedule').mockResolvedValue('invalidPayload')
        const invalidEnvelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'JOB#x',
                timestamp: 1,
                type: 'Put Thinking Schedule',
            },
            getContent: async () => ({ not: 'a schedule' }),
        }
        await ephemeraThinkingSchedulingDataSource.receiveEvents!({
            events: [invalidEnvelope as never],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).toHaveBeenCalledWith({ not: 'a schedule' })
        spy.mockRestore()
    })

    it('receiveEvents persists Put Thinking Job Create payloads', async () => {
        const spy = jest.spyOn(persistJobCreate, 'persistThinkingJobCreate').mockResolvedValue('written')
        await ephemeraThinkingSchedulingDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                        timestamp: 1,
                        type: 'Put Thinking Job Create',
                    },
                    getContent: async () => validJobCreate,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).toHaveBeenCalledWith(validJobCreate)
        spy.mockRestore()
    })

    it('receiveEvents persists Put Thinking Job Error payloads', async () => {
        const spy = jest.spyOn(persistJobError, 'persistThinkingJobError').mockResolvedValue('written')
        await ephemeraThinkingSchedulingDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                        timestamp: 1,
                        type: 'Put Thinking Job Error',
                    },
                    getContent: async () => validJobError,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).toHaveBeenCalledWith(validJobError)
        spy.mockRestore()
    })
})
