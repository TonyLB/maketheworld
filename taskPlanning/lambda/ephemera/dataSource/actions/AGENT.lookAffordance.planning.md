# Look affordance (`parseCommand` + room full description)

**Status:** Not started.

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability, what belongs in this file vs package `AGENT.md`, and **Recommended order** checkbox conventions.

## Purpose

Extend [`parseCommand`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) and the [`mtw.ephemera.actions`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) handler so players can request the **full** room description (non-header **`RoomDescription`** on the client) through the new command pipeline, in two ways:

1. **Deterministic** --- no Bedrock: canonical bare **`look`** and **`l`** (same intent as the legacy imperative parser; see match shape below).
2. **LLM Step A** --- Bedrock classifies free text as a **look at the current surroundings / examine the room** style intent (paraphrases), without running Acme Step B.

**Delivery contract:** A **render cycle** that ends in terminal **`PerceptionMessage`** for the requesting character with **`metaData.displayMode: 'full'`** and **`roomChannel: 'render'`** (the **non-header** full room view), by registering a **`roomDescription`** perception thread and enqueuing **`Render Requested`** --- matching the end state described for **`roomDescription`** in [`orchestrate.ts` `handleRenderPertains`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (terminal publish uses **`displayMode: 'full'`** for that thread kind).

**Non-goals (this task):** targeted looks (named exit, feature, object, another character) --- only **current room, full description**, aligned with a minimal slice of what [`lambda/ephemera/parse/index.ts`](../../../../lambda/ephemera/parse/index.ts) does for the bare-`look` / bare-`l` line and what [`executeAction`](../../../../lambda/ephemera/parse/executeAction.ts) does when **`actionType: 'look'`** and **`EphemeraId`** is a room (reuse or factor shared wiring rather than forking behavior).

## Relationship to other plans

- **Action parse umbrella:** [`AGENT.actionParse.plan.md`](AGENT.actionParse.plan.md) (Phase 4: branch framework; this affordance can land as a concrete first branch or just ahead of a generic registry, but should still map to one clear handler path in [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts)).
- **Perception / render:** Normative context for render channel and **`roomDescription`** delivery: [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) (e.g. correlated room description, **`roomChannel: 'render'`**).

## Getting started

1. **Foundations** --- Root [Getting Started pattern for complex tasks](../../../../AGENT.md#getting-started-pattern-for-complex-tasks): why this feature exists and how it ties to the perception vertical.
2. **Current parser** --- [`parseCommand.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) (order of operations: deterministic shortcuts, Step A, Step B only for Acme intent), [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) (result union + guards), [`buildParseCommandIntentClassificationPrompt.ts`](../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts), [`parseCommandIntentClassification.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts).
3. **Handler** --- [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts) (branch on `parseResult` and side effects; compare **`Navigation`** and **`Character Navigate`** stream event).
4. **Legacy parity** --- Room bare look: [`lambda/ephemera/parse/index.ts`](../../../../lambda/ephemera/parse/index.ts) (regex for **`look` / `l`**); effect pipeline: [`executeAction.ts`](../../../../lambda/ephemera/parse/executeAction.ts) **`look`** for **`EphemeraRoomId`** (**`sendPerceptionThreadRegistered`** with **`threadKind: 'roomDescription'`** + **`sendRenderRequested`** with perspective and **`generationContextWml`**).
5. **Tests** --- [`parseCommand.test.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`index.test.ts`](../../../../lambda/ephemera/dataSource/actions/index.test.ts); Jest from **`lambda/ephemera`**.

## Material decisions (proposed; refine when implementing)

| Topic | Proposed direction |
| --- | --- |
| **Deterministic match** | After trim, case-insensitive **exact** token: **`^look$`** or **`^l$`** (equivalently, mirror legacy **`\s*(?:look\|l)\s*`** for the whole string with no other words). Shorthand **`l`** must be the entire command, not a prefix of longer input. **Do not** invoke Bedrock on this path. |
| **Result type** | New **`ParseCommandResult`** variant, e.g. **`{ type: 'LookRoom', confidence: number }`**, with **`isParseCommandLookRoomResult`** in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts). **Confidence 1** on the deterministic path. |
| **LLM label** | Add a Step A JSON outcome, e.g. **`"type": "LookRoom"`** (name must match prompt and **`interpretParseCommandIntentClassificationBody`**; keep **`confidence`** in `[0, 1]`). Step B **not** run for this intent (same structure as **`AwaitRoadRunner`**: classifies, then short-circuits before enrich). |
| **Prompt (Step A)** | Extend the classification prompt: place **LookRoom** in the **mandatory decision order** (document tie-breaks vs **AwaitRoadRunner** / **AcmeOrder** --- e.g. when the line is *primarily* about *seeing* the *current space*, description of surroundings, "examine the room", "what's here", *without* a shopping/catalog focus). Excluded: ordering from Acme, or clearly meta/OOC (maps to **Unknown** / **Unimplemented** as today). |
| **Handler** | If **`content.characterId`** is valid: resolve the character's **current room** (e.g. same data as **[`getRoomExitTargetsForCharacter`](../../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)** **`fromRoomId`**). If not in a room, **`WorldOOCMessage`** with a clear line (consistent with **Navigation** when not in a room). If in a room, run the **same side effects** as **`executeAction` `look`** for that **room** (or call a small shared helper used by both paths): **`sendPerceptionThreadRegistered`**, **`ComponentRender`**, **`sendRenderRequested`**. **No** new bus **`streamEvent`** on `mtw.ephemera.actions` required unless you explicitly want a journal entry for "look" --- product default is **perception + render** only, matching legacy. |
| **Stream / published events** | Optional: add a **`Look Room`-typed** (or similar) **published** payload in [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) for observability **only** if other DataSources need to subscribe; otherwise keep effects on **`messageBus`** and existing perception/render events only. |

## End-to-end chain (for verification)

**LookRoom command** to **non-header full description**:

1. **`sendPerceptionThreadRegistered`** + **`sendRenderRequested`** (as in **`executeAction`**).
2. **Render orchestration** / **cache** produce **`Render Pertains`** for the registered perspective.
3. **`handleRenderPertains`** in [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) resolves **`roomDescription`** threads and emits **`PublishMessage`** with **`displayMode: 'full'`** and **`roomChannel: 'render'`** --- client **`RoomDescription`** in **full** mode, not the sticky **header** shell.

*Contrast:* Imperative [`perceptionMessage`](../../../../lambda/ephemera/perception/index.ts) for **`PerceptionRoomMessage`** uses **`payload.header`** to set **`displayMode`**; this feature targets the **correlated orchestration** path, not a direct one-shot **`PerceptionRoomMessage`**.

## Progress

| Area | State |
| --- | --- |
| Types + guards | |
| Deterministic short-circuit in `parseCommand` | |
| Step A prompt + interpretation + tests | |
| Actions `index.ts` handler + room resolution | |
| Optional shared helper with `executeAction` | |
| Tests (parse + handler + mocked bus) | |
| Durable doc touch-up (`dataSource/actions/AGENT.md` or `parse` pointer) | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [ ] Read **Material decisions** and adjust naming (**`LookRoom`** vs product-preferred label) in code and prompt in one pass.
- [ ] Add **`LookRoom` (or chosen name)** to **`ParseCommandResult`** and **`IntentClassificationResult`** in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) with a type guard.
- [ ] In [`parseCommand.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): after Coyote test shortcuts, if deterministic **`look` / `l`**, return **`{ type: 'LookRoom', confidence: 1 }`** without calling Bedrock.
- [ ] Update [`buildParseCommandIntentClassificationPrompt.ts`](../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) and [`parseCommandIntentClassification.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts) for the new Step A type; keep JSON-only contract and error handling consistent.
- [ ] In [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts): handle **`LookRoom`**: not in room (OOC), else **register + render request** (reuse **`executeAction`** factoring if practical).
- [ ] Tests: **deterministic** (no mock Bedrock), **LLM fixture** (mock **`invokeBedrockParseCommand`**) for paraphrase intent, **handler** asserts **`sendPerceptionThreadRegistered` / `sendRenderRequested`** (or shared helper) with expected **`threadKind: 'roomDescription'`** and room id.
- [ ] Short **Verification** run (below); update **Progress** table; if behavior is non-obvious, add a line to [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) under Role or a new **Affordances** bullet.

## Verification

From `lambda/ephemera/` (Jest; use **exact** commands from the repo if [`AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) **Verification** is updated):

```bash
cd lambda/ephemera && npx jest dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts --runInBand
cd lambda/ephemera && npm run build
```

Grep spot-checks after implementation:

- `LookRoom` (or final type name) in `baseClasses.ts`, `parseCommand.ts`, `index.ts`.
- `roomDescription` + `sendRenderRequested` in the new handler path (or shared module).

## When this task finishes

- Move any **stable** "how to add an affordance" content into [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) or the umbrella [`AGENT.actionParse.plan.md`](AGENT.actionParse.plan.md) if it applies beyond **look**.
- **Archive or delete** this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md#when-the-task-finishes) so `taskPlanning/` stays current.
