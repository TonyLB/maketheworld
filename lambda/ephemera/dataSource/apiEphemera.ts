/**
 * api.ephemera: internal API stream for the ephemera lambda (parallel to api.wml / api.assets).
 * Header/envelope guards and typed messageBus send helpers. Not emitted from EventBridge.
 * Includes cache commands, State Change (`componentId` + `markState`), and Objects Change
 * (`componentId` + structured `add` / `remove`; see `ObjectsChangeCommand` in `localApiEvents.ts`).
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
    EphemeraApiCommandPayload,
} from './localApiEvents'

export type EphemeraApiSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Put Cache Record' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Delete Cache Records' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'State Change' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Objects Change' })

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

export const isEphemeraApiSubscribedHeader: HeaderGuard<EphemeraApiSubscribedHeader> = (
    header
): header is EphemeraApiSubscribedHeader =>
    isPutCacheRecordHeader(header)
    || isDeleteCacheRecordsHeader(header)
    || isStateChangeHeader(header)
    || isObjectsChangeHeader(header)

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
