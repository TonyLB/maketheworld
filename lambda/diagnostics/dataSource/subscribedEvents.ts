import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ConnectionsSessionDisconnectProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import { DiagnosticsAPIPayload, DiagnosticsApiSubscribedHeader } from './apiDiagnostics'

export type DiagnosticsConnectionsProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Session Disconnect Problem' }

export type DiagnosticsApiStaleSessionSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'StaleSessionSweep' }

export type DiagnosticsApiRoomOccupancyDriftSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'RoomOccupancyDriftSweep' }

const isConnectionsProblemHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader => (
    header.dataSourceKey === 'mtw.connections' && header.type === 'Session Disconnect Problem'
)

const isDiagnosticsApiStaleSessionSweepHeader: HeaderGuard<DiagnosticsApiStaleSessionSweepHeader> = (
    header
): header is DiagnosticsApiStaleSessionSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'StaleSessionSweep'
)

const isDiagnosticsApiRoomOccupancyDriftSweepHeader: HeaderGuard<DiagnosticsApiRoomOccupancyDriftSweepHeader> = (
    header
): header is DiagnosticsApiRoomOccupancyDriftSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'RoomOccupancyDriftSweep'
)

export const isDiagnosticsSubscribedHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader | DiagnosticsApiSubscribedHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader | DiagnosticsApiSubscribedHeader => (
    isConnectionsProblemHeader(header) ||
    isDiagnosticsApiStaleSessionSweepHeader(header) ||
    isDiagnosticsApiRoomOccupancyDriftSweepHeader(header)
)

export const isConnectionsProblemEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent,
    DiagnosticsConnectionsProblemHeader
>(isConnectionsProblemHeader)

export const isDiagnosticsApiStaleSessionSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'StaleSessionSweep' }>,
    DiagnosticsApiStaleSessionSweepHeader
>(isDiagnosticsApiStaleSessionSweepHeader)

export const isDiagnosticsApiRoomOccupancyDriftSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'RoomOccupancyDriftSweep' }>,
    DiagnosticsApiRoomOccupancyDriftSweepHeader
>(isDiagnosticsApiRoomOccupancyDriftSweepHeader)

export const isDiagnosticsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent | DiagnosticsAPIPayload,
    DiagnosticsConnectionsProblemHeader | DiagnosticsApiSubscribedHeader
>(isDiagnosticsSubscribedHeader)

export type DiagnosticsSubscribedContent = ConnectionsSessionDisconnectProblemEvent | DiagnosticsAPIPayload
