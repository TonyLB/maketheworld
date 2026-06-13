# Message Components - Agent Navigation Guide

## Overview

The `Message` directory contains React components that handle the display of different types of game messages. These components receive messages from the WebSocket connection and render them appropriately based on their `DisplayProtocol` type.

## Core Purpose

- **Message Rendering**: Display different types of game messages with appropriate styling
- **Protocol Routing**: Route messages to the correct component based on `DisplayProtocol`
- **Interactive Elements**: Handle clickable links and character actions
- **Real-time Updates**: Process incoming WebSocket messages for immediate display
- **Narrative Interface**: Create an immersive, time-ordered display of in-fiction events organized by location

## Current Message Types

### **Chat Messages**
- **`SayMessage`**: Character dialogue with speech bubbles
- **`NarrateMessage`**: Character narrative actions
- **`OOCMessage`**: Out-of-character player communication
- **`WorldMessage`**: System-generated content
- **`WorldOOCMessage`**: System / out-of-world lines (grey striped bubble, not in-play)
- **`CommandTranscriptMessage`**: Player-submitted command echo on the message log (distinct styling)

### **Perception Messages**
- **`RoomDescription`**: Room information and layout
- **`RoomHeader`**: Room header information
- **`FeatureDescription`**: Interactive feature details
- **`KnowledgeDescription`**: Knowledge item information
- **`CharacterDescription`**: Character appearance and details

### **Utility Messages**
- **`SpacerMessage`**: Visual spacing in chat
- **`UnknownMessage`**: Fallback for unrecognized message types

## Message Routing System

### **Main Router** (`index.tsx`)
The primary message router uses a switch statement to route messages based on `DisplayProtocol`:

```typescript
const { DisplayProtocol } = message
switch(DisplayProtocol) {
    case 'SayMessage':
        return <SayMessage message={message} variant={message.CharacterId === CharacterId ? 'right' : 'left'} />
    case 'RoomDescription':
        return <RoomDescription message={message} {...rest} />
    case 'FeatureDescription':
        return <ComponentDescription message={message} icon={<FeatureIcon />} onClickLink={onClickLink} {...rest} />
    // ... other cases
    default:
        return <UnknownMessage message={message} />
}
```

### **Component Structure**
Each message type has its own component that:
- Receives the message object as props
- Handles specific styling and layout
- Manages interactive elements (links, buttons)
- Integrates with Redux for state management

## Message Panel UI Architecture

The Message Panel provides the primary interface for character-based gameplay, organizing messages into a narrative timeline that maintains immersion while providing essential navigation context.

### **Overall Layout**

The Message Panel (`MessagePanel.tsx`) creates a two-section interface:
- **Message Display Area**: Virtualized list of time-ordered messages
- **Input Area**: Character action and communication input

### **Narrative Timeline Organization**

#### **Time-Ordered Message Flow**
Messages are displayed in strict chronological order to create a coherent narrative:
- **Character dialogue** (`SayMessage`, `NarrateMessage`, `OOCMessage`)
- **World events** (`WorldMessage`)
- **Environmental descriptions** (`RoomDescription`, `FeatureDescription`)
- **Character interactions** (movement, actions, discoveries)

#### **Room-Based Sectioning**
The timeline organizes messages into distinct sections representing different locations the character has visited. When a character moves to a new room, a new section begins with a room header, and all subsequent messages are grouped under that location until the next movement occurs.

### **Sticky Room Headers**

#### **Header Positioning**
Room headers use sticky positioning to remain visible during scrolling:
- **Scroll Behavior**: Headers scroll with content until reaching the top of the viewport
- **Sticky Lock**: Once at the top, headers remain visible as context anchors
- **Multiple Headers**: Only the current section's header remains sticky when multiple sections are visible

#### **Header Content**
Each room header displays:
- **Room Name**: Current location identifier
- **Room Summary**: Brief description of the space
- **Character List**: Other characters currently present
- **Exit List**: Available navigation options
- **Environmental Status**: Current room state

**Multi-channel (render vs affordances, Phase C):** Agreed client norms live in [`lambda/ephemera/AGENT.multiChannel.contract.md`](../../../../lambda/ephemera/AGENT.multiChannel.contract.md) **Phase C client composition (agreed)**. Mental models: [`AGENT.multiChannel.concepts.md`](../../../../lambda/ephemera/AGENT.multiChannel.concepts.md). Narrative transcript: [`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md).

### **Dynamic Header Updates**

#### **In-Place Header Replacement**
The system handles room header updates through a special mechanism that preserves the narrative timeline while keeping location context current. When new room header information arrives, it updates the existing header display rather than adding a new message to the chronological flow.

#### **Header Update Triggers**
Headers are refreshed when:
- **Room State Changes**: Environmental modifications, feature updates
- **Character Movement**: Other characters entering or leaving the room
- **Permission Changes**: Access to new areas or features
- **Time-Based Events**: Scheduled world changes affecting the room

#### **Temporal Consistency**
- **Message Timeline**: Remains strictly chronological for narrative flow
- **Header State**: Always reflects the most current room information
- **No Timeline Pollution**: Header updates don't create timeline entries
- **Context Preservation**: Room context remains visible regardless of scroll position

### **Virtual Scrolling Implementation**

#### **Performance Optimization**
The message list uses grouped virtualization to handle potentially long message histories efficiently. This approach renders only visible messages while maintaining smooth scrolling performance and supporting the room-based organization structure.

#### **Scrolling Behavior**
- **Auto-Follow**: New messages automatically scroll into view
- **Smooth Navigation**: Efficient scrolling through long message histories
- **Context Preservation**: Sticky headers maintain location awareness
- **Performance**: Only renders visible messages for optimal performance

### **Message Flow Management**

#### **Room Transition Handling**
When a character moves between rooms:

1. **Section Completion**: Current room section is finalized with final message count
2. **New Section Creation**: New room section begins with fresh header
3. **Header Population**: New room header displays current room state
4. **Message Continuation**: Subsequent messages are grouped under new room section

#### **Message Targeting and Display**
All messages are targeted to specific characters via the `message.Target` field and appear in that character's chronological timeline. Messages are grouped into room sections based on when they arrive relative to room transitions, not based on their type or origin. All message types (including OOC messages, character dialogue, and system events) follow the same room-sectioning pattern within each character's personal timeline.

### **State Management Integration**

#### **Message Processing**
The `getMessagesByRoom` selector takes the presentation transcript (one row per logical `MessageId` from `getPresentation`) and builds the room-organized timeline structure. This processing creates the grouped message layout while preserving transcript order within each room section.

#### **Character Context**
The `useActiveCharacter` hook provides:
- **Character Identity**: For message attribution and styling
- **Current Location**: For room section management
- **Permission Level**: For message visibility and interaction capabilities
- **Message History**: Organized message breakdown for display

### **User Experience Goals**

#### **Narrative Immersion**
- **Chronological Flow**: Maintains story continuity through strict time ordering
- **Location Context**: Room headers provide spatial anchoring for events
- **Character Perspective**: All information filtered through character viewpoint
- **Seamless Transitions**: Smooth movement between different locations

#### **Navigation Clarity**
- **Spatial Awareness**: Always clear which room events are occurring in
- **Temporal Awareness**: Clear progression of time through message sequence
- **Context Retention**: Sticky headers prevent loss of location context
- **History Access**: Full scrollable history of character's experiences

#### **Real-Time Responsiveness**
- **Immediate Updates**: New messages appear instantly in timeline
- **Live Room State**: Headers update to reflect current conditions
- **Character Awareness**: Real-time character presence in room headers
- **Environmental Changes**: Dynamic updates to room descriptions and features

## Integration Points

### **WebSocket Communication**
- Receives messages from the WebSocket connection
- Processes real-time updates from the server
- Handles connection state and reconnection

### **Redux State Management**
- Uses `useDispatch` for character actions
- Integrates with `ActiveCharacter` context
- Manages message history and state

### **Character System**
- Links to character actions via `socketDispatchPromise`
- Handles character-specific message styling
- Manages character presence and location

## Planned WML Integration

### **Current Perception System Issues**
The perception system currently sends WML schema strings that don't match the documented interfaces:
- **Format Mismatch**: WML schema vs. expected RenderTree
- **Missing Fields**: Incomplete message structure
- **Inconsistent Types**: Different formats for similar content

### **Phase 1 Interface Updates** ✅ **COMPLETED**
- **New `PerceptionMessage` Type**: Added to `packages/mtw-interfaces` with WML schema support
- **Component UUID Field**: Uses `SchemaComponentUUID` for component identification and data lookup
- **Type Guards**: Comprehensive validation with `isPerceptionMessage` function
- **Tests**: Full test coverage with 67 tests passing

### **Planned WML Disambiguation**

#### **New Message Type**

Instead of several bespoke data formats for different types of perception events, we will reduce to
a single `PerceptionMessage` type that encodes *both* type information and content in a WML transmission
string. This will help make our communications more aligned with the WML standard for transmission.

```typescript
interface PerceptionMessage {
    DisplayProtocol: 'PerceptionMessage';
    wmlContent: string;           // WML schema string
    componentUUID: SchemaComponentUUID; // Component UUID for lookup and type determination
    // ... other fields
}
```

#### **Component Lookup and Routing Logic**
The message router will need to:
1. **Parse WML**: Use existing frontend WML parsing capabilities
2. **Lookup Component**: Use `componentUUID` to fetch component data and determine type
3. **Route Appropriately**: Send to correct component based on component type

```typescript
case 'PerceptionMessage':
    const standardForm = new StandardForm(message.wmlContent)
    const component = standardForm.byUniversalID(message.componentUUID)
    const componentType = component.tag
    
    switch(componentType) {
        case 'Room':
            return <RoomDescription message={message} wmlContent={message.wmlContent} component={component} />
        case 'Feature':
            return <ComponentDescription message={message} wmlContent={message.wmlContent} component={component} />
        case 'Knowledge':
            return <ComponentDescription message={message} wmlContent={message.wmlContent} component={component} />
        case 'Character':
            return <CharacterDescription message={message} wmlContent={message.wmlContent} component={component} />
    }
```

#### **WML Content Processing**
Components will need to:
- **Parse WML**: Convert WML schema string to StandardForm
- **Use Component Data**: Access component information via `componentUUID` lookup
- **Extract Content**: Pull relevant information from WML structure and component data
- **Render Appropriately**: Display content with proper styling based on component type

**CRITICAL (Feature and Knowledge)** — mirror Room: In **`ComponentDescription.tsx`**, resolve prose from the parent component only:

1. Get the parent from `parsedWML.byUniversalId[componentUUID]`; use `instanceof StandardFeature` or `StandardKnowledge`.
2. Prefer **`component.render`** (ephemera **`<Render>`**, **`SituationProseFacetPayload`** shape); skip when empty.
3. Else use the **`SITUATION#DEFAULT`** facet in **`component.situations`** (not `items[0]`).
4. Map **`_displayName`** / **`_description`** from the payload; safe defaults when missing (**Unknown** / *No description*).

**Room**: Use **`StandardRoom.render`**, then the first **Situation** facet. See [`AGENT.RoomDescription.md`](./AGENT.RoomDescription.md) and [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md).

**Implementation reference:** [`ComponentDescription.tsx`](./ComponentDescription.tsx) (`resolveFeatureKnowledgeProse`).

**⚠️ CRITICAL**: The `StandardRender` constructor expects:
- **RenderTree arrays**: `new StandardRender(['text'])` ✅
- **StandardRender instances**: `new StandardRender(existingStandardRender)` ✅  
- **WML strings**: `new StandardRender('<Name>text</Name>')` ✅
- **NOT plain strings**: `new StandardRender('text')` ❌

See [WML Standard Components documentation](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) for details.

### **Migration Strategy**

#### **Phase 1: Add WML Support** ✅ **COMPLETED**
- **✅ Backend Ready**: Backend perception system now sends `PerceptionMessage` format
- **✅ Infrastructure Ready**: WML parsing with fallback strategy implemented in Redux
- **✅ Add `PerceptionMessage` case**: Added case to message router in `index.tsx`
- **✅ Create component lookup logic**: Using `componentUUID` to determine component type

#### **Phase 2: Bridge State Component Updates** ✅ **COMPLETED** 
All message components now support dual format handling (legacy and WML PerceptionMessage):

**✅ Bridge State Implementation Complete:**
- **`KnowledgeDescription`**: Handles both legacy and WML formats with proper Standard Component integration
- **`FeatureDescription`**: Uses ComponentDescription with dual format support
- **`RoomDescription`**: Full bridge state with legacy conversion functions and Standard format sub-components
- **`RoomHeader`**: Inherits bridge state from RoomDescription with header-specific layout

**Current Capabilities:**
- **Dual Format Support**: All components accept both legacy message types and PerceptionMessage with WML
- **Legacy Conversion**: Automatic conversion from legacy data to Standard Components at component boundaries
- **Standard Component Integration**: Sub-components work exclusively with Standard format objects
- **Backward Compatibility**: Maintains full support for existing legacy message formats

#### **Phase 3: Legacy Removal**
- Remove legacy message types from perception system
- Remove legacy property handling from components
- Clean up bridge state code
- Update type definitions to remove legacy interfaces

## Navigation Tips

1. **Start with Message Panel**: Begin with `MessagePanel.tsx` to understand overall UI structure
2. **Examine Virtual List**: Review `VirtualMessageList.tsx` for room organization and header management
3. **Study Message Router**: Understand message routing logic in `index.tsx`
4. **Check Room Selector**: Review `getMessagesByRoom` in `selectors.ts` for timeline organization
5. **Explore Components**: Each message type has its own component with specific styling
6. **Review WML Integration**: Focus on planned WML disambiguation for future development
7. **Test Message Flow**: Verify message processing from WebSocket through timeline to display

## Development Notes

### **Current State**
- **Bridge State Active**: All components support both legacy and WML PerceptionMessage formats
- **Message Routing**: Routes both legacy message types and PerceptionMessage with component lookup
- **Component Library**: Complete set of message display components with dual format support
- **WML Integration**: Full WML parsing and Standard Component integration
- **Redux Integration**: Proper state management and character actions
- **WebSocket Handling**: Real-time message processing for both format types

### **Future Plans**
- **Legacy Removal**: Complete Phase 3 migration by removing legacy message type support
- **PerceptionMessage Consolidation**: Migrate remaining message types to unified PerceptionMessage format
- **Bridge State Cleanup**: Remove dual format support once backend sends only WML format
- **Performance Optimization**: Optimize WML parsing and component rendering for real-time updates

### **Technical Debt**
- **Bridge State Complexity**: Components maintain both legacy and WML format support, adding complexity
- **Legacy Message Types**: Multiple specific message types could be consolidated into PerceptionMessage
- **Component Dual Concerns**: Some components handle both message parsing and display logic 