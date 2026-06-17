/**
 * mtw.ephemera.coyoteGame DataSource.
 *
 * Bus-only. Subscribes to Object Moved (Coyote rooms) and mtw.ephemera.actions Await RoadRunner.
 */
import EphemeraDataSource from '../abstract'
import { isAwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'
import { isObjectMovedPublishedPayload } from '../positions/publishedEvents'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import type { CoyoteGameSubscribedContent } from './subscribedEvents'
import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'
import { handleAwaitRoadRunnerForPlanOutcome } from './handlers/handleAwaitRoadRunnerForPlanOutcome'
import { handleObjectMovedForHypothesis } from './handlers/handleObjectMovedForHypothesis'
import messageBus from '../../messageBus'

export const ephemeraCoyoteGameDataSource = new EphemeraDataSource<
    never,
    CoyoteGamePublishedPayload,
    CoyoteGameSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.coyoteGame',
    replayable: false,
    publisherStrategy: 'busOnly',
    // Run hypothesis generation after earlier bus work (e.g. PublishMessage/object cascades)
    // so immediate player-facing updates are delivered before this late derived step.
    subscriptionPriority: 20,
    subscribedEventTypeGuard: isCoyoteGameSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const raw = await event.getContent()
            if (isObjectMovedPublishedPayload(raw)) {
                await handleObjectMovedForHypothesis(raw, { streamEvent, messageBus })
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
