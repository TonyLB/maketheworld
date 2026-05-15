/**
 * mtw.ephemera.thinking.scheduling DataSource: persists thinking schedule, job bootstrap (`Meta::Job`
 * + adjacency), and job-level errors from api.ephemera commands.
 */
import type { ThinkingJobCompletedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    isThinkingScheduleEvent,
    ThinkingEventSerializer,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import EphemeraDataSource from '../../abstract'
import { maybeCompleteThinkingJob } from './maybeCompleteThinkingJob'
import { persistThinkingJobCreate } from './persistThinkingJobCreate'
import { persistThinkingJobError } from './persistThinkingJobError'
import { persistThinkingSchedule } from './persistThinkingSchedule'
import { isThinkingSchedulingSubscribedEnvelope, type ThinkingSchedulingSubscribedCommand } from './subscribedEvents'

export const ephemeraThinkingSchedulingDataSource = new EphemeraDataSource<
    never,
    ThinkingJobCompletedEvent,
    ThinkingSchedulingSubscribedCommand
>({
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    replayable: false,
    publisherStrategy: 'busOnly',
    eventSerializer: new ThinkingEventSerializer(),
    subscribedEventTypeGuard: isThinkingSchedulingSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                switch (event.header.type) {
                    case 'Put Thinking Schedule': {
                        const outcome = await persistThinkingSchedule(raw)
                        if (outcome === 'written' && isThinkingScheduleEvent(raw)) {
                            await maybeCompleteThinkingJob({
                                generationId: raw.generationId,
                                streamEvent,
                            })
                        }
                        break
                    }
                    case 'Put Thinking Job Create':
                        await persistThinkingJobCreate(raw)
                        break
                    case 'Put Thinking Job Error':
                        await persistThinkingJobError(raw)
                        break
                    default:
                        break
                }
            })
        )
    },
})

ephemeraThinkingSchedulingDataSource.subscribe()

export default ephemeraThinkingSchedulingDataSource
