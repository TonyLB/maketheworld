import { PayloadAction } from '@reduxjs/toolkit'
import type { EventPayload, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ClientSnapshotMessagePayload, ClientUpdateMessagePayload } from './baseClasses'

//
// Helper function: Apply multiple update events to a baseline snapshot (reduce pattern)
// Note: Only accepts UpdatePayload events, not snapshots
// Curried: First apply aggregator, then apply to (baselineSnapshot, events)
//
export const applyEvents = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>
) => (
    baselineSnapshot: SnapshotPayload,
    events: Array<{ event: UpdatePayload; timestamp: number }>
): SnapshotPayload => {
    return events.reduce((snapshot, { event }) => {
        const result = aggregator.applyUpdate(snapshot, event)
        return result.success ? result.snapshot : snapshot
    }, baselineSnapshot)
}

//
// Helper function: Perform 30-second cleanup (consolidate old events into snapshot)
// Returns cleaned up recentEvents array
// Takes incomingTimestamp to ensure cleanup accounts for the event being processed
// Curried: First apply config, then apply to (recentEvents, incomingTimestamp)
//
export const performCleanup = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    isSnapshot: (event: UpdatePayload | SnapshotPayload) => event is SnapshotPayload,
    isUpdate: (event: UpdatePayload | SnapshotPayload) => event is UpdatePayload,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload>>
) => (
    recentEvents: Array<{ event: UpdatePayload | SnapshotPayload; timestamp: number }>,
    incomingTimestamp: number
): Array<{ event: UpdatePayload | SnapshotPayload; timestamp: number }> => {
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
        const snapshotEvents = oldEvents.filter((e): e is { timestamp: number, event: SnapshotPayload } => isSnapshot(e.event))
        const baselineSnapshot = snapshotEvents.length > 0
            ? snapshotEvents[snapshotEvents.length - 1].event
            : aggregator.createEmpty()
        
        // Find events after the baseline snapshot
        const baselineTimestamp = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1].timestamp : 0
        const eventsAfterBaseline = oldEvents
            .filter(e => e.timestamp > baselineTimestamp && isUpdate(e.event))
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((e): e is { timestamp: number, event: UpdatePayload } => isUpdate(e.event))
        
    // Consolidate by applying events to baseline
    const consolidatedSnapshot = applyEventsWithAggregator(baselineSnapshot, eventsAfterBaseline)
    
    // Create synthetic snapshot event at 30-second boundary
    const syntheticSnapshot: { event: SnapshotPayload; timestamp: number } = {
        event: consolidatedSnapshot,
        timestamp: thirtySecondsAgo
    }
    
    // Return cleaned up recentEvents with synthetic snapshot + recent events
    return [syntheticSnapshot, ...stillRecentEvents]
}

//
// Reducer: Process incoming snapshot event.
// Sidecar resolution (fetch from sidecarUrl when present) happens before this reducer runs.
// Curried: First apply config, then return the reducer (state, action) => void
//
export const processRawSnapshot = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    ExternalSnapshotPayload extends SerializableObject
>(
    dataSourceKey: string,
    eventSerializer: DataSourceEventSerializer<UpdatePayload, any, SnapshotPayload, ExternalSnapshotPayload>,
    isUpdate: (event: UpdatePayload | SnapshotPayload) => event is UpdatePayload,
    performCleanupWithConfig: ReturnType<typeof performCleanup<SnapshotPayload, UpdatePayload>>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload>>
    ) => (
    state: any,
    action: PayloadAction<ClientSnapshotMessagePayload<ExternalSnapshotPayload>>
) => {
        const { streamKey, timestamp, header, content } = action.payload
        
        // Check if stream is subscribed
        const stream = state.subscribedStreams[streamKey]
        if (!stream) {
            // Stream not subscribed, ignore
            return
        }
        
        // Deserialize snapshot (if no deserializer, assume internal/external formats match)
        const snapshot = eventSerializer.deserializeSnapshot
            ? eventSerializer.deserializeSnapshot(content)
            : content as unknown as SnapshotPayload
        
        if (!snapshot) {
            console.warn(`[${dataSourceKey}] Failed to deserialize snapshot for streamKey: ${streamKey}`)
            return
        }
        // Use timestamp from message (not Date.now())
        const snapshotTimestamp = timestamp
        
    // Perform cleanup before processing (pass incoming timestamp for accurate window calculation)
    const cleanedRecentEvents = performCleanupWithConfig(stream.recentEvents, snapshotTimestamp)
    
    // Find events that happened AFTER this snapshot
    const eventsAfterSnapshot = cleanedRecentEvents.filter(
        e => e.timestamp > snapshotTimestamp
    )
    
    // Create new recent events: snapshot first, then events after it
    const snapshotEvent = { event: snapshot, timestamp: snapshotTimestamp }
    const newRecentEvents = [snapshotEvent, ...eventsAfterSnapshot]
    
    // Re-aggregate: Start with snapshot, apply any UPDATE events that came after it
    const updateEventsAfterSnapshot = eventsAfterSnapshot.filter((e): e is { timestamp: number, event: UpdatePayload } => isUpdate(e.event))
    const newMaterializedView = applyEventsWithAggregator(snapshot, updateEventsAfterSnapshot)
    
    // Mutate state directly (Immer will handle immutability)
    state.subscribedStreams[streamKey] = {
        materializedView: newMaterializedView,
        recentEvents: newRecentEvents
    }
}

//
// Reducer: Process incoming update event
// Curried: First apply config, then return the reducer (state, action) => void
//
export const processRawEvent = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    ExternalUpdatePayload extends EventPayload
>(
    dataSourceKey: string,
    eventSerializer: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, any>,
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    isSnapshot: (event: UpdatePayload | SnapshotPayload) => event is SnapshotPayload,
    isUpdate: (event: UpdatePayload | SnapshotPayload) => event is UpdatePayload,
    performCleanupWithConfig: ReturnType<typeof performCleanup<SnapshotPayload, UpdatePayload>>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload>>
    ) => (
    state: any,
    action: PayloadAction<ClientUpdateMessagePayload<ExternalUpdatePayload>>
) => {
        const { streamKey, timestamp, header, content } = action.payload
        
        // Check if stream is subscribed
        const stream = state.subscribedStreams[streamKey]
        if (!stream) {
            // Stream not subscribed, ignore
            return
        }
        
        // Build header for serializer (StreamingEventHeader shape)
        const streamingHeader = {
            dataSourceKey,
            streamKey,
            timestamp,
            type: header.type
        }
        // Deserialize event
        const event = eventSerializer.deserialize({
            dataSourceKey,
            streamKey,
            externalUpdate: content,
            header: streamingHeader
        })
        if (!event) {
            console.warn(`[${dataSourceKey}] Failed to deserialize event for streamKey: ${streamKey}`)
            return
        }
        
        // Use timestamp from message (not Date.now())
        const eventTimestamp = timestamp
        
    // Perform cleanup before processing (pass incoming timestamp for accurate window calculation)
    const cleanedRecentEvents = performCleanupWithConfig(stream.recentEvents, eventTimestamp)
    const latestTimestamp = cleanedRecentEvents.length > 0
        ? Math.max(...cleanedRecentEvents.map(e => e.timestamp))
        : 0
    
    const isInOrder = eventTimestamp >= latestTimestamp
    
    if (isInOrder) {
        // FAST PATH: Simple aggregation
        const result = aggregator.applyUpdate(stream.materializedView, event)
        const newMaterializedView = result.success ? result.snapshot : stream.materializedView
        const newRecentEvents = [...cleanedRecentEvents, { event, timestamp: eventTimestamp }]
        
        // Mutate state directly (Immer will handle immutability)
        state.subscribedStreams[streamKey] = {
            materializedView: newMaterializedView,
            recentEvents: newRecentEvents
        }
    } else {
        // OUT-OF-ORDER PATH: Re-aggregate from snapshot
        // Find most recent snapshot in recentEvents
        const snapshotEvents = cleanedRecentEvents.filter((e): e is { timestamp: number, event: SnapshotPayload } => isSnapshot(e.event))
        const baselineSnapshot = snapshotEvents.length > 0
            ? snapshotEvents[snapshotEvents.length - 1].event
            : aggregator.createEmpty()
        const baselineTimestamp = snapshotEvents.length > 0 
            ? snapshotEvents[snapshotEvents.length - 1].timestamp 
            : 0
        
        // Collect ALL cached events (including the new one) that need to be considered
        // We need to include all events from cleanedRecentEvents plus the new event,
        // then sort by timestamp, then filter for only UPDATE events after the baseline
        const allEvents = [
            ...cleanedRecentEvents,
            { event, timestamp: eventTimestamp }
        ]
        
        // Sort by timestamp (first-to-last chronological order)
        const sortedEvents = allEvents.sort((a, b) => a.timestamp - b.timestamp)
        
        // Filter for only UPDATE events to apply (snapshots shouldn't be re-applied)
        // AND only events AFTER the baseline snapshot (events before are already in the snapshot)
        const sortedUpdateEvents = sortedEvents.filter((e): e is { timestamp: number, event: UpdatePayload } => 
            isUpdate(e.event) && e.timestamp > baselineTimestamp
        )
        
        // Re-aggregate in chronological order from the most recent snapshot
        const newMaterializedView = applyEventsWithAggregator(baselineSnapshot, sortedUpdateEvents)
    
        // Include baseline snapshot + all sorted events (updates and any intermediate snapshots)
        // Exclude the baseline snapshot from sortedEvents to avoid duplication
        const baselineSnapshotEvent = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1] : null
        const sortedEventsWithoutBaseline = baselineSnapshotEvent
            ? sortedEvents.filter(e => !(isSnapshot(e.event) && e.timestamp === baselineTimestamp))
            : sortedEvents
        const newRecentEvents = baselineSnapshotEvent
            ? [baselineSnapshotEvent, ...sortedEventsWithoutBaseline]
            : sortedEvents
    
        // Mutate state directly (Immer will handle immutability)
        state.subscribedStreams[streamKey] = {
            materializedView: newMaterializedView,
            recentEvents: newRecentEvents
        }
    }
}

