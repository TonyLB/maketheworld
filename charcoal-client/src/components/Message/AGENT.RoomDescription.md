# RoomDescription Component - Standard Format Implementation

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

The component now uses **Standard format exclusively**. Room data is extracted from `StandardForm` via `StandardRoom` components.

### **Standard Format Data**
- **Room Data**: `StandardRoom` from `StandardForm.byUniversalId[metaData.componentUUID]`
- **Room name / summary / description (prose)**: Runtime precedence in **`RoomDescription.tsx`** (via **`SituationRoomFacetPayload`**): (1) **`StandardRoom.render`** (ephemera **`<Render>`**, same JSON shape as **`SituationRoomFacetPayloadType`**), (2) first **Situation** facet payload on the room, (3) **legacy** fallback: first **`StandardExample`** referenced by **`StandardRoom.examples`**. **Authoring:** Prefer **Situation** facets (and wire **`render`**); do **not** add new Room prose via **`examples`** / nested **Example** under Room (deprecated; see [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)).
- **Exits**: `StandardExitFacet[]` from `StandardRoom.exits.items`
- **Characters**: `StandardCharacter[]` resolved from `StandardRoom.characters.payload` references

### **Perception `parsedWML` parsing**

Inbound **`PerceptionMessage.wmlContent`** is parsed with **`standardizeMode: 'ephemeraWire'`** (see [`../../slices/messages/AGENT.md`](../../slices/messages/AGENT.md) and [`../../slices/perceptionCache/AGENT.md`](../../slices/perceptionCache/AGENT.md)) so **`<Render>`** and **`<Object>`** under **`Room`** are accepted. Asset-only **`StandardForm`** parsing would reject those tags.

## Component Architecture

### **Main Component** (`RoomDescription.tsx`)
- **Props Interface**: Accepts `parsedWML?: StandardForm` and `metaData: PerceptionRoomMetaData`
- **Mode Flag**: `header` prop determines display mode (full vs. compact)
- **Layout System**: CSS Grid with content, exits, and characters areas
- **Styling**: Gradient background with conditional margins

### **Sub-Components**

#### **RoomExit** (`RoomExit.tsx`)
- **Purpose**: Displays individual room exits as clickable chips
- **Functionality**: Character movement via Redux dispatch
- **Data**: Uses `StandardExitFacet` with `reference` (target room) and `payload` (exit name)
- **Implementation**: Extracts exit name from `exit.payload.toJSON()` and target room from `exit.reference.universalKey`

#### **RoomCharacter** (`RoomCharacter.tsx`)
- **Purpose**: Shows characters present in the room
- **Functionality**: Character linking and navigation
- **Data**: Uses `StandardCharacter` with rich text name, image, and metadata
- **Implementation**: Extracts character data from `StandardCharacter` properties directly

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

**Room-render / perception** WML from ephemera typically uses **`<Render>`** for resolved header prose (see **`packages/mtw-wml`** **`standardize/AGENT.md`**). Asset authoring should prefer **Situation** facets; **Example** under Room remains supported as **legacy** for older assets only.

```xml
<Asset uuid=(render)>
    <Room uuid=(room-uuid)>
        <Render>
            <DisplayName>Room Display Name</DisplayName>
            <Summary>Brief room summary</Summary>
            <Description>Room description content</Description>
        </Render>
        <Exit to=(ROOM#other-room)>North Exit</Exit>
        <Character uuid=(CHARACTER#npc) />
    </Room>
</Asset>
```

### **Component Interface**

```typescript
interface RoomDescriptionProps {
    parsedWML?: StandardForm;
    metaData: PerceptionRoomMetaData;
    children?: ReactChild | ReactChildren;
    header?: boolean;
    currentHeader?: boolean;
}
```

### **Standard Format Data Extraction Pattern**

```typescript
// Initialize with proper types (see RoomDescription.tsx)
let name: StandardLiteral = new StandardLiteral('Untitled', { tag: 'DisplayName' })
let description: StandardRender = new StandardRender([])
let summary: StandardRender = new StandardRender([])
let exits: StandardExitFacet[] = []
let characters: StandardCharacter[] = []

if (parsedWML) {
    const component = parsedWML.byUniversalId[componentUUID]
    if (component instanceof StandardRoom) {
        let prosePayload: SituationRoomFacetPayload | undefined
        if (component.render) {
            const fromRender = new SituationRoomFacetPayload(component.render)
            if (!SituationRoomFacetPayload.isEmpty(fromRender)) {
                prosePayload = fromRender
            }
        }
        if (!prosePayload) {
            const firstSituationFacet = component.situations.items[0]
            if (firstSituationFacet) {
                prosePayload = firstSituationFacet.payload as SituationRoomFacetPayload
            }
        }
        if (prosePayload) {
            name = prosePayload._displayName || new StandardLiteral('Untitled', { tag: 'DisplayName' })
            description = prosePayload._description || new StandardRender([])
            summary = prosePayload._summary || new StandardRender([])
        } else {
            // Legacy fallback only (deprecated for new authoring; prefer Situation + render)
            const firstExampleRef = component.examples.payload[0]
            if (firstExampleRef) {
                const firstExample = parsedWML._lookup(firstExampleRef.standardKey.toJSON())
                if (firstExample && firstExample.universalKey) {
                    const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as any]
                    if (exampleComponent instanceof StandardExample) {
                        name = exampleComponent.displayName || new StandardLiteral('Untitled', { tag: 'DisplayName' })
                        description = exampleComponent.description || new StandardRender([])
                        summary = exampleComponent.summary || new StandardRender([])
                    }
                }
            }
        }
        exits = component.exits.items
        characters = component.characters.payload
            .map((ref) => parsedWML._lookup(ref.standardKey.toJSON()))
            .filter((c): c is StandardCharacter => c instanceof StandardCharacter)
    }
}
```

### **Exit Facet Pattern**

Exits are handled via the Facet pattern using `StandardExitFacet`:
- Exits are stored in `StandardRoom.exits.items` as `StandardExitFacet[]`
- Each facet has a `reference` (target room) and `payload` (exit name/description)
- Access via `exit.reference.universalKey` for target room and `exit.payload.toJSON()` for exit name

### **Sub-Component Implementation**

#### **RoomExit Component**
```typescript
// RoomExit component interface - uses StandardExitFacet
interface RoomExitProps {
    exit: StandardExitFacet;  // Exit facet from StandardRoom.exits.items
    children?: ReactChild | ReactChildren;
}

// In RoomExit component - ExitFacet implementation
export const RoomExit = ({ exit }: RoomExitProps) => {
    // Extract exit name from facet payload
    const exitName = exit.payload.toJSON() ?? 'Unknown Exit'
    // Extract target room ID from facet reference
    const targetRoomId = exit.reference.universalKey ?? ''
    
    // Navigation logic
    const clickHandler = () => {
        if (isEphemeraCharacterId(CharacterId) && isEphemeraRoomId(targetRoomId)) {
            dispatch(addOnboardingComplete(['exitLink']))
            dispatch(moveCharacter(CharacterId)({ RoomId: targetRoomId, ExitName: exitName }))
        }
    }
    
    return <Chip label={exitName} icon={<ExitIcon />} onClick={clickHandler} />
}
```

#### **RoomCharacter Component**
```typescript
// RoomCharacter component interface - uses StandardCharacter
interface RoomCharacterProps {
    character: StandardCharacter;
    children?: ReactChild | ReactChildren;
}

// RoomCharacter component implementation
export const RoomCharacter = ({ character }: RoomCharacterProps) => {
    // Extract character data from StandardCharacter properties
    const characterName = character.name?.plainString || 'Unknown Character'
    const characterId = character.universalKey as EphemeraCharacterId
    const characterImage = character.image?.fileURL
    
    // Navigation logic
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

## Migration Status: ✅ Complete

### **Current Implementation**
- ✅ **Standard Format Only**: Component exclusively uses Standard format data from `StandardForm`
- ✅ **Sub-Component Integration**: RoomExit and RoomCharacter work with `StandardExitFacet` and `StandardCharacter` directly
- ✅ **Backend Integration**: Backend sends Standard format data via `PerceptionMessage` with `parsedWML` (ephemera wire may include **`<Render>`** on **`Room`**)
- ✅ **Character Integration**: Characters extracted from `StandardRoom.characters.payload` references
- ✅ **Exit Integration**: Exits use `StandardExitFacet` pattern from `StandardRoom.exits.items`

### **Migration Progress**

#### **Phase 1: Component Analysis** ✅ **COMPLETED**
- [x] Document current component structure and dependencies
- [x] Identify legacy data formats and WML equivalents
- [x] Analyze sub-component requirements (RoomExit, RoomCharacter)
- [x] Map Redux integration points

#### **Phase 2: Bridge State Implementation** ✅ **COMPLETED**
- [x] Update `RoomDescription` component interface to accept Standard format objects
- [x] Refactor `RoomExit` component to accept only `StandardExitFacet` instances (ExitFacet pattern)
- [x] Refactor `RoomCharacter` component to accept only `StandardCharacter` instances
- [x] Update component rendering to pass Standard format objects directly to sub-components
- [x] Add unit tests for component integration

#### **Phase 3: Backend Integration** ✅ **COMPLETED**
- [x] Update backend to include character data in room Standard format structure
- [x] Ensure ExitFacet and StandardCharacter data is properly included
- [x] Test Standard format generation for room components
- [x] Validate character data integration

#### **Phase 4: Complete Migration** ✅ **COMPLETED**
- [x] Remove legacy data format support from RoomDescription component
- [x] Update backend to send only Standard format data
- [x] Remove legacy conversion functions
- [x] Update tests to use only Standard format data

#### **Phase 5: Testing and Validation** ✅ **COMPLETED**
- [x] Test Standard format-only implementation
- [x] Verify navigation functionality with native Standard format
- [x] Validate layout in both header and full modes
- [x] Test asset integration with Standard format only

#### **Phase 6: Documentation Cleanup** ✅ **COMPLETED**
- [x] Update documentation to reflect Standard format-only implementation
- [x] Remove bridge state implementation notes
- [x] Document final Standard format integration patterns

## Implementation Notes

### **Standard Format Architecture**
1. **Standard Format Input**: Component accepts `parsedWML: StandardForm` via `PerceptionMessage` (built with **`ephemeraWire`** parsing for perception)
2. **Room Data Extraction**: Extracts `StandardRoom` from `parsedWML.byUniversalId[componentUUID]`
3. **Prose resolution**: **`render`** → **Situation** facet → **Example** (legacy fallback only; see **`SituationRoomFacetPayload`**)
4. **Exit Handling**: Direct use of `StandardExitFacet[]` from `StandardRoom.exits.items`
5. **Character Resolution**: Resolves `StandardCharacter[]` from `StandardRoom.characters.payload` references

### **Data Flow**
1. **Input**: `PerceptionMessage` with `parsedWML` and `metaData.componentUUID`
2. **Room Lookup**: `parsedWML.byUniversalId[componentUUID]` → `StandardRoom`
3. **Prose**: **`StandardRoom.render`**, then first Situation facet, then first **`StandardExample`** under **`examples`** (legacy only; do not rely on this for new content)
4. **Exit Direct Access**: `StandardRoom.exits.items` → `StandardExitFacet[]`
5. **Character Resolution**: `StandardRoom.characters.payload` → resolve each reference → `StandardCharacter[]`

### **Performance Considerations**
- **Complex Parsing**: Room data includes multiple sub-components
- **State Updates**: Heavy Redux integration requires careful state management
- **Layout Recalculation**: Grid layout may need optimization for Standard format data

### **Testing Coverage**
- **Unit Tests**: [`RoomDescription.test.tsx`](RoomDescription.test.tsx) --- **Pure render** (active) covers **`<Render>`** + **`ephemeraWire`**; **Pure affordances** / **Merged behavior** are **`describe.skip`** baselines for future multi-channel work
- **Integration Tests**: Message routing with `PerceptionMessage` and `parsedWML`
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
- **`../../slices/messages/index.ts`**: `processPerceptionMessage` and Redux wiring

### **Related Documentation**
- **WML Standard**: See [`../../../../packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md)
- **Message Components**: See [`AGENT.md`](AGENT.md) for overall migration strategy
- **Redux Integration**: See [`../../slices/AGENT.md`](../../slices/AGENT.md) for state management patterns

## Development Notes

### **Current State**
- **Standard Format Only**: Uses `StandardForm` and `StandardRoom` exclusively
- **Complex Layout**: CSS Grid with multiple interactive areas
- **Redux Integration**: Heavy dependency on player assets and character actions
- **Sub-Components**: RoomExit uses `StandardExitFacet`, RoomCharacter uses `StandardCharacter`

### **Technical Debt**
- **Layout Complexity**: CSS Grid layout may need optimization
- **State Dependencies**: Heavy Redux integration could be simplified
- **Sub-Component Coupling**: RoomExit and RoomCharacter are tightly coupled
- **Asset Integration**: Personal asset logic is complex and WML-specific

### **Future Improvements**
- **Component Simplification**: Reduce complexity of layout and state management
- **Performance Optimization**: Optimize parsing and rendering for Standard format data
- **Testing Coverage**: Expand tests for edge cases and error handling 