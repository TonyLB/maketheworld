# Assets Lambda - Event Flow and Data Sources

## Overview

The Assets Lambda serves as a domain authority for asset storage, caching, and metadata management in Make The World's event mesh architecture. It hosts multiple specialized data sources that provide different views of asset data to subscribers, and processes events from upstream sources (particularly WML parsing) to maintain materialized views of asset and component data.

### Role in Event Mesh

The Assets Lambda participates in the event mesh as:
- **Event Consumer**: Processes WML content updates, diagnostic events, and coordination events
- **Event Producer**: Publishes asset-level events to EventBridge for downstream subscribers
- **Data Source Host**: Hosts 4 specialized data sources with different responsibilities
- **Materialized View Authority**: Maintains cached component and asset metadata

## Data Sources

The Assets Lambda hosts four data sources, each serving a specific purpose:

### 1. **mtw.assets** (Main Assets DataSource)

**Purpose**: Publishes asset-level events (zone changes, caching, removal) to EventBridge

**Type**: Non-replayable (event streaming only, no client subscriptions)

**Streams**: Per-asset streams using asset ID as streamKey

**Events Published**:
- `Zone Updated` - Asset moved between zones (Canon, Library, Personal)
- `Asset Cached` - Asset cached/recached in DynamoDB
- `Asset Removed` - Asset deleted from system

**Event Subscription**: Subscribes to `mtw.wml` events to trigger caching operations

**Implementation**: [`./dataSource/index.ts`](./dataSource/index.ts)

**Documentation**: See [`./dataSource/AGENT.md`](./dataSource/AGENT.md) (if exists) or inline comments in implementation

### 2. **mtw.assets.contentHeaders** (Content Headers)

**Purpose**: Provides filtered asset and component metadata for content discovery UI

**Type**: Replayable (supports client subscriptions)

**Streams**: Single `global` stream with zone-based asset aggregation

**Events Published**:
- `ContentHeadersSnapshot` - Complete state for all assets
- `ContentHeadersUpdate` - Incremental changes with WML diffs

**Event Subscription**: Subscribes to `mtw.assets` events for asset updates

**Implementation**: [`./contentHeaders/index.ts`](./contentHeaders/index.ts)

**Documentation**: [`./contentHeaders/AGENT.md`](./contentHeaders/AGENT.md)

### 3. **mtw.assets.characters** (Character Data)

**Purpose**: Provides character component data for character-specific queries

**Type**: Replayable (supports client subscriptions)

**Streams**: Per-asset streams using asset ID as streamKey

**Events Published**:
- Character snapshots with WML character listings
- Character updates when character components change

**Event Subscription**: Subscribes to `mtw.assets` component events for character changes

**Implementation**: [`./characters/index.ts`](./characters/index.ts)

**Documentation**: [`./characters/AGENT.md`](./characters/AGENT.md)

### 4. **mtw.assets.library** (Library Zone Assets)

**Purpose**: Provides filtered list of asset IDs in the Library zone for Library UI

**Type**: Replayable (supports client subscriptions)

**Streams**: Single `global` stream for all Library assets

**Events Published**:
- `Snapshot` - Complete list of Library asset IDs
- `Asset Added` - Asset entered Library zone
- `Asset Removed` - Asset left Library zone

**Event Subscription**: Subscribes to `mtw.assets` events for zone changes

**Implementation**: [`./library/index.ts`](./library/index.ts)

**Documentation**: [`./library/AGENT.md`](./library/AGENT.md)

## Event Flow Patterns

### Incoming Events

The Assets Lambda receives events from multiple sources:

**EventBridge Events**:
- `mtw.wml` events → Content Update, Content Removed, Zone Changed
- `mtw.diagnostics` events → Heal Global Values
- `mtw.coordination` events → Remove Asset
- `mtw.subscriptions` events → Initialize Subscription (for all 4 data sources)

**WebSocket API Messages**:
- Asset fetch requests
- Metadata queries
- Upload URL generation
- Import defaults fetching
- Player settings updates
- Collaboration status queries

**Implementation**: See event routing in [`./app.ts`](./app.ts) lines 48-315

### Event Processing Flow

```
EventBridge Event
  ↓
app.ts (handler)
  ↓
eventDeserializers (converts external → internal format)
  ↓
messageBus.send() (StreamingEvent)
  ↓
DataSource.receiveEvents() (subscribed to messageBus)
  ↓
streamEvent() (generates outgoing events)
  ↓
EventBridge (publishes to subscribers)
```

### Internal Message Bus

The Assets Lambda uses an internal message bus to coordinate between subsystems:

**Message Types**:
- `StreamingEvent` - Incoming EventBridge events (deserialized)
- `FetchAsset` - Asset retrieval requests
- `FetchImports` - Import resolution requests
- `UploadURL` - Upload link generation
- `PlayerSettings` - Player preference updates (triggers `mtw.assets.players` data source updates)
- `ReturnValue` - WebSocket response messages
- `CollaborationStatus` - Editing collaboration status
- `Error` - Error responses
- (Legacy `PlayerInfo` messages removed - player data now flows through `mtw.assets.players` data source)

**Implementation**: [`./messageBus/`](./messageBus/)

### Data Source Event Pattern

Data sources subscribe to the internal message bus (`dataSource.subscribe()`) and process events via their `receiveEvents` handler. When state changes occur, they publish downstream events using the `streamEvent()` function provided by the DataSource base class.

**Pattern**: External event → Deserializer → MessageBus → DataSource.receiveEvents() → streamEvent() → EventBridge

**Examples**: See any data source implementation (e.g., [`./library/index.ts`](./library/index.ts)) for the complete pattern

## Data Source Relationships

### Dependency Chain

```
mtw.wml (WML Lambda)
  ↓ Content Update events
mtw.assets (Assets Lambda)
  ↓ Asset-level events (Zone Updated, Asset Cached, Asset Removed)
├─→ mtw.assets.contentHeaders (subscribes for metadata updates)
├─→ mtw.assets.characters (subscribes for character component updates)
└─→ mtw.assets.library (subscribes for Library zone filtering)
```

### Event Filtering

Each downstream data source applies its own filtering:

- **contentHeaders**: Filters for component updates to extract metadata
- **characters**: Filters for character component changes only
- **library**: Filters for zone changes involving Library zone

This cascading pattern enables:
- Specialized views of asset data
- Efficient event filtering at each layer
- Independent evolution of each data source
- Composable data in UI (combine multiple sources)

## Configuration

### EventBridge and SNS Rules

The Assets Lambda's event subscriptions are configured in the SAM template:

**EventBridge Rules**: See `template.yaml` under `AssetsFunction.Events` for:
- InitializeSubscriptions event patterns (from `mtw.subscriptions`)
- WML event patterns (from `mtw.wml`)
- Diagnostic event patterns (from `mtw.diagnostics`)
- Coordination event patterns (from `mtw.coordination`)

**SNS Subscriptions**: See `template.yaml` under `AssetsFunction.Events.MTWFeedbackSNS` for SNS topic filters

## Integration Points

### Dependencies

**Upstream Event Sources**:
- **WML Lambda** (`mtw.wml`) - Content parsing and validation events
- **Diagnostics** (`mtw.diagnostics`) - System health and healing events
- **Coordination** (`mtw.coordination`) - Asset lifecycle coordination events
- **Subscriptions Lambda** (`mtw.subscriptions`) - Client subscription initialization

**Data Storage**:
- **AssetDB** (DynamoDB) - Asset and component metadata storage
- **S3 Buckets** - Asset file storage (WML, JSON, images)
- **GraphDB** (DynamoDB) - Component relationship graph

**Infrastructure**:
- **EventBridge** - Event mesh coordination
- **SNS Feedback Topic** - Direct session communication

### Downstream Consumers

**Direct Consumers** (subscribe to Assets Lambda events):
- **mtw.assets.contentHeaders** - Content discovery UI
- **mtw.assets.characters** - Character-specific queries
- **mtw.assets.library** - Library zone filtering
- **Ephemera Lambda** - Real-time game state (via character events)
- **Frontend Clients** - Via Subscriptions Lambda (for replayable sources)

## Usage Patterns

### How Events Are Published

Data sources publish events internally via their `streamEvent` function (provided by the DataSource base class). When asset state changes occur, the relevant data source processes them and publishes appropriate events.

**Example**: When an asset's zone changes, the `mtw.assets` DataSource publishes a `Zone Updated` event, which downstream data sources (contentHeaders, characters, library) automatically receive and filter.

**Implementation**: Data sources call `streamEvent()` within their `receiveEvents` handler—see any data source implementation for examples (e.g., [`./library/index.ts`](./library/index.ts) lines 117-133).

### Processing WML Events

When WML content updates arrive from the WML Lambda, the `mtw.assets` DataSource processes them and triggers caching operations, which result in `Asset Cached` events published to downstream subscribers.

**Event Flow**: `mtw.wml` Content Update → Assets DataSource → cacheAsset operation → `Asset Cached` event

**Implementation**: See [`./dataSource/index.ts`](./dataSource/index.ts) for WML event processing

### Client Subscriptions

Clients subscribe to replayable data sources (contentHeaders, characters, library) through the Subscriptions Lambda using standard DataSource subscription messages with the appropriate `dataSourceKey` and `streamKey`.

**Frontend Examples**: See individual data source AGENT.md files for subscription patterns and helpers

## Navigation Tips

### Understanding Event Flows

1. **Start with app.ts**: Entry point shows how events are routed to the message bus
2. **Check dataSource/index.ts**: Main `mtw.assets` DataSource event processing
3. **Review individual data sources**: Each has its own event filtering and publishing logic
4. **Study messageBus**: Understand internal event coordination

### Key Files

**Event Entry Point**:
- `./app.ts` - Main handler, EventBridge routing, WebSocket API handling

**Data Source Implementations**:
- `./dataSource/index.ts` - Main `mtw.assets` DataSource
- `./contentHeaders/index.ts` - Content headers DataSource
- `./characters/index.ts` - Characters DataSource
- `./library/index.ts` - Library DataSource

**Event Coordination**:
- `./messageBus/index.ts` - Internal message bus
- `./messageBus/baseClasses.ts` - Internal message types

**Supporting Systems**:
- `./cacheAsset/` - Asset caching operations
- `./serialize/dbRegister.ts` - Asset registration and event publishing

### Related Documentation

- **[DataSource Pattern](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)**: Generic pattern documentation
- **[Event Architecture](../../AGENT.architecture.events.md)**: System-wide event mesh architecture
- **[Assets Overview](./README.md)**: General Assets Lambda documentation
- **[Content Headers](./contentHeaders/AGENT.md)**: Content headers data source details
- **[Library Data Source](./library/AGENT.md)**: Library zone filtering details
- **[Characters Data Source](./characters/AGENT.md)**: Character data details

## Development Notes

### Current Architecture

The Assets Lambda follows a **layered event processing** model:
1. **External Events** arrive via EventBridge or SNS
2. **Deserialization** converts to internal message bus format
3. **Message Bus** distributes to subscribed handlers
4. **Data Sources** process and generate downstream events
5. **Serialization** converts back to external format for EventBridge

This separation enables:
- Type-safe internal processing
- Clean external API contracts
- Independent evolution of data sources
- Testable event processing logic

### Event Processing Strategy

**Parallel Processing**: Multiple data sources can process the same upstream event independently

**Filtering**: Each data source applies its own filtering logic (zone-specific, component-specific, etc.)

**Idempotency**: Events are designed to be safely processed multiple times

**Error Isolation**: Failures in one data source don't affect others

### Future Considerations

**Authorization Integration**: Currently, authorization is handled at the WebSocket/subscription layer, not in individual data sources. Future enhancements might include:
- Per-stream authorization filtering
- Dynamic permission change handling
- Fine-grained event filtering based on player roles

**Performance Optimization**: As event volume grows, consider:
- Event batching strategies
- Selective event routing
- Claim-check patterns for large events

**Monitoring**: Consider adding:
- Event processing latency metrics
- Event throughput tracking
- Error rate monitoring per data source
