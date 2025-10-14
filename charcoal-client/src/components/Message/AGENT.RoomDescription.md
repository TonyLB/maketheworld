# RoomDescription Component - Bridge State Implementation

## Overview

The `RoomDescription` component is the most complex message component in the system, handling room information display with multiple sub-components and rich data structures. It serves both as a standalone room description and as a header component for room navigation.

## Core Purpose

### **Primary Function**
- **Room Information Display**: Shows comprehensive room data including name, description, exits, and characters
- **Dual Mode Operation**: Functions as both full description and compact header
- **Interactive Navigation**: Provides clickable exits and character links
- **Asset Integration**: Displays personal asset status and edit capabilities

### **Key Responsibilities**
- **Layout Management**: Complex grid layout with content, exits, and characters sections
- **Data Processing**: Handles room metadata, character lists, and exit information
- **Interactive Elements**: Manages clickable exits and character navigation
- **State Integration**: Connects with Redux for player assets and character actions

## Current Data Structure

### **Legacy Message Types**

#### **RoomDescription** (`packages/mtw-interfaces/ts/messages.ts`)
```typescript
export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type RoomDescribeData = {
    Description: RenderTree;
    ShortName?: string;
    Name: RenderTree;
    Summary: RenderTree;
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
    assets?: AssetUUID[];
}
```

#### **RoomHeader** (`packages/mtw-interfaces/ts/messages.ts`)
```typescript
export type RoomHeader = {
    DisplayProtocol: 'RoomHeader';
} & RoomDescribeData & MessageAddressing
```

### **Supporting Data Types**

#### **RoomExit**
```typescript
export type RoomExit = {
    Name: string;
    RoomId: EphemeraRoomId;
    Visibility: 'Public' | 'Private';
}
```

#### **RoomCharacter**
```typescript
export type RoomCharacter = {
    Name: string;
    CharacterId: EphemeraCharacterId;
    fileURL?: string;
}
```

## Component Architecture

### **Main Component** (`RoomDescription.tsx`)
- **Props Interface**: Accepts `RoomDescriptionType | RoomHeaderType`
- **Mode Flag**: `header` prop determines display mode (full vs. compact)
- **Layout System**: CSS Grid with content, exits, and characters areas
- **Styling**: Gradient background with conditional margins

### **Sub-Components**

#### **RoomExit** (`RoomExit.tsx`)
- **Purpose**: Displays individual room exits as clickable chips
- **Functionality**: Character movement via Redux dispatch
- **Data**: Uses `RoomExit` type with name, room ID, and visibility
- **WML Migration**: 
  - **Data Structure**: Standard format uses `StandardReferenceData` for target room, legacy uses `EphemeraRoomId`
- **Description**: Standard format uses `StandardLiteral` for description, legacy uses plain string
- **Navigation**: Must maintain Redux dispatch for character movement
- **Visibility**: Legacy has `Visibility: 'Public' | 'Private'`, Standard format may not have this concept

#### **RoomCharacter** (`RoomCharacter.tsx`)
- **Purpose**: Shows characters present in the room
- **Functionality**: Character linking and navigation
- **Data**: Uses `RoomCharacter` type with character metadata
- **WML Migration**:
  - **Name**: Standard format uses rich text (`EditWrappedStandardNode`), legacy uses plain string
- **Image**: Standard format has structured image data, legacy uses `fileURL` string
- **Metadata**: Standard format has `shortName` and `pronouns`, legacy doesn't
- **Navigation**: Must maintain character linking functionality

### **Integration Points**

#### **Redux State**
- **Player Assets**: `getPlayer` selector for asset ownership
- **Personal Assets**: `getStatus` for draft asset status
- **Character Actions**: `socketDispatchPromise` for navigation
- **WML Integration Requirements**:
  - **Asset Integration**: `getStatus` selector must work with Standard format asset references
- **Asset Ownership**: `getPlayer` selector for asset ownership logic
- **Edit Capabilities**: Asset status affects edit button display
- **Navigation Actions**: `moveCharacter` and `socketDispatchPromise` must work with Standard format data
- **Onboarding**: `addOnboardingComplete` for user guidance

#### **Active Character Context**
- **Character ID**: Current character for navigation actions
- **Character Actions**: Link and movement functionality

## WML Migration Requirements

### **WML Structure for Rooms**

Based on the WML standard, room data should be structured as:

```xml
<Asset uuid=(RoomName)>
    <Room uuid=(room-uuid)>
        <Example uuid=(room-example-1)>
            <Name>Room Display Name</Name>
            <Description>Room description content</Description>
            <Summary>Brief room summary</Summary>
        </Example>
        <Exit to=(ROOM#other-room)>North Exit</Exit>
        <Character uuid=(character-1)><Name>Character Name</Name></Character>
    </Room>
</Asset>
```

### **Bridge State Interface**

```typescript
interface RoomDescriptionProps {
    message: RoomDescriptionType | RoomHeaderType | (PerceptionMessage & { parsedWML?: StandardForm });
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
    // New WML properties
    parsedWML?: StandardForm;
    componentUUID?: SchemaComponentUUID;
}
```

### **Standard Format Data Extraction Pattern**

```typescript
// Initialize with proper types
let name: StandardRender = new StandardRender(['Unknown'])
let description: StandardRender = new StandardRender([])
let summary: StandardRender = new StandardRender([])
let exits: StandardExit[] = []
let characters: StandardCharacter[] = []

if (parsedWML && componentUUID) {
    // Standard format: extract from StandardForm
    const component = parsedWML.byUniversalId[componentUUID]
    if (component instanceof StandardRoom) {
        // Extract room data from Standard format structure
        const firstExample = component.examples.payload[0]
        if (firstExample && firstExample.universalKey) {
            const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as ComponentUUID]
            if (exampleComponent instanceof StandardExample) {
                name = exampleComponent.name ? new StandardRender(exampleComponent.name) : new StandardRender(['Unknown'])
                description = exampleComponent.description ? new StandardRender(exampleComponent.description) : new StandardRender([])
                summary = exampleComponent.summary ? new StandardRender(exampleComponent.summary) : new StandardRender([])
            }
        }
        
        // Pass Standard format objects directly to sub-components
        exits = component.exits.payload  // Pass StandardExit instances directly
        characters = []  // Characters not stored in Room component - requires backend changes
    }
} else {
    // Legacy format: extract from message
    const legacyMessage = message as RoomDescriptionType | RoomHeaderType
    name = new StandardRender(legacyMessage.Name || ['Unknown'])
    description = new StandardRender(legacyMessage.Description || [])
    summary = new StandardRender(legacyMessage.Summary || [])
    // Convert legacy data to Standard format for sub-components
    exits = legacyMessage.Exits?.map(legacyExit => createStandardExitFromLegacy(legacyExit)) || []
    characters = legacyMessage.Characters?.map(legacyCharacter => createStandardCharacterFromLegacy(legacyCharacter)) || []
}
```

### **Legacy Data Conversion Functions**

#### **Convert Legacy RoomExit to StandardExit**
```typescript
const createStandardExitFromLegacy = (legacyExit: RoomExit): StandardExit => {
    // Create StandardExit instance from legacy data
    const exitData: StandardExitData = {
        to: legacyExit.RoomId,  // Convert EphemeraRoomId to reference
        description: legacyExit.Name  // Convert string name to StandardLiteral
    }
    
    return StandardExit.create(exitData)
}
```

#### **Convert Legacy RoomCharacter to StandardCharacter**
```typescript
const createStandardCharacterFromLegacy = (legacyCharacter: RoomCharacter): StandardCharacter => {
    // Create StandardCharacter instance from legacy data
    const characterData: StandardCharacterData = {
        name: legacyCharacter.Name,  // Convert string to rich text
        shortName: legacyCharacter.Name,  // Use name as shortName
        pronouns: undefined,  // Legacy doesn't have pronouns
        image: legacyCharacter.fileURL ? { fileURL: legacyCharacter.fileURL } : undefined
    }
    
    // Use Standard format factory to create StandardCharacter instance
    return standardComponentFactory('Character', characterData) as StandardCharacter
}
```

### **Sub-Component Standard Format Integration Strategy**

#### **Phase 1: Bridge State (Current Implementation)**
```typescript
// Updated RoomExit component interface - pure Standard format
interface RoomExitProps {
    exit: StandardExit;  // Only accept Standard format
    children?: ReactChild | ReactChildren;
}

// In RoomExit component - Bridge State Implementation
export const RoomExit = ({ exit }: RoomExitProps) => {
    const exitData = exit.toJSON()
    const exitName = exitData.description || 'Unknown Exit'
    const targetRoomId = exitData.to.universalKey as EphemeraRoomId
    
    // Navigation logic remains the same
    const clickHandler = () => {
        if (isEphemeraCharacterId(CharacterId) && isEphemeraRoomId(targetRoomId)) {
            dispatch(addOnboardingComplete(['exitLink']))
            dispatch(moveCharacter(CharacterId)({ RoomId: targetRoomId, ExitName: exitName }))
        }
    }
    
    return <Chip label={exitName} icon={<ExitIcon />} onClick={clickHandler} />
}
```

#### **Phase 2: Native Standard Format Integration (Next Step)**
```typescript
// In RoomExit component - Native Standard format implementation
export const RoomExit = ({ exit }: RoomExitProps) => {
    // Use native Standard format properties instead of toJSON()
    const exitName = exit.description?.plainString || 'Unknown Exit'
    const targetRoomId = exit.to.universalKey as EphemeraRoomId
    
    // Navigation logic remains the same
    const clickHandler = () => {
        if (isEphemeraCharacterId(CharacterId) && isEphemeraRoomId(targetRoomId)) {
            dispatch(addOnboardingComplete(['exitLink']))
            dispatch(moveCharacter(CharacterId)({ RoomId: targetRoomId, ExitName: exitName }))
        }
    }
    
    return <Chip label={exitName} icon={<ExitIcon />} onClick={clickHandler} />
}
```

#### **Refactor RoomCharacter to Accept StandardCharacter Only**
```typescript
// Updated RoomCharacter component interface - pure Standard format
interface RoomCharacterProps {
    character: StandardCharacter;  // Only accept Standard format
    children?: ReactChild | ReactChildren;
}

// In RoomCharacter component - Bridge State Implementation
export const RoomCharacter = ({ character }: RoomCharacterProps) => {
    const characterData = character.toJSON()
    const characterName = characterData.name?.toJSON() || 'Unknown Character'
    const characterId = character.universalKey as EphemeraCharacterId
    const characterImage = characterData.image?.toJSON()
    
    // Navigation logic remains the same
    const clickHandler = () => {
        dispatch(socketDispatchPromise({
            message: 'link',
            CharacterId: viewCharacterId,
            to: characterId
        }))
    }
    
    return <CharacterChip 
        CharacterId={characterId} 
        onClick={clickHandler} 
        Name={characterName} 
        fileURL={characterImage} 
    />
}
```

#### **Phase 2: Native Standard Format Integration (Next Step)**
```typescript
// In RoomCharacter component - Native Standard format implementation
export const RoomCharacter = ({ character }: RoomCharacterProps) => {
    // Use native Standard format properties instead of toJSON()
    const characterName = character.name?.plainString || 'Unknown Character'
    const characterId = character.universalKey as EphemeraCharacterId
    const characterImage = character.image?.fileURL
    
    // Navigation logic remains the same
    const clickHandler = () => {
        dispatch(socketDispatchPromise({
            message: 'link',
            CharacterId: viewCharacterId,
            to: characterId
        }))
    }
    
    return <CharacterChip 
        CharacterId={characterId} 
        onClick={clickHandler} 
        Name={characterName} 
        fileURL={characterImage} 
    />
}
```

## Migration Challenges

### **Complex Data Structure**
- **Multiple Sub-Components**: RoomExit and RoomCharacter components need WML support
- **Nested Data**: Exits and characters are complex objects, not simple strings
- **State Dependencies**: Heavy integration with Redux for navigation and assets

### **Layout Complexity**
- **Grid Layout**: CSS Grid with multiple areas (content, exits, characters)
- **Conditional Styling**: Different styles for header vs. full description
- **Responsive Design**: Complex layout that must work in both modes

### **Interactive Elements**
- **Exit Navigation**: Clickable exits that dispatch Redux actions
- **Character Linking**: Character chips with navigation functionality
- **Asset Integration**: Personal asset status and edit capabilities

### **Display Modes**
The `RoomDescription` component supports two display modes:

#### **Full Description Mode** (default)
- **Layout**: Side margins (70px left/right)
- **Content**: Complete room description with all sub-components
- **Height**: Unlimited height, full content display
- **Usage**: Primary room display in message stream

#### **Header Mode** (`header={true}`)
- **Layout**: No margins, compact header positioning
- **Content**: Essential information only (name, truncated description)
- **Height**: Limited to `maxHeight: '20vh'` with overflow hidden
- **Live Indicator**: Shows "Live" chip when `currentHeader={true}`
- **Usage**: Room context headers during navigation
- **Routing**: `RoomHeader` message type routes to `<RoomDescription header />`

### **Message Timeline Organization Role**

The RoomDescription component plays a crucial organizational role in the message timeline system:

#### **Room Section Headers**
When used in header mode (`header={true}`), RoomDescription components serve as:
- **Section Boundaries**: Demarcate different room sections in the chronological message timeline
- **Sticky Context**: Remain visible at the top of the viewport during scrolling to provide location context
- **Dynamic Updates**: Receive updated room information that replaces the header content without creating new timeline entries

#### **Header Update Behavior**
RoomHeader messages have special handling in the message timeline:
- **In-Place Updates**: When a new RoomHeader message arrives for the same room, it updates the existing header rather than appearing in chronological order
- **Temporal Independence**: Header content reflects current room state, not historical state when the header was first created
- **Timeline Preservation**: Regular messages maintain strict chronological ordering while headers provide current context

For complete details on message timeline organization, see [`AGENT.md`](AGENT.md).

## Migration Status: Bridge State ✅ Phases 1-3 Complete

### **Current Implementation (Bridge State)**
- ✅ **Dual Format Support**: Handles both legacy and Standard format data
- ✅ **Legacy Conversion**: Converts legacy data to Standard format for sub-components
- ✅ **Sub-Component Migration**: RoomExit and RoomCharacter accept only Standard format objects
- ✅ **Backend Integration**: StandardRoom character integration complete
- 🔄 **Next Phase**: Remove legacy data handling and use only Standard format

### **Migration Progress**

#### **Phase 1: Component Analysis** ✅ **COMPLETED**
- [x] Document current component structure and dependencies
- [x] Identify legacy data formats and WML equivalents
- [x] Analyze sub-component requirements (RoomExit, RoomCharacter)
- [x] Map Redux integration points

#### **Phase 2: Bridge State Implementation** ✅ **COMPLETED**
- [x] Update `RoomDescription` component interface to accept Standard format objects
- [x] Implement legacy data conversion functions (`createStandardExitFromLegacy`, `createStandardCharacterFromLegacy`)
- [x] Refactor `RoomExit` component to accept only `StandardExit` instances
- [x] Refactor `RoomCharacter` component to accept only `StandardCharacter` instances
- [x] Update component rendering to pass Standard format objects directly to sub-components
- [x] Add unit tests for legacy conversion functions

#### **Phase 3: Backend Integration** ✅ **COMPLETED**
- [x] Update backend to include character data in room Standard format structure
- [x] Ensure StandardExit and StandardCharacter data is properly included
- [x] Test Standard format generation for room components
- [x] Validate character data integration

#### **Phase 4: Complete Migration (Pending)**
- [ ] Remove legacy data format support from RoomDescription component
- [ ] Update backend to send only Standard format data
- [ ] Remove legacy conversion functions
- [ ] Update tests to use only Standard format data

#### **Phase 5: Testing and Validation (Pending)**
- [ ] Test Standard format-only implementation
- [ ] Verify navigation functionality with native Standard format
- [ ] Validate layout in both header and full modes
- [ ] Test asset integration with Standard format only

#### **Phase 6: Documentation Cleanup (Pending)**
- [ ] Update documentation to reflect Standard format-only implementation
- [ ] Remove bridge state implementation notes
- [ ] Document final Standard format integration patterns

## Implementation Notes

### **Bridge State Architecture**
1. **Legacy Input Processing**: Accepts legacy RoomDescription and RoomHeader message formats
2. **Standard Format Conversion**: Converts legacy data to Standard format objects at component boundary
3. **Pure Sub-Components**: RoomExit and RoomCharacter work exclusively with Standard format objects
4. **Character Integration**: Handles characters from both legacy arrays and StandardRoom.characters references
5. **Migration Path**: Maintains backward compatibility while enabling future removal of legacy support

### **Critical Migration Considerations**
1. **Data Conversion**: Legacy-to-Standard conversion happens at the RoomDescription component level
2. **Sub-Component Purity**: RoomExit and RoomCharacter must never receive legacy data directly
3. **Backend Transition**: Backend currently sends legacy format but includes Standard format character data
4. **Future Cleanup**: Legacy conversion code can be removed once backend sends only Standard format

### **Performance Considerations**
- **Complex Parsing**: Room data includes multiple sub-components
- **State Updates**: Heavy Redux integration requires careful state management
- **Layout Recalculation**: Grid layout may need optimization for Standard format data

### **Testing Coverage**
- **Unit Tests**: Legacy conversion functions and component rendering
- **Integration Tests**: Both legacy and Standard format data handling
- **Manual Testing**: Room navigation and character interaction functionality
- **Layout Testing**: Header vs. full description modes with proper styling

## Navigation Tips

### **Getting Started**
1. **Examine Current Component**: Understand the complex layout and data flow
2. **Review Sub-Components**: Understand RoomExit and RoomCharacter requirements
3. **Map Redux Integration**: Identify all state dependencies
4. **Plan WML Structure**: Design WML format for room data

### **Key Files**
- **`RoomDescription.tsx`**: Main component with complex layout
- **`RoomExit.tsx`**: Exit display and navigation
- **`RoomCharacter.tsx`**: Character display and linking
- **`messages.ts`**: Legacy data type definitions

### **Related Documentation**
- **WML Standard**: See [`../../../../packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md)
- **Message Components**: See [`AGENT.md`](AGENT.md) for overall migration strategy
- **Redux Integration**: See [`../../slices/AGENT.md`](../../slices/AGENT.md) for state management patterns

## Development Notes

### **Current State**
- **Legacy Support**: Fully functional with `RoomDescription` and `RoomHeader` formats
- **Complex Layout**: CSS Grid with multiple interactive areas
- **Redux Integration**: Heavy dependency on player assets and character actions
- **Sub-Components**: RoomExit and RoomCharacter have their own requirements

### **Migration Priority**
- **High Complexity**: Most complex component in the migration
- **Dependencies**: Multiple sub-components need WML support
- **Integration**: Heavy Redux integration requires careful planning
- **Testing**: Complex functionality requires comprehensive testing

### **Technical Debt**
- **Layout Complexity**: CSS Grid layout may need optimization
- **State Dependencies**: Heavy Redux integration could be simplified
- **Sub-Component Coupling**: RoomExit and RoomCharacter are tightly coupled
- **Asset Integration**: Personal asset logic is complex and WML-specific

### **Future Plans**
- **Standard Format Standardization**: Move to Standard format for all room data
- **Component Simplification**: Reduce complexity of layout and state management
- **Performance Optimization**: Optimize parsing and rendering for Standard format data
- **Testing Coverage**: Add comprehensive tests for Standard format functionality 