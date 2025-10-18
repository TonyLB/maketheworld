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

- DynamoDB Consistency Finding
- Player State Finding
- Diagnostic Run Completed

---

## Implementation Notes

### Event Emission

Diagnostics lambda should:
1. Run diagnostic checks
2. Collect findings
3. Emit **one event per finding** (not batched)
4. Include `diagnosticRunId` for correlation

### Event Consumption

Consumers should:
1. Filter events by relevant criteria
2. Make idempotent decisions about how to respond
3. Log actions taken in response to findings

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

