/**
 * WML DataSource subscription surface: types, envelope type guards, and typed send-helpers
 * for events this DataSource subscribes to. Colocating these keeps header/payload alignment
 * in one place and gives send sites compile-time safety via the helpers.
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    CoordinationEventUpdate,
    CoordinationCanonizeEvent,
    CoordinationDecanonizeEvent,
    COORDINATION_EVENT_TYPES,
    ApplyEditRequest,
    MoveAssetRequest,
    PurgeAssetRequest,
    CreateSnapshotRequest,
} from './localApiEvents'
import type { DiagnosticsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

// Re-export for use by DataSource subscribedEventTypeGuard
export { COORDINATION_EVENT_TYPES }

export type WMLSubscribedPayload = CoordinationEventUpdate | DiagnosticsEventUpdate

/** Header union for events WML DataSource subscribes to. */
export type WMLSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Apply Edit' })
    | (StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Move Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Canonize Asset' | 'Decanonize Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Create Snapshot' })
    | (StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Purge Asset' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' })

export const isWMLSubscribedHeader: HeaderGuard<WMLSubscribedHeader> = (header): header is WMLSubscribedHeader =>
    isApplyEditHeader(header) ||
    isMoveAssetHeader(header) ||
    isCanonizeOrDecanonizeHeader(header) ||
    isCreateSnapshotHeader(header) ||
    isPurgeAssetHeader(header) ||
    isDiagnosticsHeader(header)

export const isWMLSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<WMLSubscribedPayload, WMLSubscribedHeader>(isWMLSubscribedHeader)

const isApplyEditHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Apply Edit' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Apply Edit' } =>
    h.dataSourceKey === 'api.wml' && h.type === 'Apply Edit'
const isMoveAssetHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Move Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Move Asset' } =>
    h.dataSourceKey === 'api.wml' && h.type === 'Move Asset'
const isCanonizeOrDecanonizeHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Canonize Asset' | 'Decanonize Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Canonize Asset' | 'Decanonize Asset' } =>
    h.dataSourceKey === 'api.wml' && (h.type === 'Canonize Asset' || h.type === 'Decanonize Asset')
const isCreateSnapshotHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Create Snapshot' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Create Snapshot' } =>
    h.dataSourceKey === 'api.wml' && h.type === 'Create Snapshot'
const isPurgeAssetHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Purge Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Purge Asset' } =>
    h.dataSourceKey === 'api.wml' && h.type === 'Purge Asset'
const isDiagnosticsHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' } =>
    h.dataSourceKey === 'mtw.diagnostics'

const isApplyEditEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ApplyEditRequest, StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Apply Edit' }>(isApplyEditHeader)
const isMoveAssetEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<MoveAssetRequest, StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Move Asset' }>(isMoveAssetHeader)
const isCanonizeOrDecanonizeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CoordinationCanonizeEvent | CoordinationDecanonizeEvent, StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Canonize Asset' | 'Decanonize Asset' }>(isCanonizeOrDecanonizeHeader)
const isCreateSnapshotEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CreateSnapshotRequest, StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Create Snapshot' }>(isCreateSnapshotHeader)
const isPurgeAssetEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<PurgeAssetRequest, StreamingEventHeader & { dataSourceKey: 'api.wml'; type: 'Purge Asset' }>(isPurgeAssetHeader)
const isDiagnosticsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<DiagnosticsEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics' }>(isDiagnosticsHeader)

export { isApplyEditEnvelope, isMoveAssetEnvelope, isCanonizeOrDecanonizeEnvelope, isCreateSnapshotEnvelope, isPurgeAssetEnvelope, isDiagnosticsEnvelope }

type Bus = { send: (payload: StreamingEventMessage) => void }

const apiWmlSerializer = { serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({ type: header.type, ...content }) }

export function sendApplyEdit(bus: Bus, streamKey: string, content: ApplyEditRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.wml',
        streamKey,
        timestamp,
        type: 'Apply Edit',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiWmlSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.wml',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendMoveAsset(bus: Bus, streamKey: string, content: MoveAssetRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.wml',
        streamKey,
        timestamp,
        type: 'Move Asset',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiWmlSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.wml',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendCanonizeAsset(bus: Bus, streamKey: string, content: CoordinationCanonizeEvent): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.wml',
        streamKey,
        timestamp,
        type: 'Canonize Asset',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiWmlSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.wml',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendPurgeAsset(bus: Bus, streamKey: string, content: PurgeAssetRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.wml',
        streamKey,
        timestamp,
        type: 'Purge Asset',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiWmlSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.wml',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}
