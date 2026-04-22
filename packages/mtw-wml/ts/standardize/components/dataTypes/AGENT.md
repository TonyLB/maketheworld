# Data Types - Agent Navigation Guide

## Overview

The `dataTypes` directory contains TypeScript type definitions that represent the **serialization format** for all WML components. These types define the structure of data as it appears in JSON storage, API responses, and database records.

## Core Purpose

- **Serialization Format**: Defines the structure of data for storage and transmission
- **Type Safety**: Provides TypeScript types for data validation and manipulation
- **API Contracts**: Establishes the format for external API communication
- **Database Schema**: Represents the canonical format for persistent storage

## ⚠️ CRITICAL: Serialization vs. Manipulation Types

### **Two-Layer Architecture**

The WML system uses a **two-layer architecture** to separate concerns:

#### **Layer 1: Serialization Types (This Directory)**
- **Purpose**: Data storage, transmission, and persistence
- **Format**: JSON-serializable structures
- **Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/`
- **Examples**: `RenderTree`, `StandardReferenceData`, primitive types

#### **Layer 2: Manipulation Types (Components Directory)**
- **Purpose**: Runtime operations and business logic
- **Format**: Active objects with methods
- **Location**: `packages/mtw-wml/ts/standardize/components/`
- **Examples**: `StandardRender`, `StandardComponent` classes

### **Data Flow Pattern**

```typescript
// 1. SERIALIZATION (Data Types) - JSON format for storage
export type StandardExampleData = {
    tag: 'Example';
    name?: RenderTree;        // ← Serialization format
    summary?: RenderTree;     // ← Serialization format
    description?: RenderTree; // ← Serialization format
} & StandardBaseData

// 2. MANIPULATION (Component Classes) - Active objects for operations
export class StandardExamplePayload {
    _name?: StandardRender;      // ← Runtime manipulation format
    _summary?: StandardRender;   // ← Runtime manipulation format
    _description?: StandardRender; // ← Runtime manipulation format
    
    fromJSON(props: StandardExampleData) {
        // Convert: Serialization → Manipulation
        this._name = props.name ? new StandardRender(props.name) : undefined
    }
    
    toJSON(): StandardExampleData {
        // Convert: Manipulation → Serialization
        return {
            name: this._name?.toJSON(),
            // ...
        }
    }
}
```

### **Why This Separation?**

#### **Serialization Types (RenderTree, etc.)**
✅ **Advantages**:
- **JSON Serializable**: Can be stored in databases and transmitted over APIs
- **Language Agnostic**: Can be consumed by any system that reads JSON
- **Immutable**: Safe for concurrent access and caching
- **Compact**: Efficient storage and transmission format

❌ **Limitations**:
- **No Methods**: Cannot perform operations like `merge()`, `diff()`
- **Type Safety**: Limited TypeScript support for complex operations
- **Validation**: No built-in validation or business logic

#### **Manipulation Types (StandardRender, etc.)**
✅ **Advantages**:
- **Active Objects**: Full methods for operations (`merge()`, `diff()`, `remapReferences()`)
- **Type Safety**: Strong TypeScript support with proper object types
- **Validation**: Built-in business logic and validation
- **Consistency**: Unified API across all component types

❌ **Limitations**:
- **Not Serializable**: Cannot be directly stored or transmitted
- **Memory Overhead**: More complex objects with methods
- **Language Specific**: Tied to TypeScript/JavaScript runtime

## Data Type Categories

### **Base Types**

#### **StandardBaseData** (`abstract.ts`)
Common properties shared by all component data types. Contains `key`, `universalKey`, `update` flag, and `context` references.

#### **StandardKeyData** (`reference.ts`)
Serialization format for `StandardKey` - minimal identifier format. Can be a `ComponentUUID` string or an object with `key` and optional `universalKey` (no `tag` stored). Used for internal component identification and minimal references when full context is available.

#### **StandardReferenceData** (`reference.ts`)
Serialization format for `StandardReference` - standalone reference format. Can be a `ComponentUUID` string or an object with `key`, optional `universalKey`, and **required `tag`** property. The stored `tag` makes references self-contained and enables independent schema generation. Used for ReferenceList items and standalone reference operations.

**See [`../AGENT.md`](../AGENT.md)** for detailed explanation of the semantic separation between `StandardKey` and `StandardReference`.

### **Component Data Types**

#### **StandardExampleData** (`example.ts`)
Serialization format for Example components. Contains `name`, `summary`, and `description` as `RenderTree` arrays for storage and transmission. Optional `shortName` (string or editable) is the *Example's own* label, used for UI (tabs, lists). **Name vs ShortName**: `name` is the name of the *item being exemplified* (Room/Feature/Knowledge); `shortName` is the label of the *Example itself*. Use `shortName` for the Example's tab/list label; do **not** use `name` as the Example's label.

#### **StandardRoomData** (`room.ts`)
Serialization format for Room components. Contains `shortName`, `exits`, `features`, **Situation** facets (`situations`), optional ephemera **`render`**, and other reference structures. The **`examples`** field remains for migration and legacy assets but is **deprecated** for Room display prose; prefer **Situation** facets (asset) and **`render`** (ephemera wire). See [`../../AGENT.md`](../../AGENT.md) and [`../AGENT.implementation.md`](../AGENT.implementation.md) (**StandardRoom**).

#### **StandardFeatureData** (`feature.ts`)
Serialization format for Feature components. Contains `examples` array referencing `StandardExample` components for display content.

#### **StandardCharacterData** (`character.ts`)
Serialization format for Character components. Contains `name`, `description`, and `location` as primitive types and references.

#### **StandardMessageData** (`message.ts`)
Serialization format for Message components. Contains `content` as `RenderTree`, plus `recipients` and `conditions` arrays.

#### **StandardKnowledgeData** (`knowledge.ts`)
Serialization format for Knowledge components. Contains `examples` array referencing `StandardExample` components for display content.

#### **StandardMomentData** (`moment.ts`)
Serialization format for Moment components. Contains `conditions`, `effects`, and `duration` as editable string arrays.

#### **StandardMapData** (`map.ts`)
Serialization format for Map components. Contains `image`, `rooms`, and `positions` with spatial reference structures.

#### **StandardActionData** (`action.ts`)
Serialization format for Action components. Contains `name`, `effects`, and `requirements` as primitive string types.

#### **StandardVariableData** (`variable.ts`)
Serialization format for Variable components. Contains `name`, `value`, and `type` as primitive string types.

#### **StandardComputedData** (`computed.ts`)
Serialization format for Computed components. Contains `expression`, `dependencies`, and `result` as primitive string types.

### **Sub-Component Data Types**

### **Edit Data Types**

Component-level edit operations (Remove/Replace) are no longer supported. All edit operations are handled at the reference level in `ReferenceList` (as `StandardReferenceRemove` references), not as wrapper classes around components.

## Type Guards

### **Purpose**
Type guards validate that data conforms to the expected serialization format:

```typescript
export const isStandardExample = (arg: any): arg is StandardExampleData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Example'),
        checkTypes(arg, {}, {
            key: 'string',
            universalKey: 'string',
            name: 'renderTree',
            summary: 'renderTree',
            description: 'renderTree'
        })
    )
}
```

### **Available Type Guards**
- `isStandardExampleData()` - Validates Example data
- `isStandardRoomData()` - Validates Room data
- `isStandardFeatureData()` - Validates Feature data
- `isStandardCharacterData()` - Validates Character data
- `isStandardMessageData()` - Validates Message data
- `isStandardKnowledgeData()` - Validates Knowledge data
- `isStandardMomentData()` - Validates Moment data
- `isStandardMapData()` - Validates Map data

## Usage Patterns

### **Data Validation**
```typescript
import { isStandardExample } from './dataTypes/example'

const data = { tag: 'Example', name: ['Test'] }
if (isStandardExample(data)) {
    // TypeScript knows this is StandardExampleData
    console.log(data.name) // RenderTree
}
```

### **API Response Handling**
```typescript
// API returns serialization format
const apiResponse: StandardExampleData = {
    tag: 'Example',
    name: ['API Content'],
    summary: ['API Summary'],
    description: ['API Description']
}

// Convert to manipulation format for operations
const example = new StandardExample(apiResponse)
const merged = example.merge(otherExample)
```

### **Database Storage**
```typescript
// Store serialization format
const dataToStore: StandardExampleData = {
    tag: 'Example',
    name: ['Database Content'],
    key: 'example-1'
}

// Convert manipulation format back to serialization
const example = new StandardExample(manipulationData)
const serialized = example.toJSON() // Returns StandardExampleData
```

## Integration Points

- **Component Classes**: Convert serialization ↔ manipulation formats
- **API Layer**: Use serialization types for request/response contracts
- **Database Layer**: Store serialization formats directly
- **Validation Layer**: Use type guards to validate incoming data
- **Schema System**: Convert between WML schema and serialization formats

## Navigation Tips

1. **Start with Abstract Types**: Understand `StandardBaseData` and `StandardReferenceData`
2. **Check Type Guards**: Use type guards for runtime validation
3. **Understand Conversion**: Know how serialization ↔ manipulation conversion works
4. **Follow Patterns**: All component types follow the same serialization patterns
5. **Use TypeScript**: Leverage type safety for data validation

## Development Notes

### **Current State**
- **Complete Coverage**: All component types have serialization definitions
- **Type Safety**: Strong TypeScript typing throughout
- **Validation**: Comprehensive type guards for all types
- **Consistency**: Unified patterns across all component types

### **Future Plans**
- **Enhanced Validation**: More sophisticated runtime validation rules
- **Schema Integration**: Tighter integration with WML schema system
- **Performance**: Optimize type guard performance for large datasets
- **Documentation**: Add more examples for complex data patterns

### **Best Practices**
- **Always Validate**: Use type guards before processing data
- **Preserve Format**: Don't modify serialization formats without migration
- **Document Changes**: Update this guide when adding new data types
- **Test Conversion**: Ensure serialization ↔ manipulation conversion works correctly 