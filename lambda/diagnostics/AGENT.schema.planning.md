# Diagnostics Event Schema - Planning Document

**Status**: 🚧 **INCOMPLETE - PLANNING IN PROGRESS**  
**Created**: October 18, 2025  
**Purpose**: Define proper event-driven architecture for diagnostics events

---

## Current State (Ad Hoc)

The diagnostics system currently uses imperative, command-style events:
- `detail-type: "Initialize"` - Command to initialize the system
- Events are action requests rather than state change notifications
- No consistent schema or semantic patterns

**Problems with Current Approach**:
- Violates event-sourcing principles (events should describe what happened, not what to do)
- Tight coupling between event producers and consumers
- Difficult to add new listeners without changing event structure
- No clear ownership of diagnostic state

---

## Target Architecture (Descriptive Events)

### Principle: Events Describe State Changes

Diagnostics events should report **findings** from diagnostic processes, not **commands** to execute:

✅ **Good** (Descriptive): `"S3 Structure Finding"` - Reports what was discovered  
❌ **Bad** (Imperative): `"Initialize Primitives"` - Commands an action

### Event Pattern

```typescript
{
  source: "mtw.diagnostics",
  "detail-type": "S3 Structure Finding",
  detail: {
    source: "primitives.wml",        // What was examined
    status: "missing" | "present",   // What was found
    zone: "Canon",                   // Where it should be
    timestamp: "2025-10-18T...",
    diagnosticRunId: "uuid"          // For correlation
  }
}
```

Consumers (like WML lambda) decide how to **respond** to findings:
- WML lambda sees `source: "primitives.wml", status: "missing"` → initializes primitives
- Future consumers might log, alert, or take different actions

---

## Planned Event Types

### 1. S3 Structure Finding

**Purpose**: Reports the presence/absence of expected S3 objects

**Status**: ✅ **KNOWN REQUIREMENT** (needed for primitives initialization)

**Detail Schema**:
```typescript
interface S3StructureFinding {
  source: string;              // S3 key or logical identifier (e.g., "primitives.wml")
  status: "missing" | "present" | "corrupted" | "unexpected";
  diagnosticRunId: string;     // Correlation ID
  timestamp: string;           // ISO 8601 timestamp

  //
  // The following are potential future expansions of this finding
  //
  zone?: Zone;                 // Expected zone (if applicable)
  expectedPath?: string;       // Expected S3 key
  actualPath?: string;         // Actual S3 key (if different)
  issues?: string[];           // List of specific problems found
}
```

**Known Use Cases**:
- Missing `primitives.wml` → WML lambda initializes primitives
- Missing zone metadata on assets → Triggers zone repair
- Potential: Unexpected objects in Canon → Alerts for manual review

**Listeners**:
- `mtw.wml` - Responds to missing/corrupted primitives
- Future: `mtw.assets` - Responds to metadata issues
- Future: Monitoring/alerting systems

---

### Future design possibilities

- **Diagnostic Run Started** - Trigger coordinated self-diagnostics
- **Diagnostic Run Completed** - Summary of findings from a run
- **DynamoDB Consistency Finding** - Cache inconsistencies, orphaned records
- **Player State Finding** - Player data corruption, permission mismatches

---

## Existing Healing Infrastructure

### Current Self-Healing Functions

The system already has foundation for self-healing:

**Assets Lambda** (`lambda/assets/selfHealing/globalValues.ts`):
- `healGlobalValues()` - Repairs session mappings and canon asset state
- Fixes connection metadata and global asset cache

**Diagnostics Lambda** (`lambda/diagnostics/player/index.ts`):
- `healPlayer()` - Repairs player-specific data corruption
- Rebuilds player asset library and character listings

**Heal Step Function**: Orchestrates player healing operations

### Integration with New Pattern

These existing healing functions should be **triggered by findings**, not run directly:

**Current** (imperative):
```typescript
// Direct call to healing function
await healPlayer(playerId)
```

**Target** (event-driven):
```typescript
// Finding triggers healing
if (event.type === 'Player State Finding' && event.status === 'corrupted') {
  await healPlayer(event.playerId)
}
```

This aligns healing with the self-diagnostic pattern - findings describe problems, domain lambdas remediate.

---

## Architectural Decision: Diagnostics as Orchestration Layer

**Decision Date**: October 18, 2025

### Principle: Domain Authority Stays in Domain Lambdas

The diagnostics lambda should **NOT** directly validate storage from other lambdas. Instead:

**Diagnostics Lambda Role**: Orchestration and aggregation
- Triggers diagnostic runs across the system
- Aggregates findings from domain lambdas
- Provides unified diagnostic reporting
- Does NOT import lambda-specific code or validate their storage directly

**Domain Lambda Role**: Self-validation
- Each lambda validates its own storage using its own code
- Emits findings about problems discovered
- Maintains authority over its storage format and validation rules

### Example Pattern

**Diagnostics triggers run**:
```typescript
// Diagnostics lambda
await eventBridge.putEvents({
  Source: 'mtw.diagnostics',
  DetailType: 'Diagnostic Run Started',
  Detail: { diagnosticRunId, scope: 'full' }
})
```

**Each lambda performs self-diagnostics**:
```typescript
// WML lambda listens for Diagnostic Run Started
if (event.type === 'Diagnostic Run Started') {
  // WML validates its own manifests using its own reconstruction code
  await checkManifestIntegrity(diagnosticRunId)
}

// Assets lambda listens for Diagnostic Run Started
if (event.type === 'Diagnostic Run Started') {
  // Assets validates its own DynamoDB cache consistency
  await checkCacheConsistency(diagnosticRunId)
}
```

**Diagnostics aggregates results**:
```typescript
// Diagnostics lambda listens for all findings
// Aggregates by diagnosticRunId
// Emits summary when run completes
```

### Future: Step Functions Orchestration

**Potential Pattern** (premature to design now):
- Diagnostics lambda triggers Step Function for orchestrated diagnostic run
- Step Function coordinates parallel lambda diagnostics
- Each lambda returns findings to Step Function
- Step Function hands results back to diagnostics for aggregation
- Enables timeout handling, retry logic, parallelization

**Benefits**:
- Better visibility into diagnostic progress
- Coordinated timeouts and error handling
- Parallel execution of independent checks
- Clean separation: orchestration (Step Functions) vs aggregation (Diagnostics)

### Implications for Storage Format Code

**Manifest Types & Operations**: Located in `packages/mtw-asset-workspace`
- This is a shared utility package (like `mtw-wml`, `mtw-utilities`)
- Multiple lambdas can import utility packages (not lambda code)
- Manifest parsing/reconstruction lives here
- Both AssetWorkspace AND WML diagnostics use this code (no duplication)

**Rule**: Lambdas don't import from other **lambdas**. Utility packages serve multiple consumers.

**DRY Maintained**: Single implementation of manifest logic in mtw-asset-workspace

## Implementation Notes

### Event Emission

Diagnostics lambda should:
1. Trigger diagnostic runs via coordination events
2. Aggregate findings emitted by domain lambdas
3. Emit summary/completion events
4. Include `diagnosticRunId` for correlation across distributed checks

### Event Consumption

Domain lambdas should:
1. Listen for diagnostic run triggers
2. Validate their own storage using their own code
3. Emit findings about problems discovered
4. Make idempotent decisions about auto-remediation

---

## Open Questions

1. **Granularity**: Should findings be per-object or batched by category?
   - Current thinking: Per-object for flexibility
   
2. **Severity Levels**: Should findings include severity (info, warning, error)?
   - Current thinking: Status field is sufficient for now
   
3. **Automatic Remediation**: Should events include suggested actions?
   - Current thinking: No - keep events purely descriptive

4. **Diagnostic Triggers**: What triggers diagnostic runs?
   - Manual admin requests?
   - Scheduled CloudWatch Events?
   - On-demand from other lambdas?
   
5. **Finding Persistence**: Should findings be stored in DynamoDB?
   - For history/trending analysis?
   - Current thinking: Not in initial implementation

---

## Related Documentation

- **[Event Architecture](../../AGENT.architecture.events.md)**: System-wide event patterns
- **[WML Lambda](../wml/README.md)**: Consumer of S3 Structure Finding events
- **[Initialize Lambda](../initialize/app.ts)**: Currently emits imperative events (to be migrated)

---

## Next Steps

- [ ] Implement `S3 Structure Finding` event emission in diagnostics lambda
- [ ] Update WML lambda to listen for `S3 Structure Finding` events
- [ ] Update initialize lambda to emit findings instead of commands
- [ ] Design remaining event types (DynamoDB Consistency, Player State, etc.)
- [ ] Document diagnostic run triggers and scheduling
- [ ] Consider adding diagnostic dashboard/UI

---

**Document Status**: This is a planning document. Implementation should follow the patterns described here, but details may evolve as we learn from implementation.

