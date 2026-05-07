# EventBridge Event Contracts

## Overview

This directory contains event contracts for cross-service communication via AWS EventBridge. Each data source defines its event types, type guards, and serializers in this shared interface layer to enable service isolation and deployment independence.

## Architecture

The EventBridge event system follows a **three-phase implementation pattern**:

1. **Phase 1**: Define event contracts in `mtw-interfaces/ts/eventBridge/`
2. **Phase 2**: Create lambda-specific base class with common configuration
3. **Phase 3**: Instantiate individual DataSources using the base class and imported contracts

## Event Contract Structure

Each data source file (`[dataSource].ts`) contains:

- **Internal Event Types**: Clean, domain-specific representations for messageBus processing
- **External Event Types**: Transmittable representations for EventBridge communication
- **Type Guards**: Functions for runtime event validation
- **Serializers**: Classes implementing `DataSourceEventSerializer` interface

## Discovering Data Sources

Pattern documentation does not enumerate all call-sites. Use search to find a live inventory:

| What to find | Search pattern | Notes |
|--------------|----------------|-------|
| EventBridge contract layout | Directory `packages/mtw-interfaces/ts/eventBridge/` | One directory per data source; structure IS the inventory |
| Serializers | `rg "implements DataSourceEventSerializer"` | Lives in this package |
| Lambda DataSource keys | `rg "dataSourceKey: 'mtw\."` in `lambda/` | DataSource instantiations (exclude test paths if desired) |
| Lambda envelope unions | `rg "IncomingEvent"` | Envelope unions for `receiveEvents` (e.g. `AssetsIncomingEvent`) |
| Frontend slices | `rg "createDataSourceSlice"` | Charcoal-client data source slices |
| Subscription routing | `lambda/subscriptions/handlerFramework/index.ts` | Central routing config for `dataSourceKey` to LifeLine |

See [AGENT.implementation.md](./AGENT.implementation.md#discovering-implementations) for full discovery guidance.

## Usage Pattern

```typescript
// Import event contracts from shared interface layer
import { 
    WMLEventSerializer, 
    WMLEventUpdate, 
    WMLEventExternal 
} from '@tonylb/mtw-interfaces/ts/eventBridge'

// Use in DataSource implementation
const dataSource = new MyDataSource({
    // ... other configuration
    eventSerializer: new WMLEventSerializer()
})
```

## EventBridge Status

All event contracts are now centralized in the `mtw-interfaces` package:

- **WML Events**: Content and zone change events
- **Assets Events**: Component and asset-level events with sub-sources
- **Ephemera Events**: Real-time game state events
- **Connections Events**: Session lifecycle and problem-report events (`mtw.connections`)
- **Diagnostics Events**: Findings and diagnostics-domain events (`mtw.diagnostics`)
- **Cognito Events**: Signup-domain events (`mtw.cognito` / `New Player`)

## Related Documentation

- **[Implementation Guide](./AGENT.implementation.md)**: Detailed technical guidelines for implementing and maintaining EventBridge contracts
- **[DataSource Pattern](../../../mtw-lambda-patterns/ts/dataSource/AGENT.md)**: How to implement DataSources using these contracts
- **[Base Classes](./baseClasses.ts)**: Shared event types and interfaces
- **[Header-Authoritative Serialization](./AGENT.implementation.md)**: Serializers receive `header` in both `serialize` and `deserialize`; use `header.type` for discrimination; payload `type` is derived for wire compatibility

## Development Guidelines

### Adding New Data Source Events

1. **Create Data Source File**: Add `[dataSource].ts` in this directory
2. **Define Event Types**: Create internal and external event type definitions
3. **Implement Type Guards**: Add runtime validation functions
4. **Build Serializer**: Create class implementing `DataSourceEventSerializer`
5. **Export Contracts**: Add exports to `index.ts`
6. **Follow naming conventions**: Name types and place files so your implementation remains discoverable (see [Discovering Data Sources](#discovering-data-sources))

### Event Contract Design

- **Internal Format**: Clean, domain-specific representations optimized for manipulation
- **External Format**: Transmittable representations optimized for cross-service communication
- **Type Safety**: Full TypeScript support for both internal and external event structures
- **Versioning**: Design for backward compatibility and future evolution

### Serializer Implementation

- Implement `DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>` interface
- Handle conversion between internal messageBus events and external EventBridge events
- Include proper error handling and validation
- Support different event types within the same data source
