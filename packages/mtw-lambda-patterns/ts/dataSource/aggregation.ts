/**
 * Aggregation support for DataSource patterns
 * 
 * This module provides the generic interface for aggregating snapshots with streaming events
 * to maintain current state on clients or subscribers.
 */

import { SerializableObject, EventPayload, StreamingEventHeader, ResolvedStreamingEnvelope } from './baseClasses'

export type { ResolvedStreamingEnvelope } from './baseClasses'

/**
 * Result of applying a single update event
 */
export type AggregationResult<SnapshotPayload> =
    | { success: true; snapshot: SnapshotPayload }
    | { success: false; error: Error; snapshot: SnapshotPayload }

/**
 * Generic aggregator for DataSource snapshots and events
 *
 * Key concept: Aggregation combines a base snapshot with delta events to produce
 * a new snapshot. The internal snapshot format IS the materialized state.
 * Aggregators receive envelopes; routing uses envelope.header exclusively; envelope.content carries domain data.
 *
 * Envelope semantics:
 * - Initial snapshot: ResolvedStreamingEnvelope<SnapshotPayload, Header> with header.type === 'Snapshot'.
 * - Events: ResolvedStreamingEnvelope<UpdatePayload, Header> with other header.type values (e.g. 'Content Update', 'Zone Changed').
 * Snapshot application is "just another envelope": the same applyUpdate entry point handles both; domain aggregators branch on header.type.
 */
export interface DataSourceAggregator<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
> {
    /**
     * Create an empty snapshot (for initialization before any data arrives)
     */
    createEmpty(): SnapshotPayload

    /**
     * Apply a single update or snapshot envelope to a snapshot.
     * Returns the new snapshot (immutable pattern).
     *
     * For header.type === 'Snapshot', content replaces the baseline.
     * For other header.type values, content is merged/applied as a delta.
     *
     * If the update fails (e.g., merge conflict), returns success: false
     * but allows continuation with subsequent events by returning the unchanged snapshot.
     * Use envelope.header.type (and extended header fields) for routing; envelope.content for domain data.
     */
    applyUpdate(
        snapshot: SnapshotPayload,
        envelope: ResolvedStreamingEnvelope<UpdatePayload, Header>
    ): AggregationResult<SnapshotPayload>
}

