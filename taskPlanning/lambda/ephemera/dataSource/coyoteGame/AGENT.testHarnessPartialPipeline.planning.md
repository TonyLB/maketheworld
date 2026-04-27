# Coyote engine test harness: partial pipeline and handoff fixtures

**Status:** Planning. **Design decisions** in **Material decisions** below are **fully locked**. Remaining work follows **Recommended order** (implementation + **Phase 5** durable docs).

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability rules, what belongs in this file vs code-adjacent `AGENT.md`, and **Recommended order** checkbox conventions.

## Purpose

Extend the Coyote **generation** test harness so operators can:

1. Run a **full** hypothesis pipeline end-to-end for one or all harness fixtures (current behavior, triggered when no pipeline step is specified).
2. Run **individual segments** of the hypothesis pipeline **in isolation** by injecting **known-good handoff state** produced by earlier phases, without re-invoking earlier Bedrock calls.

The second mode is the **heavy** case: it requires explicit **fixture shapes** and **golden (or authored) payload data** at each boundary where execution may start.

This document is task-scoped; retire or archive it after the initiative ships and lasting notes live in [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (or adjacent docs).

## Scope

- **In scope:** Hypothesis pipeline under [`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts), harness runner [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts), harness fixtures [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts), and activation via [`parseCommand`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) / [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts).
- **Slash surface (this initiative):** Prototype the richer slash input (optional **phase alias** and **1-based fixture index** per locked **Slash command UX**) **only** on **`/test generation`**. Leave **`/test affinities`** and any other slash-based test harnesses on their **current** behavior for now; extending the same grammar or partial-run story to those commands is **explicitly out of scope** until a follow-up task.
- **Out of scope (unless explicitly pulled in later):** Outcome pipeline harness; **`/test affinities`** slash extensions and parity with generation harness commands; client UI beyond whatever existing `WorldOOCMessage` harness output already provides.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Understand project foundations**
   - **Why:** Task plans live under [`taskPlanning/`](../../../../); they retire after delivery.
   - **Read:** This file end-to-end; [`taskPlanning/AGENT.md`](../../../../AGENT.md).

2. **Understand the hypothesis pipeline boundaries**
   - **Why:** Partial runs and injections must align with real step names and state carried on [`CoyoteHypothesisPipelineState`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts).
   - **Focus:** Step order: `loadRoomObjects` -> `hypothesisStageOneLlm` -> `seamCombineRender` -> `hypothesisPlanSelectionLlm` -> `parsePlanSelectionHandoff` -> `hypothesisPhasePlanHopLlm` -> `parsePhasePlanHopRecord`. Locked aliases **`clustering`** / **`planSelect`** / **`phasePlan`** map to the three LLM hops (see **Phase aliases vs implementation**).

3. **Understand current harness and activation**
   - **Why:** Changes extend existing behavior; slash routing must stay deterministic where possible.
   - **Read:** [`generators/testHarness/`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/), [`discriminateIntent/deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts), [`coyoteEngineTestSlashCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/coyoteEngineTestSlashCommand.ts).

4. **Check testing patterns**
   - **Why:** Ephemera uses Jest from `lambda/ephemera`; keep parity with harness and actions tests.
   - **Commands:** See **Verification** below; extend when adding new test files.

5. **Identify next task**
   - **Why:** Progress lives in **Recommended order**; readers often open only this plan.
   - **Focus:** First unchecked **Recommended order** phase; material design choices are settled in **Material decisions**.

## Material decisions (locked)

Design choices for this initiative. (Durable **AGENT.md** updates are a **Phase 5** task, not a section here.)

### Slash command UX

- [X] **Grammar (locked):** Accepted forms: `/test generation`; `/test generation <fixtureIndex>`; `/test generation <phaseAlias>`; `/test generation <phaseAlias> <fixtureIndex>`. **Token order is fixed** (no reordering). **Case is insensitive** for aliases and the `/test generation` prefix.
- [X] **Fixture selector (locked):** **1-based integer index only** (no `fixture-03`-style ids).
- [X] **Unknown tokens (locked):** **Strict error:** publish a **WorldOOCMessage** that explains the failure and lists valid phase aliases and the allowed fixture index range (do not silently ignore bad tokens).

### Phase aliases vs implementation

- [X] **Public names (locked):** Canonical user-facing aliases (case-insensitive): **`clustering`**, **`planSelect`**, **`phasePlan`**. Implement **both** semantics below under these names (same alias set for **stop-after** and **start-at** modes).
- [X] **Stop-after (prefix run) (locked):** Each alias names a **prefix run** that stops immediately **after** the matching **LLM** invoke (earlier steps execute live with Bedrock where applicable).
  - **`clustering`** -> stop after **`hypothesisStageOneLlm`**.
  - **`planSelect`** -> stop after **`hypothesisPlanSelectionLlm`**.
  - **`phasePlan`** -> stop after **`hypothesisPhasePlanHopLlm`**.  
  Harness output must **label partial completion** (reuse or extend existing blocks such as usage lines / stage bodies so it is obvious which hop ran and where the run stopped).
- [X] **Start-at (isolated step) (locked):** For **`planSelect`** and **`phasePlan`** isolated runs, committed handoff data must supply pipeline state sufficient to invoke that LLM **without** running earlier LLMs---i.e. inputs **as if** upstream orchestration completed (bundles live in [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts)---see **Handoff fixture strategy**).
  - Start **`planSelect`**: inject handoff-shaped state equivalent to **after `seamCombineRender`** (e.g. **`combinedMarkdown`** plus **`roomObjectsByRoom`** and any fields **`hypothesisPlanSelectionLlm`** reads from [`CoyoteHypothesisPipelineState`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)).
  - Start **`phasePlan`**: inject state equivalent to **after `parsePlanSelectionHandoff`** (e.g. **`hop1Handoff`**, **`combinedMarkdown`**, **`roomObjectsByRoom`**).
  - **`clustering`** start-at / first-hop focus: **no** separate curated inject bundle. Use the **existing** harness fixture **`roomObjectsByRoom`**, run deterministic **`loadRoomObjects`**, then **`hypothesisStageOneLlm`** (same practical inputs as prefix **stop-after** **`clustering`**). Add separate curated upstream state **only** if we later need synthetic overrides.

### Handoff fixture strategy

- [X] **Storage (locked):** **Colocated TypeScript modules** under the test-harness tree (same general pattern as existing harness data in [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts)). **Expand that file** for hand-maintained **`planSelect`** / **`phasePlan`** inject bundles (types + values); split out only if the module becomes unmanageably large. No separate JSON-on-disk or generated-snapshot layout for this initiative unless a later task revisits.
- [X] **Source of golden data (locked):** **Hand-maintained** payloads in those modules (curate and update when pipeline inputs or contracts change). No required export-from-full-run tool in scope for the first delivery; an export helper may be added later as a convenience only.
- [X] **Versioning (locked):** **No separate schema-version field** inside fixture payloads. Handoff modules are typed TypeScript; **shape drift fails at compile time** until fixtures are updated. Revisit only if we introduce untyped JSON loaders or multi-era payloads side by side.
- [X] **Coverage (locked):** **`clustering`** does **not** get a matrix of separate curated inject payloads---**`loadRoomObjects`** from the existing per-fixture **`roomObjectsByRoom`** is deterministic, so treat that as the input to **`hypothesisStageOneLlm`** (run steps 1+2). **Hand-maintained inject bundles** (for **start-at** **`planSelect`** and **`phasePlan`**) live in **[`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts)**; grow that module as needed. **Optional** matrix: full **10 fixtures** per inject boundary vs **subset** vs **single reference** row per boundary is a **tuning preference**---start minimal (reference or subset) and add rows when debugging specific fixtures (not a blocker for initial implementation).

### Runner and types

- [X] **API surface (locked):** Extend **[`runCoyoteHypothesisPipeline`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)** with optional arguments (exact shape is an implementation detail: **second parameter**, optional fields on **`GenerateHypothesisDeps`**, etc.) that include at minimum:
  - **`testOnly`**: **`'clustering'`** | **`'planSelect'`** | **`'phasePlan'`** (aligns with slash aliases). **Omit** for production full-pipeline runs; behavior must match **`runCoyoteHypothesisPipeline(deps)`** as it works today when **`testOnly`** is absent.
  - **`harnessRunKind`**: **`'stopAfter'`** | **`'startAt'`**. Required whenever **`testOnly`** is set. **Stop-after**: prefix run through the matching LLM and stop right after it. **Start-at**: begin at that LLM with optional **`injectState`** (see **Phase aliases vs implementation**).
  - **`injectState`**: optional injected partial **[`CoyoteHypothesisPipelineState`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)** (or a narrowed handoff type). **Supply only** when **`harnessRunKind`** is **`'startAt'`** on **`planSelect`** or **`phasePlan`** (**`hypothesisPlanSelectionLlm`** / **`hypothesisPhasePlanHopLlm`**). **Omit** for **`clustering`** (use fixture **`roomObjectsByRoom`** + **`loadRoomObjects`** before the first LLM).
  Production gameplay calls **`runCoyoteHypothesisPipeline(deps)`** with no test options. The harness passes objects such as **`{ testOnly: 'clustering', harnessRunKind: 'stopAfter' }`** or **`{ testOnly: 'planSelect', harnessRunKind: 'startAt', injectState: ... }`**.
- [X] **Partial success mapping (locked):** Evolve **`GenerateHypothesisPipelineResult`** ([`coyoteHypothesisPipeline.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts), re-exported from [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.ts)) into a **discriminated union**: one variant for **full completion** (today's successful end-to-end shape) and separate variant(s) for **harness/partial completion** (stop-after at a hop, start-at runs, stub/abort paths as needed). Prefer a **`type`** / **`kind`** discriminator so callers narrow cleanly; **avoid** a single flat shape with many optional fields.

All items under **Material decisions** are locked. Updating durable **`AGENT.md`** files is **not** an open design question; it is a **Phase 5** checklist item in **Recommended order**.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step finishes.

- [ ] Phase 0 - decisions and inventory
  - [X] Resolve **Slash command UX** items enough to implement a parser (grammar, fixture selector, unknown tokens locked under **Slash command UX**).
  - [X] Resolve **Phase aliases vs implementation** enough to implement parser + harness (`clustering` / `planSelect` / `phasePlan`, stop-after LLM mapping, start-at handoff fixtures---locked under **Phase aliases vs implementation**).
  - [ ] Document each pipeline boundary with required inputs (fields on state + files references) in a short appendix or [`generators/pipelines/hypothesis/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) subsection (link from here).

- [ ] Phase 1 - fixture contract
  - [ ] Define TypeScript types (and optional JSON schema) for saved handoffs per boundary.
  - [ ] Expand [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) with types and hand-maintained inject bundles for **planSelect** / **phasePlan** start-at per **Coverage** (locked).
  - [ ] Add one vertical slice of real golden data for one fixture and one boundary to validate the contract.

- [ ] Phase 2 - pipeline runner extensions
  - [ ] Extend **`runCoyoteHypothesisPipeline`** with **`testOnly`** (**`'clustering'`** | **`'planSelect'`** | **`'phasePlan'`**), **`harnessRunKind`** (**`'stopAfter'`** | **`'startAt'`**), and optional **`injectState`** per **API surface (locked)** (`injectState` only for **`startAt`** **`planSelect`** / **`phasePlan`**).
  - [ ] Implement **discriminated union** **`GenerateHypothesisPipelineResult`** per **Partial success mapping (locked)**; update **`mapPipelineRunToGenerateHypothesisResult`**, **`generateHypothesisWithStageResults`**, and callers (harness, tests).
  - [ ] Wire **inject-and-run-from** for **`planSelect`** and **`phasePlan`** using typed bundles from [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts).
  - [ ] Unit tests with mocked Bedrock where appropriate; avoid flaky live calls in CI for isolated-step tests.

- [ ] Phase 3 - harness integration
  - [ ] Extend [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts) to accept mode, fixture filter, and phase options; format `WorldOOCMessage` output for partial vs full runs.
  - [ ] Wire parse result or command tail from [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (extend `ParseCommandCoyoteEngineTestResult` or equivalent plumb).

- [ ] Phase 4 - slash command and player feedback (**`/test generation` only**; do not extend `/test affinities` or other slash harnesses in this initiative)
  - [ ] Parse `/test generation` tails in deterministic path or dedicated helper; align with [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) and slash command guards.
  - [ ] Invalid combinations return clear OOC errors (range, unknown phase, missing fixture).

- [ ] Phase 5 - coverage and docs
  - [ ] Expand golden handoffs per **Coverage** decision.
  - [ ] **Durable docs:** Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) harness section (**`/test generation`** slash grammar; **`testOnly`** / **`harnessRunKind`** / **`injectState`**; fixture and handoff layout including [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts)). Link from [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) when the parse surface changes.
  - [ ] Run **Verification** commands below.

- [ ] Phase 6 - retire this plan
  - [ ] Delete or archive this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

From repository root or `lambda/ephemera/` (align with [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) if it disagrees):

```bash
cd lambda/ephemera
npm run test -- --runInBand dataSource/coyoteGame/generators/testHarness/ dataSource/actions/parseCommand.test.ts dataSource/actions/discriminateIntent/
```

Extend paths when new tests are added (e.g. `coyoteHypothesisPipeline` partial-run tests).

Grep sentinels after implementation:

```bash
# from repo root
rg "runCoyoteEngineTestHarness|CoyoteEngineTest|test generation" lambda/ephemera/dataSource/actions lambda/ephemera/dataSource/coyoteGame/generators/testHarness
```

## Progress

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 | In progress | Slash command UX + phase aliases + handoff coverage/colocation locked; pipeline boundary appendix still open |
| Phase 1 | Not started | Fixture contract (expand coyoteEngineTestFixtures.ts) |
| Phase 2 | Not started | Runner |
| Phase 3 | Not started | Harness |
| Phase 4 | Not started | Slash UX |
| Phase 5 | Not started | Coverage + docs |
| Phase 6 | Not started | Plan retirement |
