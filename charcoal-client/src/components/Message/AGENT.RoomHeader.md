# RoomHeader Component - Migration Planning Guide

## Overview

The `RoomHeader` component is a specialized mode of the `RoomDescription` component, providing a compact header display for room navigation. It shares the same underlying component but with different styling and layout constraints.

## Core Purpose

### **Primary Function**
- **Compact Room Display**: Shows essential room information in a header format
- **Navigation Context**: Provides room context during character movement
- **Live Status**: Indicates when the room is the current active location
- **Asset Integration**: Shows personal asset status and edit capabilities

### **Key Responsibilities**
- **Header Layout**: Compact display with limited height and overflow handling
- **Live Indicator**: Shows "Live" chip when room is current location
- **Essential Information**: Displays name and basic description only
- **Asset Status**: Integrates with personal asset system for edit capabilities

## Current Implementation

### **Component Structure**
The `RoomHeader` uses the same `RoomDescription` component with a `header` prop:

```typescript
// In Message/index.tsx routing
case 'RoomHeader':
    return <RoomDescription message={message} {...rest} header />

// In RoomDescription.tsx
export const RoomDescription = ({ message, header, currentHeader }: RoomDescriptionProps) => {
    // ... component logic
    return <MessageComponent
        sx={{
            // ... styling
            ...(header
                ? {}  // Header mode: no margins
                : {
                    marginLeft: "70px",
                    marginRight: "70px"  // Full mode: side margins
                }
            )
        }}
    >
        <Box sx={{ gridArea: 'content' }}>
            <Typography variant='h5' align='left'>
                { standardName?.plainString ?? 'Untitled' }
                { currentHeader && <MiniChip text="Live" /> }  // Live indicator
            </Typography>
            <Box sx={{ 
                overflow: 'hidden',
                ...(header && {
                    maxHeight: '20vh',  // Header constraint
                    overflow: 'hidden'
                })
            }}>
                {/* Description content */}
            </Box>
        </Box>
        {/* Exits and Characters sections */}
    </MessageComponent>
}
```

### **Key Differences from Full Description**

#### **Layout Constraints**
- **Height Limit**: `maxHeight: '20vh'` with overflow hidden
- **No Margins**: Removes side margins for header positioning
- **Compact Display**: Shows only essential information

#### **Live Status**
- **Current Header**: `currentHeader` prop indicates active room
- **Live Chip**: Shows "Live" indicator when room is current location
- **Asset Integration**: Personal asset status affects edit capabilities

#### **Content Prioritization**
- **Name Display**: Room name with live indicator
- **Description**: Truncated description with overflow handling
- **No Exits/Characters**: Header mode typically doesn't show sub-components

## WML Migration Requirements

### **WML Structure for Room Headers**

Room headers use the same WML structure as full descriptions, but with different display logic:

```xml
<Asset key=(RoomName)>
    <Room uuid=(room-uuid)>
        <Example uuid=(room-example-1)>
            <Name>Room Display Name</Name>
            <Description>Room description content</Description>
            <Summary>Brief room summary</Summary>
        </Example>
        <!-- Exits and Characters may be present but not displayed in header mode -->
    </Room>
</Asset>
```

### **Bridge State Interface**

```typescript
interface RoomHeaderProps {
    message: RoomHeaderType | (PerceptionMessage & { parsedWML?: StandardForm });
    children?: ReactChild | ReactChildren;
    header: true;  // Always true for RoomHeader
    currentHeader?: boolean;
    // New WML properties
    parsedWML?: StandardForm;
    componentUUID?: SchemaComponentUUID;
}
```

### **WML Data Extraction Pattern**

```typescript
// Initialize with proper types (same as RoomDescription)
let name: StandardRender = new StandardRender(['Unknown'])
let description: StandardRender = new StandardRender([])
let summary: StandardRender = new StandardRender([])

if (parsedWML && componentUUID) {
    // WML format: extract from StandardForm
    const component = parsedWML.byUniversalId[componentUUID]
    if (component instanceof StandardRoom) {
        // Extract room data from WML structure (same as RoomDescription)
        const firstExample = component.examples.payload[0]
        if (firstExample && firstExample.universalKey) {
            const exampleComponent = parsedWML.byUniversalId[firstExample.universalKey as ComponentUUID]
            if (exampleComponent instanceof StandardExample) {
                name = exampleComponent.name ? new StandardRender(exampleComponent.name) : new StandardRender(['Unknown'])
                description = exampleComponent.description ? new StandardRender(exampleComponent.description) : new StandardRender([])
                summary = exampleComponent.summary ? new StandardRender(exampleComponent.summary) : new StandardRender([])
            }
        }
    }
} else {
    // Legacy format: extract from message
    const legacyMessage = message as RoomHeaderType
    name = new StandardRender(legacyMessage.Name || ['Unknown'])
    description = new StandardRender(legacyMessage.Description || [])
    summary = new StandardRender(legacyMessage.Summary || [])
}
```

## Migration Strategy

### **Phase 1: Component Analysis** 🔄 **IN PROGRESS**
- [x] Document current header-specific behavior
- [x] Identify layout constraints and styling differences
- [ ] Map live status and asset integration requirements
- [ ] Analyze content prioritization logic

### **Phase 2: Bridge State Implementation**
- [ ] Update `RoomDescription` component to accept Standard format objects (inherits to RoomHeader)
- [ ] Ensure header mode works with Standard format data (inherited from RoomDescription)
- [ ] Maintain live status functionality with Standard format data
- [ ] Preserve asset integration logic

### **Phase 3: Header-Specific Features**
- [ ] Test live indicator with Standard format data
- [ ] Verify layout constraints work with Standard format data
- [ ] Ensure asset status integration functions correctly
- [ ] Validate overflow handling with Standard format content

### **Phase 4: Testing and Validation**
- [ ] Test header mode with both legacy and Standard format data
- [ ] Verify live status indicator functionality
- [ ] Test layout constraints and overflow handling
- [ ] Validate asset integration in header mode

## Implementation Notes

### **Critical Considerations**
1. **Layout Constraints**: Header mode has specific height and overflow constraints
2. **Live Status**: Current header logic must work with Standard format data
3. **Asset Integration**: Personal asset status affects header display
4. **Content Prioritization**: Header shows limited content compared to full description

### **Performance Considerations**
- **Compact Rendering**: Header mode should be optimized for quick rendering
- **Overflow Handling**: Text truncation must work with Standard format content
- **Live Updates**: Status changes should be efficient

### **Testing Strategy**
- **Layout Testing**: Verify header constraints with Standard format content
- **Live Status**: Test live indicator with Standard format data
- **Asset Integration**: Validate asset status display
- **Overflow Testing**: Ensure text truncation works correctly

## Navigation Tips

### **Getting Started**
1. **Understand Header Mode**: Review how `header` prop affects display
2. **Examine Live Logic**: Understand current header status handling
3. **Map Asset Integration**: Identify personal asset status requirements
4. **Plan WML Integration**: Design WML support for header mode

### **Key Files**
- **`RoomDescription.tsx`**: Main component with header mode logic
- **`Message/index.tsx`**: Routing logic for RoomHeader
- **`messages.ts`**: Legacy data type definitions

### **Related Documentation**
- **RoomDescription**: See [`AGENT.RoomDescription.md`](AGENT.RoomDescription.md) for full component details
- **Message Components**: See [`AGENT.md`](AGENT.md) for overall migration strategy
- **Asset Integration**: See [`../../slices/AGENT.md`](../../slices/AGENT.md) for asset status patterns

## Development Notes

### **Current State**
- **Header Mode**: Fully functional with legacy `RoomHeader` format
- **Layout Constraints**: Height limits and overflow handling
- **Live Status**: Current header indicator functionality
- **Asset Integration**: Personal asset status display

### **Migration Priority**
- **Medium Complexity**: Simpler than full RoomDescription but has specific requirements
- **Dependencies**: Relies on RoomDescription component updates
- **Header-Specific**: Has unique layout and status requirements
- **Testing**: Requires specific testing for header mode functionality

### **Technical Debt**
- **Layout Constraints**: Height limits may need adjustment for WML content
- **Live Status**: Current header logic could be simplified
- **Asset Integration**: Personal asset logic is complex
- **Content Prioritization**: Header content selection could be more flexible

### **Future Plans**
- **Standard Format Standardization**: Move to Standard format for header data
- **Layout Optimization**: Improve header layout for Standard format content
- **Status Simplification**: Streamline live status logic
- **Testing Coverage**: Add comprehensive tests for header functionality 