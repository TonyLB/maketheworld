jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import * as persistModule from './persistThinkingSchedule'
import { ephemeraThinkingSchedulingDataSource } from './index'
import { isThinkingSchedulingSubscribedEnvelope } from './subscribedEvents'

const validEvent = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    scheduleStatus: 'scheduled' as const,
}

describe('mtw.ephemera.thinking.scheduling DataSource', () => {
    it('is bus-only with api.ephemera Put Thinking Schedule subscription guard', () => {
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
                    getContent: async () => validEvent,
                },
            ],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).toHaveBeenCalledWith(validEvent)
        spy.mockRestore()
    })

    it('receiveEvents skips invalid getContent payloads', async () => {
        const spy = jest.spyOn(persistModule, 'persistThinkingSchedule').mockResolvedValue('written')
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
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})
