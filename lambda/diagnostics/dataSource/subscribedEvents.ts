import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ConnectionsSessionDisconnectProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import { EphemeraObjectsSpawnCompensationProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/objects'
import { PlayerStaleSessionProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/players'
import { DiagnosticsAPIPayload, DiagnosticsApiSubscribedHeader } from './apiDiagnostics'

export type DiagnosticsConnectionsProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections'; type: 'Session Disconnect Problem' }

export type DiagnosticsEphemeraObjectsProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.objects'; type: 'Spawn Compensation Problem' }

export type DiagnosticsPlayersProblemHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.players'; type: 'Stale Session Problem' }

export type DiagnosticsApiStaleSessionSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'StaleSessionSweep' }

export type DiagnosticsApiRoomOccupancyDriftSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'RoomOccupancyDriftSweep' }

export type DiagnosticsApiPlayerMisalignmentSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'PlayerMisalignmentSweep' }

export type DiagnosticsApiComponentVerticalMisalignmentSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'ComponentVerticalMisalignmentSweep' }

export type DiagnosticsApiRenderCacheDriftSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'RenderCacheDriftSweep' }

export type DiagnosticsApiOrphanedImprovisedObjectSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'OrphanedImprovisedObjectSweep' }

export type DiagnosticsApiLudicGraphStaleStructureSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'LudicGraphStaleStructureSweep' }

export type DiagnosticsApiLudicGraphPortMismatchSweepHeader =
    StreamingEventHeader & { dataSourceKey: 'api.diagnostics'; type: 'LudicGraphPortMismatchSweep' }

const isConnectionsProblemHeader: HeaderGuard<DiagnosticsConnectionsProblemHeader> = (
    header
): header is DiagnosticsConnectionsProblemHeader => (
    header.dataSourceKey === 'mtw.connections' && header.type === 'Session Disconnect Problem'
)

const isEphemeraObjectsProblemHeader: HeaderGuard<DiagnosticsEphemeraObjectsProblemHeader> = (
    header
): header is DiagnosticsEphemeraObjectsProblemHeader => (
    header.dataSourceKey === 'mtw.ephemera.objects' && header.type === 'Spawn Compensation Problem'
)

const isPlayersProblemHeader: HeaderGuard<DiagnosticsPlayersProblemHeader> = (
    header
): header is DiagnosticsPlayersProblemHeader => (
    header.dataSourceKey === 'mtw.players' && header.type === 'Stale Session Problem'
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

const isDiagnosticsApiPlayerMisalignmentSweepHeader: HeaderGuard<DiagnosticsApiPlayerMisalignmentSweepHeader> = (
    header
): header is DiagnosticsApiPlayerMisalignmentSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'PlayerMisalignmentSweep'
)

const isDiagnosticsApiComponentVerticalMisalignmentSweepHeader: HeaderGuard<DiagnosticsApiComponentVerticalMisalignmentSweepHeader> = (
    header
): header is DiagnosticsApiComponentVerticalMisalignmentSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'ComponentVerticalMisalignmentSweep'
)

const isDiagnosticsApiRenderCacheDriftSweepHeader: HeaderGuard<DiagnosticsApiRenderCacheDriftSweepHeader> = (
    header
): header is DiagnosticsApiRenderCacheDriftSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'RenderCacheDriftSweep'
)

const isDiagnosticsApiOrphanedImprovisedObjectSweepHeader: HeaderGuard<DiagnosticsApiOrphanedImprovisedObjectSweepHeader> = (
    header
): header is DiagnosticsApiOrphanedImprovisedObjectSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'OrphanedImprovisedObjectSweep'
)

const isDiagnosticsApiLudicGraphStaleStructureSweepHeader: HeaderGuard<DiagnosticsApiLudicGraphStaleStructureSweepHeader> = (
    header
): header is DiagnosticsApiLudicGraphStaleStructureSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'LudicGraphStaleStructureSweep'
)

const isDiagnosticsApiLudicGraphPortMismatchSweepHeader: HeaderGuard<DiagnosticsApiLudicGraphPortMismatchSweepHeader> = (
    header
): header is DiagnosticsApiLudicGraphPortMismatchSweepHeader => (
    header.dataSourceKey === 'api.diagnostics' && header.type === 'LudicGraphPortMismatchSweep'
)

export const isDiagnosticsSubscribedHeader: HeaderGuard<
    DiagnosticsConnectionsProblemHeader |
    DiagnosticsEphemeraObjectsProblemHeader |
    DiagnosticsPlayersProblemHeader |
    DiagnosticsApiSubscribedHeader
> = (
    header
): header is DiagnosticsConnectionsProblemHeader | DiagnosticsEphemeraObjectsProblemHeader | DiagnosticsPlayersProblemHeader | DiagnosticsApiSubscribedHeader => (
    isConnectionsProblemHeader(header) ||
    isEphemeraObjectsProblemHeader(header) ||
    isPlayersProblemHeader(header) ||
    isDiagnosticsApiStaleSessionSweepHeader(header) ||
    isDiagnosticsApiRoomOccupancyDriftSweepHeader(header) ||
    isDiagnosticsApiPlayerMisalignmentSweepHeader(header) ||
    isDiagnosticsApiComponentVerticalMisalignmentSweepHeader(header) ||
    isDiagnosticsApiRenderCacheDriftSweepHeader(header) ||
    isDiagnosticsApiOrphanedImprovisedObjectSweepHeader(header) ||
    isDiagnosticsApiLudicGraphStaleStructureSweepHeader(header) ||
    isDiagnosticsApiLudicGraphPortMismatchSweepHeader(header)
)

export const isConnectionsProblemEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent,
    DiagnosticsConnectionsProblemHeader
>(isConnectionsProblemHeader)

export const isEphemeraObjectsProblemEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraObjectsSpawnCompensationProblemEvent,
    DiagnosticsEphemeraObjectsProblemHeader
>(isEphemeraObjectsProblemHeader)

export const isPlayersProblemEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PlayerStaleSessionProblemEvent,
    DiagnosticsPlayersProblemHeader
>(isPlayersProblemHeader)

export const isDiagnosticsApiStaleSessionSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'StaleSessionSweep' }>,
    DiagnosticsApiStaleSessionSweepHeader
>(isDiagnosticsApiStaleSessionSweepHeader)

export const isDiagnosticsApiRoomOccupancyDriftSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'RoomOccupancyDriftSweep' }>,
    DiagnosticsApiRoomOccupancyDriftSweepHeader
>(isDiagnosticsApiRoomOccupancyDriftSweepHeader)

export const isDiagnosticsApiPlayerMisalignmentSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'PlayerMisalignmentSweep' }>,
    DiagnosticsApiPlayerMisalignmentSweepHeader
>(isDiagnosticsApiPlayerMisalignmentSweepHeader)

export const isDiagnosticsApiComponentVerticalMisalignmentSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'ComponentVerticalMisalignmentSweep' }>,
    DiagnosticsApiComponentVerticalMisalignmentSweepHeader
>(isDiagnosticsApiComponentVerticalMisalignmentSweepHeader)

export const isDiagnosticsApiRenderCacheDriftSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'RenderCacheDriftSweep' }>,
    DiagnosticsApiRenderCacheDriftSweepHeader
>(isDiagnosticsApiRenderCacheDriftSweepHeader)

export const isDiagnosticsApiOrphanedImprovisedObjectSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'OrphanedImprovisedObjectSweep' }>,
    DiagnosticsApiOrphanedImprovisedObjectSweepHeader
>(isDiagnosticsApiOrphanedImprovisedObjectSweepHeader)

export const isDiagnosticsApiLudicGraphStaleStructureSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'LudicGraphStaleStructureSweep' }>,
    DiagnosticsApiLudicGraphStaleStructureSweepHeader
>(isDiagnosticsApiLudicGraphStaleStructureSweepHeader)

export const isDiagnosticsApiLudicGraphPortMismatchSweepEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    Extract<DiagnosticsAPIPayload, { type: 'LudicGraphPortMismatchSweep' }>,
    DiagnosticsApiLudicGraphPortMismatchSweepHeader
>(isDiagnosticsApiLudicGraphPortMismatchSweepHeader)

export const isDiagnosticsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsSessionDisconnectProblemEvent | EphemeraObjectsSpawnCompensationProblemEvent | PlayerStaleSessionProblemEvent | DiagnosticsAPIPayload,
    DiagnosticsConnectionsProblemHeader | DiagnosticsEphemeraObjectsProblemHeader | DiagnosticsPlayersProblemHeader | DiagnosticsApiSubscribedHeader
>(isDiagnosticsSubscribedHeader)

export type DiagnosticsSubscribedContent =
    | ConnectionsSessionDisconnectProblemEvent
    | EphemeraObjectsSpawnCompensationProblemEvent
    | PlayerStaleSessionProblemEvent
    | DiagnosticsAPIPayload
