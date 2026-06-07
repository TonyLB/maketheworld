# streamEventPubSub - Agent Navigation Guide

## Overview

### Purpose

The **streamEventPubSub** module provides a derived pubsub that subscribes to LifeLinePubSub, filters StreamEvent messages, deserializes them via a per-data-source registry, and publishes already-converted data. DataSource slices and personalAssets subscribe to StreamEventPubSub instead of LifeLinePubSub for StreamEvent handling.

### Context

LifeLinePubSub receives all WebSocket messages (Ephemera, Asset, Coordination, Subscription). StreamEvent messages (from the subscriptions service) carry DataSource updates (Snapshots, Content Updates, Merge Conflicts, etc.). Previously, each consumer (dataSource slices, personalAssets) subscribed to LifeLinePubSub, filtered StreamEvents, applied `fromWebSocketFormat`, deserialized, and dispatched. This duplicated format transformation and deserialization across consumers.

StreamEventPubSub centralizes that logic: one subscription to LifeLinePubSub, one deserialize per event, one publish of pre-deserialized payloads. Subscribers receive `StreamEventDeserializedPayload` and dispatch directly.

### Key Concepts

- **Deserializer registry**: Map of `dataSourceKey` -> `DataSourceEventSerializer`. Slices register via `registerDeserializer` when created.
- **LifeLine bridge**: On module load, subscribes to LifeLinePubSub, filters `messageType === 'StreamEvent'` and `isSubscriptionClientMessage`, transforms via `fromWebSocketFormat`, deserializes via registry lookup, publishes to StreamEventPubSub.
- **Snapshot `replayAt` ingress**: For Snapshot events only, `extractReplayAtFromSnapshotHeader` reads flat `header.replayAt` after `fromWebSocketFormat`. Never read from `update.replayAt`. Replay StreamEvents are normalized to flat WebSocket by the feedback lambda (`fromSNSFeedbackFormat` -> `toWebSocketFormat`); see [`lambda/feedback/AGENT.md`](../../../../../lambda/feedback/AGENT.md).
- **Fire-and-forget async**: Deserialization is async (sidecar fetches for WML). The bridge runs deserialize in a fire-and-forget `void (async () => {...})()` so it does not block the LifeLine callback.

---

## Technical Details

### Data Flow

```
LifeLinePubSub (WebSocket) -> StreamEventPubSub bridge
  -> fromWebSocketFormat
  -> registry.get(dataSourceKey).deserialize(...)
  -> StreamEventPubSub.publish({ dataSourceKey, streamKey, timestamp, header, content })

StreamEventPubSub -> dataSource slices (filter by dataSourceKey)
StreamEventPubSub -> personalAssets (filter by dataSourceKey + streamKey)
```

### Exports

- **StreamEventPubSub**: PubSub instance; subscribe/unsubscribe same API as LifeLinePubSub
- **StreamEventDeserializedPayload**: Type for published payloads
- **makeStreamEventGuardForDataSource(dataSourceKey)**: Returns an envelope type guard (via `makeResolvedEnvelopeGuardFromHeaderGuard`) that narrows payloads for the given data source
- **registerDeserializer(dataSourceKey, deserializer)**: Register deserializer for a data source
- **unregisterDeserializer(dataSourceKey)**: Unregister (optional, for tests)

### Cross-References

- **lifeLine** ([../../lifeLine/](../../lifeLine/)): LifeLinePubSub; StreamEventPubSub subscribes here
- **dataSource** ([../](../)): Parent; registers deserializers; subscribes to StreamEventPubSub
- **personalAssets** ([../../personalAssets/](../../personalAssets/)): Subscribes to StreamEventPubSub for mtw.wml
