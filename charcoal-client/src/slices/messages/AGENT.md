# Messages Slice - Agent Navigation Guide

## Overview

The `messages` slice manages the Redux state for all game messages received via WebSocket. It handles message storage, retrieval, and synchronization with the local cache database.

## Core Purpose

- **Message Storage**: Maintains message history in Redux state
- **Cache Synchronization**: Syncs messages with local IndexedDB cache
- **Message Ordering**: Ensures messages are stored in chronological order
- **Performance Optimization**: Pre-processes messages for efficient rendering

## Current Architecture

### **State Structure**
```typescript
type MessageState = Record<EphemeraCharacterId, Message[]>
```

Messages are organized by target character ID, with each character having an array of messages sorted by creation time.

### **Core Operations**

#### **Message Reception** (`receiveMessages`)
- Receives new messages from WebSocket
- Uses binary search for efficient insertion
- Maintains chronological ordering
- Handles message updates and duplicates

#### **Cache Synchronization** (`cacheMessages`)
- Stores messages in IndexedDB via `cacheDB`
- Updates `LastSync` timestamps for character synchronization
- Dispatches messages to Redux state

#### **Message Retrieval** (`selectors`)
- `getMessages`: Retrieves messages for a specific character
- `getMessagesByRoom`: Filters messages by room context

## Planned WML Integration

### **Performance Optimization Strategy**

#### **Current Issue**
The planned `PerceptionMessage` type will contain WML schema strings that need parsing:
```typescript
interface PerceptionMessage {
    DisplayProtocol: 'PerceptionMessage';
    wmlContent: string;           // WML schema string requiring parsing
    componentUUID: SchemaComponentUUID;
    // ... other fields
}
```

**✅ Phase 1 Interface Updates Completed:**
- `PerceptionMessage` type defined in `packages/mtw-interfaces`
- `SchemaComponentUUID` type using `EphemeraId` system
- Comprehensive type guards and validation
- Full test coverage with 67 tests passing

#### **Optimization Plan**
To avoid expensive WML parsing on every render, we will:

1. **Parse at Reception**: Parse WML content when messages are first received
2. **Store Parsed Data**: Store `StandardForm` instances in Redux state
3. **Pre-compute Component Data**: Extract component information during parsing
4. **Cache Results**: Avoid re-parsing the same WML content

#### **Enhanced Message Structure**
```typescript
// Enhanced message type with parsed WML
type EnhancedMessage = Message | (PerceptionMessage & { parsedWML: StandardForm })
```

#### **Implementation Strategy**

##### **Phase 1: Message Processing Enhancement** ✅ **IMPLEMENTED**
```typescript
// Helper function to process PerceptionMessage with WML parsing
const processPerceptionMessage = (message: Message): EnhancedMessage => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        try {
            const standardForm = new StandardForm(message.wmlContent)
            return {
                ...message,
                parsedWML: standardForm
            }
        } catch (error) {
            console.warn('Failed to parse WML content for PerceptionMessage:', error)
            // Create a fallback StandardForm to prevent perpetual loading state
            const [upperTag] = splitType(message.componentUUID)
            const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
            
            // Create a proper fallback StandardForm with the correct component type
            const fallbackForm = new StandardForm('fallback')
            const defaultData = defaultComponentFromTag(tag as any, 'fallback', message.componentUUID)
            const fallbackComponent = standardComponentFactory(defaultData)
            
            if (fallbackComponent) {
                fallbackForm._components = [fallbackComponent]
            }
            
            return {
                ...message,
                parsedWML: fallbackForm
            }
        }
    }
    return message
}

// In cacheMessages action
const processedMessages = messages.map(processPerceptionMessage)
```

##### **Phase 2: No Special Selectors Needed**
```typescript
// Use existing getMessages selector - components handle routing
// No need for getPerceptionMessages - components filter by DisplayProtocol
export const getMessages = (state: RootState, characterId: EphemeraCharacterId) => {
    return state.messages[characterId] || []
}
```

##### **Phase 3: Component Integration**
```typescript
// Components handle parsing with fallback support
case 'PerceptionMessage':
    // parsedWML is guaranteed to exist (either valid or fallback)
    const component = message.parsedWML.byUniversalID(message.componentUUID)
    const componentType = component?.tag || getComponentTypeFromUUID(message.componentUUID)
    
    switch(componentType) {
        case 'Room':
            return <RoomDescription message={message} component={component} />
        // ... other cases
    }
```

### **Benefits of This Approach**

1. **Performance**: Parse once, use many times
2. **Memory Efficiency**: Store parsed objects instead of re-parsing strings
3. **Simple Architecture**: Use existing selectors, no special perception selectors needed
4. **Lazy Evaluation**: Support future lazy parsing strategies
5. **User Experience**: Graceful error handling with fallback content
6. **Backward Compatibility**: Graceful fallback to runtime parsing
7. **Cache Safety**: Store original messages in IndexedDB, process at read time
8. **Type Safety**: Proper TypeScript types for enhanced messages

### **Migration Timeline**

#### **Phase 1: Infrastructure** ✅ **COMPLETED**
- ✅ Add WML parsing utilities to message processing
- ✅ Enhance message state structure for parsed data
- ✅ Use existing message selectors (no special perception selectors needed)
- ✅ Store original messages in cacheDB, process at read time
- ✅ Proper TypeScript types for enhanced messages

#### **Phase 2: Bridge State Component Updates**
- Update message router to handle `PerceptionMessage` case
- Modify components to accept both legacy and WML formats
- Implement bridge state for gradual migration
- Track progress through component migration list

#### **Phase 3: Legacy Removal**
- Remove legacy message types from perception system
- Remove legacy property handling from components
- Clean up bridge state code
- Update type definitions to remove legacy interfaces

#### **Phase 4: Optimization**
- Implement lazy parsing strategies
- Add parsing performance monitoring
- Optimize memory usage for parsed data

## Integration Points

### **WebSocket Handler**
- Receives raw messages from server
- Triggers `cacheMessages` action with message processing

### **Message Components**
- Handle parsing states with loading components
- Focus on rendering with graceful parsing fallbacks

### **Cache Database**
- Stores original message format (without parsedWML)
- Processes messages at read time for WML parsing
- Avoids storing complex objects in IndexedDB

### **WML Library**
- Provides `StandardForm` parsing capabilities
- Enables component extraction and type determination

## Navigation Tips

1. **Start with Index**: Understand the main slice logic in `index.ts`
2. **Check Selectors**: Review existing message retrieval patterns in `selectors.ts`
3. **Review Binary Search**: Understand message ordering in `binarySearch.ts`
4. **Examine Cache Integration**: See how messages sync with IndexedDB
5. **Plan WML Integration**: Focus on component-level parsing strategy

## Development Notes

### **Current State**
- **Message Storage**: Fully functional Redux state management with enhanced message types
- **Cache Integration**: Complete IndexedDB synchronization with safe storage (original messages only)
- **Message Ordering**: Efficient binary search insertion
- **Selector System**: Optimized message retrieval
- **WML Processing**: ✅ Implemented with fallback strategy and type safety

### **Testing Patterns**
- **Watch Mode**: `npm test` - Runs Vitest in watch mode (default)
- **Single Run**: `npm test -- --run` - Runs tests once and exits
- **Specific File**: `npm test -- --run src/path/to/test.ts` - Run specific test file
- **Client vs Packages**: Use `npm test` for client (Vitest), `npm run test` for packages (Jest)

### **Future Plans**
- **Component Integration**: Update message router to handle `PerceptionMessage` case
- **Component Updates**: Modify components to use parsed WML content
- **Error Display**: Create components to show fallback content gracefully
- **Performance Monitoring**: Add parsing performance tracking

### **Technical Debt**
- **Component Updates**: Need to update message router and components for `PerceptionMessage`
- **Error Handling**: Need to create graceful fallback display components
- **Performance**: Monitor parsing performance in production
- **Memory Usage**: Optimize parsed data lifecycle management 