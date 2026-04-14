import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ParseRequestedCommand } from '../localApiEvents'

export type ActionsParseRequestedHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' }

export type ActionsSubscribedContent = ParseRequestedCommand

const isActionsParseRequestedHeader: HeaderGuard<ActionsParseRequestedHeader> = (
    h
): h is ActionsParseRequestedHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Parse Requested'
)

export const isActionsParseRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ParseRequestedCommand,
    ActionsParseRequestedHeader
>(isActionsParseRequestedHeader)

export const isActionsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ActionsSubscribedContent> => (
    isActionsParseRequestedEnvelope(envelope)
)
