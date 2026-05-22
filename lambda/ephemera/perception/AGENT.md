# Perception System - Agent Navigation Guide

## Overview

The `perceptionMessage` function is the core handler for **perception-based messaging** in the Ephemera system. It processes various types of perception requests and generates appropriate messages to be displayed to characters based on their context, location, and access permissions.

## Core Purpose

The perception system serves as the **message routing and display engine** that:

- **Processes Perception Requests**: Handles different types of perception messages (rooms, components, maps, etc.)
- **Context-Aware Rendering**: Generates descriptions appropriate to the character's context
- **Message Routing**: Sends messages to the right characters based on location and permissions
- **Asset Integration**: Leverages the internalCache system for efficient data retrieval
- **Real-time Updates**: Provides immediate feedback through the message bus

## Architecture: `mtw.ephemera.perception` DataSource

**Audience-facing** assembly for correlated room and room-header legs lives in the bus-published DataSource at [`../dataSource/perception/`](../dataSource/perception/). See [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) for the **data domain** (how perception **bridges** `renderOrchestration`, `renderCache`, and delivery), **correlated** vs **immediate** patterns, **normative routing**, **plan assumptions**, **policy**, **obligations**, and **verification**.

**Which flows use fan-in versus imperative [`perceptionMessage`](./index.ts)** is the steady-state **[Delivery paths (correlated vs imperative)](../dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative)** section in that doc. Start there when debugging or extending routing.

This guide remains the map for **imperative** `perceptionMessage` behavior, triggers, and message shapes for paths that still use it. **v1 handler policy** (removed Message path; Knowledge and Map branches **gated off** by flags): [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md#imperative-perceptionmessage-baseline-v1). **Follow-on design** (default publish, etc.): [`../dataSource/perception/AGENT.development.md`](../dataSource/perception/AGENT.development.md).

## Perception Event Triggers

The perception system can be triggered by several different categories of events, each representing a different reason why characters need updated information:

### **Blueprint Change Events** *(Content Updates)*
**What They Are**: Changes to the underlying world definition that require perception updates

#### **WML Content Updates** *(Legacy Pattern - Migration In Progress)*
- **Source**: `Content Update` EventBridge events from WML Lambda (via Asset re-caching)
- **Trigger Pattern**: WML source changes → Ephemera receives Content Update → `cacheAsset({ updateOnly: true })` → Updated component data available
- **Perception Impact**: Characters may see updated room descriptions, feature descriptions, or component changes on next interaction
- **Migration Context**: This represents the legacy direct WML → Ephemera flow; target flow is WML → Assets → Ephemera

#### **Asset Canonization/Decanonization Events**
- **Current state**: No active path. The former `mtw.coordination` EventBridge source for Canonize/Decanonize has been removed; no lambda subscribes to these events today.
- **Future**: When mtw.assets (or extended data sources) are wired to canonize/decanonize, Ephemera may need to react (e.g. via mtw.wml Zone Changed or mtw.assets) so characters gain/lose access to content and room headers update.

#### **Asset-Level Changes**
- **Source**: Direct asset modifications, imports, or structural changes
- **Trigger Pattern**: Asset structure changes → Room compositions change → Headers need updates
- **Perception Impact**: Room descriptions may include new components or lose removed ones
- **Propagation**: Affects all rooms associated with the modified asset. **Room header refresh** for linked rooms is kicked via **`kickRoomHeaderBroadcastForRoom`** (group by **`perspectiveKey`**, **`Perception Thread Registered`** with **`threadKind: 'roomHeaderBroadcast'`**, then **`Render Requested`** with **`targets`**) and delivered by fan-in in [`../dataSource/perception/orchestrate.ts`](../dataSource/perception/orchestrate.ts), not by re-queuing imperative **`Perception`** with **`header: true`** for that path.

### **Character State Events** *(Real-Time Updates)*
**What They Are**: Changes to character presence, movement, or actions that require immediate perception updates

#### **Character Movement Events**
- **Source**: `MoveCharacter` internal message bus events
- **Trigger Pattern**: Character moves rooms → New room perception → Header updates → Map updates
- **Perception Flow** (when the mover has a **non-empty** arrival-room **`perspectiveKey`**):
  1. [`moveCharacter`](../moveCharacter/index.ts) registers a **`characterMove`** perception thread on **`internalCache.PerceptionThreads`** (synchronous **`register`** before transact) and kicks passive **`Render Requested`** for the new room.
  2. Header **Generating** / terminal **`PublishMessage`** for the mover (and optional **`headerTargets`**) is delivered by fan-in in [`../dataSource/perception/orchestrate.ts`](../dataSource/perception/orchestrate.ts), analogous to **`roomHeaderBroadcast`**.
  3. Leave/Arrive narrative **`WorldMessage`** sends use [`../dataSource/perception/characterMoveDelivery.ts`](../dataSource/perception/characterMoveDelivery.ts) with correlated **`OrchestrateMessages`** group ids (**`before`** / root / **`after`**).
  4. **`MapUpdate`** still updates the character's map view.
- **Fallback**: empty filtered perspective or same-room updates may still use imperative **`Perception`** / **`perceptionMessage`** where the code path requires it.
- **Special Behavior**: Room headers use in-place updates rather than timeline entries

#### **Character Interaction Events**
- **Source**: Direct character actions, commands, or link interactions
- **Trigger Pattern**: Character interacts with component → Component perception triggered
- **Perception Types**:
  - **Room look (`look` at a room)**: [`parse/executeAction.ts`](../parse/executeAction.ts) registers a room thread via **`sendPerceptionThreadRegistered`** and kicks passive render via **`sendRenderRequested`**; delivery is **`PublishMessage`** from **`mtw.ephemera.perception`** fan-in ([`../dataSource/perception/orchestrate.ts`](../dataSource/perception/orchestrate.ts)), not imperative **`Perception`** → `perceptionMessage` for that path.
  - **Feature Interaction**: `PerceptionComponentMessage` for feature descriptions
  - **Knowledge Access**: `PerceptionComponentMessage` with `directResponse` for immediate knowledge delivery
  - **Character Examination**: Character description lookups
- **Targeting**: Usually character-specific rather than broadcast

#### **Room State Changes**
- **Source**: Environmental changes, character presence updates, or dynamic content
- **Trigger Pattern**: Room state changes → Room header updates → Character notifications
- **Examples**:
  - Characters entering/leaving rooms (updates character lists in headers)
  - Room features being activated or deactivated
  - Environmental conditions changing
- **Update Strategy**: Headers receive current state updates, not timeline entries

### **WML Message components (MESSAGE#)** *(Not implemented)*
Ephemera does not deliver WML `Message` components to players at runtime. Authoring and parsing may still exist in `mtw-wml`; live play does not route `MESSAGE#` or `MOMENT#` through `perceptionMessage`. Use other mechanisms (e.g. future DataSource pipelines) for narrative or system text.

### **System Coordination Events** *(Infrastructure)*
**What They Are**: System-level events that require perception updates for consistency

#### **Map Subscription Events**
- **Source**: Character map subscriptions, room transitions
- **Trigger Pattern**: Character needs map updates → Map rendering → `EphemeraUpdate` delivery
- **Targeting**: Always character-specific due to different asset access levels
- **Content**: Map data filtered based on character's asset permissions

#### **Cache Invalidation Events**
- **Source**: Asset cache updates, system maintenance, or data consistency operations
- **Trigger Pattern**: Cached data becomes stale → Re-render needed → Updated perceptions
- **Scope**: May affect multiple characters if they share access to updated assets
- **Performance**: Uses InternalCache system to minimize redundant lookups

### **Event Processing Patterns**

#### **Character Presence Filtering**
All perception events are filtered through character presence detection:
- **Room-Based Events**: Only processed if characters are present in affected rooms
- **Asset-Based Events**: Only processed if characters have access to affected assets
- **Performance Benefit**: Implements "tree falls in forest" principle for cost optimization

#### **Asset Discovery and Filtering**
Most perception events involve asset discovery:
1. **Global Assets**: System-wide canonical assets available to all characters
2. **Character Assets**: Personal and authorized assets for specific characters
3. **Asset Intersection**: Only include assets where the component/content actually appears
4. **Permission Filtering**: Respect character-level access controls

#### **Message Targeting Strategy**
Different events use different targeting approaches:
- **Broadcast**: All characters in associated rooms (room changes, announcements)
- **Targeted**: Specific character only (personal interactions, knowledge access)
- **Asset-Filtered**: Characters with access to specific assets (asset changes)
- **Anonymous**: Public information for unauthenticated access

For detailed technical implementation of these patterns, see [`../AGENT.event.md`](../AGENT.event.md) - Event Flow Documentation.

## Message Types

The system handles several types of perception messages, each with specific behavior:

### **PerceptionAssetMessage**
Triggers room header updates when assets change:

```typescript
{
    type: 'Perception',
    characterId?: EphemeraCharacterId,
    ephemeraId: EphemeraAssetId,       // Asset that changed
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Room Discovery**: Finds all rooms associated with the asset
- **Header Updates**: Sends room header updates to affected characters
- **Change Propagation**: Ensures UI reflects asset modifications

### **PerceptionRoomMessage**
Displays room descriptions to characters:

```typescript
{
    type: 'Perception',
    characterId?: EphemeraCharacterId,
    ephemeraId: EphemeraRoomId,        // Room to describe
    header?: boolean,                   // Header-only or full description
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Character Targeting**: Sends to specific character or all characters in room
- **Description Types**: Full room description or header-only based on `header` flag (`displayMode` on the **`PublishMessage`**)
- **Render body**: **`wmlContent`** is built from **`internalCache.RenderCache`** and [`roomRenderChannelWmlForRoomId`](../dataSource/perception/roomRenderWmlFromCacheRecord.ts) (cache-backed prose for **`roomChannel: 'render'`**), not **`ComponentRender.get`**
- **Real-time Updates**: Provides immediate room information

#### **Special Header Message Behavior**
When `header: true` is specified, the generated PerceptionMessage (with room header metadata) has unique timeline organization properties:

- **Timeline Organization**: These messages serve as section boundaries in the character's message timeline, organizing messages into room-based sections
- **In-Place Updates**: Unlike regular messages, room header messages update existing headers rather than creating new timeline entries when the same room sends another header. A header message can be *either* a new entry (if it indicates a new room) or an update to the existing header
- **Sticky Context**: Headers remain visible at the top of the viewport during scrolling to provide current location context
- **Dynamic Content**: Header content reflects the current state of the room, not the historical state when first displayed
- **Temporal Independence**: While regular messages maintain strict chronological order, headers transcend timeline sequence to provide real-time room context

This special behavior enables the narrative timeline system where players see their story organized by location while maintaining current awareness of their surroundings.

For complete details on how room header messages organize the message timeline, see [`../../../charcoal-client/src/components/Message/AGENT.md`](../../../charcoal-client/src/components/Message/AGENT.md) - Message Panel UI Architecture

### **PerceptionComponentMessage**
Displays component descriptions (features, knowledge, characters), using the componentRender internalCache ([`../internalCache/componentRender.AGENT.md`](../internalCache/componentRender.AGENT.md)):

```typescript
{
    type: 'Perception',
    characterId?: EphemeraCharacterId,
    ephemeraId: EphemeraFeatureId | EphemeraCharacterId | EphemeraKnowledgeId,
    directResponse?: boolean,           // For knowledge: direct to session
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Component-Specific**: Different handling for features, knowledge, and characters
- **Character Descriptions**: Direct database lookup for character metadata

### **PerceptionMapMessage**
Displays map information to characters:

```typescript
{
    type: 'Perception',
    characterId: EphemeraCharacterId,   // Required for maps
    ephemeraId: EphemeraMapId,         // Map to display
    mustIncludeRoomId?: EphemeraRoomId, // Optional room filter
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Character Required**: Maps always require a specific character
- **Room Filtering**: `mustIncludeRoomId` ensures map contains specific room
- **Map Updates**: Sends EphemeraUpdate messages for map display

## Integration Points

### **InternalCache System**
The perception system heavily leverages the internalCache for efficient data access:

- **ComponentData**: Retrieves blueprint component bodies across assets ([`../internalCache/componentData.AGENT.md`](../internalCache/componentData.AGENT.md))
- **ComponentRender**: Generates rendered descriptions for non-room components and for **non-publish** room uses (e.g. generation context in **`executeAction`**); **room** **`PerceptionMessage`** on the render channel uses **RenderCache** + **`roomRenderChannelWmlForRoomId`**, not **`ComponentRender.get`** ([`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) **Multi-channel**)
- **RenderCache**: Request-scoped room cache rows for imperative room perception WML (see **`roomRenderChannelWmlForRoomId`**)
- **CharacterMeta**: Gets character information and asset access
- **RoomCharacterList**: Finds characters in specific rooms
- **Global**: Accesses system-wide asset information
- **AssetRooms**: Maps assets to their associated rooms

### **Message Bus System**
Sends various types of messages through the message bus:

- **PublishMessage**: For character descriptions, room descriptions, feature descriptions
- **EphemeraUpdate**: For map updates and real-time changes
- **Perception**: For routing perception requests to appropriate handlers

### **Database Integration**
Direct database access for character metadata:

```typescript
const characterDescription = await ephemeraDB.getItem<EphemeraCharacterDescription>({
    Key: {
        EphemeraId: ephemeraId,
        DataCategory: 'Meta::Character'
    },
    ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color']
})
```

## Processing Flow

### **Message Type Detection**
The system uses type guards to determine message type:
- `isPerceptionAssetMessage()`
- `isPerceptionRoomMessage()`
- `isPerceptionComponentMessage()`
- `isPerceptionMapMessage()`

### **Asset Discovery**
For most operations, the system discovers relevant assets:
- **Global Assets**: System-wide accessible assets
- **Character Assets**: Assets specific to the requesting character
- **Asset Filtering**: Only includes assets where components appear

### **Character Targeting**
Determines which characters should receive messages:
- **Room-Based**: Characters currently in specific rooms
- **Asset-Based**: Characters with access to specific assets
- **Direct Targeting**: Specific character IDs
- **Anonymous Access**: Public information for unauthenticated users

### **Message Generation**
Creates appropriate message formats:
- **PerceptionMessage** (publish): Room, feature, knowledge, and character examine content (with room `displayMode` metadata where applicable)
- **EphemeraUpdate** with **MapUpdate**: For map display updates
- **WorldMessage** is not emitted by this handler; arrival/departure lines and speech are published elsewhere (e.g. `moveCharacter`, `executeAction`)

## Usage Patterns

### **Room Description Display**
```typescript
// Display room description to all characters in the room
await perceptionMessage({
    payloads: [{
        type: 'Perception',
        ephemeraId: 'ROOM#marketSquare-uuid',
        header: false
    }],
    messageBus
})
```

### **Character Description**
```typescript
// Display character description to specific character
await perceptionMessage({
    payloads: [{
        type: 'Perception',
        characterId: 'CHARACTER#player-uuid',
        ephemeraId: 'CHARACTER#target-uuid'
    }],
    messageBus
})
```

### **Map Display**
```typescript
// Display map to specific character
await perceptionMessage({
    payloads: [{
        type: 'Perception',
        characterId: 'CHARACTER#player-uuid',
        ephemeraId: 'MAP#dungeon-uuid'
    }],
    messageBus
})
```

## Error Handling

### **Missing Data**
- **Default Values**: Provides sensible defaults for missing character data
- **Graceful Degradation**: Continues processing even with incomplete data
- **Error Logging**: Logs issues without breaking the message flow

### **Invalid References**
- **Type Validation**: Validates EphemeraId types before processing
- **Asset Validation**: Ensures assets exist before attempting access
- **Character Validation**: Verifies character existence and permissions

## Performance Considerations

### **Caching Strategy**
- **InternalCache Integration**: Leverages existing cache system for efficiency
- **Batch Processing**: Processes multiple payloads in parallel
- **Selective Loading**: Only loads data needed for specific operations

### **Message Optimization**
- **Targeted Sending**: Only sends messages to relevant characters
- **Asset Filtering**: Reduces unnecessary message generation
- **Group Management**: Uses messageGroupId for coordinated updates

## Navigation Tips

1. **Start with Message Types**: Understand the different perception message formats
2. **Check Integration Points**: See how internalCache and messageBus are used
3. **Review Processing Flow**: Understand the message type detection and routing
4. **Examine Error Handling**: See how the system handles missing or invalid data
5. **Look at Test Cases**: Understand expected behavior through test examples

## Development Notes

- **Message Bus Integration**: Heavily depends on the message bus for routing
- **Cache Dependencies**: Requires internalCache system for data access
- **Type Safety**: Uses TypeScript type guards for message validation
- **Real-time Focus**: Designed for immediate message delivery
- **Scalability**: Handles multiple payloads and characters efficiently

## Interface Inconsistencies

The perception system's output format has diverged from the documented interfaces in `mtw-interfaces`. This section documents the inconsistencies and required updates.

### **Current Perception Output vs. Documented Interfaces**

#### **Room Messages**
**Perception Sends:**
```typescript
{
    type: 'PublishMessage',
    targets: [characterId],
    displayProtocol: 'PerceptionMessage',
    wmlContent: schemaToWML([roomDescribe.schema]),  // WML schema format
    metaData: {
        componentUUID: 'ROOM#roomId',
        displayMode: 'header' // or 'full'
    },
    messageGroupId: MessageGroupId
}
```

**mtw-interfaces Expects:**
```typescript
{
    DisplayProtocol: 'PerceptionMessage',
    Description: RenderTree,           // RenderTree format
    Name: RenderTree,
    Summary: RenderTree,
    RoomId: EphemeraRoomId,
    Exits: RoomExit[],
    Characters: RoomCharacter[],
    assets?: AssetUUID[],
    MessageId: string,
    CreatedTime: number,
    Target?: EphemeraCharacterId
}
```

**Issues:**
- **Format Mismatch**: Perception sends WML schema, interfaces expect RenderTree
- **Missing Fields**: No RoomId, Exits, Characters, assets in perception output
- **Extra Fields**: Interfaces expect MessageId, CreatedTime, Target that perception doesn't provide

#### **Feature Messages**
**Perception Sends:**
```typescript
{
    type: 'PublishMessage',
    targets: [characterId],
    displayProtocol: 'FeatureDescription',
    description: schemaToWML([featureDescribe.schema]),  // WML schema format
    FeatureId: ephemeraId,
    messageGroupId: MessageGroupId
}
```

**mtw-interfaces Expects:**
```typescript
{
    DisplayProtocol: 'FeatureDescription',
    Description: RenderTree,           // RenderTree format
    Name: RenderTree,
    FeatureId: EphemeraFeatureId,
    assets?: AssetUUID[],
    MessageId: string,
    CreatedTime: number,
    Target?: EphemeraCharacterId
}
```

**Issues:**
- **Format Mismatch**: Perception sends WML schema, interfaces expect RenderTree
- **Missing Fields**: No Name, assets, MessageId, CreatedTime, Target
- **Extra Fields**: Interfaces don't expect messageGroupId

#### **Knowledge Messages**
**Perception Sends:**
```typescript
{
    type: 'PublishMessage',
    targets: [characterId],
    displayProtocol: 'KnowledgeDescription',
    description: schemaToWML([knowledgeDescribe.schema]),  // WML schema format
    KnowledgeId: ephemeraId,
    messageGroupId: MessageGroupId
}
```

**mtw-interfaces Expects:**
```typescript
{
    DisplayProtocol: 'KnowledgeDescription',
    Description: RenderTree,           // RenderTree format
    Name: RenderTree,
    KnowledgeId: EphemeraKnowledgeId,
    assets?: AssetUUID[],
    MessageId: string,
    CreatedTime: number,
    Target?: EphemeraCharacterId
}
```

**Issues:**
- **Format Mismatch**: Perception sends WML schema, interfaces expect RenderTree
- **Missing Fields**: No Name, assets, MessageId, CreatedTime, Target

#### **Character Messages**
**Perception Sends:**
```typescript
{
    type: 'PublishMessage',
    targets: [characterId],
    displayProtocol: 'CharacterDescription',
    Name: string,
    Pronouns: string,
    fileURL?: string,
    Color?: string,
    CharacterId: ephemeraId,
    messageGroupId: MessageGroupId
}
```

**mtw-interfaces Expects:**
```typescript
{
    DisplayProtocol: 'CharacterDescription',
    CharacterId: EphemeraCharacterId,
    Name: string,
    fileURL?: string,
    Pronouns?: { subject: string, object: string, possessive: string, adjective: string, reflexive: string },
    MessageId: string,
    CreatedTime: number,
    Target?: EphemeraCharacterId
}
```

**Issues:**
- **Pronouns Format**: Perception sends string, interfaces expect structured object
- **Missing Fields**: No MessageId, CreatedTime, Target
- **Extra Fields**: Interfaces don't expect messageGroupId, Color

### **Required Updates**

#### **1. Update mtw-interfaces Message Types**
The message types in `packages/mtw-interfaces/ts/messages.ts` need to be updated to match the actual perception output:

- **Add WML Schema Support**: Create new message types that accept WML schema format
- **Update Field Requirements**: Remove required fields that perception doesn't provide
- **Add Missing Fields**: Include messageGroupId and other perception-specific fields
- **Fix Pronouns Format**: Update CharacterDescription to accept string pronouns

#### **2. Create New Message Types**
Consider creating new message types specifically for perception output:

```typescript
export type PerceptionRoomMessage = {
    type: 'PublishMessage';
    targets: EphemeraCharacterId[];
    displayProtocol: 'PerceptionMessage';
    wmlContent: WMLSchema;  // WML schema content
    metaData: PerceptionRoomMetaData;
    messageGroupId?: MessageGroupId;
}

export type PerceptionFeatureMessage = {
    type: 'PublishMessage';
    targets: EphemeraCharacterId[];
    displayProtocol: 'FeatureDescription';
    description: WMLSchema;
    FeatureId: EphemeraFeatureId;
    messageGroupId?: MessageGroupId;
}
```

#### **3. Update Validation Functions**
The `isMessage` validation function needs to be updated to handle the actual perception output format.

#### **4. Documentation Updates**
Update the `mtw-interfaces/AGENT.md` to reflect the actual message formats used by the perception system.

### **Migration Progress**

#### **✅ Phase 1: Interface Updates - COMPLETED**
- **New `PerceptionMessage` Type**: Added to `packages/mtw-interfaces` with WML schema support
- **Component UUID Field**: Uses `SchemaComponentUUID` for component identification and data lookup
- **Type Guards**: Comprehensive validation with `isPerceptionMessage` function
- **Tests**: Full test coverage with 67 tests passing

#### **🔄 Phase 2: Backend Updates - IN PROGRESS**
- **✅ Perception System**: Updated to send `PerceptionMessage` format for rooms, features, and knowledge
- **✅ MessageBus Integration**: Added `PublishPerceptionMessage` type and processing
- **✅ Infrastructure**: Frontend WML parsing with fallback strategy implemented
- **🔄 Character Descriptions**: Still using legacy format (doesn't use WML content)
- **🔄 Frontend Router**: Next step - update message router to handle new format

#### **⏳ Phase 3: Frontend Updates - PENDING**
- **Frontend Message Router**: Add `PerceptionMessage` case to handle new format
- **Component Updates**: Modify components to parse WML content
- **Component Lookup**: Use `componentUUID` to determine component type
- **Testing**: End-to-end validation of new message flow

### **Implementation Priority**
1. **High Priority**: Fix CharacterDescription pronouns format mismatch
2. **Medium Priority**: Add WML schema support for room/feature/knowledge messages
3. **Low Priority**: Add missing metadata fields (MessageId, CreatedTime, etc.) 