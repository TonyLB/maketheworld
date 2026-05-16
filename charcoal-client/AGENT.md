# Charcoal Client - Agent Navigation Guide

**⚠️ IN PROGRESS DOCUMENTATION** - This documentation is actively being developed and expanded. Expect continued refinement and additional detail over time.

## Overview

The Charcoal Client is a React-based frontend that provides users with two distinct modes of interaction with the Make The World collaborative storytelling platform:

1. **Authoring Mode**: Creating, editing, and managing world content
2. **Playing Mode**: Experiencing the world through character perspectives

### Key Concepts

- **Dual Mode Architecture**: Clear separation between authoring capabilities and character-based gameplay
- **Character-Centric Play**: All in-game interaction happens through character context
- **Asset-Based Authoring**: World building through structured asset creation and editing
- **Real-Time Messaging**: WebSocket-based communication for live storytelling

## Core Purpose

### Primary Functions

- **World Building Interface**: Comprehensive tools for creating and editing game content
- **Character Experience Engine**: Immersive interface for role-playing through character perspectives  
- **Real-Time Communication**: Live messaging for storytelling and collaborative authoring
- **Asset Management**: Version control and collaboration tools for shared content

### Key Responsibilities

- Route users between authoring and playing contexts appropriately
- Maintain clear boundaries between author-level and character-level information
- Provide real-time updates while preserving narrative immersion
- Handle complex state management for both editing and gameplay modes

## User Experience Modes

The client implements the fundamental architectural distinction between authoring and playing contexts. This dual-mode design reflects the core [Architectural Philosophy](../AGENT.architecture.philosophy.md) of perception-driven processing and is supported by the backend [Event Architecture](../AGENT.architecture.events.md).

### 🎨 **Authoring Mode - Collaborative Creator**

In authoring mode, users work as **collaborating authors** to create and extend the world. This mode provides:

**Information Scope:**
- Full access to underlying world structure and data
- Visibility into WML markup and asset relationships  
- Administrative capabilities within granted permissions
- Meta-information about how content should be rendered in fiction

**Primary Components:**
- **Library System** (`/Library/`): Browse and manage personal and shared assets
- **Asset Editor** (`/Library/Edit/Asset/:AssetId/*`): Comprehensive WML editing interface
- **Character Editor** (`/Library/Edit/Character/:AssetId/*`): Character creation and management
- **Map Editor**: Visual map creation and room/exit management
- **WML Editor**: Direct markup editing with syntax highlighting

**Routing Patterns:**
```
/Library/                           - Asset browser and management
/Library/Edit/Asset/:AssetId/*      - Asset editing interface  
/Library/Edit/Character/:AssetId/*  - Character editing
/Draft/*                           - Draft asset editing
```

**Key Features:**
- Direct WML manipulation and editing
- Asset version control and collaboration
- Administrative permission management
- Cross-asset dependency tracking
- Structured content creation tools

### 🎭 **Playing Mode - Character Perspective**

In playing mode, users experience the world **through the lens of their character**, maintaining narrative immersion:

**Information Scope:**
- World information filtered through character's perspective and knowledge
- No direct access to underlying markup or administrative data
- Content presented as fiction rather than structured data
- Character-limited permissions and sensory access

**Primary Components:**
- **Active Character Context** (`/Character/:CharacterId/*`): Character-scoped interaction
- **Message Panel** (`/Character/:CharacterId/Play`): Live messaging and interaction
- **Character Map View** (`/Character/:CharacterId/Map/`): In-character map navigation
- **Thinking jobs dashboard** (operator overlay): Command **`/dashboard`** in play opens completed jobs (**`thinkingJobs`**) and per-segment result detail (**`thinkingResults`** / **`fetchThinkingResult`**). See [`src/components/ThinkingDashboard/AGENT.md`](src/components/ThinkingDashboard/AGENT.md).
- **Perception System**: Character-filtered world information

**Routing Patterns:**
```
/Character/:CharacterId/Play        - Character messaging interface
/Character/:CharacterId/Map/        - Character map view
```

**Message Types & Perspective:**
- **`SayMessage`**: Character dialogue and speech
- **`NarrateMessage`**: Character actions and narrative
- **`OOCMessage`**: Out-of-character player communication (breaks character perspective)
- **`RoomDescription`**: Environment from character's viewpoint
- **`FeatureDescription`**: Interactive elements available to character
- **`KnowledgeDescription`**: Information the character knows or discovers

**Key Features:**
- Character-limited world perception
- Real-time narrative interaction
- Immersive fiction presentation
- Character-based permissions and access

## Technical Architecture

### WebSocket Communication System

The client maintains persistent WebSocket connections that serve different purposes across the two user modes, implementing the event processing patterns detailed in [Event Architecture](../AGENT.architecture.events.md):

#### **Authoring Mode - Collaborative Editing**
**Purpose**: Enable real-time collaboration between multiple authors working on shared content

**Real-Time Updates:**
- **Asset State Synchronization**: Live updates when other authors modify shared assets
- **Draft Conflict Resolution**: Coordination when multiple authors edit the same content
- **Permission Changes**: Immediate notification of access rights modifications
- **Version Control Events**: Real-time asset version updates and merge notifications

**Foundation for Future Tools:**
- **Live Editing**: Infrastructure for real-time collaborative WML editing (planned)
- **Concurrent Editing Indicators**: Show when others are actively editing (planned) 
- **Change Notifications**: Alert authors to modifications in dependent assets
- **Collaborative Workflows**: Support for review, approval, and publishing processes

**Message Types:**
- Asset update notifications
- Permission change events
- Draft state synchronization
- Version control messages

#### **Playing Mode - Live Storytelling**
**Purpose**: Deliver immersive real-time narrative experiences between characters

**Real-Time Features:**
- **Character Messages**: Live dialogue, narration, and out-of-character communication
- **World State Updates**: Room descriptions, character movements, environmental changes
- **Action Responses**: Immediate feedback to character commands and interactions
- **Perception Updates**: Character-filtered information about world changes

**Immersion Preservation:**
- All updates filtered through character perspective
- No authoring-level information leaks into character experience
- Maintains narrative flow and engagement

**Message Types:**
- `SayMessage`, `NarrateMessage`, `OOCMessage` for character communication
- `RoomDescription`, `FeatureDescription` for world perception
- `PerceptionMessage` for standardized character-filtered content

#### **Cross-Mode Coordination**
- **Character-Asset Relationship**: When authors modify assets that affect active characters
- **Permission Inheritance**: How asset-level permissions affect character capabilities
- **Content Publication**: Making authored content available to playing characters

### Routing Structure

The application uses React Router to enforce the authoring/playing distinction:

```typescript
// Authoring routes - full world access
<Route path="/Library/" element={<Library />} />
<Route path="/Library/Edit/Asset/:AssetId/*" element={<EditAsset />} />
<Route path="/Draft/*" element={<EditAsset />} />

// Playing routes - character-scoped access  
<Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch />} />
```

### Context Providers

**LibraryAsset Context** (Authoring):
- Asset-level state management
- WML editing capabilities
- Cross-asset relationship tracking
- Administrative permissions

**ActiveCharacter Context** (Playing):
- Character-scoped state and permissions
- Message filtering and routing
- Character-specific UI components
- Immersive interaction handling

### State Management

- **Author State**: Asset editing, WML manipulation, permissions
- **Character State**: Character information, location, available actions
- **Message State**: Real-time communication with character filtering
- **Navigation State**: Tab management for multiple contexts

## Integration Points

### Dependencies

- **WebSocket System**: Real-time messaging for both collaborative authoring and live storytelling
- **WML System**: [`packages/mtw-wml/`](../packages/mtw-wml/ts/AGENT.md) - World markup processing
- **Interface System**: [`packages/mtw-interfaces/`](../packages/mtw-interfaces/AGENT.md) - Message contracts
- **Asset System**: [`lambda/assets/`](../lambda/assets/AGENT.md) - Content management
- **Ephemera System**: [`lambda/ephemera/`](../lambda/ephemera/AGENT.md) - Real-time game state

### Cross-References

- **Message System**: [`src/components/Message/AGENT.md`](src/components/Message/AGENT.md) - Message routing and display
- **Thinking jobs dashboard**: [`src/components/ThinkingDashboard/AGENT.md`](src/components/ThinkingDashboard/AGENT.md) - Completed thinking jobs overlay (Command `/dashboard`)
- **Room headers (play transcript)**: [`src/components/Message/AGENT.RoomDescription.md`](src/components/Message/AGENT.RoomDescription.md) - In sticky header mode, `RoomDescription` distinguishes **live** (last message group: blue shell, interactive exits and character chips) from **historical** (grey shell, outlined/muted affordances, no navigation from stale exits or character links). **Live** follows game reality (last group in the virtualized list), not which header is stuck at the top of the viewport. See that doc for `currentHeader`, `useLivePalette`, and `affordancesInactive` wiring.
- **WML Standardization**: [`packages/mtw-wml/ts/standardize/AGENT.md`](../packages/mtw-wml/ts/standardize/AGENT.md) - Content structure
- **Perception Engine**: [`lambda/ephemera/perception/AGENT.md`](../lambda/ephemera/perception/AGENT.md) - Character-filtered information

### API Contracts

- **Asset CRUD**: Create, read, update, delete world content
- **Character Actions**: In-character commands and communications  
- **Real-Time Messaging**: WebSocket message handling
- **Permission Management**: User access control and character capabilities

## Usage Patterns

### Authoring Workflow

```typescript
// 1. Navigate to Library
navigate('/Library/')

// 2. Select or create asset
navigate('/Library/Edit/Asset/MyAsset/')

// 3. Edit WML content
updateStandard({ type: 'update', update: (draft) => {
    // Modify StandardForm structure
    return draft
}})

// 4. Add components (rooms, features, etc.)
const component = standardComponentFactory({ tag: 'Room', key: 'Room1' })
draft._components = [...draft._components, component]
```

### Playing Workflow  

```typescript
// 1. Select character context
<ActiveCharacter CharacterId={characterId}>
    // 2. Character-scoped interactions
    <MessagePanel />
</ActiveCharacter>

// 3. Send character actions
dispatch(parseCommand(CharacterId)({ 
    entry: "look around", 
    mode: 'Command' 
}))

// 4. Receive character-filtered responses
// Messages automatically filtered by perception system
```

### Message Type Usage

```typescript
// Authoring: Direct content creation
<WMLEdit /> // Full WML editing capabilities

// Playing: Character perspective
case 'RoomDescription':
    // Filtered through character's perception
    return <RoomDescription message={message} />
case 'SayMessage':  
    // Character dialogue
    return <SayMessage message={message} variant={...} />
```

## Navigation Tips

### Getting Started - Authoring Mode

1. **Workbench (Form-Based)**: See [`src/components/Workbench/AGENT.md`](src/components/Workbench/AGENT.md) for the overlay authoring interface, breadcrumb navigation, and component editing patterns
2. **Library Overview**: Start at [`src/components/Library/index.tsx`](src/components/Library/index.tsx)
3. **Asset Editing**: Examine [`src/components/Library/Edit/EditAsset.tsx`](src/components/Library/Edit/EditAsset.tsx)
4. **WML Integration**: Review [`src/components/Library/Edit/WMLEdit.tsx`](src/components/Library/Edit/WMLEdit.tsx)
5. **Component Creation**: Study [`src/components/Library/Edit/WMLComponentDetail.tsx`](src/components/Library/Edit/WMLComponentDetail.tsx)

### Getting Started - Playing Mode

1. **Character Context**: Start at [`src/components/ActiveCharacter/index.tsx`](src/components/ActiveCharacter/index.tsx)
2. **Message System**: Examine [`src/components/Message/index.tsx`](src/components/Message/index.tsx)
3. **Input Handling**: Review [`src/components/LineEntry/index.tsx`](src/components/LineEntry/index.tsx)
4. **Real-Time Updates**: Study [`src/slices/messages/`](src/slices/messages/)

### Key Files - Architecture

- **Routing**: [`src/components/AppLayout/index.tsx`](src/components/AppLayout/index.tsx) - Main application routing
- **State Management**: [`src/store/index.tsx`](src/store/index.tsx) - Redux store configuration
- **Message Processing**: [`src/components/Message/AGENT.md`](src/components/Message/AGENT.md) - Message system details

## Development Notes

### Current State

- **Dual Mode Support**: Complete separation between authoring and playing contexts
- **Character Perspective**: Full character-scoped information filtering
- **Real-Time Messaging**: WebSocket-based live communication
- **Asset Management**: Comprehensive content creation and editing tools
- **WML Integration**: Full support for world markup language processing

### Architecture Strengths

- **Clear Separation**: Authoring and playing modes are architecturally distinct
- **Character Immersion**: Playing mode maintains strict character perspective
- **Real-Time Capability**: Live updates without breaking immersion
- **Collaborative Tools**: Multi-user content creation and editing

### Areas for Continued Development

- **Mobile Optimization**: Enhanced responsive design for authoring tools
- **Performance**: Large asset handling and real-time optimization
- **User Experience**: Streamlined transitions between authoring and playing modes
- **Accessibility**: Enhanced support for assistive technologies
- **Documentation**: Continued expansion of component and pattern documentation

### Technical Debt

- **Component Complexity**: Some components handle both authoring and playing concerns
- **State Management**: Complex interdependencies between different state slices
- **Testing Coverage**: Need for expanded test coverage across component modes
- **Type Safety**: Opportunities for enhanced TypeScript integration
- **RoomExitEditor Refactoring**: The RoomExitEditor component was recently refactored to remove conditional logic dependencies, but needs further review for:
  - Proper error handling and validation
  - User experience improvements (better feedback, loading states)
  - Performance optimization for large exit lists
  - Accessibility enhancements
  - Integration with the broader StandardExit API patterns

This documentation will continue to evolve as the client system grows and new patterns emerge. The fundamental distinction between authoring and playing modes remains central to the user experience design.
