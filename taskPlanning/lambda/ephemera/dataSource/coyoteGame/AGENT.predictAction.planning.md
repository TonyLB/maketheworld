# Coyote Game: player-requested hypothesis (`predict`) (planning)

**Status:** In progress. P0 decisions locked. Next step is Phase P1 (parse affordance).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Move Coyote **hypothesis generation** from an automatic reaction to **`Object Moved`** to an **explicit player affordance**, symmetric with **`Await RoadRunner`** for plan outcome.

Today, [`handleObjectMovedForHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.ts) runs the full hypothesis pipeline whenever an object is **placed into** a Coyote demo room. With **`positionGraph`**-backed play manipulation (pick up, put down, reposition), that trigger surface will grow much faster than the semantic signal that "the plan changed meaningfully." Players should **stage freely**, then **`predict`** when they want a reading, then **`wait`** to execute.

This file is task-scoped and should be archived or removed when the change ships and durable guidance has been moved to package docs.

## Scope and boundaries

### In scope

- Deterministic bare **`predict`** short-circuit in [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts) (no **`p`** alias).
- New discriminate-intent section **`PredictHypothesis`** in [`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts) and interpreter wiring in [`intentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts).
- Parse result variant, type guard, and **`streamEvent`** branch in [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (mirror **`AwaitRoadRunner`**).
- New actions published payload + envelope guard (parallel [`AwaitRoadRunnerPublishedPayload`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)).
- CoyoteGame ingress: subscribe to the new actions event; handler that reuses the existing hypothesis publish path (placeholder -> invalidate -> `get('intent')` -> terminal).
- **Remove** automatic hypothesis on **`Object Moved`** (unsubscribe / delete handler wiring; keep affordance refresh on **`Object Moved`** unchanged in [`affordanceOrchestration`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/)).
- Client help copy in [`CoyoteHelpMessage.tsx`](../../../../../charcoal-client/src/components/Message/CoyoteHelpMessage.tsx).
- Product loop update in [`AGENT.CoyoteGame.md`](../../../../../AGENT.CoyoteGame.md) (step 3: predict, not auto-after-order).
- Tests across actions parse, actions index, coyoteGame handler, and subscribed envelope guards.

### Out of scope

- Hypothesis **pipeline** prompt/tuning changes (see [`AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md)).
- Implementing pick-up / put-down manipulation commands (they remain **`Unimplemented`** until a separate plan; this change only stops auto-hypothesis when those moves land).
- **`singleFlight`** / coalescing for concurrent **`predict`** requests (follow-up if playtests show overlap pain).
- UI affordance buttons for predict (help text + typed command only for this slice).

## Success criteria

- Typing **`predict`** (and agreed paraphrases) triggers hypothesis generation; **`Object Moved`** alone does **not**.
- Player loop in product docs reads: **order / place -> predict -> wait**.
- **`help`** mentions **`predict`** between staging and waiting.
- Existing hypothesis delivery (`CoyoteGameHypothesisMessage`, stream Started/Result payloads) unchanged in wire shape unless an open decision explicitly revises audience scope.
- Regression suite for actions + coyoteGame passes under commands in **Verification**.

## Reference pattern

Treat **`Await RoadRunner`** as the end-to-end template:

| Concern | Outcome (existing) | Hypothesis (target) |
| --- | --- | --- |
| Deterministic shortcut | (none) | **`predict`** only |
| LLM intent | **`AwaitRoadRunner`** | **`PredictHypothesis`** |
| Parse result `type` | **`AwaitRoadRunner`** | **`PredictHypothesis`** |
| Actions `streamEvent` header | **`Await RoadRunner`** | **`Predict Hypothesis`** |
| CoyoteGame handler | [`handleAwaitRoadRunnerForPlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleAwaitRoadRunnerForPlanOutcome.ts) | New handler (refactor from [`handleObjectMovedForHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.ts)) |
| Cache + pipeline | `invalidate('outcome')` -> `get('outcome')` | `invalidate('intent')` -> `get('intent')` (unchanged) |
| In-flight player feedback | **`WorldOOCMessage`** "Awaiting Road Runner" + **`WorldMessage`** "Outcome: Generating..." | **`CoyoteGameHypothesisMessage`** "Hypothesis: Generating..." to requester only (no extra actions OOC ack) |
| Delivery audience | All active characters in Coyote rooms | Requesting character only |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read steady-state Coyote data flow: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (**Object Moved** hypothesis path, **Await RoadRunner** outcome path).
3. Read actions affordance checklist: [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) (**Adding a new command affordance**).
4. Read product loop: [`AGENT.CoyoteGame.md`](../../../../../AGENT.CoyoteGame.md) (**Core Player Loop**).
5. Read testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Command context: Jest from **`lambda/ephemera/`** via **`npm run test`**.
6. Run baseline verification (below) before edits.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package **`AGENT.concepts.md`**. When a decision ships, record it in **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and product docs where appropriate) and remove the row here.

| ID | Decision | Blocks slice | Status | Locked answer |
| --- | --- | --- | --- | --- |
| D-1 | **Stream contract naming** | P2, P3 | Decided | Actions header / published payload **`type: 'Predict Hypothesis'`**; parse JSON **`type: 'PredictHypothesis'`** (mirror **`Await RoadRunner`** / **`AwaitRoadRunner`**). |
| D-2 | **Delivery audience** | P3 | Decided | **(b) Requesting character only** for **`CoyoteGameHypothesisMessage`** Started + Result rows. |
| D-3 | **Deterministic alias** | P1 | Decided | **No** bare **`p`** --- **`predict`** only. |
| D-4 | **Guard when mispredicted** | P1, P3 | Decided | Not in a Coyote room: **`WorldOOCMessage`** guidance, **no** stream / Bedrock. In a Coyote room with empty staging: **run pipeline** (stub or low-confidence hypothesis acceptable). |
| D-5 | **LLM paraphrase examples** | P1 | Decided | Narrow **`PredictHypothesis`** section; seed examples include "what's my plan", "read the setup", "what am I trying to do", "guess my scheme"; disambiguate from **`LookRoom`**. |
| D-6 | **Player OOC ack from actions** | P2 | Decided | **None.** Existing coyoteGame handler already **`publish`es** **`CoyoteGameHypothesisMessage`** with **`Hypothesis: Generating...`** ([`handleObjectMovedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.ts)); with D-2 that is sufficient in-flight feedback. Do **not** add a parallel **`WorldOOCMessage`** on the actions path (unlike **`Await RoadRunner`**, which uses both OOC ack and outcome-channel placeholder). |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase P0 - lock open decisions
  - [X] Resolve D-1 through D-6 in the table above.

- [ ] Phase P1 - parse affordance (`mtw.ephemera.actions`)
  - [ ] Add **`PredictHypothesis`** to [`ParseCommandResult`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) and intent classification union + guards.
  - [ ] Add deterministic **`predict`** only in [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts).
  - [ ] Add **Section** for **`PredictHypothesis`** in [`buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts); update precedence / disambiguation vs **`LookRoom`**, **`AwaitRoadRunner`**, **`Unimplemented`**.
  - [ ] Wire interpreter in [`intentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts).
  - [ ] Apply D-4 guard in parse or handler (not in Coyote room -> OOC; no stream).
  - [ ] Tests: [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`intentClassification.test.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts).

- [ ] Phase P2 - actions stream contract
  - [ ] Add **`PredictHypothesisPublishedPayload`** + guard in [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) per D-1.
  - [ ] Add **`streamEvent`** branch in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) (no **`WorldOOCMessage`** ack per D-6).
  - [ ] Add envelope guard in [`objects/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/objects/subscribedEvents.ts) (or shared actions subscribe helper if extracted).
  - [ ] Tests: [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts), [`publishedEvents.test.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.test.ts).

- [ ] Phase P3 - coyoteGame handler migration
  - [ ] Refactor [`handleObjectMovedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.ts) into **`handlePredictHypothesisForHypothesis`** (or rename in place) keyed on actions payload + D-2 audience rules.
  - [ ] Update [`coyoteGame/index.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/index.ts): remove **`Object Moved`** branch; handle **`Predict Hypothesis`** (D-1 name).
  - [ ] Update [`coyoteGame/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/subscribedEvents.ts) ingress union + guards.
  - [ ] Retire or repurpose [`handleObjectMovedForHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.test.ts) for the new trigger.
  - [ ] Confirm **`Object Moved`** still drives affordance refresh only (no coyoteGame subscription).

- [ ] Phase P4 - client + product docs
  - [ ] Update [`CoyoteHelpMessage.tsx`](../../../../../charcoal-client/src/components/Message/CoyoteHelpMessage.tsx): insert **`predict`** step between Acme order and wait.
  - [ ] Update [`AGENT.CoyoteGame.md`](../../../../../AGENT.CoyoteGame.md) core loop step 3.
  - [ ] Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md): document **`Predict Hypothesis`** ingress; remove **Object Moved** hypothesis path.
  - [ ] Update [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) outbound list.

- [ ] Phase P5 - closeout
  - [ ] Run full **Verification** block.
  - [ ] Mark checkboxes in this plan; move any lasting rules from **Open decisions** into durable docs.
  - [ ] Archive or delete this task plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from **`lambda/ephemera/`** unless noted otherwise.

Baseline (before edits):

```bash
npm run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
npm run test -- --watchAll=false dataSource/actions/index.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/handlers/handleObjectMovedForHypothesis.test.ts
```

After implementation:

```bash
npm run test -- --watchAll=false dataSource/actions/
npm run test -- --watchAll=false dataSource/coyoteGame/
```

Client help (from **`charcoal-client/`**):

```bash
npm test -- src/components/Message/CoyoteHelpMessage.test.tsx
```

Manual smoke (optional):

1. Order an Acme object --- confirm **no** automatic **`CoyoteGameHypothesisMessage`**.
2. Type **`predict`** --- confirm placeholder then terminal hypothesis.
3. Type **`wait for road runner`** --- confirm outcome still runs.

## Progress

| Milestone | Status |
| --- | --- |
| Task plan drafted | Done |
| Open decisions locked (P0) | Done |
| Parse affordance shipped (P1) | Not started |
| Actions stream contract shipped (P2) | Not started |
| CoyoteGame migration shipped (P3) | Not started |
| Client + product docs updated (P4) | Not started |
| Verification green; plan archived (P5) | Not started |

## Related docs

- Prior assessment (chat): player-requested **`predict`** vs auto **`Object Moved`** --- aligned with **`Await RoadRunner`** symmetry.
- Actions parse initiative: [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.actionParse.plan.md`](../actions/AGENT.actionParse.plan.md).
- Positions / manipulation context: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (**play mutations**).
