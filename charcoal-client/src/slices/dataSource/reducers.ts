import { PayloadAction } from '@reduxjs/toolkit'
import type { EventPayload, SerializableObject, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ClientStreamingMessagePayload, RecentEventEnvelope } from './baseClasses'

const SNAPSHOT_HEADER_TYPE = 'Snapshot'

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
// Curried: First apply config, then apply to (recentEvents, incomingTimestamp)
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
    incomingTimestamp: number
): Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>> => {
        // Use the latest timestamp (including incoming event) as "now" (pure function - no Date.now())
        // If recentEvents is empty, the spread becomes no-op and Math.max(incomingTimestamp) = incomingTimestamp
        const latestTimestamp = Math.max(...recentEvents.map(e => e.timestamp), incomingTimestamp)
        const thirtySecondsAgo = latestTimestamp - 30000

        // Separate old and recent events
        const oldEvents = recentEvents.filter(e => e.timestamp <= thirtySecondsAgo)
        const stillRecentEvents = recentEvents.filter(e => e.timestamp > thirtySecondsAgo)

        if (oldEvents.length === 0) {
            // No cleanup needed
            return recentEvents
        }

        // Find the most recent snapshot in oldEvents (or use empty as baseline)
        const snapshotEvents = oldEvents.filter((e): e is RecentEventEnvelope<SnapshotPayload, Header> => e.header.type === SNAPSHOT_HEADER_TYPE)
        const baselineSnapshot = snapshotEvents.length > 0
            ? snapshotEvents[snapshotEvents.length - 1].content
            : aggregator.createEmpty()

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

    // Return cleaned up recentEvents with synthetic snapshot + recent events
    return [syntheticSnapshot, ...stillRecentEvents]
}

//
// Reducer: Process incoming snapshot or event envelope.
// Branches on header.type === 'Snapshot' to deserialize and apply.
// Sidecar resolution (fetch from sidecarUrl when present) happens before this reducer runs.
// Curried: First apply config, then return the reducer (state, action) => void
//
export const processRawEnvelope = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    ExternalPayload extends SerializableObject | EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    dataSourceKey: string,
    eventSerializer: DataSourceEventSerializer<UpdatePayload, any, SnapshotPayload, any>,
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    performCleanupWithConfig: ReturnType<typeof performCleanup<SnapshotPayload, UpdatePayload, Header>>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>
) => (
    state: any,
    action: PayloadAction<ClientStreamingMessagePayload<ExternalPayload>>
) => {
    const { streamKey, timestamp, header, content } = action.payload

    // Check if stream is subscribed
    const stream = state.subscribedStreams[streamKey]
    if (!stream) {
        return
    }

    const streamingHeader: Header = {
        dataSourceKey,
        streamKey,
        timestamp,
        type: header.type,
        ...(Object.prototype.hasOwnProperty.call(header, 'zone') ? { zone: (header as { zone?: string }).zone } : {})
    } as Header

    if (header.type === SNAPSHOT_HEADER_TYPE) {
        // Snapshot path
        const snapshot = eventSerializer.deserializeSnapshot
            ? eventSerializer.deserializeSnapshot(content as any)
            : content as unknown as SnapshotPayload

        if (!snapshot) {
            console.warn(`[${dataSourceKey}] Failed to deserialize snapshot for streamKey: ${streamKey}`)
            return
        }

        const snapshotTimestamp = timestamp
        const cleanedRecentEvents = performCleanupWithConfig(stream.recentEvents, snapshotTimestamp)
        const eventsAfterSnapshot = cleanedRecentEvents.filter(e => e.timestamp > snapshotTimestamp)

        const snapshotEvent: RecentEventEnvelope<SnapshotPayload, Header> = { header: streamingHeader, content: snapshot, timestamp: snapshotTimestamp }
        const newRecentEvents = [snapshotEvent, ...eventsAfterSnapshot]

        const updateEventsAfterSnapshot = eventsAfterSnapshot.filter((e): e is RecentEventEnvelope<UpdatePayload, Header> => e.header.type !== SNAPSHOT_HEADER_TYPE)
        const newMaterializedView = applyEventsWithAggregator(snapshot, updateEventsAfterSnapshot)

        state.subscribedStreams[streamKey] = {
            materializedView: newMaterializedView,
            recentEvents: newRecentEvents
        }
    } else {
        // Event path
        const event = eventSerializer.deserialize({
            content: content as any,
            header: streamingHeader
        })
        if (!event) {
            console.warn(`[${dataSourceKey}] Failed to deserialize event for streamKey: ${streamKey}`)
            return
        }

        const eventTimestamp = timestamp
        const cleanedRecentEvents = performCleanupWithConfig(stream.recentEvents, eventTimestamp)
        const latestTimestamp = cleanedRecentEvents.length > 0
            ? Math.max(...cleanedRecentEvents.map(e => e.timestamp))
            : 0

        const isInOrder = eventTimestamp >= latestTimestamp
        const newEnvelope: RecentEventEnvelope<UpdatePayload, Header> = { header: streamingHeader, content: event, timestamp: eventTimestamp }

        if (isInOrder) {
            const result = aggregator.applyUpdate(stream.materializedView, { header: streamingHeader, content: event })
            const newMaterializedView = result.success ? result.snapshot : stream.materializedView
            const newRecentEvents = [...cleanedRecentEvents, newEnvelope]

            state.subscribedStreams[streamKey] = {
                materializedView: newMaterializedView,
                recentEvents: newRecentEvents
            }
        } else {
            const snapshotEvents = cleanedRecentEvents.filter((e): e is RecentEventEnvelope<SnapshotPayload, Header> => e.header.type === SNAPSHOT_HEADER_TYPE)
            const baselineSnapshot = snapshotEvents.length > 0
                ? snapshotEvents[snapshotEvents.length - 1].content
                : aggregator.createEmpty()
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

            state.subscribedStreams[streamKey] = {
                materializedView: newMaterializedView,
                recentEvents: newRecentEvents
            }
        }
    }
}
