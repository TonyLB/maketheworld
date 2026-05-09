# Assets Lambda - Event Flow and Data Sources

## Overview

The Assets Lambda serves as a domain authority for asset storage, caching, and metadata management in Make The World's event mesh architecture. It hosts multiple specialized data sources that provide different views of asset data to subscribers, and processes events from upstream sources (particularly WML parsing) to maintain materialized views of asset and component data.

### Role in Event Mesh

The Assets Lambda participates in the event mesh as:
- **Event Consumer**: Processes WML content updates, diagnostic events, and coordination events
- **Event Producer**: Publishes asset-level events to EventBridge for downstream subscribers
- **Data Source Host**: Hosts 7 specialized data sources with different responsibilities
- **Materialized View Authority**: Maintains cached component and asset metadata

## Data Sources

The Assets Lambda hosts seven data sources, each serving a specific purpose:

### 1. **mtw.assets** (Main Assets DataSource)

**Purpose**: Publishes asset-level events (zone changes, caching, removal) to EventBridge

**Type**: Non-replayable (event streaming only, no client subscriptions)

**Streams**: Per-asset streams using asset ID as streamKey

**Events Published**:
- `Zone Updated` - Asset moved between zones (Canon, Library, Personal)
- `Asset Cached` - Asset cached/recached in DynamoDB
- `Asset Removed` - Asset deleted from system

**Event Subscription**: Subscribes to `mtw.wml` events to trigger caching operations

**Diagnostics finding handling (steady state):**
- Subscribes to `mtw.diagnostics` findings including:
  - `Cache Consistency Finding` -> calls `cacheAsset(...)`.
  - `Ephemera RenderCache Finding` -> calls `reseedComponentExamplesFromDiagnostics(...)`.
  - `Player Misalignment Finding` -> calls `healPlayer(player)` idempotently.
- `Ephemera RenderCache Finding` remediation is **assets-led** and **descriptive**:
  - validates and normalizes `perspective` and optional `roomIds`,
  - resolves target room set (`roomIds` scope when provided, else all perspective-eligible rooms),
  - emits synthetic `Component Updated` events from Assets to drive `mtw.assets.componentExamples` fanout.
- This path does **not** write ephemera render cache directly. It preserves ownership boundaries by healing through the existing publish/subscribe chain.

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

### 5. **mtw.assets.players** (Player Data)

**Purpose**: Provides per-player asset libraries, characters, and settings for client player slice

**Type**: Replayable (supports client subscriptions)

**Streams**: Per-player streams using player name as streamKey

**Events Published**:
- `Snapshot` - Complete player library state (assets, characters, settings)
- `Player Settings Updated` - Player preference changes (onboard tags, guest name/ID)
- `Player Asset Assigned` - Asset added to player's library (Personal/Draft zones)
- `Player Asset Removed` - Asset removed from player's library
- `Player Character Assigned` - Character added to player's library
- `Player Character Removed` - Character removed from player's library

**Event Subscription**: Subscribes to `mtw.assets` events for player zone (Personal/Draft) changes and internal `PlayerSettings` messages

**Stream Key Resolution**: Uses player name from `SessionInitialized` coordination message; client auto-subscribes via `onReady` callback once player name is available

**Implementation**: [`./players/index.ts`](./players/index.ts)

**Key Architecture Decisions**:
- Player name is the stream identifier (no connection-scoped fields like `SessionId` in payloads)
- Subscriptions lambda enriches outgoing WebSocket messages with current session ID as special case
- Emits granular deltas derived directly from `mtw.assets` events—no in-memory ownership cache
- Subscribes to legacy `PlayerSettings` messageBus type for now (long-term goal: fold into unified data-source handler pattern)

### 6. **mtw.assets.componentExamples** (Component Examples)

**Purpose**: Publishes Example lifecycle events (ExampleAdded, ExampleRemoved, ExampleUpdated) for Ephemera mirroring. Downstream (e.g. `mtw.ephemera.examples`) subscribes and writes render-cache records keyed by component and `perspectiveId`, using these events as the **authoritative bridge** between Assets blueprints and Ephemera's render cache.

**Type**: Non-replayable (no external client subscribes to this data source)

**Streams**: Per-example streams using `exampleId` as streamKey.

**Events Published**:
- `ExampleAdded`: `{ type: 'ExampleAdded'; exampleId; parentIds; assetStack; example }`
- `ExampleUpdated`: `{ type: 'ExampleUpdated'; exampleId; parentIds; assetStack; example }`
- `ExampleRemoved`: `{ type: 'ExampleRemoved'; exampleId; parentIds; assetStack }`

Where:
- `exampleId`: Example component UUID (blueprint Example)
- `parentIds`: Component UUIDs of parents derived from **Feature**/**Knowledge** **`examples`** lists that reference this Example (`exampleEnrichment` does not walk **`Room.examples`**)
- `assetStack`: Ordered list of AssetUUIDs in the Example's inheritance chain (base-first, event asset last)
- `example`: Cache-shaped payload `{ markState, renderedContent, provenance: { type: 'authored' } }` matching Ephemera render-cache schema

**Event Subscription and Enrichment**:

- Subscribes to `mtw.assets` **Component Updated** and **Component Removed** events.
- Filters to **Example-associated** component events via **[`isExampleAssociatedComponent`](./componentExamples/exampleAssociatedFilter.ts)**:
  - Every **`Example`** component.
  - **`Feature`** and **`Knowledge`** only when they have a non-empty **`examples`** reference list (`component.examples?.payload?.length > 0`).
  - **`Room`** updates **do not** pass this filter (Room prose is **Situation** / **`render`**, not **`Room.examples`**). **`Room`** **`Component Updated`** therefore does **not** drive this data source today; see **[`componentExamples/AGENT.md`](./componentExamples/AGENT.md)** and **[`componentExamples/index.test.ts`](./componentExamples/index.test.ts)**.
- For each Example-associated change, this data source:
  - Reconstructs the Example's **inheritance chain** via `_from` links across the Assets table to build the ordered `assetStack` (base-first, event asset last).
  - Derives **`parentIds`** from **Feature**/**Knowledge** **`examples`** reference lists (via **[`exampleEnrichment.ts`](./componentExamples/exampleEnrichment.ts)**); **`Room.examples`** is not used for parent discovery after the standardized model dropped Room-owned example lists.
  - For `ExampleUpdated` (and eventually `ExampleAdded`), merges the Example across the asset stack into a single payload shaped for Ephemera's render cache (`{ markState, renderedContent, provenance: { type: 'authored' } }`).
  - For `ExampleRemoved`, computes `assetStack` and `parentIds` without emitting a new example payload.

Other component types (Character, Message, Guidance, etc.) are ignored by this data source.

**Diagnostics reseed integration (steady state):**
- `Ephemera RenderCache Finding` remediation in `mtw.assets` uses synthetic `Component Updated` events to intentionally re-enter this enrichment pipeline.
- As a result, reseed uses the same authored payload construction path as normal component updates rather than introducing a separate cache-healing event shape.
- `status: 'missing'` and `status: 'corrupted'` currently share the same idempotent reseed behavior.

**Implementation**: [`./componentExamples/index.ts`](./componentExamples/index.ts)

**Steady-state notes** (filter and enrichment): [`./componentExamples/AGENT.md`](./componentExamples/AGENT.md).

For more on how these events are consumed to populate Ephemera's render cache, see `lambda/ephemera/AGENT.caching.planning.md` and `lambda/ephemera/dataSource/renderCache/AGENT.md`.

### 7. **mtw.assets.components.verticals** (Component import vertical index)

**Purpose**: Maintains **derived** DynamoDB **`Meta::Import::...`** rows keyed by **universal component id**, describing **cross-asset import hops** (`StandardComponent._from`) so future reads can assemble an import vertical with **bounded** Dynamo access (see [`taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentVertical.planning.md)).

**Type**: Non-replayable (integration projector; no subscription snapshots for this key).

**Dynamo**: Under partition **`AssetId = universalKey`**, sort key **`Meta::Import::${parentStripped}::${childStripped}`** (asset ids with `ASSET#` stripped). **Single writer** for these rows: this DataSource only; **`cacheAsset`** does not author **`Meta::Import`** items.

**Event Subscription**:

- Subscribes to `mtw.assets` **`Component Updated`**, **`Component Republished`**, and **`Component Removed`**.
- Projects hop rows from **`component.universalKey`**, **`streamKey`** (child asset), and **`_from`** (parent asset when present). Does **not** publish outbound mesh events in v1.

**Implementation**: [`./dataSource/components/verticals/index.ts`](./dataSource/components/verticals/index.ts)

**Steady-state schema and maintenance**: [`./dataSource/components/verticals/AGENT.md`](./dataSource/components/verticals/AGENT.md).

## Event Flow Patterns

### Incoming Events

The Assets Lambda receives events from multiple sources:

**EventBridge Events**:
- `mtw.wml` events → Content Update, Zone Changed, Asset Purged
- `mtw.diagnostics` events → Heal Global Values
- `mtw.diagnostics` findings → Cache Consistency Finding, Ephemera RenderCache Finding, Player Misalignment Finding
- `mtw.cognito` events → `New Player` triggers idempotent player heal in `mtw.assets` DataSource
- `mtw.subscriptions` events → Initialize Subscription (for replayable data sources)
- synthetic `api.assets` ingress → `HealPlayer` direct invoke path normalized onto the same DataSource lane as mesh events, with response payload returned through message-bus `ReturnValue` extraction
  - `stepFunctions/heal.asl.yaml` now invokes `AssetsFunction` (not `DiagnosticsFunction`) for `HealPlayer`; that invoke lands on this same synthetic ingress lane

**Cognito trigger boundary:** `AssetsFunction` is **not** a Cognito User Pool trigger and never starts `HealStateMachine` directly. Player heal entry is exclusively the `mtw.cognito` mesh subscription (PostConfirmation publish from [`lambda/cognitoEvent`](../cognitoEvent/AGENT.md)) and the synthetic `api.assets` ingress used by the heal SFN task and by direct `type: HealPlayer` invocations. The `HealStateMachine` itself remains for ad-hoc operator invocations and finding-driven heals; it is not started from any in-tree handler.

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
  ↓ Asset-level events (Zone Updated, Asset Cached, Asset Removed, Component Updated, Component Removed)
├─→ mtw.assets.contentHeaders (subscribes for metadata updates)
├─→ mtw.assets.characters (subscribes for character component updates)
├─→ mtw.assets.library (subscribes for Library zone filtering)
├─→ mtw.assets.players (subscribes for Personal/Draft zone changes)
└─→ mtw.assets.componentExamples (subscribes for Component Updated/Removed; publishes Example lifecycle for Ephemera mirroring)
```

### Event Filtering

Each downstream data source applies its own filtering:

- **contentHeaders**: Filters for component updates to extract metadata
- **characters**: Filters for character component changes only
- **library**: Filters for zone changes involving Library zone
- **players**: Filters for zone changes involving Personal/Draft zones and player settings updates
- **componentExamples**: Filters for Component Updated and Component Removed, then to Example-associated components only (**Example**, **Feature** with non-empty **`examples`**, **Knowledge** with non-empty **`examples`**; see **[`componentExamples/exampleAssociatedFilter.ts`](./componentExamples/exampleAssociatedFilter.ts)**)

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
- **mtw.assets.players** - Client player slice (replaces legacy `whoAmI` life-line dependency)
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

Clients subscribe to replayable data sources (contentHeaders, characters, library, players) through the Subscriptions Lambda using standard DataSource subscription messages with the appropriate `dataSourceKey` and `streamKey`.

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
- `./players/index.ts` - Players DataSource

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
- **[Players Data Source](./players/index.ts)**: Player library and settings data source (see inline implementation comments)

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
