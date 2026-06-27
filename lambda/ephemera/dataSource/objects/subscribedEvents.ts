/**
 * Ingress envelope guards for `mtw.ephemera.objects`.
 * - api.ephemera `Objects Change`
 * - mtw.ephemera.actions `Acme Order`, `Await RoadRunner`
 * - mtw.diagnostics `Orphaned Improvised Object Finding`
 *
 * Shared actions envelope guards (`Predict Hypothesis`, etc.) also live here for
 * downstream DataSources (for example coyoteGame) that import the same helpers.
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type StreamingEventEnvelope,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DiagnosticsOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isEphemeraApiObjectsChangeEnvelope } from '../apiEphemera'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type {
    AcmeOrderPublishedPayload,
    AwaitRoadRunnerPublishedPayload,
    PredictHypothesisPublishedPayload,
} from '../actions/publishedEvents'

export type ObjectsDiagnosticsOrphanedImprovisedObjectFindingHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Orphaned Improvised Object Finding' }

export type ObjectsSubscribedContent =
    | ObjectsChangeCommand
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload
    | DiagnosticsOrphanedImprovisedObjectFindingEvent

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

const isDiagnosticsOrphanedImprovisedObjectFindingHeader: HeaderGuard<ObjectsDiagnosticsOrphanedImprovisedObjectFindingHeader> = (
    header
): header is ObjectsDiagnosticsOrphanedImprovisedObjectFindingHeader => (
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Orphaned Improvised Object Finding'
)

export const isDiagnosticsOrphanedImprovisedObjectFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsOrphanedImprovisedObjectFindingEvent,
    ObjectsDiagnosticsOrphanedImprovisedObjectFindingHeader
>(isDiagnosticsOrphanedImprovisedObjectFindingHeader)

export const isObjectsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ObjectsSubscribedContent> => (
    isEphemeraApiObjectsChangeEnvelope(envelope)
    || isEphemeraActionsAcmeOrderEnvelope(envelope)
    || isEphemeraActionsAwaitRoadRunnerEnvelope(envelope)
    || isDiagnosticsOrphanedImprovisedObjectFindingEnvelope(envelope)
)

export { isEphemeraApiObjectsChangeEnvelope }
export type { ObjectsChangeCommand }
