# Look affordance (`parseCommand` + room full description)

**Status:** In progress.

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

## Material decisions

Canonical type string: **`LookRoom`**. Refine other implementation details (tie-breaks, copy) as you build; the **JSON** `type` and **`ParseCommandResult`** discriminant **must** stay **`LookRoom`**.

| Topic | Proposed direction |
| --- | --- |
| **Deterministic match** | After trim, case-insensitive **exact** token: **`^look$`** or **`^l$`** (equivalently, mirror legacy **`\s*(?:look\|l)\s*`** for the whole string with no other words). Shorthand **`l`** must be the entire command, not a prefix of longer input. **Do not** invoke Bedrock on this path. |
| **Result type** | New **`ParseCommandResult`** variant: **`{ type: 'LookRoom', confidence: number }`** (exported as **`ParseCommandLookRoomResult`**), with **`isParseCommandLookRoomResult`** in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts). **Confidence 1** on the deterministic path. |
| **LLM label** | Step A JSON outcome **`"type": "LookRoom"`** (name must match prompt and **`interpretParseCommandIntentClassificationBody`**; keep **`confidence`** in `[0, 1]`). Step B **not** run for this intent (same structure as **`AwaitRoadRunner`**: classifies, then short-circuits before enrich). |
| **Prompt (Step A)** | Extend the classification prompt: place **LookRoom** in the **mandatory decision order** (document tie-breaks vs **AwaitRoadRunner** / **AcmeOrder** --- e.g. when the line is *primarily* about *seeing* the *current space*, description of surroundings, "examine the room", "what's here", *without* a shopping/catalog focus). Excluded: ordering from Acme, or clearly meta/OOC (maps to **Unknown** / **Unimplemented** as today). |
| **Handler (shipped first slice)** | If **`content.characterId`** is valid: resolve the character's **current room** (e.g. same data as **[`getRoomExitTargetsForCharacter`](../../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)** **`fromRoomId`**). If not in a room, **`WorldOOCMessage`**. If in a room, call shared helper [`requestFullRoomDescriptionForCharacter`](../../../../lambda/ephemera/dataSource/actions/requestFullRoomDescriptionForCharacter.ts) ( **`sendPerceptionThreadRegistered`** + **`sendRenderRequested`**, same as legacy **`executeAction` `look`** for a room). |
| **Stream / published events (next phase)** | Prefer an explicit **`mtw.ephemera.actions` outbound** (see [Next phase: event-driven look](#next-phase-event-driven-look) below) so **`mtw.ephemera.renderOrchestration`** subscribes as a **sibling** to the **`api.ephemera` / `Render Requested`** path, with **perception thread registration** ordered on a **named `messageBus` lane** + **flush** before the normal render cycle. The first slice above stays valid as stepping stone / fallback until that refactor lands. |

## End-to-end chain (for verification)

**LookRoom command** to **non-header full description**:

1. **`sendPerceptionThreadRegistered`** + **`sendRenderRequested`** (as in **`executeAction`**).
2. **Render orchestration** / **cache** produce **`Render Pertains`** for the registered perspective.
3. **`handleRenderPertains`** in [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) resolves **`roomDescription`** threads and emits **`PublishMessage`** with **`displayMode: 'full'`** and **`roomChannel: 'render'`** --- client **`RoomDescription`** in **full** mode, not the sticky **header** shell.

*Contrast:* Imperative [`perceptionMessage`](../../../../lambda/ephemera/perception/index.ts) for **`PerceptionRoomMessage`** uses **`payload.header`** to set **`displayMode`**; this feature targets the **correlated orchestration** path, not a direct one-shot **`PerceptionRoomMessage`**.

### First slice vs. next phase (end state)

- **Current shipped path (first slice):** `LookRoom` in actions calls **`requestFullRoomDescriptionForCharacter`**, which enqueues **`sendPerceptionThreadRegistered`** and **`sendRenderRequested`** ( **`api.ephemera`**, named render-orchestration lane; **[`app.ts`](../../../../lambda/ephemera/app.ts)** must **flush** that lane --- see [`renderOrchestrationIngressLaneId`](../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) --- for work to run in the same invocation).
- **Planned path (next phase):** actions **only** **`streamEvent`** a **Look Command Requested** (or similarly named) outbound; **`isRenderOrchestrationSubscribedEnvelope`** matches it; render orchestration **registers the perception thread on a dedicated lane**, **awaits** **`flush` for that lane**, then continues the **normal** passive render handling (**`Render Request`**, fast-paths, generate, **etc.**). **`Render Pertains`** at **`mtw.ephemera.perception`** should then see the **established** `roomDescription` thread and deliver terminal **`RoomDescription`**.

## Next phase: event-driven look

*Actions `streamEvent` to `mtw.ephemera.renderOrchestration` (sibling to the `api.ephemera` `Render Request` path).*

**Feasibility:** This is **feasible** in this monolith: **`InternalMessageBus`** already carries **cross-DataSource** `StreamingEvent` handoffs, and **`isRenderOrchestrationSubscribedEnvelope`** is a **type guard union** (today **`api.ephemera` + `State Changed`**) that can be **extended** with a **`dataSourceKey: 'mtw.ephemera.actions'`** ingress shape. Ordering is addressed by the same pattern as **`sendRenderRequested`**: a **stable `laneId` helper** and **`await messageBus.flush(laneId)`** (and possibly **`await messageBus.flush()`** afterward) so **`PerceptionThreads` row exists before** downstream **`Render Pertains`** / correlation work. Final delivery (**`displayMode: 'full'`**, **`roomChannel: 'render'`**) should **reuse** the existing [`handleRenderPertains`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) / [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) path once the thread and render cycle line up. Implementation details to lock during build: **exact** payload fields on the new actions outbound, **naming** of the **`header.type`**, and whether **ComponentRender** / **generationContextWml** stay in actions, move to render orchestration, or stay in the shared helper.

1. **Outbound contract** --- Add a **`Look Command Requested`**-style (name TBD) entry to [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) **`ActionsPublishedPayload`** and extend [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts) to **`streamEvent`** it when **`parseResult` is `LookRoom`**, in a room, instead of (or behind a feature flag) calling **`requestFullRoomDescriptionForCharacter` directly**.
2. **Subscription** --- In [`subscribedEvents.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts), extend **`isRenderOrchestrationSubscribedEnvelope`**, and **`RenderOrchestrationSubscribedContent`** and **`localApiEvents`** / other ingress types as needed, so the new **`mtw.ephemera.actions`** header + body is recognized alongside **`Render Request` + `State Changed`**. Add a small header guard and envelope guard mirroring **`isRenderRequestedIngressEnvelope`**.
3. **Handler branch** --- In the render-orchestration ingress path (see [`orchestrationHandler.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts)), add a **discriminated** branch for the new event: **first** enqueue **`PerceptionThreads` / `sendPerceptionThreadRegistered` (or equivalent)** on a **dedicated** **`messageBus` `laneId`**, then **`await flush` that `laneId`** so the thread row is visible **before** **`Render Request`**, **`findRender`**, and downstream steps.
4. **Continue normal path** --- After the flush, run the **same** passive perception request handling as for **`Render Requested`** ( **`sendRenderRequested`**, fast-paths, **generate**, **intake** --- as implemented today) so **Render Pertains** fires with a **valid** `roomDescription` thread.
5. **Verification** --- End-to-end: after **`look`**, **`mtw.ephemera.perception`** processes **`Render Pertains`**, and the requesting character receives a terminal **`PerceptionMessage`** with **full** room view (**`metaData.displayMode: 'full'`**). Add or extend tests; confirm Lambda **`flush` order** in [`app.ts`](../../../../lambda/ephemera/app.ts) if a **new** named lane is introduced.
6. **Docs** --- Touch [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) and/or [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) for the new envelope and ordering contract.

## Progress

| Area | State |
| --- | --- |
| Types + guards | Done (LookRoom + `isParseCommandLookRoomResult`) |
| Deterministic short-circuit in `parseCommand` | Done |
| Step A prompt + interpretation + tests | Done |
| Actions `index.ts` handler + room resolution | Done |
| Optional shared helper with `executeAction` | Done (`requestFullRoomDescriptionForCharacter`) |
| Tests (parse + handler + mocked bus) | Done |
| Event-driven look: actions outbound, render orchestration subscribe, lane-ordered `PerceptionThreads` then `Render Request` | In progress: outbound type + guard in [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) (`Look Command Requested`); emit + subscribe + ordering still [Recommended order](#recommended-order) |
| Durable doc touch-up (`dataSource/actions/AGENT.md`, `parse` pointer; post-next-phase render + actions `AGENT.md` ingress) | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] Read **Material decisions** and lock naming as **`LookRoom`** in the task plan and in **`baseClasses.ts`**; Step A prompt text is the next line.
- [X] Add **`LookRoom`** (`ParseCommandLookRoomResult`) to **`ParseCommandResult`** and **`IntentClassificationResult`** in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) with **`isParseCommandLookRoomResult`**.
- [X] In [`parseCommand.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommand.ts): after Coyote test shortcuts, if deterministic **`look` / `l`**, return **`{ type: 'LookRoom', confidence: 1 }`** without calling Bedrock.
- [X] Update [`buildParseCommandIntentClassificationPrompt.ts`](../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts) and [`parseCommandIntentClassification.ts`](../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts) for the new Step A type; keep JSON-only contract and error handling consistent.
- [X] In [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts): handle **`LookRoom`**: not in room (OOC), else **register + render request** (reuse **`executeAction`** factoring if practical).
- [X] Tests: **deterministic** (no mock Bedrock), **LLM fixture** (mock **`invokeBedrockParseCommand`**) for paraphrase intent, **handler** asserts **`sendPerceptionThreadRegistered` / `sendRenderRequested`** (or shared helper) with expected **`threadKind: 'roomDescription'`** and room id.
- [X] Short **Verification** run (below); update **Progress** table; if behavior is non-obvious, add a line to [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) under Role or a new **Affordances** bullet.
- [X] **Next phase --- outbound envelope:** In [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), add a **`mtw.ephemera.actions` payload** (e.g. type **`Look Command Requested`**) with fields needed for render orchestration (e.g. **`characterId`**, **`roomId`**, **`confidence`**; align with [`requestFullRoomDescriptionForCharacter`](../../../../lambda/ephemera/dataSource/actions/requestFullRoomDescriptionForCharacter.ts) and **`RenderRequestedCommand`** as needed). Add a runtime **type guard** if other actions outbounds use one.
- [ ] **Next phase --- emit from actions:** In [`index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts), for **`LookRoom`**, **`streamEvent`** the new outbound in-room (and stop or feature-flag the direct **`requestFullRoomDescriptionForCharacter`** call so there is a single code path to production). Keep **OOC** and **paraphrase** tests aligned.
- [ ] **Next phase --- render orchestration subscription:** Extend [`isRenderOrchestrationSubscribedEnvelope`](../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) and related types so **`dataSourceKey: 'mtw.ephemera.actions'`** + the new header **`type`** are part of the union; update **`RenderOrchestrationSubscribedContent`** in [`orchestrationHandler.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) (and imports) to narrow the new case.
- [ ] **Next phase --- handler and ordering:** In the new branch, **enqueue** **`PerceptionThreads` registration** (or **`sendPerceptionThreadRegistered`**) on a **named** **`messageBus` `laneId`**; **await** **`messageBus.flush(thatLaneId)`**; then invoke the **existing** passive render pipeline (**`sendRenderRequested`**, fast-paths, **etc.**) so **correlation** sees an established **`roomDescription`** row before **`Render Pertains`**.
- [ ] **Next phase --- app flush and prod checks:** In [`app.ts`](../../../../lambda/ephemera/app.ts) (or document per-invocation order), ensure **named** lanes for **perception thread registration** and for **render orchestration** are **flushed** so same-Lambda work runs; re-verify **CloudWatch** and terminal **`RoomDescription`**. Add Jest / integration coverage where the repo has patterns.
- [ ] **Next phase --- document:** Update [`dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) and/or [`dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) with the sibling-event contract; mark **Progress** and **Durable doc** rows when done.

## Verification

From `lambda/ephemera/` (Jest; use **exact** commands from the repo if [`AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) **Verification** is updated):

```bash
cd lambda/ephemera && npx jest dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts --runInBand
cd lambda/ephemera && npx jest dataSource/actions/publishedEvents.test.ts --runInBand
cd lambda/ephemera && npm run build
```

Grep spot-checks after implementation:

- `LookRoom` in `baseClasses.ts`, and after later slices in `parseCommand.ts`, `index.ts`.
- `roomDescription` + `sendRenderRequested` in the new handler path (or shared module).
- `LookCommandRequestedPublishedPayload` / **`Look Command Requested`** + **`isLookCommandRequestedPublishedPayload`** in `publishedEvents.ts` (Jest: `dataSource/actions/publishedEvents.test.ts`). Remaining next phase: `isRenderOrchestrationSubscribedEnvelope` + perception **lane** `flush` in logs/tests.

## When this task finishes

- Move any **stable** "how to add an affordance" content into [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md) or the umbrella [`AGENT.actionParse.plan.md`](AGENT.actionParse.plan.md) if it applies beyond **look**.
- **Archive or delete** this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md#when-the-task-finishes) so `taskPlanning/` stays current.
