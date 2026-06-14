import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ActionAssessedCommand, ParseRequestedCommand } from '../localApiEvents'

export type ActionsParseRequestedHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' }

export type ActionsActionAssessedHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' }

export type ActionsSubscribedContent = ParseRequestedCommand | ActionAssessedCommand

const isActionsParseRequestedHeader: HeaderGuard<ActionsParseRequestedHeader> = (
    h
): h is ActionsParseRequestedHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Parse Requested'
)

const isActionsActionAssessedHeader: HeaderGuard<ActionsActionAssessedHeader> = (
    h
): h is ActionsActionAssessedHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Action Assessed'
)

export const isActionsParseRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ParseRequestedCommand,
    ActionsParseRequestedHeader
>(isActionsParseRequestedHeader)

export const isActionsActionAssessedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ActionAssessedCommand,
    ActionsActionAssessedHeader
>(isActionsActionAssessedHeader)

export const isActionsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ActionsSubscribedContent> => (
    isActionsParseRequestedEnvelope(envelope)
    || isActionsActionAssessedEnvelope(envelope)
)
