/**
 * Ingress for mtw.ephemera.coyoteGame:
 * - mtw.ephemera.actions Predict Hypothesis
 * - mtw.ephemera.actions Await RoadRunner
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { AwaitRoadRunnerPublishedPayload, PredictHypothesisPublishedPayload } from '../actions/publishedEvents'
import {
    isEphemeraActionsAwaitRoadRunnerEnvelope,
    isEphemeraActionsPredictHypothesisEnvelope,
} from '../objects/subscribedEvents'

export type CoyoteGameSubscribedContent = PredictHypothesisPublishedPayload | AwaitRoadRunnerPublishedPayload

export const isCoyoteGameSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CoyoteGameSubscribedContent> => (
    isEphemeraActionsPredictHypothesisEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
)
