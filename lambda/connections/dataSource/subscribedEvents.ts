import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from "@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses"
import { DiagnosticsStaleSessionIdFindingEvent } from "@tonylb/mtw-interfaces/ts/eventBridge/diagnostics"

export type ConnectionsSubscribedHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Stale SessionId Finding' }

const isDiagnosticsStaleSessionFindingHeader: HeaderGuard<ConnectionsSubscribedHeader> = (
    header
): header is ConnectionsSubscribedHeader =>
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Stale SessionId Finding'

export const isConnectionsSubscribedHeader: HeaderGuard<ConnectionsSubscribedHeader> = (
    header
): header is ConnectionsSubscribedHeader => (
    isDiagnosticsStaleSessionFindingHeader(header)
)

export const isDiagnosticsStaleSessionFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsStaleSessionIdFindingEvent,
    ConnectionsSubscribedHeader
>(isDiagnosticsStaleSessionFindingHeader)

export const isConnectionsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsStaleSessionIdFindingEvent,
    ConnectionsSubscribedHeader
>(isConnectionsSubscribedHeader)

export type ConnectionsExternalSubscribedContent = DiagnosticsStaleSessionIdFindingEvent
