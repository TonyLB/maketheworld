import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ConnectionsSessionDisconnectProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import { DiagnosticsAPIPayload, DiagnosticsApiSubscribedHeader } from './apiDiagnostics'

export type ConnectionsNewPlayerEvent = {
    player: string
}

export type DiagnosticsConnectionsProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Session Disconnect Problem' }

export type DiagnosticsConnectionsNewPlayerHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'New Player' }

export type DiagnosticsApiStaleSessionSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'StaleSessionSweep' }

export type DiagnosticsApiHealPlayerHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'HealPlayer' }

export type DiagnosticsApiRoomOccupancyDriftSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'RoomOccupancyDriftSweep' }

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

const isDiagnosticsApiStaleSessionSweepHeader: HeaderGuard<DiagnosticsApiStaleSessionSweepHeader> = (
    header
): header is DiagnosticsApiStaleSessionSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'StaleSessionSweep'
)

const isDiagnosticsApiHealPlayerHeader: HeaderGuard<DiagnosticsApiHealPlayerHeader> = (
    header
): header is DiagnosticsApiHealPlayerHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'HealPlayer'
)

const isDiagnosticsApiRoomOccupancyDriftSweepHeader: HeaderGuard<DiagnosticsApiRoomOccupancyDriftSweepHeader> = (
    header
): header is DiagnosticsApiRoomOccupancyDriftSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'RoomOccupancyDriftSweep'
)

export const isDiagnosticsSubscribedHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader => (
    isConnectionsProblemHeader(header) ||
    isConnectionsNewPlayerHeader(header) ||
    isDiagnosticsApiStaleSessionSweepHeader(header) ||
    isDiagnosticsApiHealPlayerHeader(header) ||
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

export const isDiagnosticsApiHealPlayerEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'HealPlayer' }>,
    DiagnosticsApiHealPlayerHeader
>(isDiagnosticsApiHealPlayerHeader)

export const isDiagnosticsApiRoomOccupancyDriftSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'RoomOccupancyDriftSweep' }>,
    DiagnosticsApiRoomOccupancyDriftSweepHeader
>(isDiagnosticsApiRoomOccupancyDriftSweepHeader)

export const isConnectionsNewPlayerEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsNewPlayerEvent,
    DiagnosticsConnectionsNewPlayerHeader
>(isConnectionsNewPlayerHeader)

export const isDiagnosticsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent | ConnectionsNewPlayerEvent | DiagnosticsAPIPayload,
    DiagnosticsConnectionsProblemHeader | DiagnosticsConnectionsNewPlayerHeader | DiagnosticsApiSubscribedHeader
>(isDiagnosticsSubscribedHeader)

export type DiagnosticsSubscribedContent = ConnectionsSessionDisconnectProblemEvent | ConnectionsNewPlayerEvent | DiagnosticsAPIPayload
