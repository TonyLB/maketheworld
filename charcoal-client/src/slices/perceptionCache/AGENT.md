# Perception Cache - Agent Navigation Guide

## Overview

The `perceptionCache` slice is a specialized Redux store designed to handle anonymous knowledge interrogation functionality. Unlike the main `messages` slice which manages character-based message history, `perceptionCache` provides ahistorical, session-based caching for anonymous users exploring knowledge content without being connected as a character.

### **Key Concepts**
- **Anonymous Access**: Allows users to explore knowledge without character authentication
- **Session-Based Caching**: Uses session IDs rather than character IDs for message targeting
- **Ahistorical Storage**: No message history or temporal ordering - just current state
- **WML Integration**: Handles `PerceptionMessage` format with parsed WML content

## Core Purpose

### **Primary Function**
- **Anonymous Knowledge Exploration**: Enables users to browse knowledge content without character login
- **Session-Based Message Handling**: Processes messages sent to `SESSION#${SessionId}` targets
- **WML Content Caching**: Stores parsed `StandardForm` instances for efficient rendering

### **Key Responsibilities**
- **Message Processing**: Filters and processes `PerceptionMessage` format messages
- **WML Parsing**: Converts WML schema strings to `StandardForm` instances
- **Cache Management**: Provides fast access to knowledge content via component UUIDs
- **Fallback Handling**: Creates default `StandardForm` instances for malformed WML

## Technical Details

### **Data Structures**

#### **State Structure**
```typescript
type PerceptionCacheState = Record<PerceptionCacheKey, EnhancedPerceptionMessage>

type PerceptionCacheKey = `${EphemeraCharacterId | 'ANONYMOUS'}::${string}`

type EnhancedPerceptionMessage = PerceptionMessage & { 
    parsedWML: StandardForm 
}
```

#### **Cache Key Format**
- **Anonymous Access**: `ANONYMOUS::${componentUUID}`
- **Character Access**: `${CharacterId}::${componentUUID}` (future use)

### **Core Methods**

#### **`receiveMessages` Action**
```typescript
receiveMessages: (state, action: PayloadAction<Message[]>) => {
    action.payload
        .filter((value): value is PerceptionMessage => 
            (value.DisplayProtocol === 'PerceptionMessage'))
        .forEach((message) => {
            const enhancedMessage = processPerceptionMessage(message)
            // For anonymous knowledge exploration, we cache all PerceptionMessages
            // The backend sends to SESSION#${SessionId} for directResponse, but the Target
            // field may not be included in the message payload itself
            const cacheKey = `ANONYMOUS::${message.metaData.componentUUID}`
            state[cacheKey] = enhancedMessage
        })
}
```

#### **`processPerceptionMessage` Helper**
```typescript
const processPerceptionMessage = (message: PerceptionMessage): EnhancedPerceptionMessage => {
    try {
        const standardForm = new StandardForm(message.wmlContent, { standardizeMode: 'ephemeraWire' })
        return { ...message, parsedWML: standardForm }
    } catch (error) {
        const componentUUID = message.metaData.componentUUID
        const [upperTag] = splitType(componentUUID)
        const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
        const fallbackForm = new StandardForm('fallback')
        const defaultData = defaultComponentFromTag(tag as any, 'fallback', componentUUID)
        const { component: fallbackComponent } = standardComponentFactory(defaultData)
        if (fallbackComponent) {
            fallbackForm._components = [fallbackComponent]
        }
        return { ...message, parsedWML: fallbackForm }
    }
}
```

**Ephemera wire:** Same **`ephemeraWire`** mode and **`metaData.componentUUID`** fallback as the **`messages`** slice ([`../messages/AGENT.md`](../messages/AGENT.md)).

### **Selector Interface**
```typescript
export const getCachedPerception = ({ 
    CharacterId, 
    EphemeraId 
}: { 
    CharacterId?: EphemeraCharacterId, 
    EphemeraId: EphemeraKnowledgeId 
}): Selector<{ 
    fetched: boolean, 
    parsedWML?: StandardForm, 
    componentUUID?: string 
}>
```

## Integration Points

### **Dependencies**
- **`@tonylb/mtw-interfaces`**: For `PerceptionMessage` and base class types
- **`@tonylb/mtw-wml`**: For `StandardForm` parsing and component creation
- **`@tonylb/mtw-utilities`**: For `splitType` utility function

### **Cross-References**
- **Message Routing**: See [`../lifeLine/index.api.ts`](../lifeLine/index.api.ts) for message dispatch
- **WML Processing**: See [`../../../../packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) for WML format details
- **Component Rendering**: See [`../Message/AGENT.md`](../Message/AGENT.md) for display components

### **System Relationships**

#### **Message Flow**
1. **Knowledge Component** dispatches `socketDispatchPromise` with `directResponse: true`
2. **Backend** sends `PerceptionMessage` to `SESSION#${SessionId}` target
3. **lifeLine Middleware** dispatches to `perceptionCache.receiveMessages`
4. **perceptionCache** processes and caches the parsed WML content
5. **Knowledge Component** uses `getCachedPerception` selector to retrieve content

#### **Comparison with Messages Slice**
| Aspect | Messages Slice | Perception Cache |
|--------|----------------|------------------|
| **Targeting** | Character-based (`CharacterId`) | Session-based (`SESSION#`) |
| **History** | Maintains message history | Ahistorical (current state only) |
| **Temporal Ordering** | Binary search insertion | Simple key-value storage |
| **Use Case** | Character interactions | Anonymous exploration |
| **Message Types** | All message types | Only `PerceptionMessage` |

## Usage Patterns

### **Knowledge Component Integration**
```typescript
// Knowledge component uses perceptionCache
const { fetched, parsedWML, componentUUID } = useSelector(
    getCachedPerception({ EphemeraId: `KNOWLEDGE#${KnowledgeId}` })
)

// Renders with parsed WML data
if (fetched && parsedWML && componentUUID) {
    return <ComponentDescription
        message={{
            DisplayProtocol: 'PerceptionMessage',
            wmlContent: parsedWML.toJSON(),
            componentUUID: componentUUID,
            // ... other fields
        }}
        parsedWML={parsedWML}
        componentUUID={componentUUID}
        // ... props
    />
}
```

### **Middleware Integration**
```typescript
// lifeLine middleware automatically dispatches to perceptionCache
const receiveMessages = (dispatch) => ({ payload }) => {
    if (payload.messageType === 'Messages') {
        dispatch(cacheMessages(payload))
        dispatch(perceptionCacheReceiveMessages(payload.messages)) // ← This line
    }
}
```

## Navigation Tips

### **Getting Started**
1. **Start with Knowledge Component**: Understand how anonymous access works
2. **Examine lifeLine Middleware**: See how messages are routed to perceptionCache
3. **Review Selector Usage**: Understand how components retrieve cached data

### **Key Files**
- **`index.ts`**: Main slice logic and WML processing
- **`selectors.ts`**: Cache retrieval interface
- **`baseClasses.ts`**: Type definitions and state structure

### **Related Documentation**
- **WML Processing**: See [`../../../../packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)
- **Message Components**: See [`../Message/AGENT.md`](../Message/AGENT.md)
- **Knowledge Component**: See [`../Knowledge/index.tsx`](../Knowledge/index.tsx)

## Development Notes

### **Current State**
- **✅ WML Integration**: Updated to handle `PerceptionMessage` format
- **✅ Fallback Handling**: Robust error handling for malformed WML
- **✅ Session-Based Targeting**: Correctly processes `SESSION#` targets
- **✅ Middleware Integration**: Automatically receives messages via lifeLine
- **✅ Type Safety**: Proper TypeScript types for `Target` field and selector return types

### **Identified Issues**

#### **1. Legacy Message Type Support**
- **Problem**: Originally designed for `KnowledgeDescription` format
- **Impact**: Would not work with current backend `PerceptionMessage` format
- **Status**: ✅ **RESOLVED** - Updated to handle `PerceptionMessage`

#### **2. Missing Message Routing**
- **Problem**: `receiveMessages` action was never dispatched
- **Impact**: Cache would remain empty, causing infinite loading
- **Status**: ✅ **RESOLVED** - lifeLine middleware now dispatches correctly

#### **3. Wrong Target Format**
- **Problem**: Expected character-based targets, but backend sends session-based
- **Impact**: Messages would not be cached correctly
- **Status**: ✅ **RESOLVED** - Updated to handle `SESSION#` targets

#### **4. Incomplete WML Processing**
- **Problem**: No WML parsing or fallback handling
- **Impact**: Malformed WML would cause crashes
- **Status**: ✅ **RESOLVED** - Added robust WML parsing with fallbacks

### **Proposed Changes**

#### **✅ Completed Updates**
1. **Message Type Migration**: Updated from `KnowledgeDescription` to `PerceptionMessage`
2. **WML Integration**: Added `StandardForm` parsing and fallback creation
3. **Target Format**: Updated to handle `SESSION#` session-based targeting
4. **Error Handling**: Added robust fallback for malformed WML content
5. **Type Safety**: Updated TypeScript interfaces for new data structures

#### **Future Considerations**
1. **Performance Optimization**: Consider caching strategies for large WML content
2. **Memory Management**: Monitor memory usage with parsed `StandardForm` instances
3. **Error Reporting**: Add better error logging for WML parsing failures
4. **Testing**: Add comprehensive tests for WML parsing edge cases

### **Technical Debt**
- **Error Handling**: Could benefit from more detailed error reporting
- **Performance**: Large WML content may impact memory usage
- **Testing**: Limited test coverage for WML parsing scenarios
- **Documentation**: Could benefit from more usage examples

### **Future Plans**
- **Enhanced Error Reporting**: Better logging for WML parsing failures
- **Performance Monitoring**: Track memory usage with parsed content
- **Test Coverage**: Add comprehensive tests for edge cases
- **Documentation**: Expand usage examples and troubleshooting guides 