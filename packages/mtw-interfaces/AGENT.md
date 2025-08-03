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

#### **Client Messages** (Server → Client)
- **`AssetClientPlayerMessage`**: Player profile and character data
- **`AssetClientLibraryMessage`**: Available assets and characters
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

### 3. **Message Display** (`messages.ts`)

Defines the display protocol for different types of game messages:

#### **Current Message Types**
- **`SpacerMessage`**: Visual spacing in chat
- **`WorldMessage`**: System-generated content
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

Defines interfaces for real-time event subscriptions:

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

### 6. **Event Bridge** (`eventBridge.ts`)

Defines AWS EventBridge event formats for player updates:

#### **Event Types**
- **`EventBridgeUpdatePlayer`**: Player profile and character updates
- **`EventBridgeUpdatePlayerCharacter`**: Individual character updates
- **`EventBridgeUpdatePlayerAsset`**: Asset ownership updates

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

#### **Phase 2: Frontend Updates**
- **WML Parsing**: Leverage existing frontend WML parsing capabilities
- **Component Lookup**: Use `SchemaComponentUUID` to fetch component data and determine type
- **Component Routing**: Update message router to handle generic perception messages

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
2. **Frontend Preparation**: Add WML disambiguation logic to message router 🔄 **IN PROGRESS**
3. **Perception System Update**: Modify perception system to use new format ⏳ **PENDING**
4. **Testing and Validation**: Ensure all perception content renders correctly ⏳ **PENDING**
5. **Legacy Removal**: Remove deprecated message types after successful migration ⏳ **PENDING** 