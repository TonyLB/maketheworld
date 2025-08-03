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

## Message Types

The system handles several types of perception messages, each with specific behavior:

### **PerceptionShowMessage**
Displays messages to characters based on room associations:

```typescript
{
    type: 'Perception',
    characterId?: EphemeraCharacterId,  // Optional: specific character
    ephemeraId: EphemeraMessageId,      // Message to display
    onlyForAssets?: AssetUUID[],        // Limit to specific assets
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Global Display**: If no `characterId`, shows to all characters in associated rooms
- **Targeted Display**: If `characterId` specified, shows only to that character
- **Asset Filtering**: `onlyForAssets` restricts which characters see the message
- **Room Association**: Messages are displayed to characters in rooms where the message appears

### **PerceptionShowMoment**
Displays all messages within a moment to appropriate audiences:

```typescript
{
    type: 'Perception',
    ephemeraId: EphemeraMomentId,      // Moment containing messages
    messageGroupId?: MessageGroupId
}
```

**Behavior:**
- **Message Discovery**: Finds all messages within the moment across assets
- **Asset-Based Routing**: Routes messages based on which assets contain them
- **Global vs. Asset-Specific**: Messages in global assets go to everyone, others are asset-restricted

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
- **Description Types**: Full room description or header-only based on `header` flag
- **Real-time Updates**: Provides immediate room information

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

- **ComponentMeta**: Retrieves component metadata across assets ([`../internalCache/componentMeta.AGENT.md`](../internalCache/componentMeta.AGENT.md))
- **ComponentRender**: Generates rendered descriptions for components ([`../internalCache/componentRender.AGENT.md`](../internalCache/componentRender.AGENT.md))
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
- `isPerceptionShowMessage()`
- `isPerceptionShowMoment()`
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
- **WorldMessage**: For general world descriptions
- **RoomDescription/RoomHeader**: For room information
- **CharacterDescription**: For character information
- **FeatureDescription**: For feature descriptions
- **KnowledgeDescription**: For knowledge content
- **MapUpdate**: For map display updates

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

### **Message Broadcasting**
```typescript
// Broadcast message to all characters in associated rooms
await perceptionMessage({
    payloads: [{
        type: 'Perception',
        ephemeraId: 'MESSAGE#announcement-uuid',
        messageGroupId: 'GROUP#1'
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
    displayProtocol: 'RoomDescription' | 'RoomHeader',
    description: schemaToWML([roomDescribe.schema]),  // WML schema format
    messageGroupId: MessageGroupId
}
```

**mtw-interfaces Expects:**
```typescript
{
    DisplayProtocol: 'RoomDescription' | 'RoomHeader',
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
    displayProtocol: 'RoomDescription' | 'RoomHeader';
    description: WMLSchema;  // New type for WML schema
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