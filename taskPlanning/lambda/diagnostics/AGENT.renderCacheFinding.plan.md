# Ephemera RenderCache Finding Plan

**Status:** In progress. Phase 2.5 routing correction (assets-led reseed) is complete; next is first self-healing handler hardening with optional `roomIds` scope and broader integration coverage.

## Purpose

Create a diagnostics-driven self-healing path that can repopulate ephemera render cache entries when perspective-specific cache data is missing or corrupted.

This initiative is a short-term gap-closer while `componentExamples` publication coverage is still incomplete for perspective-driven cache freshness. The flow should follow the existing descriptive-finding pattern:

- Diagnostics publishes a finding event that describes the issue.
- Assets handles finding-driven authored reseed and emits authoritative updates on `mtw.assets.componentExamples`.
- Ephemera consumes those emits and persists through `mtw.ephemera.renderCache` write boundaries.

## Scope and non-goals

### In scope (first iteration)

- New diagnostics finding type: `Ephemera RenderCache Finding`.
- Finding detail shape:
  - `perspective: AssetUUID[]`
  - `status: 'missing' | 'corrupted'`
  - `diagnosticRunId: string`
  - `timestamp: string`
  - optional `roomIds: EphemeraRoomId[]` (blast-radius limiter)
- EventBridge routing from `mtw.diagnostics` to `AssetsFunction` for this finding type.
- Assets reseed path that emits authored starting-point payload updates consumed by ephemera cache mirroring.

### Explicitly deferred

- Facet-level limiter in finding payload (`facets`): defer to a later iteration.
- New long-term publication architecture for authored asset changes.
- Additional diagnostics aggregation/reporting UX.

## Getting started

Follow the ordered categories below (see [Getting Started pattern for complex tasks](../../../../AGENT.md#getting-started-pattern-for-complex-tasks) and [`taskPlanning/AGENT.md`](../../../AGENT.md)).

1. **Understand planning conventions**
   - **Why**: This file is task-scoped and should be removable after migration completion.
   - **Read**: [`taskPlanning/AGENT.md`](../../../AGENT.md) for durability split, required sections, checkbox conventions.

2. **Read diagnostics finding architecture**
   - **Why**: Reuse existing descriptive-event pattern rather than introducing imperative command events.
   - **Read**: [`lambda/diagnostics/AGENT.schema.planning.md`](../../../../lambda/diagnostics/AGENT.schema.planning.md).

3. **Read render cache and pass-through boundaries**
   - **Why**: Ensure remediation writes respect `mtw.ephemera.renderCache` ownership and existing event semantics.
   - **Read**: [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md), [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../../ephemera/dataSource/AGENT.passThrough.contract.planning.md), [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md).

4. **Inspect existing diagnostics wiring examples**
   - **Why**: Mirror proven implementation slices (`Cache Consistency Finding`) for serializer + subscription + infra rule.
   - **Files**:
     - [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts)
     - [`lambda/assets/dataSource/subscribedEvents.ts`](../../../../lambda/assets/dataSource/subscribedEvents.ts)
     - [`lambda/assets/dataSource/index.ts`](../../../../lambda/assets/dataSource/index.ts)
     - [`template.yaml`](../../../../template.yaml) (diagnostics EventBridge rules)

5. **Inspect ephemera ingress and DataSource subscriptions**
   - **Why**: Add diagnostics deserialization and a subscribed handling path consistent with ephemera DataSource patterns.
   - **Files**:
     - [`lambda/ephemera/app.ts`](../../../../lambda/ephemera/app.ts)
     - [`lambda/ephemera/dataSource/subscribedEvents.ts`](../../../../lambda/ephemera/dataSource/subscribedEvents.ts)
     - [`lambda/ephemera/dataSource/componentExamples.ts`](../../../../lambda/ephemera/dataSource/componentExamples.ts)
     - [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../lambda/ephemera/dataSource/renderCache/index.ts)

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark each nested line `[X]` as it is finished.

- [X] Phase 1 - define finding contract and infra route
  - [X] Add `Ephemera RenderCache Finding` types, guards, and serializer/deserializer handling in diagnostics event contracts.
  - [X] Add EventBridge rule in [`template.yaml`](../../../../template.yaml) routing `mtw.diagnostics` / `Ephemera RenderCache Finding` to `EphemeraFunction`.
  - [X] Add/extend contract tests in `packages/mtw-interfaces` for valid/invalid finding payloads.

- [X] Phase 2 - ephemera ingestion and subscribed-event typing
  - [X] Add diagnostics deserializer registration for ephemera EventBridge ingress in [`lambda/ephemera/app.ts`](../../../../lambda/ephemera/app.ts).
  - [X] Add ephemera subscribed-event guards/types for the new diagnostics finding.
  - [X] Add focused tests proving ephemera accepts the envelope and routes it to handler logic.

- [X] Phase 2.5 - routing correction to assets-led reseed
  - [X] Route `Ephemera RenderCache Finding` to `AssetsFunction` and remove direct `EphemeraFunction` EventBridge subscription for this finding in [`template.yaml`](../../../../template.yaml).
  - [X] Remove ephemera-specific diagnostics handling for direct finding consumption (`lambda/ephemera/app.ts`, `lambda/ephemera/dataSource/subscribedEvents.ts`, `lambda/ephemera/dataSource/index.ts`) now that this flow is handled upstream.
  - [X] Add assets-side diagnostics handling that reuses `lambda/assets/componentExamples` enrichment pipeline to emit authoritative authored seed updates on `mtw.assets.componentExamples`.
  - [X] Ensure `status: missing | corrupted` takes the same idempotent reseed path in first iteration.
  - [X] Add tests proving diagnostics finding -> assets emits -> ephemera `componentExamples` subscriber applies reseed updates without direct diagnostics subscription in ephemera.

- [ ] Phase 3 - first self-healing implementation
  - [ ] Implement `Ephemera RenderCache Finding` remediation as authored invariant seed healing via `mtw.assets.componentExamples` that:
    - [ ] normalizes and validates `perspective` and optional `roomIds`,
    - [ ] resolves target rooms (`roomIds` if provided, otherwise full eligible room set),
  - [ ] rebuilds and emits authored starting-point payloads for each room and each situation-facet aggregate path,
  - [ ] performs healing through assets emits consumed by `mtw.ephemera.examples` -> `mtw.ephemera.renderCache` subscribed-event flow (no direct Dynamo writes outside renderCache domain ownership).
  - [ ] Add idempotency-safe behavior for repeated findings with same inputs.
  - [ ] Add tests for all-rooms and `roomIds`-limited blast radius.

- [ ] Phase 4 - observability and operator workflow
  - [ ] Document manual emission shape and examples for operators.
  - [ ] Add logging fields (`diagnosticRunId`, status, room count, perspective key) to support run correlation.
  - [ ] Validate end-to-end behavior in a sandbox runbook.

- [ ] Phase 5 - cleanup and follow-on planning
  - [ ] Update durable docs (`AGENT.md` files) with shipped behavior where appropriate.
  - [ ] Record deferred follow-up for facet-level limiter.
  - [ ] Remove this task plan when migration gap is closed and durable docs are updated.

## Material decisions

- Finding events stay descriptive, not imperative.
- First iteration includes optional `roomIds` for blast-radius control.
- First iteration excludes facet filters due to high identification complexity.
- `Ephemera RenderCache Finding` handling is assets-led: diagnostics finding drives reseed emits on `mtw.assets.componentExamples`, then ephemera applies those emits through existing mirroring path.
- `missing` and `corrupted` statuses share the same idempotent reseed behavior in first iteration.
- Remediation must preserve render cache boundary ownership (`mtw.ephemera.renderCache` remains the write owner surface).

## Verification

- Contract and serializer tests:
  - `packages/mtw-interfaces/ts/eventBridge/diagnostics/index.test.ts`
- Ephemera ingestion/subscription tests:
  - Add or extend tests near `lambda/ephemera/app.test.ts` and relevant DataSource `subscribedEvents.test.ts`.
- Render-cache healing behavior tests:
  - Add targeted tests for handler fanout and write dispatch (all rooms vs `roomIds` subset).
- Integration check (when feasible):
  - Finding ingress -> assets reseed emits -> ephemera mirror/cache update events observed.
- Build and lint checks on touched packages:
  - `lambda/ephemera` build/test targets
  - `packages/mtw-interfaces` test targets
  - `ReadLints` clean on edited files.

## Progress

| Milestone | Status |
| --- | --- |
| Plan created with first-iteration scope and deferred facet limiter | Done |
| Finding contract (`Ephemera RenderCache Finding`) | Done |
| EventBridge route to ephemera | Done |
| Ephemera diagnostics ingress + subscription typing | Done |
| Phase 2.5 routing correction (assets-led reseed path) | Done |
| Self-healing handler (all rooms + optional `roomIds`) | Not started |
| Tests and operator runbook | Not started |

