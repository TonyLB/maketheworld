/**
 * api.ephemera: internal API stream for the ephemera lambda (parallel to api.wml / api.assets).
 * Header/envelope guards and typed messageBus send helpers. Not emitted from EventBridge.
 * Includes cache commands, State Change (`componentId` + `markState`), Objects Change
 * (`componentId` + structured `add` / `remove`; see `ObjectsChangeCommand` in `localApiEvents.ts`),
 * and **Put Thinking Schedule**, **Put Thinking Job Create**, and **Put Thinking Job Error** for thinking persistence.
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
    ActionAssessedCommand,
    PutThinkingScheduleCommand,
    PutThinkingJobCreateCommand,
    PutThinkingJobErrorCommand,
    EphemeraApiCommandPayload,
} from './localApiEvents'

export type EphemeraApiSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Parse Requested' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Create' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Error' })

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
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' };
          getContent: () => Promise<ActionAssessedCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' };
          getContent: () => Promise<PutThinkingScheduleCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Create' };
          getContent: () => Promise<PutThinkingJobCreateCommand>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Error' };
          getContent: () => Promise<PutThinkingJobErrorCommand>;
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

const isActionAssessedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Action Assessed'

const isPutThinkingScheduleHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Thinking Schedule'

const isPutThinkingJobCreateHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Create' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Create' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Thinking Job Create'

const isPutThinkingJobErrorHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Error' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Error' } =>
    h.dataSourceKey === 'api.ephemera' && h.type === 'Put Thinking Job Error'

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

export const isEphemeraApiActionAssessedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ActionAssessedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Action Assessed' }
>(isActionAssessedHeader)

export const isEphemeraApiPutThinkingScheduleEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutThinkingScheduleCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Schedule' }
>(isPutThinkingScheduleHeader)

export const isEphemeraApiPutThinkingJobCreateEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutThinkingJobCreateCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Create' }
>(isPutThinkingJobCreateHeader)

export const isEphemeraApiPutThinkingJobErrorEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PutThinkingJobErrorCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Thinking Job Error' }
>(isPutThinkingJobErrorHeader)

export const isEphemeraApiSubscribedHeader: HeaderGuard<EphemeraApiSubscribedHeader> = (
    header
): header is EphemeraApiSubscribedHeader =>
    isPutCacheRecordHeader(header)
    || isDeleteCacheRecordsHeader(header)
    || isStateChangeHeader(header)
    || isObjectsChangeHeader(header)
    || isParseRequestedHeader(header)
    || isActionAssessedHeader(header)
    || isPutThinkingScheduleHeader(header)
    || isPutThinkingJobCreateHeader(header)
    || isPutThinkingJobErrorHeader(header)

export const isEphemeraApiSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraApiCommandPayload,
    EphemeraApiSubscribedHeader
>(isEphemeraApiSubscribedHeader)

type ApiEphemeraCommandBus = {
    publish: (payload: StreamingEventMessage) => void
}

function postApiEphemeraStreamingEvent(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    header: StreamingEventHeader,
    getContent: () => Promise<unknown>,
): void {
    const timestamp = Date.now()
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header,
        getContent: getContent as StreamingEventMessage['getContent'],
        timestamp,
    }
    bus.publish(message)
}

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

export function sendPutCacheRecord(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: PutCacheRecordCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Put Cache Record',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

export function sendDeleteCacheRecords(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: DeleteCacheRecordsCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Delete Cache Records',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **State Change** to the internal bus (`componentId` + `markState`).
 */
export function sendStateChange(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: StateChangeCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'State Change',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Objects Change** to the internal bus: `add` is `{ uuid: OBJECT#..., shortName }[]`,
 * `remove` is `OBJECT#...` ids. No ReturnValue for v1.
 */
export function sendObjectsChange(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: ObjectsChangeCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Objects Change',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Parse Requested** to the internal bus for mtw.ephemera.actions ingestion.
 */
export function sendParseRequested(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: ParseRequestedCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Parse Requested',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Action Assessed** to the internal bus for mtw.ephemera.actions ingestion.
 * Pre-assessed parse outcome (v1: Navigation only); skips Bedrock parse and command transcript.
 */
export function sendActionAssessed(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: ActionAssessedCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Action Assessed',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Put Thinking Schedule** to the internal bus for `mtw.ephemera.thinking.scheduling` persistence.
 */
export function sendPutThinkingSchedule(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: PutThinkingScheduleCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Put Thinking Schedule',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Put Thinking Job Create** to the internal bus (job bootstrap; consumer: thinking scheduling DataSource).
 */
export function sendPutThinkingJobCreate(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: PutThinkingJobCreateCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Put Thinking Job Create',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}

/**
 * Post **Put Thinking Job Error** to the internal bus (run-level job failure on `Meta::Job`).
 */
export function sendPutThinkingJobError(
    bus: ApiEphemeraCommandBus,
    streamKey: string,
    content: PutThinkingJobErrorCommand,
): void {
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp: Date.now(),
        type: 'Put Thinking Job Error',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    postApiEphemeraStreamingEvent(bus, streamKey, envelope.header, envelope.getContent)
}
