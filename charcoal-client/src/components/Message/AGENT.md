# Message Components - Agent Navigation Guide

## Overview

The `Message` directory contains React components that handle the display of different types of game messages. These components receive messages from the WebSocket connection and render them appropriately based on their `DisplayProtocol` type.

## Core Purpose

- **Message Rendering**: Display different types of game messages with appropriate styling
- **Protocol Routing**: Route messages to the correct component based on `DisplayProtocol`
- **Interactive Elements**: Handle clickable links and character actions
- **Real-time Updates**: Process incoming WebSocket messages for immediate display

## Current Message Types

### **Chat Messages**
- **`SayMessage`**: Character dialogue with speech bubbles
- **`NarrateMessage`**: Character narrative actions
- **`OOCMessage`**: Out-of-character player communication
- **`WorldMessage`**: System-generated content

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

**⚠️ CRITICAL**: When accessing WML content, remember that display content (`name`, `summary`, `description`) is stored in `Example` components, not directly in Feature/Knowledge/Room components. You must:

1. Get the main component from `parsedWML.byUniversalId[componentUUID]`
2. Use `instanceof` checks to verify the component type (e.g., `component instanceof StandardFeature`)
3. Access the `examples.payload[0]` to get the first Example reference
4. Look up the Example component to get actual display content

**Implementation Pattern:**
```typescript
// Initialize with proper types
let name: StandardRender = new StandardRender(['Unknown'])  // Array, not string
let description: StandardRender = new StandardRender([])

if (parsedWML && componentUUID) {
    // WML format: extract from StandardForm
    const component = parsedWML.byUniversalId[componentUUID]
    if (component instanceof StandardFeature || component instanceof StandardKnowledge) {
        const firstExample = component.examples.payload[0]
        if (firstExample && firstExample.universalKey) {
            const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as ComponentUUID]
            if (exampleComponent instanceof StandardExample) {
                // NOTE: StandardExample properties return RenderTree, not StandardRender
                // This is a technical debt that should be fixed in the WML system
                name = exampleComponent.name ? new StandardRender(exampleComponent.name) : new StandardRender(['Unknown'])
                description = exampleComponent.description ? new StandardRender(exampleComponent.description) : new StandardRender([])
            }
        }
    }
} else {
    // Legacy format: only handle actual legacy message types
    if (message.DisplayProtocol === 'FeatureDescription' || message.DisplayProtocol === 'KnowledgeDescription') {
        const legacyMessage = message as FeatureDescriptionType | KnowledgeDescriptionType
        name = new StandardRender(legacyMessage.Name || ['Unknown'])
        description = new StandardRender(legacyMessage.Description || [])
    }
    // For PerceptionMessage without parsedWML, keep default values (Unknown/empty)
}

// For rendering, convert back to RenderTree
<RenderTreeContent list={description.toJSON()} onClickLink={onClickLink} />
```

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

#### **Phase 2: Bridge State Component Updates** 🔄 **IN PROGRESS**
Each existing component will be updated to accept **either** legacy properties **or** new WML format:

```typescript
// Bridge state component interface
interface ComponentDescriptionProps {
    message: Message;
    // Legacy properties (for backward compatibility)
    Name?: string;
    Description?: RenderTree;
    // New WML properties (for PerceptionMessage)
    parsedWML?: StandardForm;
    componentUUID?: SchemaComponentUUID;
}
```

**Component Migration List** (ordered by testability and complexity):

1. **`KnowledgeDescription`** - Knowledge items, easy to test manually via Knowledge UI
2. **`FeatureDescription`** - Interactive features, moderate complexity
3. **`RoomHeader`** - Header information, moderate complexity
4. **`RoomDescription`** - Room layout and features, most complex

**Migration Progress Tracking:**
- [x] `KnowledgeDescription` - Bridge state implemented ✅ (WML structure corrected, instanceof checks added, proper StandardRender types, resilient typeguards)
- [x] `FeatureDescription` - Bridge state implemented ✅ (uses ComponentDescription, now supports both legacy and WML formats)
- [ ] `RoomHeader` - Bridge state implemented (Phase 1 analysis completed ✅)
- [ ] `RoomDescription` - Bridge state implemented (Phase 1 analysis completed ✅)

**Note**: `CharacterDescription` is not included in this migration as character perception messages are not currently being converted to `PerceptionMessage` format. This may be addressed in a future phase.

#### **Phase 3: Legacy Removal**
- Remove legacy message types from perception system
- Remove legacy property handling from components
- Clean up bridge state code
- Update type definitions to remove legacy interfaces

## Navigation Tips

1. **Start with Router**: Understand the message routing logic in `index.tsx`
2. **Check Component Types**: Each message type has its own component
3. **Review WML Integration**: Focus on planned WML disambiguation
4. **Examine Redux Integration**: Understand state management patterns
5. **Test Message Flow**: Verify message processing from WebSocket to display

## Development Notes

### **Current State**
- **Message Routing**: Fully functional for current message types
- **Component Library**: Complete set of message display components
- **Redux Integration**: Proper state management and character actions
- **WebSocket Handling**: Real-time message processing

### **Future Plans**
- **WML Integration**: Add WML parsing and disambiguation
- **Perception System**: Migrate to generic perception messages
- **Component Updates**: Enhance components for WML content
- **Performance**: Optimize WML parsing for real-time updates

### **Technical Debt**
- **Message Type Proliferation**: Too many specific message types
- **Interface Inconsistencies**: Perception system format mismatches
- **WML Processing**: Need to add WML parsing capabilities
- **Component Complexity**: Some components handle too many concerns
- **StandardExample Type Inconsistency**: `StandardExample` properties return `RenderTree` instead of `StandardRender`, requiring conversion in client code (see WML Standard Components documentation for details) 