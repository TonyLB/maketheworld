/**
 * Ingress for mtw.ephemera.coyoteGame:
 * - mtw.ephemera.positions Object Moved
 * - mtw.ephemera.actions Await RoadRunner
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { AwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'
import type { ObjectMovedPublishedPayload } from '../positions/publishedEvents'
import { isEphemeraPositionsObjectMovedEnvelope } from '../positions/publishedEvents'
import { isEphemeraActionsAwaitRoadRunnerEnvelope } from '../objects/subscribedEvents'

export type CoyoteGameSubscribedContent = ObjectMovedPublishedPayload | AwaitRoadRunnerPublishedPayload

export const isCoyoteGameSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CoyoteGameSubscribedContent> => (
    isEphemeraPositionsObjectMovedEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
)
