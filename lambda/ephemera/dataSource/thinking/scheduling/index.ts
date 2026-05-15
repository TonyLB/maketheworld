/**
 * mtw.ephemera.thinking.scheduling DataSource: persists thinking schedule, job bootstrap (`Meta::Job`
 * + adjacency), and job-level errors from api.ephemera commands.
 */
import EphemeraDataSource from '../../abstract'
import { persistThinkingJobCreate } from './persistThinkingJobCreate'
import { persistThinkingJobError } from './persistThinkingJobError'
import { persistThinkingSchedule } from './persistThinkingSchedule'
import { isThinkingSchedulingSubscribedEnvelope, type ThinkingSchedulingSubscribedCommand } from './subscribedEvents'

/** Placeholder publish payload; schedule feed is api.ephemera ingress for MVP. */
type ThinkingSchedulingPublishedPayload = { type: 'Thinking Scheduling noop' }

export const ephemeraThinkingSchedulingDataSource = new EphemeraDataSource<
    never,
    ThinkingSchedulingPublishedPayload,
    ThinkingSchedulingSubscribedCommand
>({
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isThinkingSchedulingSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                const raw = await event.getContent()
                switch (event.header.type) {
                    case 'Put Thinking Schedule':
                        await persistThinkingSchedule(raw)
                        break
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
