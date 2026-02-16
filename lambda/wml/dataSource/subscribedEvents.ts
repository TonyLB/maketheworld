/**
 * WML DataSource subscription surface: types, envelope type guards, and typed send-helpers
 * for events this DataSource subscribes to. Colocating these keeps header/payload alignment
 * in one place and gives send sites compile-time safety via the helpers.
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    CoordinationEventUpdate,
    CoordinationCanonizeEvent,
    CoordinationDecanonizeEvent,
    COORDINATION_EVENT_TYPES,
    ApplyEditRequest,
    MoveAssetRequest,
    PurgeAssetRequest,
    CreateSnapshotRequest,
} from './coordinationSerializer'
import type { DiagnosticsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

// Re-export for use by DataSource subscribedEventTypeGuard
export { COORDINATION_EVENT_TYPES }

export type WMLSubscribedPayload = CoordinationEventUpdate | DiagnosticsEventUpdate

/** Header union for events WML DataSource subscribes to. */
export type WMLSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Apply Edit' })
    | (StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Move Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Canonize Asset' | 'Decanonize Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Create Snapshot' })
    | (StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Purge Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' })

export const isWMLSubscribedHeader: HeaderGuard<WMLSubscribedHeader> = (header): header is WMLSubscribedHeader =>
    isApplyEditHeader(header) ||
    isMoveAssetHeader(header) ||
    isCanonizeOrDecanonizeHeader(header) ||
    isCreateSnapshotHeader(header) ||
    isPurgeAssetHeader(header) ||
    isDiagnosticsHeader(header)

export const isWMLSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<WMLSubscribedPayload, WMLSubscribedHeader>(isWMLSubscribedHeader)

const isApplyEditHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Apply Edit' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Apply Edit' } =>
    h.dataSourceKey === 'internal' && h.type === 'Apply Edit'
const isMoveAssetHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Move Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Move Asset' } =>
    h.dataSourceKey === 'internal' && h.type === 'Move Asset'
const isCanonizeOrDecanonizeHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Canonize Asset' | 'Decanonize Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Canonize Asset' | 'Decanonize Asset' } =>
    h.dataSourceKey === 'internal' && (h.type === 'Canonize Asset' || h.type === 'Decanonize Asset')
const isCreateSnapshotHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Create Snapshot' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Create Snapshot' } =>
    h.dataSourceKey === 'internal' && h.type === 'Create Snapshot'
const isPurgeAssetHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Purge Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Purge Asset' } =>
    h.dataSourceKey === 'internal' && h.type === 'Purge Asset'
const isDiagnosticsHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' } =>
    h.dataSourceKey === 'mtw.diagnostics'

const isApplyEditEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ApplyEditRequest, StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Apply Edit' }>(isApplyEditHeader)
const isMoveAssetEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<MoveAssetRequest, StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Move Asset' }>(isMoveAssetHeader)
const isCanonizeOrDecanonizeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CoordinationCanonizeEvent | CoordinationDecanonizeEvent, StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Canonize Asset' | 'Decanonize Asset' }>(isCanonizeOrDecanonizeHeader)
const isCreateSnapshotEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CreateSnapshotRequest, StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Create Snapshot' }>(isCreateSnapshotHeader)
const isPurgeAssetEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<PurgeAssetRequest, StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Purge Asset' }>(isPurgeAssetHeader)
const isDiagnosticsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<DiagnosticsEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' }>(isDiagnosticsHeader)

export { isApplyEditEnvelope, isMoveAssetEnvelope, isCanonizeOrDecanonizeEnvelope, isCreateSnapshotEnvelope, isPurgeAssetEnvelope, isDiagnosticsEnvelope }

type Bus = { send: (payload: StreamingEventMessage) => void }

export function sendApplyEdit(bus: Bus, streamKey: string, content: ApplyEditRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'internal',
        streamKey,
        timestamp,
        type: 'Apply Edit',
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}

export function sendMoveAsset(bus: Bus, streamKey: string, content: MoveAssetRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'internal',
        streamKey,
        timestamp,
        type: 'Move Asset',
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}

export function sendPurgeAsset(bus: Bus, streamKey: string, content: PurgeAssetRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'internal',
        streamKey,
        timestamp,
        type: 'Purge Asset',
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}
