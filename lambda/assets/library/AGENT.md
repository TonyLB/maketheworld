# Library Data Source - Agent Navigation Guide

## Overview

The Library data source (`mtw.assets.library`) provides a filtered list of asset IDs available in the Library zone, enabling the Library UI to display and manage publicly available assets. This is a lightweight data source that publishes only asset identifiers—not metadata—allowing the UI to compose full asset information by combining library IDs with other data sources like `mtw.assets.contentHeaders`.

### Context in Architecture

The Library data source serves as a zone-filtered view into the assets system:
- **Upstream Dependency**: Subscribes to `mtw.assets` events to track zone changes
- **Downstream Consumers**: Provides asset ID lists to the Library UI component
- **Separation of Concerns**: Provides IDs only; metadata fetched separately via other data sources

### Key Concepts

**Zone Filtering**: Only includes assets where `zone === 'Library'`. Assets in Canon or Personal zones are excluded.

**Minimal Payload**: Publishes asset UUIDs only, not full metadata. This reduces network overhead and allows the UI to fetch rich metadata on-demand.

**Event-Driven Updates**: Automatically responds to asset zone changes, additions, and removals via EventBridge event subscription.

## Core Purpose

The Library data source provides:

### Primary Function
- **Library Asset Discovery**: Maintain an up-to-date list of asset IDs available in the Library zone
- **Zone Change Tracking**: Automatically update the list as assets move between zones
- **Client Subscription Support**: Enable the Library UI to subscribe to real-time updates

### Key Responsibilities
- Subscribe to `mtw.assets` events (`Zone Updated`, `Asset Cached`, `Asset Removed`)
- Filter events to only process Library zone changes
- Generate snapshots containing Library asset IDs for new subscribers
- Stream incremental updates (`Asset Added`, `Asset Removed`) to active subscribers
- Maintain minimal data payloads (IDs only, no metadata)

## Technical Details

### Data Source Configuration

- **DataSource Key**: `mtw.assets.library`
- **Type**: Replayable DataSource with single `global` stream
- **Stream Key**: `'global'` (single stream for all Library assets)
- **Event Subscription**: Subscribes to `mtw.assets` events via EventBridge
- **Event Publishing**: Publishes filtered asset ID events to subscribers

### Event Types

The Library data source publishes three event types:

1. **`Snapshot`** - Complete list of all asset IDs currently in the Library zone (sent to new subscribers)
2. **`Asset Added`** - Single asset ID that entered the Library zone (incremental update)
3. **`Asset Removed`** - Single asset ID that left the Library zone (incremental update)

**External Format**: Identical to internal format (simple pass-through serializer)

**Type Definitions**: See [`packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.ts`](../../../packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.ts) for complete type definitions and type guards.

**Header vs Payload Authority**: Event type is header-owned. Payload `assetId` carries domain data. The serializer uses envelope-level type guards on `header.type` for discrimination.

### Snapshot Generation

Queries AssetDB using the `ZoneIndex` for assets where `zone === 'Library'` and `DataCategory` begins with `Meta::Asset`. Returns only asset IDs (minimal projection) for efficient performance.

**Implementation**: See `generateLibrarySnapshot()` in [`./index.ts`](./index.ts)

**Performance**: Typically <100ms even with hundreds of assets

### Event Processing Logic

Subscribes to `mtw.assets` events and filters for Library zone changes:

- **Zone Updated** - Publishes `Asset Added` when assets enter Library, `Asset Removed` when they leave
- **Asset Cached** - Publishes `Asset Added` for assets cached in Library zone
- **Asset Removed** - Publishes `Asset Removed` for any asset deletion (idempotent)

All events are processed in parallel via `Promise.all` for efficiency.

**Implementation**: See `receiveEvents` in [`./index.ts`](./index.ts)

### Aggregation Logic

The `LibraryAggregator` maintains client-side state using simple array operations:
- **Snapshot** events replace the entire list
- **Asset Added** events add IDs (idempotent—no-op if already present)
- **Asset Removed** events remove IDs (idempotent—no-op if not present)

All operations are immutable (return new arrays).

**Implementation**: See `LibraryAggregator` in [`packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.ts`](../../../packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.ts)

## Integration Points

### Dependencies

**Backend Dependencies**:
- **AssetDB**: DynamoDB table containing asset metadata (queries via ZoneIndex)
- **EventBridge**: Receives `mtw.assets` events for zone changes
- **Assets Lambda**: Hosts the DataSource instance
- **Subscriptions Lambda**: Routes subscription requests to the data source

**Frontend Dependencies**:
- **LifeLinePubSub**: Receives streaming events via WebSocket
- **Redux Store**: Manages subscription state and materialized views
- **DataSource Slice Pattern**: Generic pattern for subscription management

### Upstream Dependencies

The Library data source **subscribes to** `mtw.assets` events:
- `Zone Updated`: Asset moved between zones
- `Asset Cached`: New asset created or recached
- `Asset Removed`: Asset deleted

### Downstream Consumers

The Library data source **provides data to**:
- **Library UI Component** (`charcoal-client/src/components/Library/index.tsx`): Displays list of library assets
- **Frontend LibraryDataSource Slice** (`charcoal-client/src/slices/libraryDataSource/`): Manages subscription state

### Cross-References

- **[Assets Data Source](../dataSource/AGENT.md)**: Parent data source that publishes zone change events
- **[DataSource Pattern](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)**: Generic pattern implementation
- **[Event Contracts](../../../packages/mtw-interfaces/ts/eventBridge/assets/library/)**: Event type definitions and serializers
- **[Frontend DataSource Slice](../../../charcoal-client/src/slices/dataSource/AGENT.md)**: Generic frontend subscription pattern
- **[Library UI Component](../../../charcoal-client/src/components/Library/index.tsx)**: Primary consumer

## Usage Patterns

### Backend: Creating the DataSource

The DataSource is configured as a replayable `AssetsDataSource` with zone filtering logic.

**Example**: See [`./index.ts`](./index.ts) for the complete implementation including snapshot generation and event processing.

### Frontend: Subscribing to Library

**Subscribe to the global stream**:
```typescript
dispatch(subscribeToLibrary())  // Subscribes to 'global' stream
```

**Get asset IDs**:
```typescript
const libraryAssetIds = useSelector(getLibraryAssetIds)
```

**Smart subscription** (prevents duplicates):
```typescript
const isSubscribed = useSelector(getIsLibrarySubscribed)
if (!isSubscribed) {
  dispatch(subscribeToLibrary())
}
```

**Complete Example**: See [`charcoal-client/src/components/Library/index.tsx`](../../../charcoal-client/src/components/Library/index.tsx) lines 100-110 for the production implementation.

### Combining with Other Data Sources

The Library data source provides **only asset IDs**. To display rich metadata, combine with other data sources:

1. Subscribe to Library → Get asset IDs
2. For each ID, subscribe to `mtw.assets.contentHeaders` → Get names, descriptions, etc.
3. Combine in UI selectors for complete display

**Pattern**: The Library UI demonstrates this composition—it gets IDs from `libraryDataSource` and can fetch additional metadata as needed from other sources.

## Navigation Tips

### Getting Started

1. **Understand the Pattern**: Review [`../dataSource/AGENT.md`](../dataSource/AGENT.md) to understand the generic DataSource pattern
2. **Review Event Contracts**: See [`packages/mtw-interfaces/ts/eventBridge/assets/library/`](../../../packages/mtw-interfaces/ts/eventBridge/assets/library/) for event type definitions
3. **Study Frontend Integration**: Look at [`charcoal-client/src/slices/libraryDataSource/`](../../../charcoal-client/src/slices/libraryDataSource/) for subscription management

### Key Files

**Backend Implementation**:
- **DataSource Instance**: `./index.ts` - Main DataSource configuration and event processing
- **Event Contracts**: `packages/mtw-interfaces/ts/eventBridge/assets/library/index.ts` - Event types and serializers
- **Aggregator**: `packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.ts` - Client-side state management logic

**Frontend Implementation**:
- **Redux Slice**: `charcoal-client/src/slices/libraryDataSource/index.ts` - Subscription state management
- **UI Component**: `charcoal-client/src/components/Library/index.tsx` - Primary consumer
- **Store Integration**: `charcoal-client/src/store/index.ts` - Redux store configuration

**Tests**:
- **Backend Tests**: `./index.test.ts` - DataSource implementation tests (15 tests)
- **Interface Tests**: `packages/mtw-interfaces/ts/eventBridge/assets/library/baseClasses.test.ts` - Event contracts (41 tests)
- **Frontend Tests**: `charcoal-client/src/slices/libraryDataSource/index.test.ts` - Subscription management (16 tests)

### Related Documentation

- **[DataSource Pattern Guide](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)**: Generic pattern documentation
- **[Assets Data Source](../dataSource/AGENT.md)**: Parent data source
- **[Content Headers Data Source](../contentHeaders/AGENT.md)**: Complementary metadata source

## Development Notes

### Current State

**Status**: ✅ Production-ready (as of October 2025)
- Fully implemented and tested (72 tests passing)
- End-to-end pipeline validated
- Legacy system completely removed
- Active in pre-release environment

**Implementation**: First iteration with single `global` stream
- No per-asset authorization filtering
- All subscribers receive same data
- Minimal payload design (IDs only)

### Architecture Decisions

**Why IDs Only?**
- Reduces network overhead (90%+ smaller payloads vs. full metadata)
- Enables composition with other data sources (contentHeaders, etc.)
- Simplifies aggregation logic (just array operations)
- Allows UI to fetch metadata on-demand

**Why Single Global Stream?**
- Simplifies implementation (no per-asset stream management)
- Sufficient for Library UI use case (show all available assets)
- Easy to subscribe/unsubscribe
- Can be expanded to per-asset streams in future if needed

**Why Idempotent Events?**
- Safe to process duplicate events
- Resilient to event replay scenarios
- Simplified error handling

### Future Enhancements

**Granular Streams** (if authorization becomes requirement):
- Per-asset streams using asset ID as streamKey
- Authorization-aware filtering based on player permissions
- Dynamic subscription management as permissions change

**Performance Optimizations** (if library grows very large):
- Pagination support for snapshots
- Claim-check pattern for extremely large libraries (>1000 assets)
- Client-side virtual scrolling integration

**Enhanced Metadata** (if simple IDs insufficient):
- Include minimal metadata in events (e.g., asset name, zone)
- Still keep payloads small compared to full metadata
- Balance between network efficiency and UI responsiveness

**Asset Metadata Integration (mtw.assets.contentHeaders coordination):**
- Subscribe to `Asset Updated` (from `mtw.assets`) when Library UI needs to display asset-level names/summaries inline
- Preferred pattern: Keep `mtw.assets.library` publishing IDs only; compose in UI by also subscribing to `mtw.assets.contentHeaders`
- Alternative (opt-in later): Enrich Library snapshot with minimal metadata (ShortName) when UX requires single-stream consumption
- Contracts to reference:
  - `packages/mtw-interfaces/ts/eventBridge/assets/index.ts` (`Asset Updated` external WML payload)
  - `lambda/assets/contentHeaders/index.ts` (how metadata is merged into a `StandardForm` for headers)

### Known Limitations

**No Authorization Filtering**: All subscribers receive same data
- Library zone is generally public, so not a concern currently
- Could add authorization layer in future if needed

**No Pagination**: Snapshot includes all Library assets
- Acceptable for current library sizes (<1000 assets typically)
- Snapshot size: ~50KB for 1000 assets (just IDs)
- Can add pagination if library grows significantly

**Global Stream Only**: No per-asset subscription granularity
- Subscribers receive all Library changes, not just assets they care about
- Acceptable because Library UI shows all assets anyway
- More efficient than managing many per-asset subscriptions
