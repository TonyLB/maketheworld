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

## Open questions (Phase 3A contract lock)

Resolve these before major prompt rewrites in Phase 3B/3C/3D. Mark `[X]` when a decision is made and reflected in parser/type/harness contracts.

- [X] **Clustering seam payload shape:** keep stage-one member `intendedRole` echo as-is for this slice, or pivot now to trope-first member fields (`trope`, `aptness`, `narrowing`) at the seam boundary.
  - Decided: lock clustering contracts as trope-first and do not require item-level `intendedRole`.
  - Transition policy: permit optional `intendedRole` echo as compatibility/debug metadata for one slice, but treat it as non-canonical and plan removal after trope-first seam consumers are stable.
- [X] **Clustering strictness policy:** lock whether parser accepts unknown root/member keys or requires exact keys only (`clusters`, optional `outliers`, optional `notes`) and define duplicate/empty constraints.
  - Decided: strict-first parser policy for Phase 3A.
  - Root keys allowed: exact allowlist only (`clusters`, optional `outliers`, optional `notes`); reject unknown root keys.
  - Member keys allowed: exact allowlist only per shape; reject unknown keys.
  - Keep duplicate/coverage/non-empty constraints strict (single assignment per staged `stableKey`, no overlaps, no omissions under chosen outlier mode).
  - Revisit gate: if strict rejects repeatedly surface useful inventive patterns, capture examples and decide explicit contract expansion rather than silent permissive parsing.
- [X] **Plan-selection handoff schema:** decide whether the current JSON handoff (`paragraphSummary`, `rubricIssues`) remains sufficient, or needs additional structured winner metadata (for example candidate id / conflict summary).
  - Decided: first-draft Phase 3A keeps current handoff JSON schema unchanged (`paragraphSummary`, `rubricIssues`).
  - Rationale: this slice already changes upstream structure from clusters to cluster-candidates; avoid adding simultaneous handoff-schema complexity in the same migration.
  - Deferred: candidate id / structured conflict metadata can be added in a later hardening pass once candidate contracts and parser stability are proven.
- [X] **Plan-selection handoff strictness:** lock exact-key-only vs permissive-extra-keys behavior, and minimum content requirements (`rubricIssues` non-empty vs allowed empty).
  - Decided: permissive extra keys are allowed in the handoff JSON for this slice.
  - Required minimum remains: `paragraphSummary` string and `rubricIssues` string array must be present and well-typed.
  - Empty `rubricIssues` is allowed for first-pass migration.
- [X] **Phase-plan JSON contract scope:** confirm whether current `validateCoyotePhasePlan` shape is the locked Phase 3A target, or whether trope-sequence/deconfliction fields must be added now before 3D prompt work.
  - Decided: lock current `validateCoyotePhasePlan` shape as the Phase 3A baseline contract.
  - Deferred: trope-sequence/deconfliction schema additions move to Phase 3D contract hardening, after candidate/selection behavior is better characterized.
  - Revisit gate: before Phase 3D prompt rewrites, decide whether additional structured fields are required by downstream outcome/rubric consumers.
- [X] **Phase-plan failure semantics:** reconfirm and lock parser behavior when JSON is malformed/invalid but prose parses (current behavior keeps prose record and sets `phasePlanValidationReason`).
  - Decided: keep current short-term behavior for Phase 3A (retain prose record when phase-plan JSON fails validation, and set `phasePlanValidationReason`).
  - Rationale: preserves playable output while contracts are being reshaped and avoids premature hard-fail coupling to still-evolving structured fields.
  - Revisit gate: tighten to hard-fail only if prose-only fallback rate is high enough to mask prompt drift or blocks Phase 4 consumers.
- [X] **Reserved token policy:** reconfirm allowed `derivedFrom` token families (snapshot stable keys, seam topology labels, reserved `setting`) and whether any additional virtual tokens are needed now.
  - Decided: no additional virtual token families for this slice.
  - Allowed now: snapshot `stableKey` tokens, seam topology labels, and reserved `setting`.
  - Revisit later: if implementation or next-iteration tuning reveals repeatable unmet grounding needs, add new tokens explicitly via a contract update (not ad hoc prompt drift).
- [X] **Harness freeze authority:** decide which fixtures become canonical contract-first snapshots for each hop (`clustering`, `plan selection`, `phase-plan`) and where they are versioned.
  - Decided: staged harness authority with two passes.
  - Pass 1 (implementation path): as each step lands, freeze contract-first output for all new incoming fixture inputs, and populate next-hop expected results for one canonical fixture (`fixture-01`) before starting implementation of the next step.
  - Pass 2 (tuning path, target around Phase 4B): backfill expected results for all steps across all fixtures for broad calibration/tuning coverage.
  - Versioning/source of truth: keep canonical fixture data in `lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts`; treat step-specific snapshots there as contract authority for parser and harness regressions.
- [X] **Compatibility sunset gate:** define explicit criteria for removing legacy intended-role affinity echoes from hypothesis seams after trope-first contracts are adopted.
  - Decided: sunset `intendedRole` echoes immediately once trope-first seam adoption checks pass.
  - Removal checks: no prompt contract requires `intendedRole`; no parser/combine path depends on it; harness/tests pass with fixtures that omit it; no downstream consumer reads it.
  - Policy: if all checks pass in the same slice, remove instead of carrying a transitional echo window.

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

- [X] Phase 2.5 - Acme trope-affinity quality hardening
  - [X] Build a representative calibration corpus for Acme enrich trope fits (clean trope signals, borderline cases, and likely misclassification patterns).
    - Artifact: [`acmeEnrichTropeCalibrationCorpus.v1.json`](acmeEnrichTropeCalibrationCorpus.v1.json) with 11 first-pass prompts spanning clean/borderline/likely-misclassification buckets and directional expected trope-fit outcomes.
  - [X] Define first-pass acceptance criteria for trope-affinity usefulness (coverage, trope-label plausibility, narrowing specificity, and failure-rate guardrails).
    - First-pass criteria are encoded in the corpus artifact itself for objective harness evaluation: `expectedLines` defines required directional signal (coverage + trope-label plausibility + narrowing specificity), and `likelyErrors` defines disallowed/failure-pattern guardrails to track fail-rate.
  - [X] Extend affinities test-harness fixture shape to carry calibration metadata (`expectedLines`, `likelyErrors`, bucket/tags) so the corpus can be encoded directly in fixtures and scored without sidecar mapping.
  - [X] Run calibration/evaluation passes against the current Acme enrich prompt and record concrete failure modes to feed hypothesis-phase parser/rubric hardening.
  - [X] Apply a bounded prompt revision pass in `actions/enrich/acmeOrder/buildPrompt.ts`, then re-run the same corpus and compare before/after outcomes.
  - [X] Lock an eval artifact reference (fixtures + rubric notes) so Phase 3A+ can reuse the same quality harness when reworking hypothesis hops.

- [X] Phase 3A - hypothesis contracts and validation seams
  - [X] Lock hop contracts before major prompt rewrites: candidate-clustering output shape, plan-selection handoff shape, and phase-plan output shape.
  - [X] Add/adjust parsers and validation contexts to fail fast on malformed hop payloads while preserving current stub/abort semantics.
  - [X] Refresh harness fixtures with contract-first snapshots so downstream prompt rewrites have stable parser targets.
  - Locked implementation notes:
    - Stage-one clustering seam is now strict-first in parser and prompt contract language: root keys limited to `clusters` / optional `outliers` / optional `notes`, cluster keys limited to `clusterName` + `members`, and member keys limited to `stableKey` + optional compatibility/debug `intendedRole`.
    - Plan-selection handoff parser now enforces required typed minimum keys (`paragraphSummary`, `rubricIssues`) while tolerating additional keys; malformed required-key payloads still abort to stub via existing pipeline failure routing.
    - Phase-plan seam keeps the current `validateCoyotePhasePlan` baseline and prose-preserving fallback behavior; prompt wording now explicitly instructs models to still emit complete scene-analysis + hypothesis prose when JSON details are uncertain.
    - Harness contract authority now includes fixture-01 phase-plan run-only inject state (`roomObjectsByRoom`, `combinedMarkdown`, `hop1Handoff`) alongside existing plan-selection inject data, so downstream hop rewrites can target stable fixture-backed parser seams.

- [X] Phase 3B - hypothesis `clustering` rework
  - [X] Rework `clustering` into candidate trope assignments with provisional object-to-trope grouping and first-draft execution detail.
  - [X] Add focused tests for clustering parse/merge behavior under trope-first data (including malformed/partial model outputs).
  - [X] Re-freeze clustering fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).
  - Locked implementation notes:
    - Stage-one seam contract is now trope-candidate-first: root `candidates` + optional `notes`, with each candidate carrying `candidateId`, `executionSummary`, ordered `tropeAssignments`, and optional candidate-local `outliers`.
    - Parser strictness remains exact-key-only with additional candidate hardening: required execution fields, canonical trope order enforcement, duplicate trope rejection, and per-candidate staged `stableKey` partition checks.
    - Combined stage-two markdown remains under `## Combined clustering` but now renders `### Candidate <id>` sections with trope-level `executionDetail` and candidate-local outliers, and fixture-01 frozen seam authority is updated to the new candidate shape.

- [X] Phase 3C - hypothesis `plan selection` rework
  - [X] Rework `plan selection` into conflict catalog + rubric comparison + best-candidate selection.
  - [X] Add tests for handoff extraction and failure routing when conflict/rubric sections are missing or invalid.
  - [X] Re-freeze plan-selection fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).
  - Locked implementation notes:
    - Plan-selection prompt contract now requires sectioned output in order (`## Conflict catalog`, `## Rubric comparison`, `## Winner selection`) before the final handoff JSON fence, while preserving required handoff keys `paragraphSummary` and `rubricIssues`.
    - Hop-1 handoff parsing now hard-fails when required conflict/rubric/winner section headings are missing, in addition to existing malformed or mistyped JSON handoff failures; pipeline failure routing remains abort-to-stub before phase-plan invocation.
    - Parser and pipeline regressions now cover missing-section failures and confirm phase-plan is not invoked on handoff contract violations; fixture-01 phase-plan handoff slices are re-frozen with conflict/rubric-centered summary and issue language.

- [X] Phase 3D - hypothesis `phase-plan` rework
  - [X] Rework `phase-plan` into deconflicted final trope sequence (second-draft detail) plus golden-path walk-through generation by trope beats.
  - [X] Add tests for phase-plan parse validation reasoning (structured-failure tolerated when prose hypothesis parses).
  - [X] Re-freeze phase-plan fixture slices in [`coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).
  - Locked implementation notes:
    - Phase-plan JSON contract now encodes final selection shape directly: required root keys `tropeSequence`, `deconflictionSummary`, and `phases`, where `tropeSequence` is unique and canonical-order constrained (`Contraption` -> `Distraction` -> `Disadvantage` -> `Finishing Move`) and `phases` are index-aligned trope beats.
    - Each phase now carries trope-beat structure (`trope`, `tropeBeat`, `stableKeysUsed`, `virtualEntities`, `achievement`, optional `prepVsBeat`) so downstream consumers can preserve second-draft detail and render beat-by-beat execution outlines.
    - Prompt + parser fallback policy remains stable: hop-2 prompt now requires trope-sequence deconfliction and beat-ordered scene analysis, while parse flow still preserves prose `intent`/`walkthrough` with `phasePlanValidationReason` whenever structured JSON fails validation.
    - Harness fixture authority is re-frozen for phase-plan entry (`fixture-01` `phasePlanInject.hop1Handoff`) with deconfliction and beat-order language aligned to the new 3D contract.

- [X] Phase 4A - outcome pipeline alignment
  - [X] Align **`buildPlanOutcomePrompt`** / **`formatPhasePlanForOutcomePrompt`** with assembled trope sequence + walk-through from Phase 3D contracts.
  - [X] Add regression tests that consume trope-first phase-plan output without legacy role assumptions.
  - Locked implementation notes:
    - Outcome phase-plan formatting is now explicitly trope-sequence-first: `formatPhasePlanForOutcomePrompt` renders `tropeSequence` and `deconflictionSummary` before per-phase beat details so outcome generation consumes assembled order and deconfliction context directly.
    - Outcome prompt guidance is now aligned with Phase 3D walk-through semantics: `buildPlanOutcomePrompt` phase-plan instructions explicitly require following trope order and walkthrough beats while preserving Road Runner safety and Coyote-backfire constraints.
    - Regression coverage now locks trope-first behavior across the outcome pipeline (`formatPhasePlanForOutcomePrompt.test.ts`, `buildPlanOutcomePrompt.test.ts`, `generatePlanOutcome.test.ts`), including a no-legacy-role-label assertion path for trope-first phase-plan + walkthrough overrides.

- [ ] Phase 4B - legality and rubric verification
  - [ ] Add verification tests for golden-path legality (trope order, distraction constraint).
  - [ ] Add rubric-level assertions where deterministic legality checks must override soft scoring.

- [ ] Phase 4B - spatial second pass (after first-pass trope-centering)
  - Tracking note: execution authority moved to [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md) Phase `T4` so tuning status is centralized with other hop-by-hop revisions.
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
