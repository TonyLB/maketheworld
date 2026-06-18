/**
 * Ingress envelope guards for `mtw.ephemera.objects`.
 * - api.ephemera `Objects Change`
 * - mtw.ephemera.actions `Acme Order`, `Await RoadRunner`
 *
 * Shared actions envelope guards (`Predict Hypothesis`, etc.) also live here for
 * downstream DataSources (for example coyoteGame) that import the same helpers.
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isEphemeraApiObjectsChangeEnvelope } from '../apiEphemera'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type {
    AcmeOrderPublishedPayload,
    AwaitRoadRunnerPublishedPayload,
    PredictHypothesisPublishedPayload,
} from '../actions/publishedEvents'

export type ObjectsSubscribedContent =
    | ObjectsChangeCommand
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload

export const isEphemeraActionsAcmeOrderEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AcmeOrderPublishedPayload> => (
    envelope.header.dataSourceKey === 'mtw.ephemera.actions'
    && envelope.header.type === 'Acme Order'
)

export const isEphemeraActionsAwaitRoadRunnerEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AwaitRoadRunnerPublishedPayload> => (
    envelope.header.dataSourceKey === 'mtw.ephemera.actions'
    && envelope.header.type === 'Await RoadRunner'
)

export const isEphemeraActionsPredictHypothesisEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PredictHypothesisPublishedPayload> => (
    envelope.header.dataSourceKey === 'mtw.ephemera.actions'
    && envelope.header.type === 'Predict Hypothesis'
)

export const isObjectsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ObjectsSubscribedContent> => (
    isEphemeraApiObjectsChangeEnvelope(envelope)
    || isEphemeraActionsAcmeOrderEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
)

export { isEphemeraApiObjectsChangeEnvelope }
export type { ObjectsChangeCommand }
