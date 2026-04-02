/**
 * api.ephemera: internal API stream for the ephemera lambda (parallel to api.wml / api.assets).
 * Header/envelope guards and typed messageBus send helpers. Not emitted from EventBridge.
 * Includes cache commands, Generate Room Preview, and State Change (componentId + markState).
 */
import {
    StreamingEventHeader,
    StreamingEventEnvelope,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type {
    PutCacheRecordCommand,
    DeleteCacheRecordsCommand,
    GenerateRoomPreviewCommand,
    StateChangeCommand,
    EphemeraApiCommandPayload,
} from './localApiEvents'

export type EphemeraApiSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Generate Room Preview' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' })

export type EphemeraApiIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' };
          getContent: () => Promise<PutCacheRecordCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' };
          getContent: () => Promise<DeleteCacheRecordsCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Generate Room Preview' };
          getContent: () => Promise<GenerateRoomPreviewCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' };
          getContent: () => Promise<StateChangeCommand>;
      }

const isPutCacheRecordHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Cache Record'

const isGenerateRoomPreviewHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Generate Room Preview' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Generate Room Preview' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Generate Room Preview'

const isDeleteCacheRecordsHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Delete Cache Records'

const isStateChangeHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'State Change'

export const isEphemeraApiPutCacheRecordEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutCacheRecordCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' }
>(isPutCacheRecordHeader)

export const isEphemeraApiDeleteCacheRecordsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DeleteCacheRecordsCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' }
>(isDeleteCacheRecordsHeader)

export const isEphemeraApiGenerateRoomPreviewEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    GenerateRoomPreviewCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Generate Room Preview' }
>(isGenerateRoomPreviewHeader)

export const isEphemeraApiStateChangeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    StateChangeCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' }
>(isStateChangeHeader)

export const isEphemeraApiSubscribedHeader: HeaderGuard<EphemeraApiSubscribedHeader> = (
    header
): header is EphemeraApiSubscribedHeader =>
    isPutCacheRecordHeader(header)
    || isDeleteCacheRecordsHeader(header)
    || isGenerateRoomPreviewHeader(header)
    || isStateChangeHeader(header)

export const isEphemeraApiSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraApiCommandPayload,
    EphemeraApiSubscribedHeader
>(isEphemeraApiSubscribedHeader)

type Bus = { send: (payload: StreamingEventMessage) => void }

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

export function sendPutCacheRecord(bus: Bus, streamKey: string, content: PutCacheRecordCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Put Cache Record',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendDeleteCacheRecords(bus: Bus, streamKey: string, content: DeleteCacheRecordsCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Delete Cache Records',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendGenerateRoomPreview(bus: Bus, streamKey: string, content: GenerateRoomPreviewCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Generate Room Preview',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendStateChange(bus: Bus, streamKey: string, content: StateChangeCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'State Change',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}
