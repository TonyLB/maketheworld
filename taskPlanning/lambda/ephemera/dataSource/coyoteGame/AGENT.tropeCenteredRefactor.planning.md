# Coyote Game: trope-centered refactor (planning)

**Status:** Rough first design draft. Next step is to align interfaces and a compatibility story with owners of `mtw-interfaces`, `mtw.ephemera.actions` (Acme enrich), and `mtw.ephemera.coyoteGame` (hypothesis / outcome pipelines).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Capture a **task-scoped** migration plan for restructuring Coyote plan generation around the **four ordered tropes** (see durable conceptual doc [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md)) while **preserving a working path** for code that today consumes **`CoyoteAffinityPossibility`** arrays on staged objects and Acme order lines.

This file is disposable after the initiative completes; steady-state architecture belongs in package `AGENT.md` files and code.

## Target shape (draft)

Rough target pipeline (names are placeholders until implementation choices land):

1. **Per-object labels (Acme enrich + persisted `Meta::Room.objects`)** --- Each object carries trope-oriented signal **judged independently** from other objects in **`tropeAffinities`** (plus **`tropeAffinitiesFailed`** for failure signaling). Use **1-3 trope fits per object** (parallel to current affinity multiplicity), each with aptness labels **`High`** | **`Good`** | **`Poor`**. Start with concise **free-text narrowing** on each fit; document the candidate structured enum families durably (for later adoption) in package docs while keeping the first-pass payload free-text-first.

2. **Trope candidates (replaces affinity-first clustering)** --- For each trope slot, propose **specific implementations** ("*this* contraption", not only "Contraption"), using staged objects, rooms, and narrowing. Outputs are **candidates per slot**, not undifferentiated clusters.

3. **Plan assembly** --- Choose **at most one filled slot per trope type** in canonical order (`Contraption` -> `Distraction` -> `Disadvantage` -> `Finishing Move`), with **deconfliction** (no incompatible double use of the same prop) and **rubric scoring** (clarity, completeness, coherence, genre legality including Distraction-before-Disadvantage when both apply). Less emphasis on open-ended causal graph search; more on **composition under constraints**.

4. **Walk-through / grounding** --- Given the chosen trope sequence and implementations, ground in **game-space** and emit the **golden-path** execution narrative (ordering of beats, spatial ties). This is where **cross-trope linkage** (Rube chains, delivery lines) must be integrated if not fully explicit in step 3.

**Chase** remains non-trope: implicit when the final selected shape has no Finishing Move (see `AGENT.tropes.md`).

## Scope and boundaries

### In scope for this initiative

- **Types and contracts** for trope-centered metadata, including evolution of Acme order enrich JSON and persistence on `EphemeraMetaRoomObject`-shaped rows.
- **Compatibility layer** so downstream consumers that still expect **legacy affinities** (`role` + `aptness`) keep working with **derived** or **dual-written** data through at least one release slice.
- **Hypothesis pipeline** refactor: trope candidates and assembly in place of (or as a successor to) current **cluster combination** paths; see [`combineHypothesisClusters`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/combineHypothesisClusters.ts) and stage-one/stage-two prompts under [`generators/pipelines/hypothesis/`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/).
- **Outcome pipeline** alignment: prompts and formatters that consume staged snapshots; see [`generators/pipelines/outcome/`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/outcome/).
- **Staging text** --- [`formatCoyoteStagedObjectsByRoom`](../../../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) and anything that echoes **intendedRole** against persisted affinities ([`parseHypothesisStageOneOutput`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/parseHypothesisStageOneOutput.ts)).

### Explicit deferrals (unless the plan is updated)

- Client UI for editing trope metadata (if any); treat as downstream of bus contracts.
- Perfect rubric automation on day one; initial pass may remain **partially LLM-judged** with deterministic legality checks.
- Full removal of legacy affinity vocabulary before consumers are migrated (see compatibility strategy below).

### Out of scope for a "rough draft" completion

- Final naming of every type field; this document only sets **migration axes**.

## Current anchor points in the repo

| Concern | Location |
| --- | --- |
| Affinity unions, validation, Acme normalize | [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) |
| Acme enrich prompt (affinity role tags) | [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts) |
| Bus + parse validation of orders | [`lambda/ephemera/dataSource/actions/publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), [`baseClasses.ts`](../../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) |
| Staged snapshot lines for LLM | [`lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) |
| Conceptual tropes (durable) | [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) |
| Coyote package index | [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) |

## Compatibility: affinities and downstream consumers

The **hard part** of the migration is that **many steps still assume** `affinities: CoyoteAffinityPossibility[]` (and `affinitiesFailed`) on Acme lines and room objects. Downstream uses include **hypothesis** intendedRole echo rules, **fixtures**, and **formatting** for prompts.

### Selected transition approach (first pass)

Keep legacy roles in the data shape short-term, but use the simplest deterministic stub so downstream code keeps compiling and type guards remain satisfied while the old role-driven flow is intentionally being retired.

- Treat trope-oriented fields as the canonical planning signal.
- Populate legacy fields as **`affinities: []`** (with **`affinitiesFailed: true`** on valid lines) as a compile-safe placeholder, not a semantic backfill.
- Remove legacy role population after first-pass trope-centered refactoring makes old readers unnecessary.

### Parallel-field transition contract (locked)

- New canonical fields: **`tropeAffinities`** and **`tropeAffinitiesFailed`**.
- Legacy compatibility fields: **`affinities`** and **`affinitiesFailed`** (temporary only).
- During transition, write both paths:
  - canonical planning semantics in `tropeAffinities` / `tropeAffinitiesFailed`;
  - compile-safe legacy placeholders in `affinities` / `affinitiesFailed`.
- Removal gate: drop legacy fields only after all known consumers are switched off role-based affinity reads.

### Minimum bar for the first shippable slice

- No **silent** breakage of `isCoyoteAffinityPossibility` validation on bus paths.
- Continue emitting shape-valid legacy placeholders (`affinities: []`, `affinitiesFailed: true`) during first-pass migration so bus validators and unchanged readers do not break compile-time contracts.
- Mid-migration runtime failures in legacy intendedRole-dependent flows are acceptable while hop contracts are being replaced.

Document deterministic stub rules as part of Phase 0 deliverables in this file.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read tropes vocabulary and constraints: [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md).
3. Read current affinity contract: [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).
4. Trace Acme enrich -> publish -> objects merge for one order: [`actions/enrich/acmeOrder/`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/), [`objects/`](../../../../../../lambda/ephemera/dataSource/objects/).
5. Skim hypothesis pipeline entry and cluster combiner: [`coyoteHypothesisPipeline.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts), [`combineHypothesisClusters.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/combineHypothesisClusters.ts).
6. Read testing authority for this area before running commands: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict with generic examples, follow this file for lambda-level Jest usage.
7. Confirm command context from package scripts before test execution: [`lambda/ephemera/package.json`](../../../../../../lambda/ephemera/package.json) and repo root [`package.json`](../../../../../../package.json). This avoids wrong workspace/cwd assumptions.
8. Run one baseline verification command before edits (from `lambda/ephemera/`):
   - `npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts`

Ephemeral testing notes for this package (durable command source): [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md).

## Design decisions (current draft)

- **Narrowing field:** use free text first. Document structured enum families durably as a later tightening step, but do not block first-pass payload rollout on enum finalization.
- **Trope fit multiplicity:** allow 1-3 trope fits per object, with aptness labels `High` | `Good` | `Poor`.
- **Field names:** lock `tropeAffinities` and `tropeAffinitiesFailed` as the new canonical structure during refactor.
- **LLM hop sequence:** current `clustering` / `plan selection` / `phase-plan` are retained as stage names but repurposed:
  - `clustering` -> generate candidate trope assignments with provisional object grouping by trope and first-draft execution detail.
  - `plan selection` -> (a) catalog conflicts, then (b) compare candidates plus conflict data on rubric, then (c) select best candidate.
  - `phase-plan` -> (a) deconflict selected candidate into final trope sequence with second-draft detail, then (b) generate golden-path walk-through from trope beats.
- **Spatial factoring:** defer explicit spatial judgment in candidate scoring/deconfliction to a second pass after first-pass trope-centering lands.
- **Legacy roles:** keep in data shape for compile/type compatibility via `affinities: []` stubs during first pass, then remove once no longer needed.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase 0 - lock compatibility story
  - [X] Lock temporary stub contract for Acme + `Meta::Room.objects`: valid lines emit `affinities: []` and `affinitiesFailed: true` until legacy role consumers are removed.
  - [X] Lock and document parallel-field names and ownership: `tropeAffinities` / `tropeAffinitiesFailed` canonical; `affinities` / `affinitiesFailed` temporary compatibility only.
  - [X] Document free-text narrowing contract and durable notes on prospective structured enums.
  - [X] List all read sites of `affinities` / `intendedRole` echo and classify: must work unchanged vs may adapt in same release.
  - Locked implementation notes:
    - Canonical object/order planning signal is `tropeAffinities` + `tropeAffinitiesFailed`; legacy `affinities` + `affinitiesFailed` remain temporary compatibility placeholders.
    - Acme parse/finalize now emits valid-line legacy stubs deterministically (`affinities: []`, `affinitiesFailed: true`), while preserving invalid catalog lines unchanged.
    - Free-text narrowing is explicitly first-pass (durable notes and candidate enum families added in `lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`).
  - Read-site classification (compatibility pass):
    - Must work unchanged: `packages/mtw-interfaces/ts/coyotePlanAffinities.ts`, `packages/mtw-interfaces/ts/ephemeraMeta.ts`, `lambda/ephemera/dataSource/actions/baseClasses.ts`, `lambda/ephemera/dataSource/actions/publishedEvents.ts`, `lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/parseHypothesisStageOneOutput.ts`, `lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/combineHypothesisClusters.ts`.
    - May adapt in same release: `lambda/ephemera/dataSource/actions/enrich/acmeOrder/interpretAndFinalize.ts`, `lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts`, `lambda/ephemera/dataSource/actions/index.ts`, `lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts`, `lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts`.
    - Hidden envelope validators to keep in scope: `lambda/ephemera/dataSource/localApiEvents.ts`, `lambda/ephemera/dataSource/objects/events.ts`.

- [X] Phase 1 - types and normalization (`mtw-interfaces` + actions)
  - [X] Introduce trope-centered types (`tropeAffinities` / `tropeAffinitiesFailed`; 1-3 fits per object; aptness `High` | `Good` | `Poor`; free-text narrowing) without breaking existing `normalizeAcmeOrderEnrichResponse` callers; extend or duplicate normalize paths as needed.
  - [X] Update Acme enrich **`buildPrompt.ts`** so the model outputs the new canonical fields and deterministic legacy stubs per Phase 0.
  - [X] Update **`publishedEvents` / `baseClasses`** validation only if new fields ride the bus; preserve backward compatibility for older payloads in tests.
  - Locked implementation notes:
    - `normalizeAcmeOrderEnrichLine` now deterministically emits canonical trope status for valid lines: non-empty trope fits stay as-is; missing/empty fits normalize to `tropeAffinities: []` with `tropeAffinitiesFailed: true`.
    - Legacy compatibility placeholders remain deterministic for valid lines (`affinities: []`, `affinitiesFailed: true`) in parse/finalize outputs.
    - Bus/type guards in `publishedEvents` and `baseClasses` remained backward-compatible (trope fields optional), with added tests to cover both payloads with trope fields and legacy-compatible payloads without them.

- [X] Phase 2 - persistence and snapshots
  - [X] Extend object merge / meta room object shape for new fields; bridge from orders to objects.
  - [X] Update **`coyoteRoomObjectSnapshot`** formatting so hypothesis/outcome prompts see trope-centered lines while still exposing enough legacy-compatible text for stage-one echo rules until relaxed.
  - Locked implementation notes:
    - `handleAcmeOrderAddObjects` now uses a dedicated bus-to-object mapper so canonical trope fields (`tropeAffinities`, `tropeAffinitiesFailed`) and temporary legacy placeholders (`affinities`, `affinitiesFailed`) are persisted and streamed in one pass-through contract.
    - `formatCoyoteObjectAffinitySuffix` is now trope-first while retaining stage-one legacy echo support: trope lines render first when present, legacy plan-role lines render as secondary compatibility text, and both failure markers are emitted deterministically when both paths fail.

- [ ] Phase 2.5 - Acme trope-affinity quality hardening
  - [X] Build a representative calibration corpus for Acme enrich trope fits (clean trope signals, borderline cases, and likely misclassification patterns).
    - Artifact: [`acmeEnrichTropeCalibrationCorpus.v1.json`](acmeEnrichTropeCalibrationCorpus.v1.json) with 11 first-pass prompts spanning clean/borderline/likely-misclassification buckets and directional expected trope-fit outcomes.
  - [X] Define first-pass acceptance criteria for trope-affinity usefulness (coverage, trope-label plausibility, narrowing specificity, and failure-rate guardrails).
    - First-pass criteria are encoded in the corpus artifact itself for objective harness evaluation: `expectedLines` defines required directional signal (coverage + trope-label plausibility + narrowing specificity), and `likelyErrors` defines disallowed/failure-pattern guardrails to track fail-rate.
  - [X] Extend affinities test-harness fixture shape to carry calibration metadata (`expectedLines`, `likelyErrors`, bucket/tags) so the corpus can be encoded directly in fixtures and scored without sidecar mapping.
  - [ ] Run calibration/evaluation passes against the current Acme enrich prompt and record concrete failure modes to feed hypothesis-phase parser/rubric hardening.
  - [ ] Apply a bounded prompt revision pass in `actions/enrich/acmeOrder/buildPrompt.ts`, then re-run the same corpus and compare before/after outcomes.
  - [ ] Lock an eval artifact reference (fixtures + rubric notes) so Phase 3A+ can reuse the same quality harness when reworking hypothesis hops.

- [ ] Phase 3A - hypothesis contracts and validation seams
  - [ ] Lock hop contracts before major prompt rewrites: candidate-clustering output shape, plan-selection handoff shape, and phase-plan output shape.
  - [ ] Add/adjust parsers and validation contexts to fail fast on malformed hop payloads while preserving current stub/abort semantics.
  - [ ] Refresh harness fixtures with contract-first snapshots so downstream prompt rewrites have stable parser targets.

- [ ] Phase 3B - hypothesis `clustering` rework
  - [ ] Rework `clustering` into candidate trope assignments with provisional object-to-trope grouping and first-draft execution detail.
  - [ ] Add focused tests for clustering parse/merge behavior under trope-first data (including malformed/partial model outputs).
  - [ ] Re-freeze clustering fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).

- [ ] Phase 3C - hypothesis `plan selection` rework
  - [ ] Rework `plan selection` into conflict catalog + rubric comparison + best-candidate selection.
  - [ ] Add tests for handoff extraction and failure routing when conflict/rubric sections are missing or invalid.
  - [ ] Re-freeze plan-selection fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).

- [ ] Phase 3D - hypothesis `phase-plan` rework
  - [ ] Rework `phase-plan` into deconflicted final trope sequence (second-draft detail) plus golden-path walk-through generation by trope beats.
  - [ ] Add tests for phase-plan parse validation reasoning (structured-failure tolerated when prose hypothesis parses).
  - [ ] Re-freeze phase-plan fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).

- [ ] Phase 4A - outcome pipeline alignment
  - [ ] Align **`buildPlanOutcomePrompt`** / **`formatPhasePlanForOutcomePrompt`** with assembled trope sequence + walk-through from Phase 3D contracts.
  - [ ] Add regression tests that consume trope-first phase-plan output without legacy role assumptions.

- [ ] Phase 4B - legality and rubric verification
  - [ ] Add verification tests for golden-path legality (trope order, distraction constraint).
  - [ ] Add rubric-level assertions where deterministic legality checks must override soft scoring.

- [ ] Phase 4B - spatial second pass (after first-pass trope-centering)
  - [ ] Add explicit spatial judgment inputs (room boundaries, co-staged props, path feasibility) to `plan selection` rubric scoring.
  - [ ] Add explicit spatial deconfliction checks to `phase-plan` so final trope sequence and walk-through respect layout constraints.
  - [ ] Expand tests with spatial contradiction cases (works in trope logic, fails in room layout) and expected corrections.

- [ ] Phase 5 - cleanup and durable docs
  - [ ] Remove deterministic legacy-role stubs and legacy role consumers after first-pass migration proves unnecessary dependencies are gone.
  - [ ] Move lasting architecture descriptions into [`coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) and related pipeline `AGENT.md` files.
  - [ ] Archive or delete this task plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

**Broad Coyote + actions:**

```bash
npx jest dataSource/coyoteGame/ dataSource/actions/
```

**Interfaces package** (after type changes):

```bash
npm test --workspace packages/mtw-interfaces -- coyotePlanAffinities
```

Adjust workspace/test invocation to match repo `package.json` if the pattern above differs.

## Progress

| Milestone | Status |
| --- | --- |
| Rough task plan authored | Done |
| Compatibility decision (projection vs dual-write) | Not started |
| Draft legacy mapping spec | Not started |
| Interfaces + Acme enrich shape | Not started |
| Snapshot + hypothesis pipeline slice | Not started |
| Outcome pipeline slice | Not started |
| Durable docs updated; task plan retired | Not started |
