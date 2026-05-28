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
export type StandardFeatureData = {
    tag: 'Feature';
    situations?: SituationProseFacetData[];  // ← Serialization format
} & StandardBaseData

// 2. MANIPULATION (Component Classes) - Active objects for operations
export class StandardFeaturePayload {
    _situations: SituationProseFacetList;  // ← Runtime manipulation format
    
    fromJSON(props: StandardFeatureData) {
        // Convert: Serialization → Manipulation
        this._situations = new SituationProseFacetList(props.situations)
    }
    
    toJSON(): StandardFeatureData {
        // Convert: Manipulation → Serialization
        return {
            ...(this._situations.items.length ? { situations: this._situations.toJSON() } : {}),
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

#### **StandardRoomData** (`room.ts`)
Serialization format for Room components. Contains `shortName`, `exits`, **Situation** facets (`situations`), optional **`lens`**, **`features`**, **`guidance`**, **`characters`**, optional ephemera **`render`** and **`objects`**. **No** **`examples`** property; Room prose lives on **Situation** / **`render`**, not an **`examples`** list. See [`../../AGENT.md`](../../AGENT.md) and [`../AGENT.implementation.md`](../AGENT.implementation.md) (**StandardRoom**).

#### **StandardFeatureData** (`feature.ts`)
Serialization format for Feature components. Contains **`situations`** (Situation prose facets) and optional ephemera wire **`render`** (same shape as Room **`render`**). **No** **`examples`** property.

#### **StandardCharacterData** (`character.ts`)
Serialization format for Character components. Contains `name`, `description`, and `location` as primitive types and references.

#### **StandardMessageData** (`message.ts`)
Serialization format for Message components. Contains `content` as `RenderTree`, plus `recipients` and `conditions` arrays.

#### **StandardKnowledgeData** (`knowledge.ts`)
Serialization format for Knowledge components. Contains **`situations`** and optional ephemera wire **`render`**. **No** **`examples`** property.

#### **StandardMomentData** (`moment.ts`)
Serialization format for Moment components. Contains `conditions`, `effects`, and `duration` as editable string arrays.

#### **StandardAreaData** (`area.ts`)
Serialization format for Area components. Optional `shortName` (literal) and **`positionGraph`** (`{ nodes?: ReferenceListData }` only; omit when empty). Participant refs are heterogeneous (`Area`, `Room`, `Feature`, `Character`) in a single `nodes` list.

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
export const isStandardFeature = (arg: any): arg is StandardFeatureData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Feature'),
        checkTypes(arg, {}, {
            key: 'string',
            universalKey: 'string'
        })
    )
}
```

### **Available Type Guards**
- `isStandardFeatureData()` - Validates Feature data
- `isStandardRoomData()` - Validates Room data
- `isStandardFeatureData()` - Validates Feature data
- `isStandardCharacterData()` - Validates Character data
- `isStandardMessageData()` - Validates Message data
- `isStandardKnowledgeData()` - Validates Knowledge data
- `isStandardMomentData()` - Validates Moment data
- `isStandardAreaData()` - Validates Area data
- `isStandardMapData()` - Validates Map data

## Usage Patterns

### **Data Validation**
```typescript
import { isStandardFeature } from './dataTypes/feature'

const data = { tag: 'Feature', key: 'fountain' }
if (isStandardFeature(data)) {
    // TypeScript knows this is StandardFeatureData
    console.log(data.key)
}
```

### **API Response Handling**
```typescript
// API returns serialization format
const apiResponse: StandardFeatureData = {
    tag: 'Feature',
    key: 'fountain',
    situations: [{
        reference: { universalKey: 'SITUATION#DEFAULT', tag: 'Situation' },
        payload: { description: ['API Content'] }
    }]
}

// Convert to manipulation format for operations
const feature = new StandardFeature(apiResponse)
const merged = feature.merge(otherFeature)
```

### **Database Storage**
```typescript
// Store serialization format
const dataToStore: StandardFeatureData = {
    tag: 'Feature',
    key: 'fountain-1',
    situations: [{ reference: { universalKey: 'SITUATION#DEFAULT', tag: 'Situation' }, payload: {} }]
}

// Convert manipulation format back to serialization
const feature = new StandardFeature(manipulationData)
const serialized = feature.toJSON() // Returns StandardFeatureData
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