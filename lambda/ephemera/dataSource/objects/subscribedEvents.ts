/**
 * Ingress envelope guards for `mtw.ephemera.objects`.
 * - api.ephemera `Objects Change`
 * - mtw.ephemera.actions `Await RoadRunner`
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isEphemeraApiObjectsChangeEnvelope } from '../apiEphemera'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type { AcmeOrderPublishedPayload, AwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'

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

export const isObjectsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ObjectsSubscribedContent> => (
    isEphemeraApiObjectsChangeEnvelope(envelope)
    || isEphemeraActionsAcmeOrderEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
)

export { isEphemeraApiObjectsChangeEnvelope }
export type { ObjectsChangeCommand }
