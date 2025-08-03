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

#### **Optimization Plan**
To avoid expensive WML parsing on every render, we will:

1. **Parse at Reception**: Parse WML content when messages are first received
2. **Store Parsed Data**: Store `StandardForm` instances in Redux state
3. **Pre-compute Component Data**: Extract component information during parsing
4. **Cache Results**: Avoid re-parsing the same WML content

#### **Enhanced Message Structure**
```typescript
interface EnhancedPerceptionMessage extends PerceptionMessage {
    parsedWML?: StandardForm;           // Pre-parsed WML content
    componentData?: StandardComponent;   // Extracted component data
    parsedAt: number;                   // Timestamp of parsing
}
```

#### **Implementation Strategy**

##### **Phase 1: Message Processing Enhancement**
```typescript
// In cacheMessages action
const processPerceptionMessage = (message: PerceptionMessage) => {
    if (message.DisplayProtocol === 'PerceptionMessage') {
        const standardForm = new StandardForm(message.wmlContent)
        const component = standardForm.byUniversalID(message.componentUUID)
        
        return {
            ...message,
            parsedWML: standardForm,
            componentData: component,
            parsedAt: Date.now()
        }
    }
    return message
}
```

##### **Phase 2: Selector Optimization**
```typescript
// Enhanced selectors for pre-parsed data
export const getParsedPerceptionMessages = (state: RootState, characterId: EphemeraCharacterId) => {
    return getMessages(state, characterId)
        .filter(msg => msg.DisplayProtocol === 'PerceptionMessage')
        .map(msg => ({
            ...msg,
            parsedWML: msg.parsedWML || new StandardForm(msg.wmlContent),
            componentData: msg.componentData || msg.parsedWML?.byUniversalID(msg.componentUUID)
        }))
}
```

##### **Phase 3: Component Integration**
```typescript
// Components receive pre-parsed data
case 'PerceptionMessage':
    const component = message.componentData || message.parsedWML?.byUniversalID(message.componentUUID)
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
3. **Component Simplicity**: Components receive ready-to-use data
4. **Caching**: Leverage Redux state for parsed data persistence
5. **Backward Compatibility**: Graceful fallback to runtime parsing

### **Migration Timeline**

#### **Phase 1: Infrastructure**
- Add WML parsing utilities to message processing
- Enhance message state structure for parsed data
- Update selectors to handle parsed content

#### **Phase 2: Component Updates**
- Modify components to use pre-parsed data
- Add fallback parsing for legacy messages
- Update message router for new data structure

#### **Phase 3: Optimization**
- Implement lazy parsing for unparsed messages
- Add parsing performance monitoring
- Optimize memory usage for parsed data

## Integration Points

### **WebSocket Handler**
- Receives raw messages from server
- Triggers `cacheMessages` action with message processing

### **Message Components**
- Consume pre-parsed message data
- Focus on rendering rather than parsing

### **Cache Database**
- Stores original message format
- Syncs with Redux for parsed data

### **WML Library**
- Provides `StandardForm` parsing capabilities
- Enables component extraction and type determination

## Navigation Tips

1. **Start with Index**: Understand the main slice logic in `index.ts`
2. **Check Selectors**: Review message retrieval patterns in `selectors.ts`
3. **Review Binary Search**: Understand message ordering in `binarySearch.ts`
4. **Examine Cache Integration**: See how messages sync with IndexedDB
5. **Plan WML Integration**: Focus on performance optimization strategy

## Development Notes

### **Current State**
- **Message Storage**: Fully functional Redux state management
- **Cache Integration**: Complete IndexedDB synchronization
- **Message Ordering**: Efficient binary search insertion
- **Selector System**: Optimized message retrieval

### **Future Plans**
- **WML Parsing**: Add pre-parsing for perception messages
- **Performance Optimization**: Implement parsed data caching
- **Component Integration**: Update components for pre-parsed data
- **Memory Management**: Optimize parsed data storage

### **Technical Debt**
- **Message Processing**: Need to add WML parsing pipeline
- **State Structure**: Enhance for parsed data storage
- **Performance**: Current approach will be expensive for WML content
- **Memory Usage**: Need to manage parsed data lifecycle 