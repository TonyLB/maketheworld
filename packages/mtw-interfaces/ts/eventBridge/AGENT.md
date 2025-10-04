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

## Available Data Sources

### WML Events (`wml.ts`)
- **Internal**: `WMLContentEvent`, `WMLZoneEvent`
- **External**: `WMLContentEventExternal`, `WMLZoneEventExternal`
- **Serializer**: `WMLEventSerializer`

### Assets Events (`assets.ts`)
- **Internal**: `ComponentEventUpdate`, `AssetLevelEventUpdate`
- **External**: `ComponentEventExternal`, `AssetLevelEventExternal`
- **Serializer**: `AssetsEventSerializer`

### Ephemera Events (`ephemera.ts`)
- **Internal**: TBD (to be migrated)
- **External**: TBD (to be migrated)
- **Serializer**: TBD (to be migrated)

### Base Classes (`baseClasses.ts`)
- **Status**: Complete
- **Contains**: Shared types, interfaces, and utilities for all event contracts

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

## Migration Status

- [x] **Phase 1**: EventBridge structure established
- [ ] **WML Events**: Pending migration (Phase 2)
- [ ] **Assets Events**: Pending migration (Phase 3)
- [ ] **Ephemera Events**: Pending migration (Phase 4)

## Related Documentation

- **[Migration Plan](./AGENT.migration.md)**: Detailed migration strategy and progress
- **[DataSource Pattern](../../../mtw-lambda-patterns/ts/dataSource/AGENT.md)**: How to implement DataSources using these contracts
- **[Base Classes](./baseClasses.ts)**: Shared event types and interfaces

## Development Guidelines

### Adding New Data Source Events

1. **Create Data Source File**: Add `[dataSource].ts` in this directory
2. **Define Event Types**: Create internal and external event type definitions
3. **Implement Type Guards**: Add runtime validation functions
4. **Build Serializer**: Create class implementing `DataSourceEventSerializer`
5. **Export Contracts**: Add exports to `index.ts`
6. **Update Documentation**: Add entry to this file's data source list

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
