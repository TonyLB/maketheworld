# Object plan-role affinities (Acme parse enrichment)

**Status:** In progress. Phase 1 (schema + shared types) is complete; next is Phase 2 (two-step parse pipeline).

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

- [ ] Phase 2 - Two-step parse pipeline (intent first, Acme second)
  - [ ] **Step A (lightweight intent):** Refactor [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) / [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) so non-Acme intents behave as today, but **AcmeOrder** is recognized with **minimal** extraction (enough to branch: raw line items or simple `{ valid, name, errorType? }` without demanding enrichment or **`affinities`** in this call). Goal: smaller prompt and output for the first invoke so most commands avoid Acme-enrich cost.
  - [ ] **Step B (Acme-only enrich):** When Step A returns `AcmeOrder`, invoke a **second** Bedrock call with a dedicated prompt that, for each **valid** line item, outputs **`name`**, **`description`**, and **`affinities`** (per vocabulary above). Invalid lines keep today's error semantics; do not emit **`affinities`** for rejected catalog lines unless product wants explicit empty arrays (default: omit).
  - [ ] Wire [`parseCommand`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) to orchestrate A then B: if the enrich call fails (provider error, invalid JSON, validation), still complete the Acme order path with **`shortName`** / **`description`** from the best available step (for example Step A names) and set **`affinitiesFailed: true`** (omit or empty **`affinities`** as documented in types); do **not** return `ParseCommandResult` **Error** solely because affinities could not be computed.
  - [ ] Adjust [`interpretParseCommandIntentClassificationBody`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts) (or split interpreters) so validation stays strict JSON + guards.

- [ ] Phase 3 - Acme enrich prompt and parsing
  - [ ] Author `buildParseAcmeOrderEnrichPrompt` (name may vary): instructions that (1) normalize player text to Acme register product **`name`** and **`description`**, (2) fill **`affinities`** with **aptness** per possibility, (3) enforce no RPG wording, (4) drop possibilities below the aptness floor.
  - [ ] Implement parser + tests with fixtures (beehive, shovel, rope-style multi-role examples from the handoff).

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
- **Affinities unavailable (LLM / validation failure):** Persist **`affinitiesFailed: true`** (boolean on `EphemeraMetaRoomObject` or equivalent) when the enrich call cannot produce validated **`affinities`**. The Acme order flow **still succeeds**: objects are merged, **`shortName`** / **`description`** come from the best fallback (document in implementation). Downstream prompts treat failed affinities distinctly from **confirmed empty** or **missing** legacy rows. Optionally refine whether **per-line-item** vs **whole-order** failure gets one flag on each object row.
- **Stage One prompt:** Explicitly **out of scope** for this task: removing [`ACTOR_AFFINITIES_LINES`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts) waits for a follow-up that consumes snapshot affinity data in the prompt logic.

## Material decisions still open

- **Partial enrich success:** If the enrich pass succeeds for some line items of a multi-item order but fails for others, how rows are labeled (**`affinitiesFailed`** only on failed lines vs failing the whole enrich pass) — align with the per-object **`affinitiesFailed`** shape above.

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

## Progress

| Milestone | Status |
| --- | --- |
| Schema + guards for **`affinities`** / **`affinitiesFailed`** on room objects | Done ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts), merge snapshots) |
| Intent-only first parse + Acme enrich second parse | Not started |
| Acme enrich prompt + parser + tests | Not started |
| Bus payload + `handleAcmeOrderAddObjects` persistence | Not started |
| `formatCoyoteStagedObjectsByRoom` renders affinities / failed flag | Not started |
| Build + tests green | Not started |
