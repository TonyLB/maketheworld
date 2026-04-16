/**
 * Ingress for mtw.ephemera.coyoteGame:
 * - mtw.ephemera.objects Objects Changed
 * - mtw.ephemera.actions Await RoadRunner
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { AwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'
import type { ObjectsChangedPayload } from '../objects/events'
import { isEphemeraObjectsObjectsChangedEnvelope } from '../objects/events'
import { isEphemeraActionsAwaitRoadRunnerEnvelope } from '../objects/subscribedEvents'

export type CoyoteGameSubscribedContent = ObjectsChangedPayload | AwaitRoadRunnerPublishedPayload

export const isCoyoteGameSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CoyoteGameSubscribedContent> => (
    isEphemeraObjectsObjectsChangedEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
)
