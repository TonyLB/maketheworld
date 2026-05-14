/**
 * mtw.ephemera.thinking.scheduling DataSource: persists schedule updates from api.ephemera Put Thinking Schedule.
 */
import { isThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import EphemeraDataSource from '../../abstract'
import type { PutThinkingScheduleCommand } from '../../localApiEvents'
import { persistThinkingSchedule } from './persistThinkingSchedule'
import { isThinkingSchedulingSubscribedEnvelope } from './subscribedEvents'

/** Placeholder publish payload; schedule feed is api.ephemera ingress for MVP. */
type ThinkingSchedulingPublishedPayload = { type: 'Thinking Scheduling noop' }

export const ephemeraThinkingSchedulingDataSource = new EphemeraDataSource<
    never,
    ThinkingSchedulingPublishedPayload,
    PutThinkingScheduleCommand
>({
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isThinkingSchedulingSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                if (isThinkingScheduleEvent(raw)) {
                    await persistThinkingSchedule(raw)
                }
            })
        )
    },
})

ephemeraThinkingSchedulingDataSource.subscribe()

export default ephemeraThinkingSchedulingDataSource
