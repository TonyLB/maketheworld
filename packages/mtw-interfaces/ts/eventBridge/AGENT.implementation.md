# EventBridge Implementation Guide

This document provides technical guidelines for implementing and maintaining EventBridge event contracts in the `mtw-interfaces` package.

## Scope: What mtw-interfaces EventBridge Covers

mtw-interfaces EventBridge holds **cross-lambda** event contracts only. Events that never leave a single lambda process are out of scope.

- **In scope:** Events with `dataSourceKey` like `'mtw.wml'`, `'mtw.assets'`, `'mtw.connections'`, `'mtw.connections.characters'`, `'mtw.diagnostics'`—serialized for EventBridge transmission and consumed by other lambdas.
- **Out of scope:** Events with `dataSourceKey: 'api.wml'` or `'api.assets'`—API-triggered events that stay in-process (e.g. Apply Edit, Move Asset, Player Settings Updated). Their payload types and type guards live in lambda-local `localApiEvents.ts`, not in mtw-interfaces. See [mtw-lambda-patterns DataSource AGENT.implementation.md](../../../mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (localApiEvents.ts and API-triggered internal events).

The former coordination package (Apply Edit, Move Asset, etc.) has been removed; those events are now internal-only and handled via `localApiEvents.ts` in each owning lambda.

## Event Contract Design

### Internal vs External Formats

- **Internal Format**: Clean, domain-specific representations optimized for manipulation. Internal content payloads do not include a `type` property; discrimination is by envelope/header only.
- **External Format**: Transmittable representations optimized for cross-service communication. External payloads include `type` for the wire so the receiving side can build the header.
- **Type Safety**: Full TypeScript support for both internal and external event structures
- **Versioning**: Design for backward compatibility and future evolution

### Event Contract Structure

Each data source should follow this consistent structure:

```typescript
// Internal event types (for messageBus processing)
export type DataSourceEventUpdate = EventType1 | EventType2

// External event types (for EventBridge communication)
export type DataSourceEventExternal = EventType1External | EventType2External

// Type guards for runtime validation
export const isDataSourceEventType1 = (event: any): event is EventType1 => { ... }

// Serializer implementing the interface
export class DataSourceEventSerializer implements DataSourceEventSerializer<DataSourceEventUpdate, DataSourceEventExternal> {
    serialize(params: { content: DataSourceEventUpdate; header: StreamingEventHeader }): DataSourceEventExternal
    deserialize(params: { content: DataSourceEventExternal; header: StreamingEventHeader }): DataSourceEventUpdate | null
}
```

## Serializer Implementation Pattern

### Interface Requirements

All serializers must implement `DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>`:

```typescript
export class MyEventSerializer implements DataSourceEventSerializer<MyEventUpdate, MyEventExternal> {
    serialize(params: {
        content: MyEventUpdate;
        header: StreamingEventHeader;
    }): MyEventExternal {
        // Convert internal format to external format
    }

    deserialize(params: {
        content: MyEventExternal;
        header: StreamingEventHeader;
    }): MyEventUpdate | null {
        // Convert external format to internal format
    }
}
```

### Header-Authoritative Serialization

Serializers follow the header/content model:

- `serialize` and `deserialize` receive `{ content, header }` (same shape as `ResolvedStreamingEnvelope`). The param is named `content` (not `update`/`externalUpdate`) to match envelope types.
- Discrimination uses **header.type** only. Deserializers must not use payload `type` for branching; use envelope (header) or deserialize-params envelope type guards only.
- External payload includes `type` so the far end can build the header before calling deserialize. The deserializer routes only on `header.type`.
- Use envelope-level type guards when branching on `header.type` to narrow content (e.g. Library, Players).

For envelope unions and payload purity rules, see [mtw-lambda-patterns DataSource AGENT.implementation.md](../../../mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (Type-Safe Routing with Envelope-Level Discriminated Unions).

### Connections character presence delivery semantics

Contracts for `Character Connected` and `Character Disconnected` on `mtw.connections.characters` are defined in [`connections/characters/index.ts`](./connections/characters/index.ts). Intended delivery is **at least once**: EventBridge retries, producer churn, and overlapping registration or disconnect windows may surface **duplicate** events for the same logical transition.

**Consumer requirements:** Handlers must treat user-visible side effects as **idempotent**. Downstream code should gate arrival and departure work so duplicates do not multiply observable behavior (for example, ephemera uses conditional updates on `Meta::Room.activeCharacters` so room-presence and messaging side effects apply only when the projection actually changes).

**`sessionId` on presence events (`Character Connected` / `Character Disconnected`):** This field identifies the **session membership edge associated with the boundary-crossing publish** (for example, the registration or teardown path that moved aggregate session count across `0 <-> 1`). It is **not** a claim that this is the character's only session, nor a complete enumeration of sessions. Do **not** treat it as proof of uniqueness, strict causality ordering across retries, or as an authority token.

**Footgun:** Because `sessionId` is present on the payload, it is tempting to assume it must equal "the session we are processing right now" or that matching it against local state is sufficient for correctness. At-least-once delivery, races, and duplicate events mean that assumption can silently become a **false authority**: consumers should drive side effects from **durable projections and conditionals** (for example room presence gates), not from correlating this field to whatever session id happens to be in scope.

`Character Registered` on `mtw.connections` follows the same stream key convention as character-presence events (`CHARACTER#${characterId}`); registration ingress is connections-owned in steady state (see area planning notes under `taskPlanning/lambda/connections/`).

### Implementation Guidelines

1. **Handle Conversion**: Convert between internal messageBus events and external EventBridge events
2. **Include Error Handling**: Proper error handling and validation for malformed data
3. **Support Multiple Types**: Handle different event types within the same data source
4. **Maintain Type Safety**: Use TypeScript type guards for runtime validation
5. **Preserve Data Integrity**: Ensure no data loss during serialization/deserialization

### Error Handling

```typescript
// Good: Graceful error handling
deserialize(params: { content: MyEventExternal; header: StreamingEventHeader }): MyEventUpdate | null {
    try {
        // Parse external event
        return parsedEvent
    } catch (error) {
        console.warn('Failed to deserialize event:', error)
        return null
    }
}

// Good: Validation with clear error messages
serialize(params: { content: MyEventUpdate; header: StreamingEventHeader }): MyEventExternal {
    if (!isValidEvent(params.content)) {
        throw new Error(`Invalid event type: ${JSON.stringify(params.content)}`)
    }
    // ... serialize
}
```

## Import Strategy

### Correct Import Pattern

All lambdas should import from the shared interface package:

```typescript
// ✅ Correct: Import from shared interface
import { 
    WMLEventSerializer, 
    WMLEventUpdate, 
    WMLEventExternal 
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

// ✅ Correct: Import sub-source events
import { 
    CharacterEventSerializer, 
    CharacterEventUpdate 
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/characters'
```

### Avoided Patterns

```typescript
// ❌ Wrong: Direct cross-lambda imports
import { WMLEventSerializer } from '../wml/dataSource/serializers'

// ❌ Wrong: Importing from lambda directories
import { AssetsEventSerializer } from '../assets/dataSource/serializers'
```

## Directory Structure

### Top-Level Data Sources

```
packages/mtw-interfaces/ts/eventBridge/
├── wml/
│   ├── index.ts              # Main WML event contracts
│   └── index.test.ts         # WML serializer tests
├── assets/
│   ├── index.ts              # Main Assets event contracts
│   ├── index.test.ts         # Assets serializer tests
│   ├── characters/
│   │   ├── index.ts          # Characters sub-source events
│   │   └── index.test.ts     # Characters serializer tests
│   └── contentHeaders/
│       ├── index.ts          # ContentHeaders sub-source events
│       ├── baseClasses.ts    # Base types and type guards
│       └── index.test.ts     # ContentHeaders serializer tests
└── ephemera/
    ├── index.ts              # Ephemera event contracts
    └── index.test.ts         # Ephemera serializer tests
```

### Sub-Source Pattern

For data sources with sub-sources, use the directory structure:

```
assets/
├── index.ts                  # Main data source events
├── characters/               # Sub-source directory
│   └── index.ts             # Sub-source events
└── contentHeaders/          # Another sub-source
    ├── index.ts             # Sub-source events
    └── baseClasses.ts       # Sub-source specific types
```

## Discovering Implementations

Pattern docs do not list every call-site. Search yields the live inventory.

| What to find | Grep pattern | Notes |
|--------------|--------------|-------|
| Serializers | `implements DataSourceEventSerializer` | In `packages/mtw-interfaces/ts/eventBridge/**` |
| EventBridge contract layout | Directory `packages/mtw-interfaces/ts/eventBridge/` | One directory per data source |
| Lambda envelope unions | `IncomingEvent` | Envelope unions for `receiveEvents` (e.g. `AssetsIncomingEvent`, `LibraryIncomingEvent`) |
| Lambda DataSource keys | `dataSourceKey: 'mtw\.` in `lambda/` | DataSource instantiations |
| Frontend slices | `createDataSourceSlice` | Charcoal-client data source slices |
| Subscription routing | `lambda/subscriptions/handlerFramework/index.ts` | Central config for `dataSourceKey` to LifeLine |

**Naming conventions** (follow these so implementations stay discoverable):

- **Envelope unions**: Name `{Domain}IncomingEvent` (e.g. `AssetsIncomingEvent`, `LibraryIncomingEvent`).
- **Serializers**: Implement `DataSourceEventSerializer`; class names typically `{Domain}EventSerializer` or `{Domain}DataSourceEventSerializer`.
- **EventBridge contracts**: Place in `packages/mtw-interfaces/ts/eventBridge/[dataSource]/index.ts` (or subdir for sub-sources).
- **dataSourceKey**: Use `'mtw.{domain}'` format; literal in constructor for grep.

For lambda-side discovery (envelope unions, DataSource instantiations), see [mtw-lambda-patterns DataSource Implementation Guide](../../../mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).

## Testing Guidelines

### Test Coverage Requirements

Each serializer should have comprehensive tests covering:

1. **Serialization**: Internal → External format conversion
2. **Deserialization**: External → Internal format conversion
3. **Round-trip Testing**: Serialize then deserialize to verify data integrity
4. **Error Handling**: Invalid data, malformed events, missing fields
5. **Type Guards**: Validation of type guard functions
6. **Edge Cases**: Null values, empty objects, boundary conditions

### Test Structure

```typescript
describe('MyEventSerializer', () => {
    let serializer: MyEventSerializer

    beforeEach(() => {
        serializer = new MyEventSerializer()
    })

    describe('Serialization', () => {
        it('should serialize internal events to external format', () => {
            // Test serialization
        })
    })

    describe('Deserialization', () => {
        it('should deserialize external events to internal format', () => {
            // Test deserialization
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid input gracefully', () => {
            // Test error cases
        })
    })
})
```

## Best Practices

### 1. Separation of Concerns

- **Serializers**: Only handle format conversion (internal ↔ external)
- **Data Sources**: Handle business logic (data manipulation, validation)
- **Utilities**: Keep business logic utilities in data source implementations

### 2. Type Safety

- Use discriminated unions for event types with different shapes
- Implement comprehensive type guards
- Avoid `any` types in favor of specific type definitions

### 3. Documentation

- Document all public interfaces and types
- Include usage examples in JSDoc comments
- Maintain up-to-date type definitions

### 4. Versioning

- Design for backward compatibility
- Use semantic versioning for breaking changes
- Document migration paths for breaking changes

## Related Documentation

- **[EventBridge Overview](./AGENT.md)**: High-level overview of EventBridge contracts
- **[DataSource Pattern](../../../mtw-lambda-patterns/ts/dataSource/AGENT.md)**: How to implement DataSources using these contracts
- **[Migration History](./AGENT.migration.md)**: Historical context of the EventBridge migration
