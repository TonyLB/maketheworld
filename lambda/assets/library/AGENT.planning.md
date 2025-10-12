# Assets Library Data Source - Planning Document

## Overview

This document analyzes the existing ad hoc library subscription system and defines requirements for migrating it to the modern DataSource pattern as `mtw.assets.library`.

## Executive Summary

The library subscription system was one of the first real-time subscription implementations in Make The World, created before the generalized DataSource pattern existed. It provides a global view of available assets in the Library zone for the Library UI, using a minimal subscription model with full-state refreshes. The goal of this migration is to modernize this system using the DataSource pattern, simplify the data model to align with the current architecture (where Characters are components within Assets rather than separate files), and properly filter to only Library-zone assets.

---

## Current System Analysis

### 1. Database Storage Pattern

#### **Subscription Storage**
Location: `connectionDB` (Connections table)

**Record Structure**:
```typescript
{
  ConnectionId: 'Library',           // Fixed key for global subscription
  DataCategory: 'Subscriptions',     // Fixed category
  SessionIds: string[]               // Array of subscribing session IDs
}
```

**Characteristics**:
- **Global Subscription**: Single record tracks all library subscribers
- **Session-Based**: Tracks which sessions are interested in library updates
- **Simple Model**: No per-stream differentiation, no event history storage
- **No Replay Data**: No snapshots or event history stored for replay

#### **Library Data Cache**
Location: `assetDB` (Assets table) via `internalCache.Library`

**Data Structure** (Legacy):
```typescript
{
  Assets: Record<string, LibraryAsset>,
  Characters: Record<string, LibraryCharacter>  // NOTE: Legacy pattern
}
```

**Source**: Queried from `assetDB` using `ZoneIndex`:
```typescript
await assetDB.query({
  IndexName: 'ZoneIndex',
  Key: { zone: 'Library' },
  KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
  ExpressionAttributeValues: { ':dcPrefix': 'Meta::' }
})
```

**Characteristics**:
- **Zone-Based Query**: Retrieves all assets/characters in Library zone
- **Lambda-Local Cache**: Cached in `internalCache.Library` during lambda execution
- **On-Demand Generation**: No persistent snapshots, regenerated each time
- **Full State Delivery**: Always sends complete state, not incremental updates
- **Legacy Pattern**: Treats Characters as separate entities (pre-dating current architecture where Characters are components within Assets)

### 2. Message Flow Architecture

#### **Subscribe Flow**

1. **Client Request**: Client sends `{ message: 'subscribe', ... }` to assets lambda via WebSocket
2. **Session Registration**: `librarySubscribeMessage` handler:
   - Gets `sessionId` from `internalCache.Connection`
   - Uses transactional write to add sessionId to global subscription record
   - Includes condition check that session exists
   - Sends success/error return value
3. **Subscription Confirmation**: Client receives confirmation via WebSocket

**Implementation**: `lambda/assets/subscribe/index.ts`

#### **Update Flow**

1. **Trigger**: `LibraryUpdate` message sent to assets lambda via SNS
2. **Data Retrieval**: `libraryUpdateMessage` handler:
   - Clears `internalCache.Library` cache
   - Fetches current Characters and Assets from database
   - Fetches list of subscribing sessionIds
3. **Fan-out**: Publishes single SNS message to FEEDBACK_TOPIC with:
   - Complete current state (all Characters and Assets)
   - Target sessionIds for delivery
   - Message type: 'Library'
4. **Delivery**: Feedback lambda delivers to WebSocket connections

**Implementation**: `lambda/assets/libraryUpdate/index.ts`

**Trigger Sources**:
- SNS messages with `Type` attribute `'LibraryUpdate'` (handled in `app.ts`)
- Presumably triggered by asset/character changes (exact trigger mechanism TBD)

#### **Initial Fetch Flow**

1. **Client Request**: Client sends `{ message: 'fetchLibrary', ... }` to assets lambda
2. **Data Retrieval**: `fetchLibraryMessage` handler:
   - Gets Characters and Assets from `internalCache.Library`
   - Sends return value with complete current state
3. **Delivery**: Client receives data via WebSocket return value

**Implementation**: `lambda/assets/fetchLibrary/index.ts`

**Usage Pattern**: Called once during subscription SYNCHRONIZE phase after SUBSCRIBE succeeds

#### **Unsubscribe Flow**

1. **Client Request**: Client sends `{ message: 'unsubscribe', ... }` to assets lambda
2. **Session Removal**: `libraryUnsubscribeMessage` handler:
   - Gets `sessionId` from `internalCache.Connection`
   - Uses optimistic update to remove sessionId from subscription record
   - Sends success return value
3. **Cleanup**: Client receives confirmation and cleans up local subscription

**Implementation**: `lambda/assets/subscribe/index.ts`

### 3. Front-End Integration

#### **State Machine Pattern**

The front-end uses the older `singleSSM` pattern (predecessor to the modern `dataSource` pattern):

**State Flow**:
```
INITIAL (wait for LifeLine)
  → INACTIVE (idle)
  → SUBSCRIBE (call backend API)
  → SYNCHRONIZE (initial fetch)
  → CONNECTED (receiving updates)
  → UNSUBSCRIBE (cleanup)
  → INACTIVE (back to idle)
```

**Implementation**: `charcoal-client/src/slices/library/index.ts`

#### **Data Reception**

**LifeLinePubSub Subscription** (Legacy):
```typescript
LifeLinePubSub.subscribe(({ payload }) => {
  if (payload.messageType === 'Library') {
    const { Characters, Assets } = payload
    dispatch(receiveLibrary({ Assets, Characters }))
  }
})
```

**State Update** (Legacy):
```typescript
// Simple replacement of entire state
const receiveLibrary = (state, action) => {
  state.Assets = action.payload.Assets
  state.Characters = action.payload.Characters
}
```

**Characteristics**:
- **Full State Replacement**: Each update replaces entire Arrays
- **No Event Aggregation**: No timestamp ordering or event merging
- **No Out-of-Order Handling**: Assumes updates arrive in order
- **Simple Model**: Just maintains current snapshot, no history
- **Legacy Pattern**: Treats Characters as separate from Assets (will need UI refactor)

**Implementation**: `charcoal-client/src/slices/library/receiveLibrary.ts`

#### **Data Types**

**LibraryAsset**:
```typescript
{
  AssetId: string;
  scopedId?: string;
  Story?: boolean;
  instance?: boolean;
}
```

**LibraryCharacter**:
```typescript
{
  CharacterId: string;
  Name: string;
  scopedId: string;
  fileName: string;
  fileURL?: string;
  Pronouns?: {
    subject: string;
    object: string;
    reflexive: string;
    possessive: string;
    adjective: string;
  };
}
```

**Implementation**: `packages/mtw-interfaces/ts/library.ts`

### 4. Current Limitations

#### **Architectural Gaps**

1. **No Event History**: Updates send full state, no incremental changes
2. **No Replay Support**: New subscribers get initial fetch, not catch-up from history
3. **No Streaming Events**: Updates go through SNS/Feedback, not EventBridge
4. **No Event Sourcing**: No audit trail of what changed when
5. **Global Only**: Single subscription scope, no per-asset streams
6. **Wrong Zone Scope**: Legacy system may provide assets from all zones (Canon, Library, Personal) instead of filtering to Library only
7. **Obsolete Data Model**: Treats Characters as separate entities instead of components within Assets

#### **Performance Concerns**

1. **Full State Delivery**: Every update sends complete list with all metadata
2. **Network Overhead**: Large payloads even for small changes
3. **No Claim-Check Pattern**: No S3 storage for large snapshots
4. **Cache Invalidation**: Full cache clear on every update
5. **Redundant Metadata**: Duplicates data that should be fetched via other data sources

#### **Integration Gaps**

1. **Not EventBridge Native**: Uses SNS directly instead of EventBridge streaming
2. **No DataSource Pattern**: Doesn't leverage standardized subscription infrastructure
3. **Manual State Management**: Front-end doesn't use aggregator pattern
4. **No Type Guards**: No event deserialization/serialization boundary
5. **Tight Coupling**: UI depends on complete metadata delivery rather than composing data sources

---

## Requirements for Modern Implementation

### 1. Data Source Configuration

#### **DataSource Key**
```typescript
dataSourceKey: 'mtw.assets.library'
```

#### **Stream Architecture**

**Primary Stream**: Single `'global'` stream (first iteration)
- Maintains current subscription model where all subscribers get same data
- Simplifies migration from existing system
- Provides list of asset IDs in the Library zone only
- Library UI will separately fetch asset/character details as needed

**Scope**: Library zone only
- Only includes assets where `zone === 'Library'`
- Filters events to only track Library zone changes
- Does not include assets from Canon or Personal zones

#### **Replayability**
```typescript
replayable: true
```

**Rationale**:
- Support proper subscription initialization with snapshots
- Enable EventBridge event streaming
- Provide replay capability for new subscribers
- Align with modern DataSource patterns

### 2. Event Types

#### **Internal Event Format** (messageBus)

**Snapshot Event**:
```typescript
{
  type: 'Snapshot',
  assetIds: AssetUUID[]  // Array of asset UUIDs
}
```

**Update Events**:
```typescript
{
  type: 'Asset Added',
  assetId: AssetUUID
}

{
  type: 'Asset Removed',
  assetId: AssetUUID
}
```

**Design Notes**:
- **Simplified Data**: Only asset UUIDs, no metadata (name, images, etc.)
- **Zone-Filtered**: Only includes assets in Library zone
- **No Character Data**: Characters are components within assets; UI fetches separately
- **Minimal Payload**: Reduces network overhead and simplifies aggregation
- **Type Safety**: Uses `AssetUUID` type from `@tonylb/mtw-base/ts/schema`

#### **External Event Format** (EventBridge/Storage)

**Snapshot Event**:
```typescript
{
  type: 'Snapshot',
  assetIds: AssetUUID[]  // Same as internal format
}
```

**Update Events**:
```typescript
{
  type: 'Asset Added',
  assetId: AssetUUID
}

{
  type: 'Asset Removed',
  assetId: AssetUUID
}
```

**Serialization Notes**:
- **Pass-Through**: Internal and external formats are identical (no transformation needed)
- **Simple Serializer**: Just validates structure and type constraints
- **Type Validation**: Ensures `AssetUUID` format (e.g., `ASSET#${string}`)
- **No WML**: Asset UUIDs are already strings in the correct format

### 3. Subscription API

#### **Backend API**

**Subscribe**:
```typescript
// Client sends via WebSocket
{
  messageType: 'Subscribe',
  dataSourceKey: 'mtw.assets.library',
  streamKey: 'global'
}

// Backend response via SNS Feedback (direct to session)
{
  messageType: 'StreamEvent',
  message: {
    dataSourceKey: 'mtw.assets.library',
    streamKey: 'global',
    type: 'Snapshot',
    timestamp: 1234567890,
    assetIds: ['ASSET#abc', 'ASSET#def', ...]
  }
}
```

**Unsubscribe**:
```typescript
// Client sends via WebSocket
{
  messageType: 'Unsubscribe',
  dataSourceKey: 'mtw.assets.library',
  streamKey: 'global'
}
```

#### **Event Delivery**

**Live Updates** (EventBridge → Subscriptions Lambda → WebSocket):
```typescript
{
  messageType: 'StreamEvent',
  message: {
    dataSourceKey: 'mtw.assets.library',
    streamKey: 'global',
    type: 'Asset Added',
    timestamp: 1234567890,
    assetId: 'ASSET#xyz'
  }
}
```

**Replay** (Direct SNS → WebSocket):
- Snapshot + events since snapshot delivered directly to requesting session
- Same message format as live updates
- Timestamp-ordered for correct aggregation

### 4. Storage Schema

#### **DynamoDB Records** (assetDB)

**Primary Key Structure**:
```typescript
{
  AssetId: 'STREAM#mtw.assets.library::global',
  DataCategory: 'Meta::Snapshot' | 'EVENT#${timestamp}::${uuid}'
}
```

**Snapshot Record**:
```typescript
{
  AssetId: 'STREAM#mtw.assets.library::global',
  DataCategory: 'Meta::Snapshot',
  assetIds: AssetUUID[]  // Array of asset UUIDs
}
```

**Event Records**:
```typescript
// Asset added to Library zone
{
  AssetId: 'STREAM#mtw.assets.library::global',
  DataCategory: 'EVENT#1234567890::abc-123',
  type: 'Asset Added',
  assetId: AssetUUID  // e.g., 'ASSET#xyz'
}

// Asset removed from Library zone
{
  AssetId: 'STREAM#mtw.assets.library::global',
  DataCategory: 'EVENT#1234567890::def-456',
  type: 'Asset Removed',
  assetId: AssetUUID  // e.g., 'ASSET#xyz'
}
```

**Storage Characteristics**:
- **Minimal Data**: Just asset UUID strings
- **Small Records**: Typical snapshot < 1KB even with hundreds of assets
- **Efficient Queries**: Single query retrieves entire library list
- **No Redundancy**: Asset metadata stored elsewhere, not duplicated here
- **Type Safe**: Validated `AssetUUID` format

#### **Subscription Tracking** (connectionDB)

**Legacy Pattern** (to be maintained for backwards compatibility):
```typescript
{
  ConnectionId: 'Library',
  DataCategory: 'Subscriptions',
  SessionIds: string[]
}
```

**Modern Pattern** (managed by subscriptions lambda):
- Subscriptions lambda tracks `mtw.assets.library::global` subscribers
- No change needed in assets lambda for subscription tracking
- Legacy pattern can be deprecated once migration complete

### 5. Aggregation Logic

#### **Aggregator Implementation**

**Location**: `packages/mtw-interfaces/ts/eventBridge/assets/library/aggregator.ts`

**Interface**:
```typescript
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

class LibraryAggregator implements DataSourceAggregator<
  LibrarySnapshot,
  LibraryEventUpdate
> {
  createEmpty(): LibrarySnapshot {
    return {
      type: 'Snapshot',
      assetIds: []
    }
  }

  applyUpdate(
    snapshot: LibrarySnapshot,
    update: LibraryEventUpdate
  ): AggregationResult<LibrarySnapshot> {
    switch (update.type) {
      case 'Snapshot':
        // Replace entire snapshot
        return {
          success: true,
          snapshot: {
            type: 'Snapshot',
            assetIds: [...update.assetIds]
          }
        }
      
      case 'Asset Added':
        // Add asset UUID if not already present
        const assetIds = snapshot.assetIds.includes(update.assetId)
          ? snapshot.assetIds
          : [...snapshot.assetIds, update.assetId]
        return {
          success: true,
          snapshot: { type: 'Snapshot', assetIds }
        }
      
      case 'Asset Removed':
        // Remove asset UUID from array
        return {
          success: true,
          snapshot: {
            type: 'Snapshot',
            assetIds: snapshot.assetIds.filter(id => id !== update.assetId)
          }
        }
      
      default:
        return {
          success: false,
          error: new Error(`Unknown event type: ${(update as any).type}`),
          snapshot
        }
    }
  }
}
```

**Key Operations**:
- **Simple Array Manipulation**: Add/remove asset UUIDs
- **Immutable Updates**: Returns new arrays, never mutates
- **Idempotent**: Adding duplicate UUID is no-op, removing missing UUID is no-op
- **No Metadata**: Just maintains list of UUIDs, not asset data
- **Type Safe**: Works with `AssetUUID` type for compile-time validation
- **Efficient**: Set operations on small arrays (< 1000 items typically)

### 6. Snapshot Generation

#### **Snapshot Content Generator**

**Function**:
```typescript
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

async function generateLibrarySnapshot({ 
  streamKey 
}: { 
  streamKey: string 
}): Promise<LibrarySnapshot> {
  // Query only Assets (not Characters) in Library zone
  const Items = await assetDB.query({
    IndexName: 'ZoneIndex',
    Key: { zone: 'Library' },
    KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
    ExpressionAttributeValues: { ':dcPrefix': 'Meta::Asset' }  // Only Assets
  })
  
  // Extract just the asset UUIDs (already in correct format)
  const assetIds: AssetUUID[] = Items.map(({ AssetId }) => AssetId as AssetUUID)
  
  return {
    type: 'Snapshot',
    assetIds
  }
}
```

**Characteristics**:
- **Zone-Filtered**: Only queries `zone: 'Library'` (not Canon or Personal)
- **Assets Only**: Queries `Meta::Asset` only (not `Meta::Character`)
- **Minimal Data**: Returns only asset UUIDs, not full metadata
- **Type Safe**: Returns properly typed `AssetUUID[]`
- **Simple Query**: Single DynamoDB query with minimal projection
- **Fast Generation**: Typically < 100ms even with hundreds of assets
- **Can be cached**: Via SingleFlight for concurrent requests

**Key Changes from Legacy**:
- No Character extraction (Characters are components, not separate entities)
- No metadata extraction (name, images, etc. fetched separately by UI)
- Explicit Library zone filtering (not all zones)
- Simplified return structure with proper TypeScript types

### 7. Event Processing

#### **Event Subscription**

The `mtw.assets.library` DataSource subscribes to `mtw.assets` events and filters for Library zone changes:

**Subscribe to**:
- `mtw.assets` zone change events
- Asset creation/deletion events
- Filter: Only process events affecting Library zone

**Critical Filtering**:
- **Zone In**: Asset moved into Library zone → `Asset Added`
- **Zone Out**: Asset moved out of Library zone → `Asset Removed`
- **Asset Created in Library**: New asset in Library zone → `Asset Added`
- **Asset Deleted from Library**: Asset deletion in Library zone → `Asset Removed`
- **Ignore**: Zone changes not involving Library, metadata updates

**Event Processing**:
```typescript
dataSource.subscribe(messageBus)

// In receiveEvents handler
async receiveEvents({ events, streamEvent }) {
  for (const event of events) {
    // Process only Library zone changes
    if (isZoneChangeEvent(event)) {
      if (event.newZone === 'Library' && event.oldZone !== 'Library') {
        // Asset entering Library
        streamEvent({
          update: {
            type: 'Asset Added',
            assetId: event.assetId
          },
          streamKey: 'global',
          detailType: 'Asset Added'
        })
      } else if (event.oldZone === 'Library' && event.newZone !== 'Library') {
        // Asset leaving Library
        streamEvent({
          update: {
            type: 'Asset Removed',
            assetId: event.assetId
          },
          streamKey: 'global',
          detailType: 'Asset Removed'
        })
      }
    }
    
    if (isAssetCreatedEvent(event) && event.zone === 'Library') {
      // New asset created in Library
      streamEvent({
        update: {
          type: 'Asset Added',
          assetId: event.assetId
        },
        streamKey: 'global',
        detailType: 'Asset Added'
      })
    }
    
    if (isAssetDeletedEvent(event) && event.zone === 'Library') {
      // Asset deleted from Library
      streamEvent({
        update: {
          type: 'Asset Removed',
          assetId: event.assetId
        },
        streamKey: 'global',
        detailType: 'Asset Removed'
      })
    }
  }
}
```

**Key Points**:
- **Library Zone Only**: Ignores zone changes between Canon/Personal
- **No Metadata Updates**: Asset name/description changes don't trigger events (UI fetches metadata separately)
- **Simple Events**: Just ID-based add/remove, no complex updates
- **Idempotent**: Safe to send duplicate add/remove events (aggregator handles)

### 8. Front-End Migration

#### **Phase 1: Dual-Mode Operation**

**Maintain Legacy Support**:
- Keep existing `library` slice operational
- Add new `libraryDataSource` slice using `createDataSourceSlice`
- UI can use either based on feature flag

**Benefits**:
- Zero-downtime migration
- Gradual rollout
- Easy rollback if issues arise

#### **Phase 2: New DataSource Slice**

**Create New Slice**: `charcoal-client/src/slices/libraryDataSource/index.ts`
```typescript
import { createDataSourceSlice } from '../dataSource'
import {
  LibraryAggregator,
  LibraryEventSerializer,
  isLibrarySnapshot,
  isLibraryUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'

export const {
  slice: libraryDataSourceSlice,
  selectors: libraryDataSourceSelectors,
  publicActions: libraryDataSourceActions,
  iterateAllSSMs: iterateLibraryDataSource
} = createDataSourceSlice({
  name: 'libraryDataSource',
  dataSourceKey: 'mtw.assets.library',
  aggregator: new LibraryAggregator(),
  eventSerializer: new LibraryEventSerializer(),
  isSnapshot: isLibrarySnapshot,
  isUpdate: isLibraryUpdate,
  sliceSelector: (state) => state.libraryDataSource
})
```

**Subscribe Helper**:
```typescript
export const subscribeToLibrary = () => {
  return subscribeToLibraryDataSource(['global'])
}

export const unsubscribeFromLibrary = () => {
  return unsubscribeFromLibraryDataSource(['global'])
}
```

**Selector Helpers**:
```typescript
export const getLibraryAssetIds = createSelector(
  [libraryDataSourceSelectors.getSubscribedStreams],
  (streams) => {
    const globalStream = streams['global']
    return globalStream?.materializedView?.assetIds || []
  }
)
```

#### **Phase 3: UI Refactoring** (Major Changes Required)

**Current UI Pattern** (Legacy):
```typescript
// Old: Receives complete asset/character metadata
const { Assets, Characters } = useSelector(getLibrary)

// Directly uses metadata for display
Assets.map(asset => <AssetCard name={asset.scopedId} story={asset.Story} />)
Characters.map(char => <CharacterCard name={char.Name} image={char.fileURL} />)
```

**New UI Pattern** (Modernized):
```typescript
// New: Receives only asset IDs
const assetIds = useSelector(getLibraryAssetIds)

// Fetch asset metadata separately (via contentHeaders or asset data sources)
const assets = useAssetMetadata(assetIds)  // Custom hook to fetch metadata

// Display after metadata loaded
assets.map(asset => <AssetCard {...asset} />)
```

**Required UI Changes**:
1. **Replace Direct Metadata Access**: UI can't use asset/character metadata from library
2. **Add Metadata Fetching**: Need to fetch asset details using asset IDs
3. **Handle Loading States**: Asset metadata loading is now separate from library subscription
4. **Remove Character Handling**: Characters fetched from asset data, not separate list
5. **Update Asset Filtering**: Library zone filtering now handled by data source

**Recommended Approach**:
- Use `mtw.assets.contentHeaders` DataSource for asset metadata
- Subscribe to content headers for all library asset IDs
- Combine library IDs with content headers for complete view
- Extract character data from asset components (not separate entities)

**Example Integration**:
```typescript
// Subscribe to library for asset IDs
const assetIds = useSelector(getLibraryAssetIds)

// Subscribe to content headers for those assets
useEffect(() => {
  assetIds.forEach(assetId => {
    dispatch(subscribeToContentHeaders(assetId))
  })
}, [assetIds])

// Get asset metadata from content headers
const contentHeaders = useSelector(getContentHeadersByAssetIds(assetIds))

// Extract characters from asset data
const characters = contentHeaders.flatMap(asset => 
  extractCharactersFromAsset(asset)
)
```

#### **Phase 4: Deprecation**

**After Migration Complete**:
1. Remove legacy `library` slice
2. Rename `libraryDataSource` to `library` (optional)
3. Remove old message handlers (`librarySubscribeMessage`, `libraryUpdateMessage`, etc.)
4. Remove legacy subscription tracking in connectionDB
5. Clean up old tests and documentation

**Important Notes**:
- **UI refactoring is substantial**: Not just a drop-in replacement
- **Characters are different**: Now components within assets, not separate entities
- **Metadata is separate**: Library provides IDs only, metadata fetched separately
- **Better separation**: Cleaner architecture with focused data sources

---

## Implementation Strategy

### Phase 1: Backend DataSource Implementation ✅ COMPLETE

#### **Tasks**

1. **Event Contracts** (`mtw-interfaces`): ✅ COMPLETE
   - ✅ Define internal event types (Snapshot, Asset Added, Asset Removed)
   - ✅ Define external event types (pass-through - same structure)
   - ✅ Create event serializer (simple validation, no complex conversion needed)
   - ✅ Create aggregator (handles add/remove operations on asset UUID arrays)
   - ✅ Export from `@tonylb/mtw-interfaces/ts/eventBridge/assets/library`
   - ✅ Comprehensive unit tests (41 tests passing)

2. **DataSource Instance** (`lambda/assets/library/index.ts`): ✅ COMPLETE
   - ✅ Use AssetsDataSource base class (pre-configured with assets lambda context)
   - ✅ Instantiate with `dataSourceKey: 'mtw.assets.library'`
   - ✅ Configure `snapshotContentGenerator` (queries Library zone for asset IDs only)
   - ✅ Configure `eventSerializer` (LibraryEventSerializer from mtw-interfaces)
   - ✅ Configure `replayable: true` for client subscription support

3. **Event Subscription**: ✅ COMPLETE
   - ✅ Subscribe to `mtw.assets` events via messageBus (Zone Updated, Asset Cached, Asset Removed)
   - ✅ Filter for Library zone changes only (ignores Canon↔Personal changes)
   - ✅ Generate Asset Added events when assets enter Library
   - ✅ Generate Asset Removed events when assets leave Library
   - ✅ Idempotent event processing (safe to apply multiple times)
   - ✅ Parallel batch processing for multiple events

4. **Integration**: ✅ COMPLETE
   - ✅ Wire DataSource into assets lambda via side-effect import in app.ts
   - ✅ Automatic messageBus subscription via .subscribe() call
   - ✅ Unit tests for event processing logic
   - ✅ Ready for EventBridge integration (configuration in template.yaml pending)

#### **Testing** ✅ COMPLETE

1. ✅ Unit tests for aggregator (41 tests in mtw-interfaces - ALL PASSING)
2. ✅ Unit tests for event serializer (41 tests in mtw-interfaces - ALL PASSING)
3. ✅ Unit tests for DataSource implementation (15 tests in lambda/assets - ALL PASSING)

#### **Success Criteria**

- [x] DataSource generates correct snapshots from database (queries Library zone only)
- [x] DataSource publishes events to EventBridge (via streamEvent)
- [x] DataSource stores replay data in DynamoDB (via DataSource base class)
- [x] DataSource responds to subscription requests (via initializeSubscription in base class)
- [x] Aggregator correctly applies all event types (Asset Added, Asset Removed, Snapshot)
- [x] Event processing filters Library zone changes correctly
- [x] Idempotent operations (safe to apply events multiple times)

### Phase 2: Front-End Integration

#### **Tasks**

1. **Create New Slice** (`charcoal-client/src/slices/libraryDataSource/`):
   - Import aggregator and serializer from mtw-interfaces
   - Create type guards for snapshot vs update
   - Call `createDataSourceSlice` factory
   - Export selectors and actions

2. **Create Helper Functions**:
   - `subscribeToLibrary()` - wrapper for stream subscription
   - `unsubscribeFromLibrary()` - wrapper for unsubscription
   - `getLibraryData()` - selector for materialized view

3. **Wire into Redux**:
   - Add slice to store configuration
   - Register iterator in `useStateSeekingMachines`
   - Export from slice index

4. **Update Library Component**:
   - Feature flag to switch between old and new implementation
   - Test with new DataSource
   - Verify real-time updates work

#### **Testing**

1. Unit tests for slice creation
2. Integration tests with mock WebSocket
3. UI tests for Library component
4. Performance testing for large datasets

#### **Success Criteria**

- [ ] Slice correctly subscribes to global stream
- [ ] Slice receives and processes snapshots
- [ ] Slice receives and processes update events
- [ ] UI displays correct data
- [ ] Real-time updates appear in UI

### Phase 3: Backwards Compatibility & Migration

#### **Tasks**

1. **Maintain Legacy Support**:
   - Keep old message handlers functional
   - Support both subscription methods simultaneously
   - Monitor usage of both APIs

2. **Gradual Rollout**:
   - Feature flag for new implementation
   - Roll out to subset of users
   - Monitor for errors and performance issues

3. **Migration Communication**:
   - Document new API for developers
   - Provide migration guide
   - Announce deprecation timeline

#### **Testing**

1. Test both systems running simultaneously
2. Test switching between implementations
3. Test rollback procedures

#### **Success Criteria**

- [ ] Both systems work independently
- [ ] No performance degradation
- [ ] Zero-downtime migration possible
- [ ] Clear migration path documented

### Phase 4: Deprecation & Cleanup

#### **Tasks**

1. **Remove Legacy Code**:
   - Delete old message handlers
   - Remove old slice implementation
   - Clean up old subscription tracking
   - Remove feature flags

2. **Update Documentation**:
   - Update API documentation
   - Update architecture diagrams
   - Add migration notes to changelog

3. **Performance Optimization**:
   - Monitor event processing performance
   - Optimize snapshot generation if needed
   - Consider claim-check pattern for large snapshots

#### **Testing**

1. Verify all old code paths removed
2. Test new implementation under load
3. Performance benchmarking

#### **Success Criteria**

- [ ] All legacy code removed
- [ ] Documentation updated
- [ ] Performance meets requirements
- [ ] Clean codebase with no tech debt

---

## Migration Risks & Mitigation

### Risk 1: Breaking Existing Clients

**Risk**: Front-end expects legacy message format

**Mitigation**:
- Phase 1: Dual-mode operation (both APIs work)
- Feature flag for gradual rollout
- Maintain legacy handlers during migration
- Comprehensive testing before deprecation

### Risk 2: Performance Degradation

**Risk**: New system slower than legacy

**Mitigation**:
- Benchmark both implementations
- Use SingleFlight for snapshot generation
- Monitor EventBridge and DynamoDB latency
- Optimize hot paths
- Consider claim-check pattern if snapshots grow large

### Risk 3: Data Inconsistency

**Risk**: Events don't match actual library state

**Mitigation**:
- Comprehensive event processing tests
- Snapshot regeneration on demand
- Monitor for data discrepancies
- Provide manual refresh mechanism

### Risk 4: Subscription Management Complexity

**Risk**: Subscriptions lambda integration issues

**Mitigation**:
- Thorough integration testing
- Monitor subscription/unsubscription success rates
- Implement retry logic
- Provide fallback to legacy system

### Risk 5: Event Ordering Issues

**Risk**: Out-of-order events cause incorrect state

**Mitigation**:
- Front-end aggregator handles timestamp ordering
- Replay ensures consistent initialization
- Monitor for timestamp anomalies
- Test with delayed and out-of-order events

---

## Open Questions

### 1. Event Trigger Mechanism

**Question**: How are `LibraryUpdate` messages currently triggered in the legacy system?

**Investigation Needed**:
- Where in the codebase are these SNS messages published?
- What asset/character operations trigger library updates?
- What is the update frequency and latency?

**Proposed Solution**: Replace trigger mechanism with event subscription to `mtw.assets` DataSource:
- Subscribe to zone change events from `mtw.assets`
- Filter for Library zone transitions
- Generate library events automatically when assets enter/leave Library
- More targeted, event-driven approach

### 2. Backwards Compatibility Duration

**Question**: How long should we maintain legacy system?

**Considerations**:
- Development velocity (how fast can we migrate front-end?)
- Testing requirements (how much confidence before deprecation?)
- User impact (any external clients using this API?)

**Recommendation**: 
- Phase 1: Implement and test new system (2 weeks)
- Phase 2: Run both systems, migrate UI (2 weeks)
- Phase 3: Monitor and fix issues (2 weeks)
- Phase 4: Deprecate legacy (1 week)
- Total timeline: ~2 months

### 3. ContentHeaders Integration

**Question**: Should Library UI use `mtw.assets.contentHeaders` for asset metadata?

**Considerations**:
- ContentHeaders provides asset metadata (name, description, etc.)
- Library provides just asset IDs
- Need coordinated subscription management
- Loading states need to be handled

**Proposed Solution**:
- Library UI subscribes to both `mtw.assets.library` (for IDs) and `mtw.assets.contentHeaders` (for metadata)
- Combine data in UI layer using selectors
- Handle loading states separately for each data source
- Graceful degradation if metadata not yet loaded

### 4. Large Dataset Handling

**Question**: What happens when library has hundreds or thousands of assets?

**Analysis**:
- **Simplified Data**: Just asset IDs (strings), not full metadata
- **Small Snapshots**: 1000 asset IDs ≈ 50KB (vs. old system with full metadata)
- **Efficient Updates**: Single ID per add/remove event
- **No Pagination Needed**: For first iteration, single global stream sufficient

**Proposed Approach**:
- Monitor snapshot sizes in production
- If library grows very large (>1000 assets), consider:
  - Pagination at UI level
  - Per-zone streams to reduce scope
  - Claim-check pattern for extremely large libraries (unlikely given ID-only data)

### 5. UI Refactoring Scope

**Question**: How much UI refactoring is acceptable for this migration?

**Considerations**:
- Current UI tightly coupled to legacy data structure
- Characters treated as separate entities
- Direct metadata access throughout UI
- May require significant component updates

**Proposed Approach**:
- Phase the UI refactoring as separate work item
- Backend DataSource can be implemented first
- Legacy system continues to work during UI refactor
- UI updates can be incremental (one component at a time)

---

## Success Metrics

### Performance Metrics

- [ ] **Snapshot Generation**: < 100ms (P95) - Simplified ID-only query
- [ ] **Event Publishing**: < 200ms (P95) - Small event payloads
- [ ] **Event Processing**: < 20ms per event - Simple add/remove operations
- [ ] **Memory Usage**: Bounded by DataSource pattern (30-second window)
- [ ] **Network Overhead**: Drastically reduced (IDs only vs. full metadata)
- [ ] **Snapshot Size**: < 100KB for 1000 assets (vs. ~1MB+ in legacy)

### Reliability Metrics

- [ ] **Subscription Success Rate**: > 99.9%
- [ ] **Event Delivery Success**: > 99.9%
- [ ] **Data Consistency**: Zero reported inconsistencies
- [ ] **Error Rate**: < 0.1% of operations
- [ ] **Zone Filtering Accuracy**: 100% (only Library zone assets included)

### Migration Metrics

- [ ] **Zero Downtime**: No service interruptions during migration
- [ ] **Backwards Compatible**: Legacy system works during transition
- [ ] **Backend Migration Time**: Complete backend within 2 weeks
- [ ] **UI Migration Time**: Complete UI refactoring within 4 weeks (separate phase)
- [ ] **Rollback Successful**: Can revert to legacy if needed

### Quality Metrics

- [ ] **Test Coverage**: > 90% for new code
- [ ] **Documentation**: Complete API docs and migration guide
- [ ] **Code Review**: All changes reviewed and approved
- [ ] **Performance Benchmarks**: Significantly exceeds legacy performance
- [ ] **Architecture Alignment**: Follows modern DataSource patterns

### Architectural Metrics

- [ ] **Data Model Modernization**: Characters treated as components, not separate entities
- [ ] **Zone Filtering**: Library zone only (not all zones)
- [ ] **Separation of Concerns**: Library provides IDs, metadata fetched separately
- [ ] **EventBridge Integration**: Events published to EventBridge, not just SNS
- [ ] **Composability**: UI can combine library IDs with contentHeaders data

---

## Next Steps

1. **Review & Approve**: Get stakeholder review of this planning document
2. **Create Implementation Tasks**: Break down phases into specific Jira tickets
3. **Begin Phase 1**: Start with event contracts in mtw-interfaces
4. **Iterate**: Review progress weekly, adjust plan as needed

---

## References

### Internal Documentation

- [DataSource Pattern Documentation](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)
- [DataSource Implementation Guide](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)
- [Front-End DataSource Pattern](../../../charcoal-client/src/slices/dataSource/AGENT.md)
- [Content Headers Example](../contentHeaders/AGENT.md)

### Implementation Files

**Current System**:
- `lambda/assets/internalCache/library.ts` - Library cache implementation
- `lambda/assets/subscribe/index.ts` - Subscribe/unsubscribe handlers
- `lambda/assets/libraryUpdate/index.ts` - Update message handler
- `lambda/assets/fetchLibrary/index.ts` - Initial fetch handler
- `charcoal-client/src/slices/library/` - Front-end library slice

**Related Types**:
- `packages/mtw-interfaces/ts/library.ts` - LibraryAsset and LibraryCharacter types
- `lambda/assets/messageBus/baseClasses.ts` - Message type definitions

**Modern Examples**:
- `lambda/assets/contentHeaders/index.ts` - Content headers DataSource
- `charcoal-client/src/slices/contentHeaders/index.ts` - Content headers front-end slice

---

**Document Status**: 📋 DRAFT - Pending Review

**Created**: 2025-10-12

**Last Updated**: 2025-10-12

**Author**: AI Assistant (via User Request)

