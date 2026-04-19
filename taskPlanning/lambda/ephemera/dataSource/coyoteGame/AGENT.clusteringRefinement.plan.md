# Coyote hypothesis Stage One: clustering and plan-structure refinement

**Status:** Planning. Next: finalize seam-shape decisions, then harness and combine-layer scaffolding.

This document is task-scoped; retire it after the initiative ships and move lasting behavior notes into [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (see [`taskPlanning/AGENT.md`](../../../../AGENT.md)).

**Prerequisite (foundational):** Acme **`stableKey`** is shipped --- steady-state contract [**`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md)**; staged objects expose deterministic **`stableKey`** for seam/combine correlation. This clustering plan can proceed in parallel only if combine logic keys off **`uuid`** temporarily.

## Purpose

Hypothesis generation already runs **two Bedrock round-trips** with a validated Markdown **seam** between them (steady-state: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)). **Stage One** still spends prompt and token budget on **per-object coarse affinity** (`coyoteOperated` / `roadRunnerTrap` / `ambiguous`) and **[`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts)** heuristics.

Meanwhile **plan-role affinities** are produced at **Acme Order** parse time, stored durably on **[`Meta::Room.objects`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)**, and rendered into **[`formatCoyoteStagedObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts)** for both hypothesis stages ([`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) **Coyote Acme orders**).

**Goal:** Refocus Stage One on **clustering and divining plan structure** (spatial/causal grouping, beat ordering where useful), reduce redundant affinity mapping, and introduce a **deterministic combine layer** after Stage One so cluster-level reasoning can sit **next to** persisted affinity data without asking the seam LLM to re-derive roles from names alone.

**Scope:** This initiative targets the **golden path** only --- snapshots where staged objects have usable **plan-role `affinities`** from Acme enrich (see [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)). Deliberate harness or integration coverage for **degraded** inputs (`affinitiesFailed`, legacy omitted **`affinities`**, or other resilience scenarios) is **out of scope** here; see [`AGENT.md` **Engine testing harness**](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for a durable note on future coverage.

## Success criteria (draft)

- Stage One prompt + **[`parseHypothesisStageOneOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts)** evolve **in lockstep** with **[`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts)** if the seam contract changes (no orphan version field; same policy as [`AGENT.md` **Hypothesis pipeline**](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).
- Engine harness fixtures supply full **[`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** shapes with **golden-path `affinities`** so seam + combine behavior is observable against realistic enriched snapshots ([`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts), [`coyoteEngineTestFixtures`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts)).
- Combine layer (name TBD) attaches **snapshot affinities** to **cluster membership** (or equivalent structure) for Stage Two consumption; behavior and wire format are unit-tested.
- External player contract unchanged unless intentionally expanded: **[`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts)** (`intent`, optional `sceneAnalysis`) and stub policy ([`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts)).

## Constraints and non-goals

- **Non-goal:** Rewriting Stage Two narrative rules beyond what falls out from an improved seam + combine output (Stage Two tone work may already exist separately).
- **Non-goal:** Changing Acme enrich or **`mergeAcmeOrderEnrich`** unless a dependency appears; affinities are inputs from **`Meta::Room`**.
- **Non-goal:** Expanding Dynamo persistence for raw seam text in production (debug path remains harness / tests per [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)).
- **Non-goal (this initiative):** Dedicated engine-harness or Jest fixtures whose **purpose** is resilience when affinity enrichment **failed** (`affinitiesFailed`), **legacy** rows with omitted **`affinities`**, or other **degraded snapshot** shapes. Runtime and prompts must still **tolerate** those rows (see **Constraint**); we are not investing in automated coverage of those paths for this task-plan.
- **Constraint:** Production remains able to represent legacy staged objects **without** `affinities` or with **`affinitiesFailed`**; clustering and hypotheses must not **require** rich plan roles to parse or stub correctly. Golden-path refinement in this plan does not relax that constraint.

## Unknowns and decisions

1. **Seam contract shape:** Replace or narrow the **`## Objects`** `- **Affinity:**` coarse token line vs keep it for compatibility; optional new sections (e.g. plan-phase labels) vs encoding everything in **Clusters** **Summary** lines.
2. **Combine layer output:** Pure Markdown augmentation for Stage Two vs structured DTO + template; whether Stage Two prompt shows **combined** block only or snapshot + seam + combined.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)). Keep **Why** / **Focus** so the next reader knows what to skim vs study.

1. **Understand task-plan conventions**
   - **Why:** Know what belongs here vs durable [`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md); see [`taskPlanning/AGENT.md`](../../../../AGENT.md).

2. **Read steady-state Coyote hypothesis docs**
   - **Why:** This initiative **extends** the shipped two-call pipeline; do not re-derive wiring.
   - **Focus:** [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (hypothesis path, staged snapshot, **Hypothesis pipeline**, harness). Affinity types: [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).

3. **Read Stage One / Stage Two / parser entry points**
   - **Why:** Seam edits require coordinated parser and both prompt builders.
   - **Focus:** [`buildHypothesisStageOnePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts), [`parseHypothesisStageOneOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts), [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts).

4. **Objects + Acme path (affinity provenance)**
   - **Why:** Snapshot rows are the authoritative affinity source for prompts.
   - **Focus:** [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md); [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) **`AcmeOrderPublishedOrder`**; [`coyoteRoomObjectSnapshot.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts).

5. **Testing**
   - **Why:** Ephemera uses Jest from `lambda/ephemera`; see [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
   - **Commands:** **Verification** below.

6. **Identify next task**
   - **Why:** Progress lives in **Recommended order**.
   - **Focus:** First unchecked line.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Apply checkboxes to each actionable line and nested bullets as they complete.

- [ ] **Design note:** Decide seam contract deltas (object-level bullets vs cluster-first), combine-layer wire format, and Stage Two prompt placement; capture decision in this section or a short comment in [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) if needed for maintainers.
- [ ] **Harness fixtures (golden path):** Extend [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts) (and any normalization helpers) so fixtures supply full **`EphemeraMetaRoomObject`** rows with realistic **`affinities`** (enriched-order shape); keep room ordering aligned with [`defaultCoyoteGameData.gameRooms`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts). Do not add failure-mode fixtures in this initiative (see **Non-goal** above).
- [ ] **Combine layer:** Implement post-Stage-One step that joins validated seam + [`CoyoteRoomObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) affinities into a single artifact for Stage Two (exact shape TBD); unit tests with fixed seam + snapshot inputs.
- [ ] **Stage One prompt + parser:** Trim or replace **[`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts)** and redundant object-level affinity work; steer copy toward clustering, spatial/causal plan structure, and using snapshot plan-role lines as ground truth; update **[`parseHypothesisStageOneOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts)** and [`parseHypothesisStageOneOutput.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.test.ts) to match.
- [ ] **Stage Two prompt:** Consume combined output; adjust [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) + tests so Stage Two instructions match the new seam/combine semantics.
- [ ] **Orchestration:** Wire combine step in [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) / [`generateHypothesisWithStageResults`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts); preserve stub-only failure behavior.
- [ ] **Harness + integration tests:** Update [`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts) / [`generateHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.test.ts) as needed for new fields or metrics.
- [ ] **Durable docs:** Refresh [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for seam/combine steady state; keep this plan's **Purpose** high-level only.

## Verification

- `cd lambda/ephemera && npx jest dataSource/coyoteGame/`
- After touching actions or objects: extend with `dataSource/actions/` or `dataSource/objects/` as appropriate.

## References

- Steady-state hypothesis + harness: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
- Runtime objects + Acme merge: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)
- Product context: [`AGENT.CoyoteGame.implementation.md`](../../../../../AGENT.CoyoteGame.implementation.md) (repo root)
