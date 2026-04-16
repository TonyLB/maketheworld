/**
 * Ingress for mtw.ephemera.coyoteGame: subscribe to mtw.ephemera.objects Objects Changed.
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ObjectsChangedPayload } from '../objects/events'
import { isEphemeraObjectsObjectsChangedEnvelope } from '../objects/events'

export type CoyoteGameSubscribedContent = ObjectsChangedPayload

export const isCoyoteGameSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CoyoteGameSubscribedContent> => (
    isEphemeraObjectsObjectsChangedEnvelope(envelope)
)
