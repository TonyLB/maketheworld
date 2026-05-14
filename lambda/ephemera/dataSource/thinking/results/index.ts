/**
 * mtw.ephemera.thinking.results DataSource: persists Thinking Result bus events from CoyoteGame.
 */
import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { isThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import EphemeraDataSource from '../../abstract'
import { persistThinkingResult } from './persistThinkingResult'
import { isThinkingResultsSubscribedEnvelope } from './subscribedEvents'

/** Placeholder publish payload; this DataSource is subscribe-only for MVP. */
type ThinkingResultsPublishedPayload = { type: 'Thinking Results noop' }

export const ephemeraThinkingResultsDataSource = new EphemeraDataSource<
    never,
    ThinkingResultsPublishedPayload,
    ThinkingResultEvent
>({
    dataSourceKey: 'mtw.ephemera.thinking.results',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isThinkingResultsSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                if (isThinkingResultEvent(raw)) {
                    await persistThinkingResult(raw)
                }
            })
        )
    },
})

ephemeraThinkingResultsDataSource.subscribe()

export default ephemeraThinkingResultsDataSource
