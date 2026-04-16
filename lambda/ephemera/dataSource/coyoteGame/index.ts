/**
 * mtw.ephemera.coyoteGame DataSource.
 *
 * Bus-only. Subscribes to Objects Changed (Coyote rooms) and mtw.ephemera.actions Await RoadRunner.
 */
import EphemeraDataSource from '../abstract'
import { isAwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'
import { isObjectsChangedPayload } from '../objects/events'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import type { CoyoteGameSubscribedContent } from './subscribedEvents'
import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'
import { handleAwaitRoadRunnerForPlanOutcome } from './handleAwaitRoadRunnerForPlanOutcome'
import { handleObjectsChangedForHypothesis } from './handleObjectsChangedForHypothesis'
import messageBus from '../../messageBus'

export const ephemeraCoyoteGameDataSource = new EphemeraDataSource<
    never,
    CoyoteGamePublishedPayload,
    CoyoteGameSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.coyoteGame',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isCoyoteGameSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const raw = await event.getContent()
            if (isObjectsChangedPayload(raw)) {
                await handleObjectsChangedForHypothesis(raw, { streamEvent, messageBus })
                return
            }
            if (isAwaitRoadRunnerPublishedPayload(raw)) {
                await handleAwaitRoadRunnerForPlanOutcome(raw, { streamEvent, messageBus })
            }
        }))
    },
})

ephemeraCoyoteGameDataSource.subscribe()

export default ephemeraCoyoteGameDataSource
