# Object plan-role affinities (Acme parse enrichment)

**Status:** In progress. Phases 1-3 and Phase 3.5 (Acme affinities **`/test affinities`** harness) are complete; next is Phase 4 (persistence).

## Purpose

Move **static plan-relevant object knowledge** out of inference-time hypothesis prompts and into the **Acme order parse** step. Each staged object should carry a compact **`affinities`** array (each entry is a **role possibility**: entity-modification targets, structural execution roles, and an **aptness** score) describing how it is likely to participate in contraption plans.

This enables a cheaper **intent-classification** pass for most commands and a **second, Acme-only** Bedrock call that performs validation, Acme-style enrichment (name + description), and affinity evaluation on the **enriched** object (for example the beehive, not the raw "BEES!" line).

This plan is task-scoped. Per [`taskPlanning/AGENT.md`](../../../../AGENT.md), retire or delete it after the initiative ships and any lasting notes live in code-adjacent [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md), [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md), and [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) as appropriate.

## Relationship to other work

- **Parse pipeline:** Builds on [`AGENT.actionParse.plan.md`](./AGENT.actionParse.plan.md) (Phases 1-3 delivered intent classification + Acme order handling). This initiative **splits** the Acme path into two steps and deepens the Acme parse output.
- **Hypothesis pipeline:** Affinity data must reach [`formatCoyoteStagedObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) and callers ([`buildHypothesisStageOnePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts), [`buildPlanOutcomePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts)). Per the Coyote LLM handoff (Iteration 2 / Stage One note), **do not** remove the `ACTOR_AFFINITIES_LINES` block from Stage One in this task; that waits until Stage One is redesigned to consume persisted **`affinities`**.

## Role vocabulary (contract summary)

Frame everything in **contraption / cartoon-physics** terms; avoid RPG jargon in prompts and JSON.

**Entity modification** (`role: "entity_modification"`):

- **target:** `coyote` | `road_runner` | `environment`
- **mode:** `direct` (object itself modifies the entity) | `constructive` (object implies a build step producing a modified entity)

**Structural execution** (no target/mode):

- **terminal** — delivers the plan's intended final outcome to the Road Runner; at most one terminal element per plan.
- **trigger** — activates another element when a physical or temporal condition is met.
- **delivery** — moves danger to the right place/time between a terminal and its target.
- **autonomous_agent** — self-propelled sub-contraption; Coyote out of the execution loop at run time.

Each possibility includes **`aptness`**: float in `[0, 1]`. Omit entries below ~**0.2**. Most objects: **1-3** possibilities in **`affinities`**. The highest aptness is not necessarily what Stage One will pick; co-staged objects matter.

**Example JSON shape** (per object after enrichment):

```json
{
  "name": "Beehive",
  "description": "Standard Acme beehive, pre-loaded with agitated bees.",
  "affinities": [
    { "role": "entity_modification", "target": "road_runner", "mode": "direct", "aptness": 0.7 },
    { "role": "terminal", "aptness": 0.5 }
  ]
}
```

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../AGENT.md)).

1. **Understand project foundations**
   - **Why:** Task-plan durability and checkbox rules live in [`taskPlanning/AGENT.md`](../../../../AGENT.md).
   - **Read:** That file; skim root [`AGENT.md`](../../../../AGENT.md) for ephemera navigation.

2. **Read this document**
   - **Focus:** **Purpose**, **Role vocabulary**, **Recommended order**, **Out of scope**.

3. **Understand integration points**
   - **Intent + Acme delivery today**
     - [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) — single Bedrock call for intent classification.
     - [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) — combined prompt (includes Acme order slot extraction).
     - [`parseCommandIntentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts) — validates model JSON to [`ParseCommandResult`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts).
     - [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) — on `AcmeOrder`, emits stream + bus messages; [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) — `AcmeOrderPublishedPayload` (`orders: string[]`).
   - **Objects persistence**
     - [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) — maps `orders` to [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) `{ uuid, shortName }` and merges into `Meta::Room`.
     - [`mergePersistMetaRoomObjects.ts`](../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) — merge semantics for `objects`.
   - **Coyote hypothesis / outcome prompts**
     - [`coyoteRoomObjectSnapshot.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) — `loadCoyoteRoomObjectsByRoom` currently reduces objects to **short names only**; **`formatCoyoteStagedObjectsByRoom`** must include affinity lines (or a **failed affinities** note) once data exists.

4. **Testing**
   - **Why:** Ephemera uses **Jest** from [`lambda/ephemera`](../../../../../lambda/ephemera/package.json).
   - **Files:** Extend [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts), [`handleApiObjectsChange.test.ts`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.test.ts); add focused tests for the new Acme enrich parser and snapshot formatting.

5. **Run baseline tests before edits**
   - Use **Verification** below.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [X] Phase 1 - Schema and types (interfaces package + guards)
  - [X] Extend [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) with optional fields aligned to the contract: at minimum **`description`**, **`affinities`** (array of discriminated role possibilities with `aptness`; `entity_modification` variants include `target` + `mode`), and **`affinitiesFailed`** (or equivalent) when the enrich step did not produce validated affinities so downstream code can tell **missing** from **known-empty** from **unavailable due to LLM failure**.
  - [X] Update [`isEphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (and any merge/load validators) so existing rows without the new fields remain valid. **`isEphemeraMetaRoomObject`** remains **shallow** (optional field types only). [`mergePersistMetaRoomObjects.ts`](../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) **`snapshotObjects`** now shallow-copies full objects so stream **`priorObjects` / `newObjects`** keep optional fields.
  - [X] Add **shared** TypeScript types for the Acme enrich model output in [`mtw-interfaces`](../../../../../packages/mtw-interfaces/ts/) (alongside room-object / meta types): these types are **reused** by the enrich parser, [`ParseCommandResult`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) shaping, persistence, and tests. Expose narrow type guards and keep **one** validation boundary from model JSON to those types. Implemented in [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) (**`AcmeOrderEnrichModelResponse`**, **`isAcmeOrderEnrichModelLine`**, **`isCoyoteAffinityPossibility`**, etc.); tests in [`coyotePlanAffinities.test.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.test.ts) and merge snapshot tests in [`mergePersistMetaRoomObjects.test.ts`](../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.test.ts).

- [X] Phase 2 - Two-step parse pipeline (intent first, Acme second)
  - [X] **Step A (lightweight intent):** Refactor [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) / [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) so non-Acme intents behave as today, but **AcmeOrder** is recognized with **minimal** extraction only: keep **`orders`** as **`ParseCommandAcmeOrderLine`** (`valid`, **`name`**, **`errorType?`**) — no enrichment or **`affinities`** in this JSON. **Strip** Acme-catalog detail from Step A copy (no long packaging rules here; those move to Step B). Goal: smaller first prompt and smaller first response. *(Runtime normalization adds **`description`** / **`affinities`** defaults on `ParseCommandAcmeOrderLine` before merge; the Step A **model** JSON remains minimal.)*
  - [X] **Step B (Acme-only enrich):** When Step A returns **`AcmeOrder`**, call **`invokeBedrockAcmeOrderEnrich`** ([`generateExample/invokeBedrockAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/generateExample/invokeBedrockAcmeOrderEnrich.ts) — **new wrapper**): same **`modelId`** as [`invokeBedrockParseCommand`](../../../../../lambda/ephemera/generateExample/invokeBedrockParseCommand.ts) (**`BEDROCK_PARSE_COMMAND_MODEL_ID`**), separate **`maxTokens`** / **`timeoutMs`** tuned for enrich JSON. **`buildParseAcmeOrderEnrichPrompt`** in Phase 2 is a **thin placeholder**: lift the Acme-order behavior already present today in [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) (validation semantics, packaged deliverables, **`lines`** output matching **[`AcmeOrderEnrichModelResponse`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)**). Phase 3 deepens instructions (full affinity vocabulary, aptness floor, no RPG wording).
  - [X] **Per-line failure:** Do **not** fail the entire enrich step when one line fails validation or parsing. Set **`affinitiesFailed: true`** (and omit or empty **`affinities`**) **only on affected lines**; other lines keep validated **`affinities`**. Align enrich **`lines`** with Step A **valid** rows by **index** (same count/order as **`orders`** filtered to **`valid`** only, or document one explicit alignment rule in code). *(Implemented in [`mergeAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts): index alignment and per-slot failure; enrich **`affinitiesFailed: true`** per line; missing **`lines`** slots mark only those rows. If the enrich **HTTP body** fails top-level **`isAcmeOrderEnrichModelResponse`** validation, Step B is treated as failed for **all** valid lines until/unless we add partial JSON recovery.)*
  - [X] Wire [`parseCommand`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): orchestrate A then B; **`ParseCommandAcmeOrderResult.confidence`** uses the **combined** rule in **Material decisions**. Do **not** return **`ParseCommandResult` `Error`** solely because affinities failed on some or all lines.
  - [X] Extend **[`AcmeOrderEnrichModelResponse`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** / line types if needed (**optional root `confidence`** for Step B; optional **`affinitiesFailed`** per **`AcmeOrderEnrichModelLine`**) and adjust guards in **`mtw-interfaces`**.
  - [X] Adjust [`interpretParseCommandIntentClassificationBody`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts) (or split interpreters) so validation stays strict JSON + guards.

- [X] Phase 3 - Acme enrich prompt and parsing (full prompt quality)
  - [X] Replace the Phase 2 placeholder: expand **`buildParseAcmeOrderEnrichPrompt`** so instructions include (1) full role vocabulary and **`affinities`** with **aptness**, (2) enforce no RPG wording, (3) drop possibilities below the aptness floor, (4) normalize player text to Acme register **`name`** / **`description`** with the full catalog rigor intended for production.
  - [X] Extend parser tests with fixtures (beehive, shovel, rope-style multi-role examples from the handoff).

- [X] Phase 3.5 - Acme parse manual-review harness (parallel to hypothesis **`/test generation`**)
  - **Goal:** After Phase 3 prompt work, run the **Coyote LLM handoff Iteration 2** corpus through the **real** Step A + Step B parse pipeline **one item at a time** (each command is a **single-line** Acme order: `order <phrase>`), collect outputs for **human review** — same spirit as handoff § Testing (“no automated assertion”). Multi-item **`order A, B, C`** runs are out of scope for this harness; isolation makes enrich behavior easier to compare.
  - **Reference implementation (hypothesis side):** The production-adjacent pattern to mirror — not copy wholesale — lives under [`coyoteGame/`](../../../../../lambda/ephemera/dataSource/coyoteGame/): [`coyoteEngineTestSlashCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/coyoteEngineTestSlashCommand.ts) (**`/test generation`** → **`CoyoteEngineTest`** without Bedrock), [`runCoyoteEngineTestHarness.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts), fixtures in [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts), wiring + env gate in [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (**`COYOTE_ENGINE_TEST_HARNESS_ENABLED`**). Documented in [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (**Acme parse affinities harness**).
  - **High-level build plan:**
    - [X] **Entry point:** **`/test affinities`** in [`coyoteAffinitiesTestSlashCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/coyoteAffinitiesTestSlashCommand.ts) → **`CoyoteAffinitiesTest`** in [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) (no Bedrock); model JSON cannot spoof (rejected in [`interpretParseCommandIntentClassificationBody`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts)).
    - [X] **Fixture list:** [`acmeOrderAffinitiesHarnessPhrases.ts`](../../../../../lambda/ephemera/dataSource/actions/acmeOrderAffinitiesHarnessPhrases.ts).
    - [X] **Runner:** [`runAcmeOrderAffinitiesHarness.ts`](../../../../../lambda/ephemera/dataSource/actions/runAcmeOrderAffinitiesHarness.ts) — **`order ${phrase}`** per line, **`parseCommand`**, one consolidated **`WorldOOCMessage`** with JSON + **`elapsedMs`** per fixture.
    - [X] **Safety:** **`COYOTE_AFFINITIES_TEST_HARNESS_ENABLED`** in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (default **`false`**).
    - [X] **Tests:** Slash + **`parseCommand`**, [`runAcmeOrderAffinitiesHarness.test.ts`](../../../../../lambda/ephemera/dataSource/actions/runAcmeOrderAffinitiesHarness.test.ts), [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts).
  - **Handoff Iteration 2 inputs** (each should be exercised as **`order <...>`** on its own):
    1. `an anvil`
    2. `a grand piano`
    3. `a rocket`
    4. `a bag of marbles`
    5. `ten thousand volts of electricity`
    6. `a box of instant hole`
    7. `invisible paint`
    8. `a giant electromagnet`
    9. `road runner costume`
    10. `a trampoline`

- [ ] Phase 4 - Persistence and bus payload
  - [ ] Extend [`AcmeOrderPublishedPayload`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) (or introduce a versioned successor) so `mtw.ephemera.objects` receives **full enriched objects**: **`shortName`** = enriched catalog **`name`**, plus **`description`**, **`affinities`**, and **`affinitiesFailed`** when applicable. Update [`isAcmeOrderPublishedPayload`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) accordingly.
  - [ ] Update [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) to pass through optional fields onto each `EphemeraMetaRoomObject` when merging.
  - [ ] Ensure [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) still satisfies player-facing messages and stream headers; adjust only as needed for payload shape.

- [ ] Phase 5 - Coyote snapshot formatting
  - [ ] Change [`loadCoyoteRoomObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts) to supply structured data (not only `string[]`) for prompts, or add a parallel loader that returns objects with **`affinities`** / **`affinitiesFailed`**.
  - [ ] Update **`formatCoyoteStagedObjectsByRoom`** so each object line includes **short name**, optional **description**, and **rendered affinities** (or an explicit note when **`affinitiesFailed`**); keep token cost reasonable.
  - [ ] Thread the richer snapshot through [`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) / [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts) deps if types change.

- [ ] Phase 6 - Verification and cleanup
  - [ ] Full Jest targets for actions + objects + coyote snapshot; `npm run build` in `lambda/ephemera`.
  - [ ] Move stable contracts into durable `AGENT.md` snippets if helpful; update this plan's checkboxes; delete or archive this file when done.

## Material decisions (locked for this task)

- **Naming:** Persisted array field name **`affinities`** (handoff examples used `roles`; implementation and docs use **`affinities`**). Each element still carries a **`role`** discriminator (`entity_modification`, `terminal`, etc.).
- **`shortName`:** Stores the **enriched Acme catalog name** (the parse enrich step's **`name`**), same string players and prompts see as the object label.
- **Affinities unavailable (LLM / validation failure):** Persist **`affinitiesFailed: true`** per staged object (`EphemeraMetaRoomObject`) when that line's affinities could not be validated. Use **per-line** failure: one bad line does **not** invalidate the whole enrich step or sibling lines. Downstream prompts treat failed affinities distinctly from **confirmed empty** or **missing** legacy rows.
- **Bedrock enrich invocation:** Add **`invokeBedrockAcmeOrderEnrich`** alongside [`invokeBedrockParseCommand`](../../../../../lambda/ephemera/generateExample/invokeBedrockParseCommand.ts); **same model id** (`BEDROCK_PARSE_COMMAND_MODEL_ID`), **different** defaults for **`maxTokens`** / **`timeoutMs`** suited to enrich payload size.
- **Confidence (combined):** **`ParseCommandAcmeOrderResult.confidence`** is a **single combined** scalar: **`stepAConfidence * stepBConfidence`**, clamped to **`[0, 1]`**. **`stepAConfidence`** is Step A **`AcmeOrder`** **`confidence`**. **`stepBConfidence`** comes from optional **`confidence`** on **`AcmeOrderEnrichModelResponse`** after a successful enrich HTTP parse; if that field is absent but JSON validated, treat **`stepBConfidence = 1`**. If the enrich **call** fails entirely (transport / non-JSON), omit Step B contribution and use **`combined = stepAConfidence`** (equivalent to **`stepBConfidence = 1`** for the aggregate score — per-line **`affinitiesFailed`** still records line-level failure).
- **Phase 2 vs Phase 3 prompt:** Phase 2 ships **`buildParseAcmeOrderEnrichPrompt`** as a **thin placeholder** that **lifts** existing Acme-order instructions out of [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) into the second prompt; Phase 3 upgrades copy to full affinity vocabulary and production rigor (see Phase 3 above).
- **Stage One prompt:** Explicitly **out of scope** for this task: removing [`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts) waits for a follow-up that consumes snapshot affinity data in the prompt logic.

## Out of scope (this initiative)

- Redesign of Stage One / Stage Two hypothesis prompts beyond **feeding richer snapshot text** (no removal of `ACTOR_AFFINITIES_LINES` yet).
- Changes to [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) except what is required to compile against updated snapshot types.

## Verification

- Phase 1 completed: `jest` in `packages/mtw-interfaces` on **`coyotePlanAffinities.test.ts`**; **`lambda/ephemera`** **`mergePersistMetaRoomObjects.test.ts`**; **`npm run build`** in **`lambda/ephemera`**.
- `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run build`
- Targeted Jest (extend as new test files appear):
  - `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts`
  - `npm run test -- --runInBand dataSource/objects/handleApiObjectsChange.test.ts`
  - Add runs for new Acme enrich unit tests and coyote snapshot tests.
- Manual or harness check: place an Acme order in a Coyote demo room and confirm Dynamo `Meta::Room.objects` rows include **`affinities`** / **`affinitiesFailed`** as appropriate and hypothesis/plan prompts receive formatted affinities (inspect logging or test harness fixtures).
- After Phase 3: use **Phase 3.5** handoff corpus (**ten** `order …` singles) for qualitative Acme enrich review; align with Coyote LLM **`CURSOR_HANDOFF.md`** § Testing (Iteration 2).

## Progress

| Milestone | Status |
| --- | --- |
| Schema + guards for **`affinities`** / **`affinitiesFailed`** on room objects | Done ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts), merge snapshots) |
| Intent-only first parse + Acme enrich second parse | Done ([`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`invokeBedrockAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/generateExample/invokeBedrockAcmeOrderEnrich.ts)) |
| Acme enrich prompt + parser + tests | Done ([`buildParseAcmeOrderEnrichPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts), **`COYOTE_AFFINITY_APTNESS_MIN`** in [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts); tests in **`coyotePlanAffinities.test.ts`**, **`mergeAcmeOrderEnrich.test.ts`**, **`parseCommand.test.ts`**, **`buildParseAcmeOrderEnrichPrompt.test.ts`**) |
| Manual affinities harness (`/test affinities`, **20** Bedrock calls when enabled) | Done ([`coyoteAffinitiesTestSlashCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/coyoteAffinitiesTestSlashCommand.ts), [`runAcmeOrderAffinitiesHarness.ts`](../../../../../lambda/ephemera/dataSource/actions/runAcmeOrderAffinitiesHarness.ts), [**`COYOTE_AFFINITIES_TEST_HARNESS_ENABLED`**](../../../../../lambda/ephemera/dataSource/actions/index.ts) default off) |
| Bus payload + `handleAcmeOrderAddObjects` persistence | Not started |
| `formatCoyoteStagedObjectsByRoom` renders affinities / failed flag | Not started |
| Build + tests green | Not started |
