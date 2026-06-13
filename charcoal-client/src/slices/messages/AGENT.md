# Messages Slice - Agent Navigation Guide

## Overview

The `messages` slice manages the Redux state for all game messages received via WebSocket. It handles message storage, retrieval, and synchronization with the local cache database. The same logical `MessageId` can receive multiple revisions over time; the slice keeps a full **history** log and a separate **presentation** view for the default transcript (see **Transcript model** below).

**Authoritative transcript concepts (server + wire):** [`lambda/ephemera/AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md). This file documents **client ingest and selectors**; producers assign **`CreatedTime`** per that doc.

## Core Purpose

- **Message Storage**: Maintains message history in Redux state
- **Cache Synchronization**: Syncs messages with local IndexedDB cache
- **Message Ordering**: Ensures messages are stored in chronological order
- **Performance Optimization**: Pre-processes messages for efficient rendering

## Current Architecture

### **Dual-Layer Persistence System**

The message system uses a **two-tier persistence architecture**:

#### **1. Client-Side IndexedDB Cache** 
- **Database**: `maketheworlddb` (Dexie-based IndexedDB)
- **Table**: `messages` uses primary key **`deltaPk`** (synthetic, typically `${CreatedTime}::${MessageId}`) with indexes on `Target`, `MessageId`, `CreatedTime` so multiple revisions per logical id can be stored
- **Purpose**: Local message history persistence for offline access and performance
- **Scope**: Character-specific message history for current client
- **Sync Tracking**: `characterSync` table tracks last sync timestamp per character

#### **2. Server-Side DynamoDB Storage**
- **Table**: `message_delta` (via `messageDeltaDB`)
- **Purpose**: Global message history accessible across all client sessions
- **Scope**: Complete message history for cross-device synchronization
- **Structure**: `Target`, `DeltaId` (`CreatedTime::MessageId`), `RowId` (MessageId), message content

### **Transcript model (revisions and three layers)**

The wire protocol can send **revisions**: the same **`MessageId`** with a new **`CreatedTime`** should not multiply bubbles in the main UI. The slice separates **what we store** from **what we show by default**.

**Goals**

1. **Authoritative log**: Retain every inbound revision in **`history`** for sync, debugging, and any future audit UI.
2. **Single bubble by default**: **`presentation`** holds one row per logical `MessageId`, with **latest** body and a stable transcript position (first-seen / `earliestCreatedTime`). On presentation rows, **`Message.CreatedTime` is overloaded** as that position key; see [`index.ts`](index.ts) (`toPresentationRow`, `applyPresentationIfLatest`).
3. **Incremental updates**: Per-id **`aggregates`** track `earliestCreatedTime` and `latestCreatedTime` with O(1) merges on ingest; avoid rescanning all of `history` on each packet.
4. **New lines**: A genuinely new **`MessageId`** still behaves as a new line; revision semantics apply only to **same-id** traffic.

**The three layers**

| Layer | Role |
|-------|------|
| **`history`** | Time-ordered `Message[]` per character: every revision is a row, sorted by `(CreatedTime, MessageId)`. A revision with the **same** id and **new** time is **inserted**; the **same** `(CreatedTime, MessageId)` **replaces** that slot. |
| **`aggregates`** | Per `(Target, MessageId)`, only **earliest** and **latest** timestamps. **Do not** cache raw indices into `history` (indices move when rows insert mid-array). To find a row, use **binary search** on `history` by `(CreatedTime, MessageId)`. |
| **`presentation`** | Same array shape as `history`, but **one row per `MessageId`**, updated in **`receiveMessages`** alongside the other branches. Default selectors (`getPresentation`, `getMessagesByRoom`, etc.) read here; **`getMessages`** exposes full **`history`**. |

**Ingest and cold load**: Live traffic and cache replay both dispatch **`receiveMessages`**, so **`history`**, **`aggregates`**, and **`presentation`** stay aligned. **`aggregates`** and **`presentation`** are not persisted separately; reloading from IndexedDB replays through the same path.

### **State Structure**

Redux state for this slice has three parts, all keyed by character (see **Transcript model** above):

| Branch | Role |
|--------|------|
| **history** | Full log of what arrived from the server (including multiple revisions of the same logical message). |
| **aggregates** | Per logical message id, the earliest and latest timestamps seen in that log. |
| **presentation** | A separate view for the UI: one row per logical message, latest text, ordered as if each line appeared when it first mattered in the stream. |

**Selectors:** [`getMessages`](selectors.ts) reads `history` (audit / full revision log). [`getPresentation`](selectors.ts) reads `presentation` (default transcript). Room grouping ([`getMessagesByRoom`](selectors.ts)) and [`getRecentlyVisited`](selectors.ts) are built on `presentation`.

**Where to read more:** Exact types live in [`baseClasses.ts`](baseClasses.ts). How `presentation` stays in sync with `history`, and how `CreatedTime` is interpreted on presentation rows, is documented in comments and helpers in [`index.ts`](index.ts) (for example `toPresentationRow` and `applyPresentationIfLatest`).

### **Core Operations**

#### **Message Reception** (`receiveMessages`)
- Applies incoming batches after [`cacheMessages`](index.ts) has persisted originals and dispatched processed messages.
- Updates `history`, `aggregates`, and `presentation` together so the UI view stays consistent with the log.

#### **Cache Synchronization** (`cacheMessages`)
- **Dual Storage**: Stores original messages in IndexedDB and processed messages in Redux
- **Sync Management**: Updates `LastSync` timestamps for character synchronization 
- **Processing Pipeline**: Applies WML parsing before Redux dispatch
- **Persistence Flow**:
  1. Store raw messages in `cacheDB.messages` (IndexedDB)
  2. Update `cacheDB.characterSync` with latest sync timestamp
  3. Process messages (parse WML content for PerceptionMessages)
  4. Dispatch processed messages to Redux state

#### **Message Retrieval** (`selectors`)
- `getMessages` / `getPresentation`: Character-scoped arrays (see State Structure above)
- `getMessagesByRoom` / `getRecentlyVisited`: Room visits and grouped transcript; use `presentation` via `getPresentation`

### **Message Synchronization Flow**

#### **Live Message Receipt** (WebSocket)
1. **WebSocket Receipt**: New messages arrive via `lifeLine` WebSocket connection
2. **Immediate Processing**: `receiveMessages` in `lifeLine.api.ts` triggers `cacheMessages`
3. **Dual Persistence**: Messages stored in both IndexedDB and Redux state
4. **Real-Time Update**: UI components receive immediate updates via Redux

#### **Historical Message Loading** (Character Activation)
1. **Character Fetch**: `activeCharacters.api.ts` calls `fetchAction` for character
2. **Local Retrieval**: Load existing messages from `cacheDB.messages` where Target = characterId
3. **Redux Population**: Dispatch cached messages to Redux state for immediate UI rendering
4. **Background Sync**: `LastMessageSync` timestamp used for server synchronization requests

#### **Cross-Device Synchronization**
- **Server Authority**: DynamoDB `message_delta` table maintains complete history
- **Client Gaps**: `LastSync` timestamps identify missing message ranges
- **Sync Requests**: Client requests messages newer than `LastMessageSync`
- **Merge Strategy**: New messages merged into existing IndexedDB and Redux stores

### **Sticky Header Persistence Implications**

**The dual persistence system affects sticky header behavior:**

- **Room Header Messages**: Must be properly stored and retrieved from both IndexedDB and DynamoDB
- **Message Format Migration**: `PerceptionMessage` format must be compatible with both persistence layers
- **Selector Dependencies**: `getMessagesByRoom` reads the presentation transcript so room sections follow the same collapsed timeline as the main UI
- **Sync Consistency**: Room headers from different clients must merge correctly for sticky header logic

**Potential Issues:**
- **Format Inconsistency**: Mixed legacy/new message formats in persistence stores
- **Missing Messages**: Incomplete sync can break room header sequencing
- **Processing Differences**: WML parsing differences between cached and live messages

## Planned WML Integration

### **Performance Optimization Strategy**

#### **Current Issue**
The `PerceptionMessage` type carries WML strings that need parsing:
```typescript
interface PerceptionMessage {
    DisplayProtocol: 'PerceptionMessage';
    wmlContent: string;           // WML string (ephemera wire; parse with standardizeMode: 'ephemeraWire')
    metaData: PerceptionMessageMetaData;  // includes componentUUID for the rendered component
    // ... other fields
}
```

**✅ Phase 1 Interface Updates Completed:**
- `PerceptionMessage` type defined in `packages/mtw-interfaces`
- `SchemaComponentUUID` type using `EphemeraId` system
- Comprehensive type guards and validation
- Full test coverage with 67 tests passing

#### **Optimization Plan**
To avoid expensive WML parsing on every render, we will:

1. **Parse at Reception**: Parse WML content when messages are first received
2. **Store Parsed Data**: Store `StandardForm` instances in Redux state
3. **Pre-compute Component Data**: Extract component information during parsing
4. **Cache Results**: Avoid re-parsing the same WML content

#### **Enhanced Message Structure**
```typescript
// Enhanced message type with parsed WML
type EnhancedMessage = Message | (PerceptionMessage & { parsedWML: StandardForm })
```

#### **Implementation Strategy**

##### **Phase 1: Message Processing Enhancement** ✅ **IMPLEMENTED**
```typescript
// Helper function to process PerceptionMessage with WML parsing
const processPerceptionMessage = (message: Message): EnhancedMessage => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        try {
            const standardForm = new StandardForm(message.wmlContent, { standardizeMode: 'ephemeraWire' })
            return {
                ...message,
                parsedWML: standardForm
            }
        } catch (error) {
            console.warn('Failed to parse WML content for PerceptionMessage:', error)
            const componentUUID = message.metaData.componentUUID
            const [upperTag] = splitType(componentUUID)
            const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`

            const fallbackForm = new StandardForm('fallback')
            const defaultData = defaultComponentFromTag(tag as any, 'fallback', componentUUID)
            const { component: fallbackComponent } = standardComponentFactory(defaultData)

            if (fallbackComponent) {
                fallbackForm._components = [fallbackComponent]
            }

            return {
                ...message,
                parsedWML: fallbackForm
            }
        }
    }
    return message
}

// In cacheMessages action
const processedMessages = messages.map(processPerceptionMessage)
```

**Ephemera wire parsing:** `standardizeMode: 'ephemeraWire'` accepts perception WML such as **`<Render>`** and **`<Object>`** under **`Room`**. Asset-only default parsing would reject those tags. See **`packages/mtw-wml`** **`standardize/AGENT.md`**.

##### **Phase 2: No Special Selectors Needed**
```typescript
// Use existing getMessages (history) or getPresentation (one row per MessageId)
// No need for getPerceptionMessages - components filter by DisplayProtocol
export const getMessages = (state: RootState, characterId: EphemeraCharacterId) => {
    return state.messages.history[characterId] || []
}
```

##### **Phase 3: Component Integration**
```typescript
// Components handle parsing with fallback support
case 'PerceptionMessage':
    // parsedWML is guaranteed to exist (either valid or fallback)
    const componentUUID = message.metaData.componentUUID
    const component = message.parsedWML.byUniversalId[componentUUID]
    const componentType = component?.tag || getComponentTypeFromUUID(componentUUID)
    
    switch(componentType) {
        case 'Room':
            return <RoomDescription message={message} component={component} />
        // ... other cases
    }
```

### **Benefits of This Approach**

1. **Performance**: Parse once, use many times
2. **Memory Efficiency**: Store parsed objects instead of re-parsing strings
3. **Simple Architecture**: Use existing selectors, no special perception selectors needed
4. **Lazy Evaluation**: Support future lazy parsing strategies
5. **User Experience**: Graceful error handling with fallback content
6. **Backward Compatibility**: Graceful fallback to runtime parsing
7. **Cache Safety**: Store original messages in IndexedDB, process at read time
8. **Type Safety**: Proper TypeScript types for enhanced messages

### **Migration Timeline**

#### **Phase 1: Infrastructure** ✅ **COMPLETED**
- ✅ Add WML parsing utilities to message processing
- ✅ Enhance message state structure for parsed data
- ✅ Use existing message selectors (no special perception selectors needed)
- ✅ Store original messages in cacheDB, process at read time
- ✅ Proper TypeScript types for enhanced messages

#### **Phase 2: Bridge State Component Updates** ✅ **COMPLETED** (4/4 components completed)
- ✅ Update message router to handle `PerceptionMessage` case
- ✅ Modify components to accept both legacy and WML formats
- ✅ Implement bridge state for gradual migration
- ✅ Track progress through component migration list
- ✅ Complete all planned components (`CharacterDescription` - not currently in scope)

#### **Phase 3: Legacy Removal**
- Remove legacy message types from perception system
- Remove legacy property handling from components
- Clean up bridge state code
- Update type definitions to remove legacy interfaces

#### **Phase 4: Optimization**
- Implement lazy parsing strategies
- Add parsing performance monitoring
- Optimize memory usage for parsed data

## Integration Points

### **WebSocket Handler**
- Receives raw messages from server
- Triggers `cacheMessages` action with message processing

### **Message Components**
- Handle parsing states with loading components
- Focus on rendering with graceful parsing fallbacks

### **Cache Database**
- Stores original message format (without parsedWML)
- Processes messages at read time for WML parsing
- Avoids storing complex objects in IndexedDB

### **WML Library**
- Provides `StandardForm` parsing capabilities
- Enables component extraction and type determination

## Navigation Tips

1. **Start with Index**: Main reducer, `receiveMessages`, `applyPresentationIfLatest`, `refreshPresentationFromLatestHistory`, and `cacheMessages` live in `index.ts`
2. **Types**: `MessagesSliceState`, aggregates, and presentation aliases are in `baseClasses.ts`
3. **Check Selectors**: `getMessages`, `getPresentation`, and `getMessagesByRoom` in `selectors.ts`
4. **Review Binary Search**: Message ordering and insertion points in `binarySearch.ts`
5. **Examine Cache Integration**: How messages sync with IndexedDB (original wire rows; Redux may add `parsedWML` after read)
6. **Tests**: `index.test.ts` covers history, aggregates, and presentation behavior

## Development Notes

### **Current State**
- **Message Storage**: `history` holds the full revision log; `aggregates` tracks per-`MessageId` time bounds; `presentation` holds the alternate transcript for UI (one row per id, overloaded `CreatedTime` for position)
- **Cache Integration**: Complete IndexedDB synchronization with safe storage (original messages only)
- **Message Ordering**: Efficient binary search insertion for `history` and `presentation`
- **Selector System**: `getPresentation` for default transcript (`getMessagesByRoom`, `getRecentlyVisited`); `getMessages` for full `history` when needed
- **WML Processing**: Implemented with fallback strategy and type safety
- **Clear**: `clear` resets `history`, `aggregates`, and `presentation` together

### **Testing Patterns**
- **Watch Mode**: `npm test` - Runs Vitest in watch mode (default)
- **Single Run**: `npm run test:single` - Runs tests once and exits
- **Specific File**: `npm run test:single -- src/path/to/test.ts` - Run specific test file
- **Client vs Packages**: Use `npm test` for client (Vitest), `npm run test` for packages (Jest)

### **Future Plans**
- **Lazy parsing**: Optional strategies from Phase 4 migration timeline
- **Error Display**: Richer UI when fallback `StandardForm` is used
- **Performance Monitoring**: Parsing cost in production

### **Technical Debt**
- **Phase 3 migration**: Legacy removal items from the migration timeline (if any remain)
- **Performance**: Monitor parsing performance in production
- **Memory Usage**: Optimize parsed data lifecycle management 