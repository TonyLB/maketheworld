jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import * as maybeComplete from './maybeCompleteThinkingJob'
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
    it('is replayable with EventBridge+bus publish and combined api.ephemera subscription guard', () => {
        expect(ephemeraThinkingSchedulingDataSource.dataSourceKey).toBe('mtw.ephemera.thinking.scheduling')
        expect(ephemeraThinkingSchedulingDataSource.replayable).toBe(true)
        expect(ephemeraThinkingSchedulingDataSource.outboundBusDelivery).toBe('publish')
        expect(ephemeraThinkingSchedulingDataSource.publisherStrategy).toBe('eventBridge+bus')
        expect(ephemeraThinkingSchedulingDataSource.subscribedEventTypeGuard).toBe(isThinkingSchedulingSubscribedEnvelope)
        expect(typeof ephemeraThinkingSchedulingDataSource.receiveEvents).toBe('function')
    })

    it('receiveEvents persists validated ThinkingScheduleEvent payloads', async () => {
        const persistSpy = jest.spyOn(persistModule, 'persistThinkingSchedule').mockResolvedValue('written')
        const rollupSpy = jest.spyOn(maybeComplete, 'maybeCompleteThinkingJob').mockResolvedValue('noop')
        const streamEvent = jest.fn()
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
            streamEvent,
            streamEnvelope: jest.fn(),
        })
        expect(persistSpy).toHaveBeenCalledWith(validScheduleEvent)
        expect(rollupSpy).toHaveBeenCalledWith({
            generationId: validScheduleEvent.generationId,
            streamEvent,
        })
        persistSpy.mockRestore()
        rollupSpy.mockRestore()
    })

    it('receiveEvents skips rollup when persistThinkingSchedule returns invalidPayload', async () => {
        const persistSpy = jest.spyOn(persistModule, 'persistThinkingSchedule').mockResolvedValue('invalidPayload')
        const rollupSpy = jest.spyOn(maybeComplete, 'maybeCompleteThinkingJob').mockResolvedValue('noop')
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
        expect(rollupSpy).not.toHaveBeenCalled()
        persistSpy.mockRestore()
        rollupSpy.mockRestore()
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
