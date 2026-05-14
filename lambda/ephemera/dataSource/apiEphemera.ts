/**
 * api.ephemera: internal API stream for the ephemera lambda (parallel to api.wml / api.assets).
 * Header/envelope guards and typed messageBus send helpers. Not emitted from EventBridge.
 * Includes cache commands, State Change (`componentId` + `markState`), Objects Change
 * (`componentId` + structured `add` / `remove`; see `ObjectsChangeCommand` in `localApiEvents.ts`),
 * and **Put Thinking Schedule** for thinking schedule persistence.
 */
import {
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type {
    PutCacheRecordCommand,
    DeleteCacheRecordsCommand,
    StateChangeCommand,
    ObjectsChangeCommand,
    ParseRequestedCommand,
    PutThinkingScheduleCommand,
    EphemeraApiCommandPayload,
} from './localApiEvents'

export type EphemeraApiSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' })

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
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' };
          getContent: () => Promise<StateChangeCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' };
          getContent: () => Promise<ObjectsChangeCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' };
          getContent: () => Promise<ParseRequestedCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' };
          getContent: () => Promise<PutThinkingScheduleCommand>;
      }

const isPutCacheRecordHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Cache Record'

const isDeleteCacheRecordsHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Delete Cache Records'

const isStateChangeHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'State Change'

const isObjectsChangeHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Objects Change'

const isParseRequestedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Parse Requested'

const isPutThinkingScheduleHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Thinking Schedule'

export const isEphemeraApiPutCacheRecordEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutCacheRecordCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' }
>(isPutCacheRecordHeader)

export const isEphemeraApiDeleteCacheRecordsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DeleteCacheRecordsCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' }
>(isDeleteCacheRecordsHeader)

export const isEphemeraApiStateChangeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    StateChangeCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' }
>(isStateChangeHeader)

export const isEphemeraApiObjectsChangeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectsChangeCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' }
>(isObjectsChangeHeader)

export const isEphemeraApiParseRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ParseRequestedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' }
>(isParseRequestedHeader)

export const isEphemeraApiPutThinkingScheduleEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutThinkingScheduleCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' }
>(isPutThinkingScheduleHeader)

export const isEphemeraApiSubscribedHeader: HeaderGuard<EphemeraApiSubscribedHeader> = (
    header
): header is EphemeraApiSubscribedHeader =>
    isPutCacheRecordHeader(header)
    || isDeleteCacheRecordsHeader(header)
    || isStateChangeHeader(header)
    || isObjectsChangeHeader(header)
    || isParseRequestedHeader(header)
    || isPutThinkingScheduleHeader(header)

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

/**
 * Post **State Change** to the internal bus (`componentId` + `markState`).
 */
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

/**
 * Post **Objects Change** to the internal bus: `add` is `{ uuid: OBJECT#..., shortName }[]`,
 * `remove` is `OBJECT#...` ids. No ReturnValue for v1.
 */
export function sendObjectsChange(bus: Bus, streamKey: string, content: ObjectsChangeCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Objects Change',
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

/**
 * Post **Parse Requested** to the internal bus for mtw.ephemera.actions ingestion.
 */
export function sendParseRequested(bus: Bus, streamKey: string, content: ParseRequestedCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Parse Requested',
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

/**
 * Post **Put Thinking Schedule** to the internal bus for `mtw.ephemera.thinking.scheduling` persistence.
 */
export function sendPutThinkingSchedule(bus: Bus, streamKey: string, content: PutThinkingScheduleCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Put Thinking Schedule',
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
