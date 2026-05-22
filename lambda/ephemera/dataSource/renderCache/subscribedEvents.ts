/**
 * Envelope guards for mtw.ephemera.renderCache DataSource subscriptions.
 * Includes api.ephemera commands, renderOrchestration outbounds, and forward-looking
 * invalidation/diagnostics contracts (handlers wired in later slices).
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type StreamingEventEnvelope,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ComponentExamplesInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'
import type { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import {
    isEphemeraApiPutCacheRecordEnvelope,
    isEphemeraApiDeleteCacheRecordsEnvelope,
} from '../apiEphemera'
import type { DeleteCacheRecordsCommand, PutCacheRecordCommand } from '../localApiEvents'
import {
    isRenderOrchestrationPublishedStreamEnvelope,
    type RenderOrchestrationPublishedPayload,
} from '../renderOrchestration/publishedEvents'

export type CacheCommand = PutCacheRecordCommand | DeleteCacheRecordsCommand

export type RenderCacheComponentExamplesInvalidatedIncomingEvent = {
    header: StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentExamples'; type: 'ExampleInvalidated' };
    getContent: () => Promise<ComponentExamplesInvalidatedEvent>;
}

export type RenderCacheDiagnosticsFindingIncomingEvent = {
    header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' };
    getContent: () => Promise<DiagnosticsEphemeraRenderCacheFindingEvent>;
}

export type RenderCacheSubscribedContent =
    | CacheCommand
    | RenderOrchestrationPublishedPayload
    | ComponentExamplesInvalidatedEvent
    | DiagnosticsEphemeraRenderCacheFindingEvent

export type RenderCacheSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.renderOrchestration'; type: string })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentExamples'; type: 'ExampleInvalidated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' })

const isComponentExamplesInvalidatedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentExamples'; type: 'ExampleInvalidated' }
> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentExamples'; type: 'ExampleInvalidated' } =>
    h.dataSourceKey === 'mtw.assets.componentExamples' && h.type === 'ExampleInvalidated'

const isDiagnosticsRenderCacheFindingHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }
> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Ephemera RenderCache Finding'

export const isComponentExamplesInvalidatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentExamplesInvalidatedEvent,
    StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentExamples'; type: 'ExampleInvalidated' }
>(isComponentExamplesInvalidatedHeader)

export const isDiagnosticsRenderCacheFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsEphemeraRenderCacheFindingEvent,
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }
>(isDiagnosticsRenderCacheFindingHeader)

export const isPutOrDeleteCacheCommandEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CacheCommand> => (
    isEphemeraApiPutCacheRecordEnvelope(envelope) || isEphemeraApiDeleteCacheRecordsEnvelope(envelope)
)

export const isRenderCacheSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<RenderCacheSubscribedContent> => (
    isPutOrDeleteCacheCommandEnvelope(envelope)
    || isRenderOrchestrationPublishedStreamEnvelope(envelope)
    || isComponentExamplesInvalidatedEnvelope(envelope)
    || isDiagnosticsRenderCacheFindingEnvelope(envelope)
)
