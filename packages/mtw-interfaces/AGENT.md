# MTW Interfaces - Agent Navigation Guide

## Overview

The `mtw-interfaces` package serves as the **single source-of-truth** for all serializable (plain-old JavaScript object) formats used in communication between the various microservices and frontend client in Make The World. This package defines the contract that ensures type safety and consistency across the entire system.

## Core Purpose

- **Type Safety**: Provides TypeScript interfaces for all API messages and responses
- **Contract Definition**: Establishes the communication protocol between services
- **Validation**: Includes runtime type checking functions for message validation
- **Documentation**: Serves as living documentation of the system's communication patterns

## Message Categories

### 1. **Asset Management** (`asset.ts`)

Defines interfaces for asset library operations, file management, and player data:

#### **API Messages** (Client → Server)
- **`FetchLibraryAPIMessage`**: Request available assets and characters
- **`FetchAssetAPIMessage`**: Retrieve specific asset content
- **`FetchImportsAPIMessage`**: Get imported component data
- **`UploadAssetLinkAPIMessage`**: Request upload URLs for assets
- **`AssetCheckin/CheckoutAPIMessage`**: Version control operations
- **`AssetSubscribe/UnsubscribeAPIMessage`**: Real-time updates
- **`AssetPlayerSettingsAPIMessage`**: Update player preferences
- **`AssetLLMGenerateRequestAPIMessage`**: AI content generation
- (Legacy `AssetWhoAmIAPIMessage` removed - player data now flows through `mtw.assets.players` data source)

#### **Client Messages** (Server → Client)
- **`AssetClientLibraryMessage`**: Available assets and characters
- (Legacy `AssetClientPlayerMessage` removed - player data now flows through `mtw.assets.players` data source)
- **`AssetClientMetaDataMessage`**: Asset metadata and zone information
- **`AssetClientFetchURL`**: Download URLs for assets
- **`AssetClientUploadURL`**: Upload URLs with presigned access
- **`AssetClientFetchImports`**: Imported component data
- **`AssetClientParseWML`**: Parsed WML with extracted images
- **`AssetClientLLMGenerate`**: AI-generated content

### 2. **Ephemera System** (`ephemera.ts`)

Defines interfaces for real-time game state and character interactions:

#### **API Messages** (Client → Server)
- **`RegisterCharacterAPIMessage`**: Join game as a character
- **`UnregisterCharacterAPIMessage`**: Leave game
- **`FetchEphemeraAPIMessage`**: Get current game state
- **`SyncAPIMessage`**: Synchronize with server state
- **`MapSubscribe/UnsubscribeAPIMessage`**: Map update subscriptions
- **`ActionAPIMessage`**: Character actions (look, move, speak, narrate, OOC)
- **`LinkAPIMessage`**: Create connections between components
- **`CommandAPIMessage`**: Execute game commands

#### **Client Messages** (Server → Client)
- **`EphemeraClientMessageEphemeraUpdate`**: Real-time state updates
  - **CharacterInPlay**: Character presence and location
  - **MapUpdate**: Map visibility and content changes
  - **MapClear**: Remove map displays
- **`EphemeraClientMessagePublishMessages`**: Chat and narrative messages
- **`EphemeraClientMessageRegister/UnregisterMessage`**: Character registration confirmations
- **`EphemeraClientMessageSubscribeToMapsMessage`**: Map subscription confirmations
- **`EphemeraClientMessageConversationStep`** (`ephemera.ts`): Correlated multi-message streams over LifeLine (e.g. `socketDispatchConversation` in charcoal-client). Fields include `conversationId`, non-empty `pipeline` (string; narrow per feature as needed), `step` (`generating` | `complete` | `error`), optional `RequestId`, and optional `payload` on terminal steps. [`isTerminalConversationStep`](ts/ephemera.ts) treats `Error` and terminal `ConversationStep` as stream completion. Preview-only wire shapes were removed; new pipelines extend this envelope with additional types next to the base definition in `ephemera.ts`.

### 3. **Message Display** (`messages.ts`)

Defines the display protocol for different types of game messages:

#### **Current Message Types**
- **`SpacerMessage`**: Visual spacing in chat
- **`WorldMessage`**: System-generated content
- **`CommandTranscriptMessage`**: Player command echo on the message log (same `RenderTree` wire as world lines; distinct protocol for client styling)
- **`RoomDescription/Header/Update`**: Room information and changes
- **`FeatureDescription`**: Feature details and interactions
- **`KnowledgeDescription`**: Knowledge item information
- **`CharacterDescription`**: Character appearance and details
- **`CharacterSpeech`**: Character dialogue
- **`CharacterNarration`**: Character narrative actions
- **`OutOfCharacterMessage`**: Player OOC communication

#### **Planned Perception System**
- **`PerceptionMessage`**: Generic WML-based perception messages (replacing specific description types)
- **`WMLSchema`**: String format for WML content transmission
- **`SchemaComponentUUID`**: UUID field for component identification and data lookup

#### **Supporting Types**
- **`RoomExit`**: Exit connections between rooms
- **`RoomCharacter`**: Characters present in a room
- **`MapDescribeData`**: Map layout and room positions
- **`MessageCharacterInfo`**: Character metadata for messages

### 4. **Subscription System** (`subscriptions.ts`)

Defines interfaces for real-time event subscriptions. Subscription WebSocket messages follow the same `WebSocketFormat` contract as other WebSocket paths (see `@tonylb/mtw-lambda-patterns` formatTransform). Per-data-source external payload shapes and validation are defined by the corresponding `DataSourceEventSerializer` and type guards (e.g. `isWMLContentEventExternal`, `isPlayerExternal`) in the `eventBridge/` modules.

#### **API Messages**
- **`SubscribeAPIMessage`**: Subscribe to event sources
- **`UnsubscribeAPIMessage`**: Unsubscribe from events

#### **Client Messages**
- **`SubscriptionClientMergeConflictMessage`**: WML merge conflicts
- **`SubscriptionClientAssetEditedMessage`**: Asset content updates

### 5. **Coordination** (`coordination.ts`)

Defines interfaces for long-running operation status:

#### **Client Messages**
- **`CoordinationClientProgressMessage`**: Operation progress updates
- **`CoordinationClientSuccessMessage`**: Operation completion
- **`CoordinationClientErrorMessage`**: Operation failures

### 6. **EventBridge Event Contracts** (`eventBridge/`)

Defines event contracts for cross-service communication via AWS EventBridge:

#### **Event Contract Structure**
- **Internal Event Types**: Clean, domain-specific representations for messageBus processing
- **External Event Types**: Transmittable representations for EventBridge communication
- **Type Guards**: Functions for runtime event validation
- **Serializers**: Classes implementing `DataSourceEventSerializer` interface

#### **Available Data Sources**
- **WML Events** (`wml.ts`): Content and zone change events
- **Assets Events** (`assets.ts`): Component and asset-level events
- **Ephemera Events** (`ephemera.ts`): Real-time game state events

#### **Legacy Event Types**
- **`EventBridgeUpdatePlayer`**: Player profile and character updates
- **`EventBridgeUpdatePlayerCharacter`**: Individual character updates
- **`EventBridgeUpdatePlayerAsset`**: Asset ownership updates

For detailed information, see **[EventBridge Documentation](./ts/eventBridge/AGENT.md)**.

## Base Classes and Utilities

### **Base Classes** (`baseClasses.ts`)

#### **Ephemera ID System**
Defines typed IDs for all game entities with validation:
- **`EphemeraAssetId`**: `ASSET#uuid`
- **`EphemeraCharacterId`**: `CHARACTER#uuid`
- **`EphemeraRoomId`**: `ROOM#uuid`
- **`EphemeraFeatureId`**: `FEATURE#uuid`
- **`EphemeraKnowledgeId`**: `KNOWLEDGE#uuid`
- **`EphemeraMapId`**: `MAP#uuid`
- **`EphemeraActionId`**: `ACTION#uuid`
- **`EphemeraVariableId`**: `VARIABLE#uuid`
- **`EphemeraComputedId`**: `COMPUTED#uuid`
- **`EphemeraMessageId`**: `MESSAGE#uuid`
- **`EphemeraMomentId`**: `MOMENT#uuid`
- **`EphemeraImageId`**: `IMAGE#uuid`

#### **Asset Workspace Addresses**
Defines locations for assets in different zones:
- **`AssetWorkspaceAddress`**: Canon, Library, Personal, Draft, Archive zones

### **Utilities** (`utils.ts`)

Provides validation and type checking utilities used throughout the package.

## Integration Points

### **Frontend Client**
- Uses client message types for WebSocket communication
- Validates incoming messages with type guards
- Sends API messages for user actions

### **Asset Service**
- Handles asset management API messages
- Returns client messages with asset data
- Manages file uploads and downloads

### **Ephemera Service**
- Processes character actions and game state
- Broadcasts real-time updates to connected clients
- Manages character registration and presence

### **WML Service**
- Uses asset interfaces for WML processing
- Handles merge conflicts and content updates
- Manages asset versioning and checkouts

### **Event Bridge**
- Publishes player updates to other services
- Triggers workflows based on player changes
- Maintains player state across services

## Navigation Tips

1. **Start with API Messages**: Understand the request/response patterns
2. **Check Type Guards**: Use validation functions for runtime safety
3. **Follow Message Flow**: Trace client → server → client message patterns
4. **Review Base Classes**: Understand the ID system and common types
5. **Examine Tests**: See concrete examples of message usage

## Development Workflow

1. **Add New Messages**: Define both API and client message types
2. **Include Type Guards**: Add validation functions for new messages
3. **Update Tests**: Ensure comprehensive test coverage
4. **Document Changes**: Update this file for new message categories
5. **Version Control**: Increment package version for breaking changes

## Testing

### **Running Tests**
```bash
npm run test
```

## Perception System Migration

### **Current State**
The perception system currently sends WML schema strings that don't match the documented interfaces. This creates inconsistencies between the actual message format and the expected RenderTree format.

### **Planned Changes**

#### **Phase 1: Interface Updates** ✅ **COMPLETED**
- **New `PerceptionMessage` Type**: Generic message type that accepts WML schema strings ✅
- **Component UUID Field**: Add `SchemaComponentUUID` for component identification and data lookup ✅
- **Backward Compatibility**: Maintain existing message types during transition ✅
- **Type Guards**: Added `isPerceptionMessage` function with comprehensive validation ✅
- **Tests**: Created `messages.test.ts` with full test coverage ✅

#### **Phase 2: Frontend Updates** 🔄 **IN PROGRESS**
- **✅ Backend Perception System**: Updated perception system to send `PerceptionMessage` format
- **✅ MessageBus Infrastructure**: Added `PublishPerceptionMessage` type and processing
- **✅ Infrastructure**: Frontend WML parsing with fallback strategy implemented
- **🔄 Frontend Message Router**: Update message router to handle `PerceptionMessage` format
- **🔄 Component Lookup**: Use `SchemaComponentUUID` to fetch component data and determine type
- **🔄 Component Routing**: Update message router to handle generic perception messages

#### **Phase 3: System Migration**
- **Perception System**: Update to use consistent `PerceptionMessage` format
- **Frontend Components**: Replace specific description components with generic WML renderer
- **Legacy Cleanup**: Remove deprecated message types after migration

### **Benefits of Migration**
- **Consistency**: Single message type for all perception content
- **Flexibility**: WML format allows for rich, structured content
- **Extensibility**: Easy to add new perception types without interface changes
- **Maintainability**: Reduced interface complexity and message type proliferation

### **Migration Timeline**
1. **Interface Definition**: Define new `PerceptionMessage` type with WML support ✅ **COMPLETED**
2. **Backend Perception System**: Updated perception system to send `PerceptionMessage` format ✅ **COMPLETED**
3. **MessageBus Infrastructure**: Added `PublishPerceptionMessage` type and processing ✅ **COMPLETED**
4. **Frontend Infrastructure**: WML parsing with fallback strategy implemented ✅ **COMPLETED**
5. **Frontend Message Router**: Update message router to handle `PerceptionMessage` format 🔄 **IN PROGRESS**
6. **Testing and Validation**: Ensure all perception content renders correctly ⏳ **PENDING**
7. **Legacy Removal**: Remove deprecated message types after successful migration ⏳ **PENDING** 