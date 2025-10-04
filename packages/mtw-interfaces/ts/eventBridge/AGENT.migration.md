# EventBridge Serializer Migration Plan

## Problem Statement

The current event transmission pattern creates tight coupling between lambda codebases through direct imports of serializers:

- **`mtw.assets` → `mtw.wml`**: Imports `WMLEventSerializer` and `WMLEventUpdate` from `../wml/dataSource/serializers`
- **`mtw.ephemera` → `mtw.assets`**: Imports `AssetsEventSerializer` from `../assets/dataSource/serializers`

This creates deployment coupling, violates service isolation, and becomes unsustainable as more services subscribe to each other.

## Target Architecture

Move event types, type guards, and serializers to `mtw-interfaces/ts/eventBridge/` to establish a shared, versioned interface layer where:

- Each lambda only depends on the shared interface package
- Serializers are co-located with event type definitions
- No direct cross-lambda imports are needed
- Event contracts are versioned and backward-compatible

## Migration Strategy

### Phase 0: Document changing design patterns
- [x] Update `mtw-lambda-patterns` documentation to describe the new three-phase pattern for implementing a new data source
- [x] Add stub `AGENT.md` to `mtw-interfaces/ts/eventBridge` directory to act as navigation guide to the various types
- [x] Update `mtw-interfaces` top-level `AGENT.md` to reference `eventBridge` directory documentation

### Phase 1: Establish EventBridge Structure
- [x] Create per-data-source files in `mtw-interfaces/ts/eventBridge/` (wml.ts, assets.ts, ephemera.ts)
- [x] Set up base classes and shared interfaces in `baseClasses.ts`
- [x] Update existing `index.ts` to export new event contracts (preserving existing functionality)
- [x] Update `eventBridge` directory `AGENT.md`
- [x] Add `mtw-lambda-patterns` dependency to `package.json`

### Phase 2: Migrate WML Events
- [x] Move `WMLEventSerializer`, `WMLEventUpdate`, `WMLEventExternal` from `lambda/wml/dataSource/serializers.ts`
- [x] Move `WMLContentEvent`, `WMLZoneEvent` and related type guards
- [x] Update `eventBridge` directory `AGENT.md`
- [x] Update `lambda/wml` to import from `@tonylb/mtw-interfaces/ts/eventBridge`
- [x] Update `lambda/assets` to import from `@tonylb/mtw-interfaces/ts/eventBridge`
- [x] Update this migration document

### Phase 3: Migrate Assets Events
- [ ] Move `AssetsEventSerializer`, `AssetsEventUpdate`, `AssetsEventExternal` from `lambda/assets/dataSource/serializers.ts`
- [ ] Move `ComponentEventUpdate`, `AssetLevelEventUpdate` and related type guards
- [ ] Update `eventBridge` directory `AGENT.md`
- [ ] Update `lambda/assets` to import from `@tonylb/mtw-interfaces/ts/eventBridge`
- [ ] Update `lambda/ephemera` to import from `@tonylb/mtw-interfaces/ts/eventBridge`
- [ ] Update this migration document

### Phase 4: Migrate Ephemera Events
- [ ] Move `EphemeraEventSerializer` and related types from `lambda/ephemera/dataSource/serializers.ts`
- [ ] Update `eventBridge` directory `AGENT.md`
- [ ] Update `lambda/ephemera` to import from `@tonylb/mtw-interfaces/ts/eventBridge`
- [ ] Update this migration document

### Phase 5: Cleanup
- [ ] Remove old serializer files from lambda directories
- [ ] Update all import statements across the codebase
- [ ] Verify no cross-lambda imports remain
- [ ] Update documentation
- [ ] Evaluate success criteria
- [ ] Remove this planning file

## File Structure

```
packages/mtw-interfaces/ts/eventBridge/
├── AGENT.migration.md          # This file
├── index.ts                    # Export all event contracts
├── baseClasses.ts              # Shared event types and interfaces
├── wml/                        # WML data source events
│   └── index.ts                # Main WML event contracts
├── assets/                     # Assets data source events
│   └── index.ts                # Main Assets event contracts
│   └── characters.ts           # Future: Assets characters sub-source
└── ephemera/                   # Ephemera data source events
    └── index.ts                # Main Ephemera event contracts
```

## Implementation Guidelines

### Event Contract Design
- **Internal Format**: Clean, domain-specific representations optimized for manipulation
- **External Format**: Transmittable representations optimized for cross-service communication
- **Type Safety**: Full TypeScript support for both internal and external event structures
- **Versioning**: Design for backward compatibility and future evolution

### Serializer Pattern
- Implement `DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>` interface
- Handle conversion between internal messageBus events and external EventBridge events
- Include proper error handling and validation
- Support different event types within the same data source

### Import Strategy
- All lambdas import from `@tonylb/mtw-interfaces/ts/eventBridge`
- No direct cross-lambda imports allowed
- Use barrel exports from `index.ts` for clean imports

## Benefits

1. **Service Isolation**: Each lambda is independently deployable
2. **Reduced Coupling**: No direct dependencies between lambda codebases
3. **Centralized Contracts**: Event definitions in one location
4. **Version Control**: Event contracts can be versioned independently
5. **Scalability**: Easy to add new subscribers without modifying existing code
6. **Maintainability**: Changes to event contracts only require updating the interface package

## Risk Mitigation

- **Backward Compatibility**: Maintain existing event formats during migration
- **Gradual Migration**: Migrate one data source at a time
- **Testing**: Comprehensive testing at each phase
- **Rollback Plan**: Keep old serializers until migration is complete

## Success Criteria

- [ ] No cross-lambda imports in the codebase
- [ ] All event serializers located in `mtw-interfaces`
- [ ] All lambdas import event contracts from `@tonylb/mtw-interfaces/ts/eventBridge`
- [ ] Event transmission continues to work correctly
- [ ] Deployment independence restored

## Next Steps

1. Create the initial file structure in `mtw-interfaces/ts/eventBridge/`
2. Start with WML events as the first migration target
3. Establish patterns that can be replicated for other data sources
4. Document any deviations or lessons learned during implementation
