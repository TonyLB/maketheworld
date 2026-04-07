/**
 * Envelope guards for mtw.ephemera.renderCache DataSource subscriptions (api.ephemera + renderOrchestration outbounds).
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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

export type RenderCacheSubscribedContent = CacheCommand | RenderOrchestrationPublishedPayload

export const isPutOrDeleteCacheCommandEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CacheCommand> => (
    isEphemeraApiPutCacheRecordEnvelope(envelope) || isEphemeraApiDeleteCacheRecordsEnvelope(envelope)
)

export const isRenderCacheSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<RenderCacheSubscribedContent> => (
    isPutOrDeleteCacheCommandEnvelope(envelope) || isRenderOrchestrationPublishedStreamEnvelope(envelope)
)
