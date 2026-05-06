import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ConnectionsSessionDisconnectProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import { DiagnosticsAPIPayload, DiagnosticsApiSubscribedHeader, isApiDiagnosticsEnvelope } from './apiDiagnostics'

export type ConnectionsNewPlayerEvent = {
    player: string
}

export type DiagnosticsConnectionsProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Session Disconnect Problem' }

export type DiagnosticsConnectionsNewPlayerHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'New Player' }

const isConnectionsProblemHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader => (
    header.dataSourceKey === 'mtw.connections' && header.type === 'Session Disconnect Problem'
)

const isConnectionsNewPlayerHeader: HeaderGuard<DiagnosticsConnectionsNewPlayerHeader> = (
    header
): header is DiagnosticsConnectionsNewPlayerHeader => (
    header.dataSourceKey === 'mtw.connections' && header.type === 'New Player'
)

export const isDiagnosticsSubscribedHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader => (
    isConnectionsProblemHeader(header) || isConnectionsNewPlayerHeader(header) || (header.dataSourceKey === 'api.diagnostics' && header.type === 'StaleSessionSweep')
)

export const isConnectionsProblemEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent,
    DiagnosticsConnectionsProblemHeader
>(isConnectionsProblemHeader)

export const isDiagnosticsStaleSessionSweepEnvelope = isApiDiagnosticsEnvelope

export const isConnectionsNewPlayerEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsNewPlayerEvent,
    DiagnosticsConnectionsNewPlayerHeader
>(isConnectionsNewPlayerHeader)

export const isDiagnosticsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent | ConnectionsNewPlayerEvent | DiagnosticsAPIPayload,
    DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader
>(isDiagnosticsSubscribedHeader)

export type DiagnosticsSubscribedContent = ConnectionsSessionDisconnectProblemEvent | ConnectionsNewPlayerEvent | DiagnosticsAPIPayload
