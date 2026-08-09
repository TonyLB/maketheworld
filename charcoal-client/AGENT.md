# Charcoal Client - Agent Navigation Guide

**⚠️ IN PROGRESS DOCUMENTATION** - This documentation is actively being developed and expanded. Expect continued refinement and additional detail over time.

## Overview

The Charcoal Client is a React-based frontend for the Make The World collaborative storytelling
platform, built around a single **play spine** (the always-present character transcript at `/`)
with **authoring** reached through a Workbench overlay rather than a separate routed mode:

1. **Authoring**: Creating, editing, and managing world content via the Workbench overlay
2. **Playing**: Experiencing the world through the play spine, filtered by character perspective

### Key Concepts

- **Component identity (authoring)**: List rows, navigation, and `byUniversalId` use `ComponentUUID` (`ref.universalKey`); reference list remove/match uses `StandardReference.sameKey`. Labels use `componentDisplayLabel` only. See [Workbench AGENT.md](src/components/Workbench/AGENT.md#component-identity-client).
- **Spine + Overlay Architecture**: The play spine is the root surface; authoring opens as a Workbench overlay over it, driven by Redux state rather than routing
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

The client is anchored on a single **play spine** (routed at `/`): exactly one worldview, one
scrolling transcript, always present. Authoring is not a separate route tree — it is a
**Workbench overlay** opened from within the play spine, driven by Redux state rather than
navigation. The client still distinguishes authoring information (structure, WML, admin) from
playing information (character-filtered fiction), and that distinction reflects the core
[Architectural Philosophy](../AGENT.architecture.philosophy.md) of perception-driven processing
and is supported by the backend [Event Architecture](../AGENT.architecture.events.md) — but the
two are no longer separate routed "modes" a user switches between.

### 🎨 **Authoring - Workbench Overlay**

Authoring happens through the **Workbench**, an always-mounted overlay (`WorkbenchContainer` in
`AppLayout`) opened via `dispatch(openWorkbench())` from the play spine (e.g.
`Message/MessagePanel.tsx`) rather than through a route. See
[`src/components/Workbench/AGENT.md`](src/components/Workbench/AGENT.md) for the breadcrumb
navigation, component editing session model, and StandardForm mutation patterns — that document
is the authority for how authoring actually works today.

**Information Scope:**
- Full access to underlying world structure and data
- Visibility into WML markup and asset relationships
- Administrative capabilities within granted permissions
- Meta-information about how content should be rendered in fiction

**Key Features:**
- Form-based WML editing (breadcrumb-navigated component sessions, not raw markup by default)
- Draft-centric editing; read-only behavior for published assets
- Cross-asset dependency tracking

**Kept-not-live prototypes:** a separate, more fully-developed map editor lives at
`Workbench/MapEdit/` (drag-to-position rooms, exit-drawing) and is intentionally retained even
though nothing currently routes to it — see
[`Workbench/AGENT.md`](src/components/Workbench/AGENT.md) for why.

### 🎭 **Playing - Play Spine**

The play spine renders the world **through the lens of the active character**, maintaining
narrative immersion. It is the client's root surface (`/`), not one tab among several.

**Information Scope:**
- World information filtered through character's perspective and knowledge
- No direct access to underlying markup or administrative data
- Content presented as fiction rather than structured data
- Character-limited permissions and sensory access

**Primary Components:**
- **Play Spine Root** (`/`): auto-selects a character when there is exactly one option, otherwise
  shows a character-selection modal; renders the message panel once a character is active
- **Active Character Context** (`/Character/:CharacterId/*`): Character-scoped interaction
- **Message Panel** (`/Character/:CharacterId/Play`): Live messaging and interaction
- **Thinking jobs dashboard** (operator overlay): Command **`/dashboard`** in play opens completed jobs (**`thinkingJobs`**) and per-segment result detail (**`thinkingResults`** / **`fetchThinkingResult`**). See [`src/components/ThinkingDashboard/AGENT.md`](src/components/ThinkingDashboard/AGENT.md).
- **Perception System**: Character-filtered world information

Note: there is no character-scoped map route. In-character map navigation was de-wired (the `map`
command, SpeedDial, and Options-mode avatar entry points were removed) because `Maps` is
functionally dead — kept only as a D3 force-graph prototype. See
[`src/components/Maps/AGENT.md`](src/components/Maps/AGENT.md).

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

There is exactly one root surface, `/`, which renders the play spine. Everything else is reached
by explicit in-app navigation or a typed URL. The full route table, from
[`src/components/AppLayout/index.tsx`](src/components/AppLayout/index.tsx):

```typescript
<Route path="/SignIn" element={signInOrUp} />
<Route path="/Character/Archived" element={<InDevelopment />} />
<Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch messagePanel={messagePanel} />} />
<Route path="/Who/" element={whoPanel} />
<Route path="/Settings/" element={settingsPanel} />
<Route path="/" element={<PlaySpineRoot messagePanel={messagePanel} />} />
```

`CharacterRouterSwitch` adds one nested route, `Play`, inside the `ActiveCharacter` context.

**The Workbench overlay is not a route.** It is always mounted in `AppLayout` and toggled by Redux
state (`slices/UI/workbench`), so authoring can open over the play spine regardless of the current
URL. `Settings` is routed (`/Settings/`) but URL-only today — nothing in the live UI navigates to
it yet; see [`Settings/AGENT.md`](src/components/Settings/AGENT.md).

### Context Providers

**Workbench state** (Authoring, Redux + `WorkbenchComponentProvider`/`useWorkbenchComponent`):
- Asset-level state management (`useWorkbenchAsset`), see [`Workbench/AGENT.md`](src/components/Workbench/AGENT.md)
- WML editing via `StandardForm` mutation
- Cross-asset relationship tracking
- Administrative permissions

**ActiveCharacter Context** (Playing):
- Character-scoped state and permissions
- Message filtering and routing
- Character-specific UI components
- Immersive interaction handling

### State Management

- **Author State**: Workbench overlay open/asset id (`slices/UI/workbench`), component editing sessions
- **Character State**: Character information, location, available actions
- **Message State**: Real-time communication with character filtering
- **Navigation State**: Route state for the play spine and character context; the Workbench overlay is state-driven, not route-driven

## Integration Points

### Dependencies

- **WebSocket System**: Real-time messaging for both collaborative authoring and live storytelling
- **WML System**: [`packages/mtw-wml/`](../packages/mtw-wml/ts/AGENT.md) - World markup processing
- **Interface System**: [`packages/mtw-interfaces/`](../packages/mtw-interfaces/AGENT.md) - Message contracts
- **Asset System**: [`lambda/assets/`](../lambda/assets/AGENT.md) - Content management
- **Ephemera System**: [`lambda/ephemera/`](../lambda/ephemera/AGENT.md) - Real-time game state

### Cross-References

- **Message System**: [`src/components/Message/AGENT.md`](src/components/Message/AGENT.md) - Message routing and display
- **Thinking jobs dashboard**: [`src/components/ThinkingDashboard/AGENT.md`](src/components/ThinkingDashboard/AGENT.md) - Completed jobs + per-segment results (`thinkingJobs`, `thinkingResults`; Command `/dashboard`)
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
// 1. Open the Workbench overlay from the play spine (not a route navigation)
dispatch(openWorkbench())

// 2. Edit WML content via a component session (see Workbench/AGENT.md
//    for the working-copy / debounced-flush two-tier model)
updateStandard({ type: 'update', update: (draft) => {
    // Modify StandardForm structure
    return draft
}})

// 3. Add components (rooms, features, etc.)
const component = standardComponentFactory({ tag: 'Room', key: 'Room1' })
draft._components = [...draft._components, component]
```

See [`Workbench/AGENT.md`](src/components/Workbench/AGENT.md) for the full API contract:
breadcrumb stack navigation, `useWorkbenchComponent` / `useWorkbenchAssetMeta` sessions, and the
consistency layer that reconciles local drafts with `standardForm`.

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

1. **Workbench (Form-Based)**: See [`src/components/Workbench/AGENT.md`](src/components/Workbench/AGENT.md) for the overlay authoring interface, breadcrumb navigation, and component editing patterns — this is the only authoring surface today
2. **Overlay entry point**: [`src/components/AppLayout/index.tsx`](src/components/AppLayout/index.tsx) — `WorkbenchContainer` wiring
3. **Opening the overlay**: [`src/components/Message/MessagePanel.tsx`](src/components/Message/MessagePanel.tsx) — `dispatch(openWorkbench())`
4. **Component editing**: Study `useWorkbenchComponent` and `useWorkbenchAssetMeta`, documented in [`Workbench/AGENT.md`](src/components/Workbench/AGENT.md)

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

- **Play-Spine-Anchored**: A single always-present play spine at `/`, with authoring as a Workbench overlay rather than a competing route tree (the chat-spine refactor; see [`AGENT.chatSpine.planning.md`](AGENT.chatSpine.planning.md) for the "Current System State" it replaced)
- **Character Perspective**: Full character-scoped information filtering
- **Real-Time Messaging**: WebSocket-based live communication
- **Asset Management**: Comprehensive content creation and editing tools via the Workbench overlay
- **WML Integration**: Full support for world markup language processing
- **Orphaned pre-refactor surfaces removed**: `Explore`, `Home`, `Knowledge`, `Library`, and unreferenced legacy components were swept out; `Maps` and `Workbench/MapEdit/` are deliberately kept as unwired D3 prototypes (see [`Maps/AGENT.md`](src/components/Maps/AGENT.md), [`Workbench/AGENT.md`](src/components/Workbench/AGENT.md))

### Architecture Strengths

- **Single Worldview**: The play spine never shows more than one worldview at a time
- **Character Immersion**: Playing mode maintains strict character perspective
- **Real-Time Capability**: Live updates without breaking immersion
- **Collaborative Tools**: Multi-user content creation and editing
- **Overlay Authoring**: Workbench can open over the play spine without a route change, preserving context

### Areas for Continued Development

- **Mobile Optimization**: Enhanced responsive design for authoring tools
- **Performance**: Large asset handling and real-time optimization
- **User Experience**: Streamlined transitions between the play spine and the Workbench overlay
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

This documentation will continue to evolve as the client system grows and new patterns emerge. The fundamental distinction between authoring and playing information scope remains central to the user experience design, even though both are now reached through one spine-anchored surface rather than separate routed modes.
