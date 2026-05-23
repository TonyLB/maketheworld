# Diagnostics Event Schema - Planning Document

**Status**: 🚧 **IN PROGRESS** - First finding type implemented; schema and further findings in development  
**Created**: October 18, 2025  
**Purpose**: Define proper event-driven architecture for diagnostics events

---

## Current State

**Implemented (findings-based)**:
- **S3 Structure Finding** - Emitted by initialize lambda (for `primitives.wml`); consumed by WML lambda to trigger idempotent primitives init. Contract lives in `packages/mtw-interfaces/ts/eventBridge/diagnostics`. EventBridge routes `mtw.diagnostics` / `S3 Structure Finding` to WML lambda.
- **Stale SessionId Finding** - Emitted by diagnostics lambda stale-session sweep (connections consistency initiative). Contract lives in `packages/mtw-interfaces/ts/eventBridge/diagnostics`. Operational notes: [`lambda/diagnostics/AGENT.md`](AGENT.md).

**Still imperative / ad hoc**:
- `detail-type: "Initialize"` - Command to run full client + primitives init (initialize lambda)
- Heal Global Values - Command-style trigger for assets lambda (session map + canon list)
- No consistent schema yet for cache/consistency findings; assets lambda has no diagnostic path that triggers `cacheAsset`

**Remaining problems**:
- Mixed patterns (some findings, some commands)
- Assets DynamoDB cache can get out of sync with S3 (e.g. after primitives init) with no diagnostic finding to trigger re-cache
- Further finding types (Cache Consistency, Player State, etc.) not yet designed or implemented

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

Consumers decide how to **respond** to findings:
- WML lambda: `source: "primitives.wml", status: "missing"` → initializes primitives, then publishes Content Update for primitives so assets can re-cache
- Assets lambda: today only re-caches on Content Update; Cache Consistency Finding (planned) will add a diagnostic path to trigger `cacheAsset` when DB is out of sync with S3
- Future: additional consumers (alerting, dashboards) can subscribe to the same findings

---

## Event Types

### 1. S3 Structure Finding

**Purpose**: Reports the presence/absence of expected S3 objects.

**Status**: ✅ **IMPLEMENTED**

**Producers**: Initialize lambda emits for `primitives.wml` when running full init (so WML can ensure primitives exist). Can also be sent manually via EventBridge for on-demand primitives init/repair.

**Detail Schema** (see `packages/mtw-interfaces/ts/eventBridge/diagnostics`):
```typescript
interface S3StructureFinding {
  source: string;              // S3 key or logical identifier (e.g., "primitives.wml")
  status: "missing" | "present" | "corrupted" | "unexpected";
  diagnosticRunId: string;     // Correlation ID
  timestamp: string;           // ISO 8601 timestamp
  // Optional future: zone?, expectedPath?, actualPath?, issues?
}
```

**Use Cases**:
- Missing `primitives.wml` → WML lambda runs `initializePrimitives()` (create/repair); on success WML publishes Content Update so assets lambda can re-cache.
- Manual EventBridge event with `source: "primitives.wml", status: "missing"` → same flow.

**Listeners**:
- `mtw.wml` - Listens for `source === "primitives.wml" && status === "missing"`; runs init and optionally publishes Content Update for primitives.

---

### 2. Cache Consistency Finding (Planned)

**Purpose**: Reports that an asset's DynamoDB cache (e.g. assets table component rows) may be out of sync with the authoritative source (e.g. S3 materialized view). Allows self-healing by triggering a re-cache without requiring a Content Update from the content owner.

**Status**: 📋 **PLANNED** - Next finding type to implement for the "DB out of sync with S3" scenario.

**Use Cases**:
- Primitives (or any asset) was updated in S3 (e.g. by init, repair, or manual write) but the assets lambda never received a Content Update, so component rows (e.g. `SITUATION#DEFAULT`) are missing or stale in DynamoDB.
- Manual remediation: operator sends a Cache Consistency Finding for a specific asset to force `cacheAsset(assetId)`.
- Future: assets lambda (or another validator) performs self-diagnostic, compares DynamoDB to S3, and emits findings for out-of-sync assets; same event type can trigger re-cache.

**Proposed Detail Schema**:
```typescript
interface CacheConsistencyFinding {
  assetId: string;             // e.g. "ASSET#primitives"
  status: "stale" | "missing"; // what the diagnostic found: cache out of date or absent
  diagnosticRunId: string;
  timestamp: string;           // ISO 8601
  // Optional: componentIds?: string[]  // if only specific components are known stale
}
```

**Listeners** (to implement):
- `mtw.assets` - On Cache Consistency Finding for an asset, call `cacheAsset({ assetId, streamEvent })` to re-sync S3 → DynamoDB. Idempotent; safe to run manually or in response to a finding.

**Implementation scope** (minimal for "fix this one inconsistency"):
- Add event contract (type, serializer, type guard) in `packages/mtw-interfaces/ts/eventBridge/diagnostics` (or a dedicated slice if preferred).
- Add EventBridge rule: `mtw.diagnostics` / `Cache Consistency Finding` → assets lambda.
- In assets DataSource `receiveEvents`, handle the new finding and call `cacheAsset(assetId)`.
- Emit event manually via AWS CLI (or small script) when operator knows an asset needs re-cache (e.g. after primitives init without a Content Update).

**Manual emission**: Operators can re-cache a single asset (e.g. after primitives init) by sending a Cache Consistency Finding via EventBridge. Example using AWS CLI (replace `YOUR_EVENT_BUS_NAME` and region as needed):

```bash
aws events put-events --entries '[
  {
    "Source": "mtw.diagnostics",
    "DetailType": "Cache Consistency Finding",
    "Detail": "{\"assetId\": \"ASSET#primitives\", \"status\": \"stale\", \"diagnosticRunId\": \"manual-1\", \"timestamp\": \"2025-10-18T12:00:00.000Z\"}"
  }
]' --event-bus-name YOUR_EVENT_BUS_NAME --region us-east-1
```

The assets lambda will receive the event and call `cacheAsset({ assetId, streamEvent })`. `assetId` can be full form (`ASSET#primitives`) or short form (`primitives`); the handler normalizes to full form. `diagnosticRunId` and `timestamp` are optional in the detail payload.

---

### Future design possibilities

- **Diagnostic Run Started** - Trigger coordinated self-diagnostics across lambdas
- **Diagnostic Run Completed** - Summary of findings from a run
- **Player State Finding** - Player data corruption, permission mismatches
- **S3 Structure Finding** - Additional listeners (e.g. `mtw.assets` for metadata issues)
- **Ephemera RenderCache Finding follow-ups** - Diagnostics renderCache sweep (publisher emits **`targetCatalogs`**), observability/runbook hardening, and long-term authored publication architecture beyond first iteration reseed

---

## Existing Healing Infrastructure

### Current Self-Healing Functions

The system already has foundation for self-healing:

**Assets Lambda** (`lambda/assets/selfHealing/globalValues.ts`):
- `healGlobalValues()` - Repairs session mappings and canon asset state
- Fixes connection metadata and global asset cache

**Assets Lambda** (`lambda/assets/player/heal.ts`):
- `healPlayer()` - Repairs player-specific data corruption in the owning domain
- Rebuilds player asset library and character listings through the assets DataSource lane (`mtw.cognito` / `New Player`, `mtw.diagnostics` / `Player Misalignment Finding`, and `api.assets` `HealPlayer`)

**Heal Step Function**: Orchestrates player healing operations

### Integration with New Pattern

These existing healing functions should be **triggered by findings or domain-owned ingress lanes**, not run from diagnostics imperative handlers:

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
- **[WML Lambda](../wml/README.md)**: Consumer of S3 Structure Finding events; runs `initializePrimitives` and publishes Content Update for primitives on create/repair
- **[Initialize Lambda](../initialize/app.ts)**: Emits S3 Structure Finding for `primitives.wml` during full init; still uses imperative `Initialize` for the overall run
- **[Event contracts](../../packages/mtw-interfaces/ts/eventBridge/diagnostics/)**: Diagnostics event types and serializers

---

## Next Steps

- [x] Implement S3 Structure Finding event emission (initialize lambda emits for primitives.wml)
- [x] WML lambda listens for S3 Structure Finding and runs primitives init; publishes Content Update on create/repair
- [ ] **Cache Consistency Finding**: Add contract, EventBridge rule, and assets handler; enable manual (or future automated) re-cache of a single asset
- [ ] **Ephemera RenderCache Finding follow-ons**:
  - [X] **Diagnostics renderCache sweep:** compare blueprint (**`internalCache.ComponentExamples.get`**) vs Ephemera materialized catalogs; emit findings with **`targetCatalogs`** `{ ephemeraId, perspectiveKey }` only (contract in **`mtw-interfaces`**). See [`renderCacheDriftSweep/index.ts`](renderCacheDriftSweep/index.ts).
  - [ ] Add observability/operator workflow (manual emission docs, correlation logging fields, sandbox runbook).
  - [ ] Plan and implement long-term authored publication architecture that reduces reseed dependence.
- [ ] Migrate initialize lambda to emit findings instead of/in addition to imperative Initialize where appropriate
- [ ] Document diagnostic run triggers and scheduling
- [ ] Consider adding diagnostic dashboard/UI
- [ ] Design remaining event types (Player State Finding, etc.)

---

**Document Status**: Living document. S3 Structure Finding is implemented; Cache Consistency Finding is the next target to address DB/S3 sync; other details may evolve.

