/**
 * WML DataSource subscription surface: types, envelope type guards, and typed send-helpers
 * for events this DataSource subscribes to. Colocating these keeps header/payload alignment
 * in one place and gives send sites compile-time safety via the helpers.
 */
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    CoordinationEventUpdate,
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

const isApplyEditEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<ApplyEditRequest> & { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Apply Edit' } } =>
    e.header.dataSourceKey === 'internal' && e.header.type === 'Apply Edit'
const isMoveAssetEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<MoveAssetRequest> & { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Move Asset' } } =>
    e.header.dataSourceKey === 'internal' && e.header.type === 'Move Asset'
const isCanonizeOrDecanonizeEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<CoordinationEventUpdate> & { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Canonize Asset' | 'Decanonize Asset' } } =>
    e.header.dataSourceKey === 'internal' && (e.header.type === 'Canonize Asset' || e.header.type === 'Decanonize Asset')
const isCreateSnapshotEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<CreateSnapshotRequest> & { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Create Snapshot' } } =>
    e.header.dataSourceKey === 'internal' && e.header.type === 'Create Snapshot'
const isPurgeAssetEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<PurgeAssetRequest> & { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Purge Asset' } } =>
    e.header.dataSourceKey === 'internal' && e.header.type === 'Purge Asset'
const isDiagnosticsEnvelope = (e: StreamingEventEnvelope<WMLSubscribedPayload>): e is StreamingEventEnvelope<DiagnosticsEventUpdate> =>
    e.header.dataSourceKey === 'mtw.diagnostics'

export { isApplyEditEnvelope, isMoveAssetEnvelope, isCanonizeOrDecanonizeEnvelope, isCreateSnapshotEnvelope, isPurgeAssetEnvelope, isDiagnosticsEnvelope }

type Bus = { send: (payload: StreamingEventMessage) => void }

export function sendApplyEdit(bus: Bus, streamKey: string, content: ApplyEditRequest): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'internal',
        streamKey,
        timestamp,
        type: content.type,
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        content,
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
        type: content.type,
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        content,
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
        type: content.type,
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        content,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}
