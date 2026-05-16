import type { StreamingEventEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { THINKING_RESULT_HEADER_TYPE } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
    isThinkingResultsSubscribedEnvelope,
} from './subscribedEvents'

const baseHeader: StreamingEventHeader = {
    dataSourceKey: EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
    streamKey: 'ROOM#test',
    timestamp: 1,
    type: THINKING_RESULT_HEADER_TYPE,
}

describe('isThinkingResultsSubscribedEnvelope', () => {
    it('accepts CoyoteGame publisher with Thinking Result header type', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: baseHeader,
            getContent: async () => ({}),
        }
        expect(isThinkingResultsSubscribedEnvelope(envelope)).toBe(true)
    })

    it('rejects wrong publisher', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: { ...baseHeader, dataSourceKey: 'mtw.ephemera.objects' },
            getContent: async () => ({}),
        }
        expect(isThinkingResultsSubscribedEnvelope(envelope)).toBe(false)
    })

    it('rejects wrong header type', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: { ...baseHeader, type: 'Hypothesis Generation Result' },
            getContent: async () => ({}),
        }
        expect(isThinkingResultsSubscribedEnvelope(envelope)).toBe(false)
    })

    it('accepts actions publisher with Thinking Result header type', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: {
                ...baseHeader,
                dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
            },
            getContent: async () => ({}),
        }
        expect(isThinkingResultsSubscribedEnvelope(envelope)).toBe(true)
    })

    it('rejects actions publisher with non-Thinking-Result header type', () => {
        const envelope: StreamingEventEnvelope<unknown> = {
            header: {
                ...baseHeader,
                dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
                type: 'Acme Order',
            },
            getContent: async () => ({}),
        }
        expect(isThinkingResultsSubscribedEnvelope(envelope)).toBe(false)
    })
})
