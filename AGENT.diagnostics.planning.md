# Diagnostics System Planning

## Overview

This document captures planning thoughts for a comprehensive diagnostics and self-healing system that can automatically detect and remediate data inconsistencies across the Make The World platform.

## Current Foundation

### Existing Infrastructure
- **`mtw.diagnostics` Event Stream**: Documented for "Global Values Corrupted" and "Graph Corrupted" events
- **Heal Step Function**: Orchestrates player healing operations
- **Self-Healing Functions**: 
  - `healGlobalValues()` - repairs session mappings and canon asset state
  - `healPlayer()` - fixes player-specific data corruption
- **Event-Driven Architecture**: Uses EventBridge for cross-system communication

### Current Manual Processes
- **CacheAsset/DecacheAsset Step Functions**: Developer-driven asset cache synchronization
  - Currently used only by `lambda/wml/parseWML.ts` (with TODO to refactor)
  - Legacy wrappers around modern event-driven patterns
  - **Replacement Strategy**: Publish diagnostic events that trigger automatic cache remediation

## Vision: Event-Driven Self-Healing

### Core Principles
- **Asynchronous Detection**: Systems publish diagnostic events when inconsistencies are detected
- **Subsystem Alerts**: Components can request healing for specific data domains
- **Automatic Remediation**: Common issues resolve without manual intervention
- **Graceful Degradation**: System continues operating while healing occurs in background

### Diagnostic Event Categories
- **Asset Cache Inconsistencies**: S3 vs DynamoDB mismatches
- **Graph Dependency Issues**: Circular dependencies, missing references
- **Session State Corruption**: Player connection mapping problems
- **Permission Inconsistencies**: Asset access vs authorization mismatches

### Remediation Patterns
- **Cache Refresh**: Trigger re-caching from authoritative sources
- **Graph Repair**: Rebuild dependency relationships from source data
- **State Reset**: Restore known-good state from backups
- **Permission Sync**: Reconcile access controls with current state

## Implementation Strategy

### Phase 1: Asset Cache Diagnostics
- Replace CacheAsset/DecacheAsset step functions with diagnostic events
- Implement automatic cache consistency checking
- Create remediation handlers for common asset cache issues

### Phase 2: Graph and Dependency Healing
- Extend diagnostics to detect graph corruption
- Implement topological sort validation
- Create automated dependency repair mechanisms

### Phase 3: Comprehensive State Validation
- Add session state consistency checks
- Implement permission synchronization
- Create cross-system validation workflows

## Benefits

- **Reduced Manual Intervention**: Common issues resolve automatically
- **Improved Reliability**: Proactive detection of inconsistencies
- **Better Developer Experience**: Less need for manual cache management
- **System Resilience**: Graceful handling of data corruption scenarios

## Related Documentation

- **[Event Architecture](AGENT.architecture.events.md)**: Foundation for event-driven healing
- **[Cache Asset Deprecation](lambda/ephemera/AGENT.cacheAsset.deprecation.md)**: Current state of legacy caching
- **[Technical Debt Tracking](AGENT.technical-debt.md)**: Step function removal planning
