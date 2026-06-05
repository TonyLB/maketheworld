import { PayloadAction } from '@reduxjs/toolkit'
import type { Draft } from 'immer'
import type { EventPayload, SerializableObject, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { DataSourcePublic, RecentEventEnvelope, RequestIdTrackingConfig } from './baseClasses'
import type { StreamEventDeserializedPayload } from './streamEventPubSub'
import { appendConfirmedRequestIds, extractConfirmedIdsFromHeader, pruneStaleConfirmedRequestIdRows } from './requestIdTracking'
import {
    logWmlPerformCleanup,
    logWmlProcessEnvelope,
    type WmlPerformCleanupBaselineSource,
    type WmlPerformCleanupContext
} from '../../testing/wmlStreamSyncInstrumentation'

const SNAPSHOT_HEADER_TYPE = 'Snapshot'
const WML_DATA_SOURCE_KEY = 'mtw.wml'

const baselineSourceFromSnapshotEvents = <
    SnapshotPayload extends SerializableObject,
    Header extends StreamingEventHeader
>(
    snapshotEvents: Array<RecentEventEnvelope<SnapshotPayload, Header>>
): WmlPerformCleanupBaselineSource => {
    if (snapshotEvents.length === 0) {
        return 'empty'
    }
    const lastSnapshot = snapshotEvents[snapshotEvents.length - 1]
    const dataSourceKey = (lastSnapshot.header as Record<string, unknown>).dataSourceKey
    return dataSourceKey === '' ? 'synthetic-prior' : 'snapshot-in-oldEvents'
}

/** publicData fields touched by pruneStaleConfirmedRequestIds */
type PruneConfirmedRequestIdsState = Pick<
    DataSourcePublic<SerializableObject, EventPayload>,
    'subscribedStreams'
>

type StreamStateUpdate<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
> = {
    materializedView: SnapshotPayload
    recentEvents: Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>>
    confirmedRequestIds?: Array<{ id: string; seenAt: number }>
}

const buildStreamUpdate = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    materializedView: SnapshotPayload,
    recentEvents: Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>>,
    header: Header,
    timestamp: number,
    existingStream: {
        confirmedRequestIds?: Array<{ id: string; seenAt: number }>
    },
    requestIdTracking?: RequestIdTrackingConfig
): StreamStateUpdate<SnapshotPayload, UpdatePayload, Header> => {
    const update: StreamStateUpdate<SnapshotPayload, UpdatePayload, Header> = {
        materializedView,
        recentEvents
    }

    if (!requestIdTracking) {
        return update
    }

    const ids = extractConfirmedIdsFromHeader(
        header as Header & Record<string, unknown>,
        requestIdTracking.headerField ?? 'both'
    )

    if (ids.length > 0) {
        update.confirmedRequestIds = appendConfirmedRequestIds(
            existingStream.confirmedRequestIds,
            ids,
            timestamp
        )
    } else if (existingStream.confirmedRequestIds !== undefined) {
        update.confirmedRequestIds = existingStream.confirmedRequestIds
    }

    return update
}

//
// Helper function: Apply multiple update events to a baseline snapshot (reduce pattern)
// Note: Only accepts UpdatePayload events, not snapshots
// Curried: First apply aggregator, then apply to (baselineSnapshot, events)
//
export const applyEvents = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>
) => (
    baselineSnapshot: SnapshotPayload,
    events: Array<RecentEventEnvelope<UpdatePayload, Header>>
): SnapshotPayload => {
    return events.reduce((snapshot, { header, content }) => {
        const result = aggregator.applyUpdate(snapshot, { header, content })
        return result.success ? result.snapshot : snapshot
    }, baselineSnapshot)
}

//
// Helper function: Perform 30-second cleanup (consolidate old events into snapshot)
// Returns cleaned up recentEvents array
// Takes incomingTimestamp to ensure cleanup accounts for the event being processed
// Uses header.type === 'Snapshot' for discrimination; no content-based type guards.
// Curried: First apply config, then apply to (recentEvents, incomingTimestamp, streamKey)
//
export const performCleanup = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>
) => (
    recentEvents: Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>>,
    incomingTimestamp: number,
    streamKey: string,
    instrumentation?: WmlPerformCleanupContext
): Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>> => {
        // Use the latest timestamp (including incoming event) as "now" (pure function - no Date.now())
        // If recentEvents is empty, the spread becomes no-op and Math.max(incomingTimestamp) = incomingTimestamp
        const latestTimestamp = Math.max(...recentEvents.map(e => e.timestamp), incomingTimestamp)
        const thirtySecondsAgo = latestTimestamp - 30000

        // Separate old and recent events
        const oldEvents = recentEvents.filter(e => e.timestamp <= thirtySecondsAgo)
        const stillRecentEvents = recentEvents.filter(e => e.timestamp > thirtySecondsAgo)

        if (oldEvents.length === 0) {
            if (instrumentation) {
                logWmlPerformCleanup({
                    caller: instrumentation.caller,
                    headerType: instrumentation.headerType,
                    streamKey,
                    incomingTimestamp,
                    latestTimestamp,
                    thirtySecondsAgo,
                    oldEvents,
                    stillRecentEvents,
                    action: 'no-op'
                })
            }
            // No cleanup needed
            return recentEvents
        }

        // Find the most recent snapshot in oldEvents (or use empty as baseline)
        const snapshotEvents = oldEvents.filter((e): e is RecentEventEnvelope<SnapshotPayload, Header> => e.header.type === SNAPSHOT_HEADER_TYPE)
        const baselineSource = baselineSourceFromSnapshotEvents(snapshotEvents)
        const baselineSnapshot = snapshotEvents.length > 0
            ? snapshotEvents[snapshotEvents.length - 1].content
            : aggregator.createEmpty(streamKey)

        // Find events after the baseline snapshot (header.type !== 'Snapshot')
        const baselineTimestamp = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1].timestamp : 0
        const eventsAfterBaseline = oldEvents
            .filter(e => e.timestamp > baselineTimestamp && e.header.type !== SNAPSHOT_HEADER_TYPE)
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((e): e is RecentEventEnvelope<UpdatePayload, Header> => e.header.type !== SNAPSHOT_HEADER_TYPE)

    // Consolidate by applying events to baseline
    const consolidatedSnapshot = applyEventsWithAggregator(baselineSnapshot, eventsAfterBaseline)

    // Create synthetic snapshot event at 30-second boundary (placeholder header; not used for aggregation)
    const syntheticSnapshot: RecentEventEnvelope<SnapshotPayload, Header> = {
        header: { dataSourceKey: '', streamKey: '', timestamp: thirtySecondsAgo, type: SNAPSHOT_HEADER_TYPE } as Header,
        content: consolidatedSnapshot,
        timestamp: thirtySecondsAgo
    }

    if (instrumentation) {
        logWmlPerformCleanup({
            caller: instrumentation.caller,
            headerType: instrumentation.headerType,
            streamKey,
            incomingTimestamp,
            latestTimestamp,
            thirtySecondsAgo,
            oldEvents,
            stillRecentEvents,
            action: 'consolidated',
            syntheticTimestamp: thirtySecondsAgo,
            baselineSource
        })
    }

    // Return cleaned up recentEvents with synthetic snapshot + recent events
    return [syntheticSnapshot, ...stillRecentEvents]
}

//
// Reducer: Process incoming snapshot or event envelope with pre-resolved internal content.
// Expects content to already be deserialized (the thunk handles resolution before dispatch).
// Branches on header.type === 'Snapshot' to apply aggregator logic.
// Curried: First apply config, then return the reducer (state, action) => void
//
export const processEnvelope = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    InternalPayload extends SnapshotPayload | UpdatePayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    dataSourceKey: string,
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    performCleanupWithConfig: ReturnType<typeof performCleanup<SnapshotPayload, UpdatePayload, Header>>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>,
    requestIdTracking?: RequestIdTrackingConfig
) => (
    state: any,
    action: PayloadAction<StreamEventDeserializedPayload>
) => {
    const { streamKey, timestamp, header, content } = action.payload

    // Check if stream is subscribed
    const stream = state.subscribedStreams[streamKey]
    if (!stream) {
        return
    }

    const streamingHeader = header as Header

    // NOTE: We pass InternalPayload and Header as separate type params; the action payload is
    // StreamEventDeserializedPayload, which is not a discriminated union on
    // header.type. So we cannot use an envelope type guard to narrow content—we must cast.
    // Future refactor: define the payload as a discriminated union so header.type narrows content.
    if (header.type === SNAPSHOT_HEADER_TYPE) {
        // Snapshot path - content is already internal
        const snapshot = content as SnapshotPayload
        const snapshotTimestamp = timestamp
        const cleanupInstrumentation = dataSourceKey === WML_DATA_SOURCE_KEY
            ? { caller: 'snapshot' as const, headerType: header.type }
            : undefined
        const cleanedRecentEvents = performCleanupWithConfig(
            stream.recentEvents,
            snapshotTimestamp,
            streamKey,
            cleanupInstrumentation
        )
        const eventsAfterSnapshot = cleanedRecentEvents.filter(e => e.timestamp > snapshotTimestamp)

        const snapshotEvent: RecentEventEnvelope<SnapshotPayload, Header> = { header: streamingHeader, content: snapshot, timestamp: snapshotTimestamp }
        const newRecentEvents = [snapshotEvent, ...eventsAfterSnapshot]

        const updateEventsAfterSnapshot = eventsAfterSnapshot.filter((e): e is RecentEventEnvelope<UpdatePayload, Header> => e.header.type !== SNAPSHOT_HEADER_TYPE)
        const newMaterializedView = applyEventsWithAggregator(snapshot, updateEventsAfterSnapshot)

        state.subscribedStreams[streamKey] = buildStreamUpdate(
            newMaterializedView,
            newRecentEvents,
            streamingHeader,
            snapshotTimestamp,
            stream,
            requestIdTracking
        )
        if (dataSourceKey === WML_DATA_SOURCE_KEY) {
            const latestCachedTimestamp = cleanedRecentEvents.length > 0
                ? Math.max(...cleanedRecentEvents.map(e => e.timestamp))
                : 0
            logWmlProcessEnvelope({
                path: 'snapshot',
                streamKey,
                incomingTimestamp: snapshotTimestamp,
                latestCachedTimestamp,
                eventsAfterSnapshotCount: eventsAfterSnapshot.length,
                recentEvents: newRecentEvents,
                materializedView: newMaterializedView
            })
        }
    } else {
        // Event path - content is already internal
        const event = content as UpdatePayload
        const eventTimestamp = timestamp
        const cleanupInstrumentation = dataSourceKey === WML_DATA_SOURCE_KEY
            ? { caller: 'event' as const, headerType: header.type }
            : undefined
        const cleanedRecentEvents = performCleanupWithConfig(
            stream.recentEvents,
            eventTimestamp,
            streamKey,
            cleanupInstrumentation
        )
        const latestTimestamp = cleanedRecentEvents.length > 0
            ? Math.max(...cleanedRecentEvents.map(e => e.timestamp))
            : 0

        const isInOrder = eventTimestamp >= latestTimestamp
        const newEnvelope: RecentEventEnvelope<UpdatePayload, Header> = { header: streamingHeader, content: event, timestamp: eventTimestamp }

        if (isInOrder) {
            const result = aggregator.applyUpdate(stream.materializedView, { header: streamingHeader, content: event })
            const newMaterializedView = result.success ? result.snapshot : stream.materializedView
            const newRecentEvents = [...cleanedRecentEvents, newEnvelope]

            state.subscribedStreams[streamKey] = buildStreamUpdate(
                newMaterializedView,
                newRecentEvents,
                streamingHeader,
                eventTimestamp,
                stream,
                requestIdTracking
            )
            if (dataSourceKey === WML_DATA_SOURCE_KEY) {
                logWmlProcessEnvelope({
                    path: 'event-in-order',
                    streamKey,
                    incomingTimestamp: eventTimestamp,
                    latestCachedTimestamp: latestTimestamp,
                    recentEvents: newRecentEvents,
                    materializedView: newMaterializedView
                })
            }
        } else {
            const snapshotEvents = cleanedRecentEvents.filter((e): e is RecentEventEnvelope<SnapshotPayload, Header> => e.header.type === SNAPSHOT_HEADER_TYPE)
            const baselineSnapshot = snapshotEvents.length > 0
                ? snapshotEvents[snapshotEvents.length - 1].content
                : aggregator.createEmpty(streamKey)
            const baselineTimestamp = snapshotEvents.length > 0
                ? snapshotEvents[snapshotEvents.length - 1].timestamp
                : 0

            const allEvents: Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>> = [
                ...cleanedRecentEvents,
                newEnvelope
            ]
            const sortedEvents = allEvents.sort((a, b) => a.timestamp - b.timestamp)
            const sortedUpdateEvents = sortedEvents.filter((e): e is RecentEventEnvelope<UpdatePayload, Header> =>
                e.header.type !== SNAPSHOT_HEADER_TYPE && e.timestamp > baselineTimestamp
            )

            const newMaterializedView = applyEventsWithAggregator(baselineSnapshot, sortedUpdateEvents)
            const baselineSnapshotEvent = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1] : null
            const sortedEventsWithoutBaseline = baselineSnapshotEvent
                ? sortedEvents.filter(e => !(e.header.type === SNAPSHOT_HEADER_TYPE && e.timestamp === baselineTimestamp))
                : sortedEvents
            const newRecentEvents = baselineSnapshotEvent
                ? [baselineSnapshotEvent, ...sortedEventsWithoutBaseline]
                : sortedEvents

            state.subscribedStreams[streamKey] = buildStreamUpdate(
                newMaterializedView,
                newRecentEvents,
                streamingHeader,
                eventTimestamp,
                stream,
                requestIdTracking
            )
            if (dataSourceKey === WML_DATA_SOURCE_KEY) {
                logWmlProcessEnvelope({
                    path: 'event-reagg',
                    streamKey,
                    incomingTimestamp: eventTimestamp,
                    latestCachedTimestamp: latestTimestamp,
                    recentEvents: newRecentEvents,
                    materializedView: newMaterializedView
                })
            }
        }
    }
}

export const pruneStaleConfirmedRequestIds = (confirmedTtlMs: number) => (
    state: Draft<PruneConfirmedRequestIdsState>,
    action: PayloadAction<{ streamKey: string; now?: number; pendingKeys?: string[] }>
) => {
    const { streamKey, pendingKeys = [] } = action.payload
    const now = action.payload.now ?? Date.now()
    const stream = state.subscribedStreams[streamKey]
    if (!stream?.confirmedRequestIds) {
        return
    }
    stream.confirmedRequestIds = pruneStaleConfirmedRequestIdRows(
        stream.confirmedRequestIds,
        now,
        confirmedTtlMs,
        pendingKeys
    )
}
