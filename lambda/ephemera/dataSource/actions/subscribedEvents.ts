import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ConnectionsSessionDisconnectEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import type { ActionAssessedCommand, ParseRequestedCommand } from '../localApiEvents'

export type ActionsParseRequestedHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' }

export type ActionsActionAssessedHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' }

export type ActionsSessionDisconnectHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Session Disconnect' }

export type ActionsSubscribedContent = ParseRequestedCommand | ActionAssessedCommand | ConnectionsSessionDisconnectEvent

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

const isActionsSessionDisconnectHeader: HeaderGuard<ActionsSessionDisconnectHeader> = (
    h
): h is ActionsSessionDisconnectHeader => (
    h.dataSourceKey === 'mtw.connections' && h.type === 'Session Disconnect'
)

export const isActionsParseRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ParseRequestedCommand,
    ActionsParseRequestedHeader
>(isActionsParseRequestedHeader)

export const isActionsActionAssessedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ActionAssessedCommand,
    ActionsActionAssessedHeader
>(isActionsActionAssessedHeader)

export const isActionsSessionDisconnectEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectEvent,
    ActionsSessionDisconnectHeader
>(isActionsSessionDisconnectHeader)

export const isActionsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ActionsSubscribedContent> => (
    isActionsParseRequestedEnvelope(envelope)
    || isActionsActionAssessedEnvelope(envelope)
    || isActionsSessionDisconnectEnvelope(envelope)
)
