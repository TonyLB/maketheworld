import { PayloadAction } from '@reduxjs/toolkit'
import type { Draft } from 'immer'
import type { EventPayload, SerializableObject, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import {
    COMPACTED_CHECKPOINT_HEADER_TYPE,
    SNAPSHOT_HEADER_TYPE,
    type DataSourcePublic,
    type RecentEventEnvelope,
    type RequestIdTrackingConfig
} from './baseClasses'
import type { StreamEventDeserializedPayload } from './streamEventPubSub'
import { appendConfirmedRequestIds, extractConfirmedIdsFromHeader, pruneStaleConfirmedRequestIdRows } from './requestIdTracking'
import {
    logWmlPerformCleanup,
    logWmlProcessEnvelope,
    type WmlPerformCleanupContext
} from '../../testing/wmlStreamSyncInstrumentation'

const WML_DATA_SOURCE_KEY = 'mtw.wml'

type LedgerEnvelope<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
> = RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>

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

export const isAuthoritativeSnapshotHeader = (header: StreamingEventHeader): boolean =>
    header.type === SNAPSHOT_HEADER_TYPE &&
    typeof header.dataSourceKey === 'string' &&
    header.dataSourceKey.length > 0

export const isCompactedCheckpointHeader = (header: StreamingEventHeader): boolean =>
    header.type === COMPACTED_CHECKPOINT_HEADER_TYPE

export const isUpdateEnvelopeHeader = (header: StreamingEventHeader): boolean =>
    !isAuthoritativeSnapshotHeader(header) && !isCompactedCheckpointHeader(header)

/** Parity with resolveReplayCursorTimestamp in packages/mtw-lambda-patterns/ts/dataSource/index.ts (do not import index here -- pulls lambda-only deps into the client bundle). */
export const resolveReplayCursor = (
    envelope: Pick<RecentEventEnvelope<unknown, StreamingEventHeader>, 'timestamp' | 'replayAt'>
): number =>
    envelope.replayAt ?? envelope.timestamp

export const rowCursor = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    row: LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>
): number =>
    isAuthoritativeSnapshotHeader(row.header)
        ? resolveReplayCursor(row)
        : row.timestamp

export const sortUpdateEnvelopes = <
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    events: Array<RecentEventEnvelope<UpdatePayload, Header>>
): Array<RecentEventEnvelope<UpdatePayload, Header>> =>
    [...events].sort((a, b) => compareLedgerRows(a, b))

const ledgerRowKindOrder = (header: StreamingEventHeader): number => {
    if (isAuthoritativeSnapshotHeader(header)) {
        return 0
    }
    if (isCompactedCheckpointHeader(header)) {
        return 1
    }
    return 2
}

const compareLedgerRows = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    a: LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>,
    b: LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>
): number => {
    if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp
    }
    const kindDiff = ledgerRowKindOrder(a.header) - ledgerRowKindOrder(b.header)
    if (kindDiff !== 0) {
        return kindDiff
    }
    return (a.eventId ?? '').localeCompare(b.eventId ?? '')
}

export const sortLedgerChronologically = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>
): Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> =>
    [...recentEvents].sort(compareLedgerRows)

export const invalidateCompactedCheckpointsAt = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    timestamp: number
): Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> =>
    recentEvents.filter(row => !isCompactedCheckpointHeader(row.header) || row.timestamp < timestamp)

export const pruneLedgerBeforeAuthoritativeSnapshot = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    incomingSnapshot: RecentEventEnvelope<SnapshotPayload, Header>
): Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> => {
    const cutoff = resolveReplayCursor(incomingSnapshot)
    return recentEvents.filter(row => rowCursor(row) > cutoff)
}

export const findLatestAuthoritativeSnapshot = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>
): RecentEventEnvelope<SnapshotPayload, Header> | null => {
    let latest: RecentEventEnvelope<SnapshotPayload, Header> | null = null
    for (const row of recentEvents) {
        if (!isAuthoritativeSnapshotHeader(row.header)) {
            continue
        }
        const snapshotRow = row as RecentEventEnvelope<SnapshotPayload, Header>
        if (!latest || snapshotRow.timestamp > latest.timestamp) {
            latest = snapshotRow
        }
    }
    return latest
}

export const findLatestValidCompactedCheckpoint = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>
): RecentEventEnvelope<SnapshotPayload, Header> | null => {
    let latest: RecentEventEnvelope<SnapshotPayload, Header> | null = null
    for (const row of recentEvents) {
        if (!isCompactedCheckpointHeader(row.header)) {
            continue
        }
        const cpRow = row as RecentEventEnvelope<SnapshotPayload, Header>
        if (!latest || cpRow.timestamp > latest.timestamp) {
            latest = cpRow
        }
    }
    return latest
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
    const sorted = sortUpdateEnvelopes(events)
    return sorted.reduce((snapshot, { header, content }) => {
        const result = aggregator.applyUpdate(snapshot, { header, content })
        return result.success ? result.snapshot : snapshot
    }, baselineSnapshot)
}

const countUpdatesSinceSnapshot = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    snapshotIndex: number
): number =>
    recentEvents.slice(snapshotIndex + 1).filter(row => isUpdateEnvelopeHeader(row.header)).length

const updateRowsAfterSnapshot = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    snapshotIndex: number
): Array<RecentEventEnvelope<UpdatePayload, Header>> =>
    recentEvents
        .slice(snapshotIndex + 1)
        .filter((row): row is RecentEventEnvelope<UpdatePayload, Header> => isUpdateEnvelopeHeader(row.header))

const hasNearTailCompactedCheckpoint = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    snapshotIndex: number,
    desirableMedian: number
): boolean => {
    const updates = updateRowsAfterSnapshot(recentEvents, snapshotIndex)
    if (updates.length === 0) {
        return false
    }
    const backCount = Math.max(1, Math.floor(desirableMedian / 2))
    const tailStartIndex = Math.max(0, updates.length - backCount)
    const tailStartTimestamp = updates[tailStartIndex].timestamp
    return recentEvents.some(
        row => isCompactedCheckpointHeader(row.header) && row.timestamp >= tailStartTimestamp
    )
}

const insertCompactedCheckpoint = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader
>(
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    snapshotIndex: number,
    snapshotRow: RecentEventEnvelope<SnapshotPayload, Header> | null,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>,
    streamKey: string,
    dataSourceKey: string,
    desirableMedian: number,
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>
): Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> => {
    const updates = updateRowsAfterSnapshot(recentEvents, snapshotIndex)
    if (updates.length === 0) {
        return recentEvents
    }

    const backCount = Math.max(1, Math.floor(desirableMedian / 2))
    const targetUpdateIndex = Math.max(0, updates.length - 1 - backCount)
    const targetUpdate = updates[targetUpdateIndex]
    const updatesToAggregate = updates.slice(0, targetUpdateIndex + 1)

    const priorCp = findLatestValidCompactedCheckpoint(recentEvents)
    let baseline: SnapshotPayload
    let baselineCursor: number

    if (snapshotRow) {
        baseline = snapshotRow.content
        baselineCursor = resolveReplayCursor(snapshotRow)
    } else if (priorCp && priorCp.timestamp < targetUpdate.timestamp) {
        baseline = priorCp.content
        baselineCursor = priorCp.timestamp
    } else {
        baseline = aggregator.createEmpty(streamKey)
        baselineCursor = 0
    }

    const applicableUpdates = updatesToAggregate.filter(row => row.timestamp > baselineCursor)
    const cpContent = applyEventsWithAggregator(baseline, applicableUpdates)

    const cpRow: RecentEventEnvelope<SnapshotPayload, Header> = {
        header: {
            dataSourceKey,
            streamKey,
            timestamp: targetUpdate.timestamp,
            type: COMPACTED_CHECKPOINT_HEADER_TYPE
        } as Header,
        content: cpContent,
        timestamp: targetUpdate.timestamp
    }

    const withoutCheckpoints = recentEvents.filter(row => !isCompactedCheckpointHeader(row.header))
    return sortLedgerChronologically([...withoutCheckpoints, cpRow])
}

export const recomputeMaterializedViewFromLedger = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>
) => (
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    streamKey: string
): SnapshotPayload => {
    const latestSnapshot = findLatestAuthoritativeSnapshot(recentEvents)
    const latestCp = findLatestValidCompactedCheckpoint(recentEvents)

    let baseline: SnapshotPayload
    let replayCursor: number

    if (latestSnapshot) {
        baseline = latestSnapshot.content
        replayCursor = resolveReplayCursor(latestSnapshot)
    } else if (latestCp) {
        baseline = latestCp.content
        replayCursor = latestCp.timestamp
    } else {
        baseline = aggregator.createEmpty(streamKey)
        replayCursor = 0
    }

    if (latestSnapshot && latestCp && latestCp.timestamp > replayCursor) {
        baseline = latestCp.content
        replayCursor = latestCp.timestamp
    }

    const updateEvents = recentEvents.filter(
        (row): row is RecentEventEnvelope<UpdatePayload, Header> =>
            isUpdateEnvelopeHeader(row.header) && row.timestamp > replayCursor
    )

    return applyEventsWithAggregator(baseline, updateEvents)
}

export const performCleanup = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
>(
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
    applyEventsWithAggregator: ReturnType<typeof applyEvents<SnapshotPayload, UpdatePayload, Header>>,
    desirableMedian: number,
    dataSourceKey: string
) => (
    recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>,
    streamKey: string,
    instrumentation?: WmlPerformCleanupContext
): Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> => {
    const latestSnapshot = findLatestAuthoritativeSnapshot(recentEvents)
    let snapshotIndex = -1
    if (latestSnapshot) {
        snapshotIndex = recentEvents.findIndex(
            row => isAuthoritativeSnapshotHeader(row.header) && row.timestamp === latestSnapshot.timestamp
        )
    }

    const tailUpdateCount = snapshotIndex >= 0
        ? countUpdatesSinceSnapshot(recentEvents, snapshotIndex)
        : recentEvents.filter(row => isUpdateEnvelopeHeader(row.header)).length

    const threshold = 1.5 * desirableMedian
    const nearTailCp = snapshotIndex >= 0
        ? hasNearTailCompactedCheckpoint(recentEvents, snapshotIndex, desirableMedian)
        : recentEvents.some(row => isCompactedCheckpointHeader(row.header))

    const shouldInsert =
        tailUpdateCount > threshold ||
        (tailUpdateCount > 0 && !nearTailCp && tailUpdateCount > Math.floor(desirableMedian / 2))

    if (!shouldInsert) {
        if (instrumentation) {
            logWmlPerformCleanup({
                caller: instrumentation.caller,
                headerType: instrumentation.headerType,
                streamKey,
                tailUpdateCount,
                desirableMedian,
                action: 'no-op'
            })
        }
        return recentEvents
    }

    const result = insertCompactedCheckpoint(
        recentEvents,
        snapshotIndex,
        latestSnapshot,
        applyEventsWithAggregator,
        streamKey,
        dataSourceKey,
        desirableMedian,
        aggregator
    )

    const cpRow = result.find(row => isCompactedCheckpointHeader(row.header))
    if (instrumentation) {
        logWmlPerformCleanup({
            caller: instrumentation.caller,
            headerType: instrumentation.headerType,
            streamKey,
            tailUpdateCount,
            desirableMedian,
            action: 'inserted-cp',
            cpTimestamp: cpRow?.timestamp
        })
    }

    return result
}

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
) => {
    const recompute = recomputeMaterializedViewFromLedger(aggregator, applyEventsWithAggregator)

    return (
        state: any,
        action: PayloadAction<StreamEventDeserializedPayload>
    ) => {
        const { streamKey, timestamp, header, content, replayAt } = action.payload

        const stream = state.subscribedStreams[streamKey]
        if (!stream) {
            return
        }

        const streamingHeader = header as Header
        const cleanupInstrumentation: WmlPerformCleanupContext | undefined = dataSourceKey === WML_DATA_SOURCE_KEY
            ? {
                caller: header.type === SNAPSHOT_HEADER_TYPE ? 'snapshot' : 'event',
                headerType: header.type
            }
            : undefined

        let recentEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>>
        let usedFastPath = false
        let newMaterializedView: SnapshotPayload

        if (header.type === SNAPSHOT_HEADER_TYPE && isAuthoritativeSnapshotHeader(header)) {
            const snapshot = content as SnapshotPayload
            const snapshotEvent: RecentEventEnvelope<SnapshotPayload, Header> = {
                header: streamingHeader,
                content: snapshot,
                timestamp,
                ...(replayAt !== undefined ? { replayAt } : {})
            }

            recentEvents = pruneLedgerBeforeAuthoritativeSnapshot(stream.recentEvents, snapshotEvent)
            recentEvents = sortLedgerChronologically([...recentEvents, snapshotEvent])
            recentEvents = performCleanupWithConfig(recentEvents, streamKey, cleanupInstrumentation)
            newMaterializedView = recompute(recentEvents, streamKey)

            state.subscribedStreams[streamKey] = buildStreamUpdate(
                newMaterializedView,
                recentEvents,
                streamingHeader,
                timestamp,
                stream,
                requestIdTracking
            )

            if (dataSourceKey === WML_DATA_SOURCE_KEY) {
                const replayCursor = resolveReplayCursor(snapshotEvent)
                const updatesAfterCursor = recentEvents.filter(
                    row => isUpdateEnvelopeHeader(row.header) && row.timestamp > replayCursor
                )
                logWmlProcessEnvelope({
                    path: 'snapshot',
                    streamKey,
                    incomingTimestamp: timestamp,
                    replayCursor,
                    latestCachedTimestamp: recentEvents.length > 0
                        ? Math.max(...recentEvents.map(e => e.timestamp))
                        : 0,
                    eventsAfterSnapshotCount: updatesAfterCursor.length,
                    recentEvents,
                    materializedView: newMaterializedView
                })
            }
        } else {
            const event = content as UpdatePayload
            const priorEvents: Array<LedgerEnvelope<SnapshotPayload, UpdatePayload, Header>> = stream.recentEvents
            const latestPriorTimestamp = priorEvents.length > 0
                ? Math.max(...priorEvents.map(e => e.timestamp))
                : 0
            const isInOrder = timestamp >= latestPriorTimestamp

            const newEnvelope: RecentEventEnvelope<UpdatePayload, Header> = {
                header: streamingHeader,
                content: event,
                timestamp
            }

            recentEvents = [...priorEvents, newEnvelope]
            recentEvents = invalidateCompactedCheckpointsAt(recentEvents, timestamp)
            recentEvents = performCleanupWithConfig(recentEvents, streamKey, cleanupInstrumentation)
            recentEvents = sortLedgerChronologically(recentEvents)

            if (isInOrder) {
                const result = aggregator.applyUpdate(stream.materializedView, { header: streamingHeader, content: event })
                newMaterializedView = result.success ? result.snapshot : stream.materializedView
                usedFastPath = true
            } else {
                newMaterializedView = recompute(recentEvents, streamKey)
            }

            state.subscribedStreams[streamKey] = buildStreamUpdate(
                newMaterializedView,
                recentEvents,
                streamingHeader,
                timestamp,
                stream,
                requestIdTracking
            )

            if (dataSourceKey === WML_DATA_SOURCE_KEY) {
                logWmlProcessEnvelope({
                    path: usedFastPath ? 'event-in-order' : 'event-reagg',
                    streamKey,
                    incomingTimestamp: timestamp,
                    latestCachedTimestamp: latestPriorTimestamp,
                    recentEvents,
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
