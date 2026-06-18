/**
 * mtw.ephemera.coyoteGame DataSource.
 *
 * Bus-only. Subscribes to mtw.ephemera.actions Predict Hypothesis and Await RoadRunner.
 */
import EphemeraDataSource from '../abstract'
import { isAwaitRoadRunnerPublishedPayload, isPredictHypothesisPublishedPayload } from '../actions/publishedEvents'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import type { CoyoteGameSubscribedContent } from './subscribedEvents'
import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'
import { handleAwaitRoadRunnerForPlanOutcome } from './handlers/handleAwaitRoadRunnerForPlanOutcome'
import { handlePredictHypothesis } from './handlers/handlePredictHypothesis'
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
            if (isPredictHypothesisPublishedPayload(raw)) {
                await handlePredictHypothesis(raw, { streamEvent, messageBus })
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
