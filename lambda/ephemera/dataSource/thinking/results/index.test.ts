jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import * as persistModule from './persistThinkingResult'
import { THINKING_RESULT_HEADER_TYPE } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraThinkingResultsDataSource } from './index'
import { EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY, isThinkingResultsSubscribedEnvelope } from './subscribedEvents'

const validEvent = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    ok: true,
    completedAt: '2026-01-01T00:00:00.000Z',
}

describe('mtw.ephemera.thinking.results DataSource', () => {
    it('is bus-only with Coyote-scoped Thinking Result subscription guard', () => {
        expect(ephemeraThinkingResultsDataSource.dataSourceKey).toBe('mtw.ephemera.thinking.results')
        expect(ephemeraThinkingResultsDataSource.replayable).toBe(false)
        expect(ephemeraThinkingResultsDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraThinkingResultsDataSource.subscribedEventTypeGuard).toBe(isThinkingResultsSubscribedEnvelope)
        expect(typeof ephemeraThinkingResultsDataSource.receiveEvents).toBe('function')
    })

    it('receiveEvents persists validated ThinkingResultEvent payloads', async () => {
        const spy = jest.spyOn(persistModule, 'persistThinkingResult').mockResolvedValue('written')
        await ephemeraThinkingResultsDataSource.receiveEvents!({
            events: [
                {
                    header: {
                        dataSourceKey: EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
                        streamKey: 'ROOM#x',
                        timestamp: 1,
                        type: THINKING_RESULT_HEADER_TYPE,
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
        const spy = jest.spyOn(persistModule, 'persistThinkingResult').mockResolvedValue('written')
        const invalidEnvelope = {
            header: {
                dataSourceKey: EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
                streamKey: 'ROOM#x',
                timestamp: 1,
                type: THINKING_RESULT_HEADER_TYPE,
            },
            getContent: async () => ({ not: 'a result' }),
        }
        await ephemeraThinkingResultsDataSource.receiveEvents!({
            events: [invalidEnvelope as never],
            streamEvent: jest.fn(),
            streamEnvelope: jest.fn(),
        })
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})
