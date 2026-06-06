//
// StreamEventPubSub - A derived pubsub that subscribes to LifeLinePubSub,
// filters StreamEvents, deserializes them via a registry, and publishes
// already-converted data. DataSource slices and personalAssets subscribe
// to StreamEventPubSub instead of LifeLinePubSub for StreamEvent handling.
//

import { PubSub } from '../../../lib/pubSub'
import { LifeLinePubSub } from '../../lifeLine'
import { isSubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { fromWebSocketFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import {
    makeResolvedEnvelopeGuardFromHeaderGuard,
    type DataSourceEventSerializer,
    type EventPayload,
    type SerializableObject,
    type StreamingEventHeader
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

/**
 * Payload published by StreamEventPubSub after deserialization.
 * Header and content are already deserialized.
 */
export type StreamEventDeserializedPayload = {
    dataSourceKey: string
    streamKey: string
    timestamp: number
    header: StreamingEventHeader & { type: string; zone?: string; [key: string]: unknown }
    content: unknown
    /** Snapshot sidecar replay watermark from wire update.replayAt when present */
    replayAt?: number
}

const deserializerRegistry = new Map<
    string,
    DataSourceEventSerializer<EventPayload, EventPayload, SerializableObject, SerializableObject>
>()

let lifeLineSubscriptionId: string | undefined

const replayAtFromSnapshotUpdate = (
    update: { type?: string; [key: string]: unknown } | undefined,
    headerType: string
): number | undefined => {
    if (headerType !== 'Snapshot' || !update) {
        return undefined
    }
    const replayAt = update.replayAt
    return typeof replayAt === 'number' ? replayAt : undefined
}

/**
 * Register a deserializer for a data source key.
 * Called by createDataSourceSlice when slices are created.
 */
export function registerDeserializer(
    dataSourceKey: string,
    deserializer: DataSourceEventSerializer<EventPayload, EventPayload, SerializableObject, SerializableObject>
): void {
    deserializerRegistry.set(dataSourceKey, deserializer)
}

/**
 * Type guard factory: returns an envelope type guard that narrows
 * StreamEventDeserializedPayload (as ResolvedStreamingEnvelope) for the given dataSourceKey.
 * Uses makeResolvedEnvelopeGuardFromHeaderGuard from mtw-lambda-patterns.
 */
export function makeStreamEventGuardForDataSource(dataSourceKey: string) {
    return makeResolvedEnvelopeGuardFromHeaderGuard<unknown, StreamingEventHeader>(
        (header): header is StreamingEventHeader => header.dataSourceKey === dataSourceKey
    )
}

/**
 * Unregister a deserializer for a data source key.
 * Optional; used for cleanup in tests or teardown.
 */
export function unregisterDeserializer(dataSourceKey: string): void {
    deserializerRegistry.delete(dataSourceKey)
}

export const StreamEventPubSub = new PubSub<StreamEventDeserializedPayload>()

function startLifeLineBridge(): void {
    if (lifeLineSubscriptionId) return
    lifeLineSubscriptionId = LifeLinePubSub.subscribe(({ payload }) => {
        if (!isSubscriptionClientMessage(payload) || payload.messageType !== 'StreamEvent') return
        const { dataSourceKey, streamKey, timestamp } = payload
        const deserializer = deserializerRegistry.get(dataSourceKey)
        if (!deserializer) return
        void (async () => {
            try {
                const coreFormat = fromWebSocketFormat(payload)
                const content = await deserializer.deserialize({
                    content: coreFormat.update as any,
                    header: coreFormat.header as any
                })
                if (!content) {
                    return
                }
                const header = { ...coreFormat.header }
                if (Object.prototype.hasOwnProperty.call(coreFormat.update, 'zone')) {
                    ;(header as Record<string, unknown>).zone = (coreFormat.update as Record<string, unknown>).zone
                }
                const replayAt = replayAtFromSnapshotUpdate(
                    coreFormat.update as { type?: string; [key: string]: unknown },
                    header.type
                )
                StreamEventPubSub.publish({
                    dataSourceKey,
                    streamKey,
                    timestamp,
                    header,
                    content,
                    ...(replayAt !== undefined ? { replayAt } : {})
                })
            } catch (err) {
                console.warn(
                    `[StreamEventPubSub] Failed to deserialize for dataSourceKey=${dataSourceKey}, streamKey=${streamKey}:`,
                    err
                )
            }
        })()
    })
}

// Start the bridge when the module is first imported (slices are created at startup)
startLifeLineBridge()
