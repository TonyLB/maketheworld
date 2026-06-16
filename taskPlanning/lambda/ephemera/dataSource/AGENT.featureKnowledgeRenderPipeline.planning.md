# Feature / Knowledge render pipeline (orchestration + perception delivery)

**Status:** Phase B complete (correlated F/K ingress + fan-in + imperative retire). Initiative ready to archive after final review; durable behavior recorded in package **`AGENT.md`** files.

Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and recommended-order checkbox conventions.

## Purpose

Restore **authored prose delivery** for Feature and Knowledge after removing **`ComponentRender`** from imperative perception. Today, link / look paths read **`internalCache.RenderCache`** synchronously but **never kick** **`renderOrchestration`**, so catalogs are not hydrated and players see prose-free WML.

This plan covers **two phases** sufficient to replicate current (pre-migration) functionality:

1. **Phase A (core):** Generalize passive orchestration so **`Render Requested`** for **`FEATURE#`** / **`KNOWLEDGE#`** runs intake, authored catalog hydrate, and cache resolve (**`allowGeneration: false`** --- authored only).
2. **Phase B (delivery):** Wire **`PerceptionThreads`** + perception fan-in so UI kicks are **correlated** (register thread, kick render, deliver on **`Render Pertains`**) instead of sync-read-then-publish in **`perceptionMessage`**.

**Explicitly out of scope for this plan:**

- LLM slow-path generation for Feature / Knowledge
- State-change fan-out, passive refresh, or **current-room** coupling (F/K perspective is character + component vertical, not room stack)
- **`Meta::Feature`** / **`Meta::Knowledge`**

When this initiative ships, move lasting behavior notes into package **`AGENT.md`** files and delete or archive this plan.

## Problem (resolved)

| Layer | Room | Feature / Knowledge |
| --- | --- | --- |
| Ingress kick | **`sendRenderRequested`** + thread registration | **`sendActionAssessed`** **`LookComponent`** or **`Look Command Requested`** -> render orchestration |
| Orchestration | **`intakeRenderRequested`** -> **`ensureAuthoredCatalog`** -> **`findRender`** | Same pipeline; F/K intake with **`markState: { markValue: [] }`**, **`allowGeneration: false`** |
| Cache populate | Hydrate + exact match on resolve | Same; authored catalog hydrate on kick |
| Delivery | Correlated fan-in (**`roomDescription`**) or aligned imperative read | Correlated fan-in (**`featureDescription`** / **`knowledgeDescription`**) via [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) |

**Already general (reuse, do not re-build):**

- Dynamo / domain schema for **`FEATURE#`** / **`KNOWLEDGE#`** ([`renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md))
- **`ensureAuthoredCatalog`** + **`ComponentExamples.get`** for cache hosts
- **`ExampleInvalidated`** catalog bumps for F/K
- WML assembly helpers and D9 **`SITUATION#DEFAULT`** selection ([`selectDefaultSituationCacheRecord.ts`](../../../../lambda/ephemera/dataSource/renderCache/selectDefaultSituationCacheRecord.ts))

## Simplifying constraint (product + code)

Feature and Knowledge renders are **character-scoped call-and-response** events (link API, feature **`look`**), not room broadcast fan-outs. That means:

- **One** **`Render Requested`** per UI action with **`characterId`** (Knowledge **`directResponse`** still one logical request; delivery target may be **`SESSION#...`**)
- **One** computed **`perspective`** per kick --- no **`groupCharacterRowsByPerspective`**, no state fan-out **`S = A union P`**, no fallback "all occupants with this perspectiveKey"
- Perception threads can use **`targets: [characterId]`** (or session for knowledge direct-response) without room occupancy resolution

Phase A/B should **not** copy room header broadcast or state-change machinery.

## Perspective model (Feature / Knowledge --- decided)

F/K perspective is **not** derived from the viewer's current room. Room look uses **`resolveRoomAssetStackForRoom`** + canon filter because the **host component is a Room** and participation order is room-scoped. Feature and Knowledge hosts carry their own **import vertical** (`Meta::Import::...` under the universal key; see [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../../lambda/assets/dataSource/components/verticals/AGENT.md)).

**Normative rule for this pipeline:**

1. **Character-visible assets:** union of global/canon assets the lambda exposes to the character plus **`CharacterMeta.assets`** (same visibility inputs legacy **`ComponentRender`** used before filtering to appearances).
2. **Component participation set:** assets that define **`FEATURE#`** / **`KNOWLEDGE#`** per that component's **ComponentVertical** (import vertical hops for the universal identity).
3. **`mergeParticipationOrder` / `perspective.assetStack`:** **intersection** of (1) and (2), with **total order** from vertical / gateway participation-order rules --- **not** from **`RoomAssets`** or **`CharacterMeta.RoomId`**.

Knowledge (including guest / out-of-room UI) and in-room feature links both use this model. **View-as** uses the **viewing** character's asset visibility intersected with the target component vertical.

**Ephemera implementation note:** [`internalCache/index.ts`](../../../../lambda/ephemera/internalCache/index.ts) registers **`createImportVerticalMetaCacheHandler`** as **`ComponentVerticals`** (Phase A slice 2). F/K perspective reads vertical hops through that handler before computing intersection.

## Mark state (Feature / Knowledge --- decided)

F/K intake uses **`markState: { markValue: [] }`** for v1. Cache lookup and hydrate target D9 **`SITUATION#DEFAULT`** only ([`selectDefaultSituationCacheRecord`](../../../../lambda/ephemera/dataSource/renderCache/selectDefaultSituationCacheRecord.ts)); do **not** inherit **`Meta::Room.state.marks`** from the viewer's current room.

## Delivery correlation UX (decided)

Phase B fan-in mirrors **`roomDescription`** correlated behavior for **Generating** and **Error** (not terminal-only):

- **`Generation Started`** -> Generating placeholder **`PublishMessage`** (same **`messageId`** overwrite pattern as room description where applicable).
- **`Orchestration Error`** / **`Generation Deferred`** -> Error placeholder, then terminal dedupe rules aligned with room threads.
- **`Render Pertains`** -> terminal WML from **`cacheRecord.renderedContent`**.

Feature and Knowledge both ship in Phase B; re-enable **`KNOWLEDGE_PERCEPTION_ENABLED`** (or remove the flag) when correlated ingress replaces the imperative Knowledge path.

## Getting started

1. **Task planning framework** --- [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Pass-through semantics (rooms)** --- [`AGENT.passThrough.contract.planning.md`](AGENT.passThrough.contract.planning.md) (orchestration outbounds, **`Render Pertains`**, routing identity)
3. **Render orchestration (room baseline)** --- [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)
4. **Render cache domain** --- [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md)
5. **Perception delivery map** --- [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative) (correlated vs imperative)
6. **Component import vertical (perspective source for F/K)** --- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../../lambda/assets/dataSource/components/verticals/AGENT.md), [`packages/mtw-gateways/ts/assets/components/verticals/fetch.ts`](../../../../packages/mtw-gateways/ts/assets/components/verticals/fetch.ts)
7. **Room look reference (correlated delivery shape only --- not perspective)** --- [`requestFullRoomDescriptionForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts), [`handleLookCommandRequestedForRenderOrchestration.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts), [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts)
8. **Current imperative F/K read path** --- [`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts), [`featureKnowledgeRenderWmlFromCacheRecord.ts`](../../../../lambda/ephemera/dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts)
9. **Development commands** --- [`lambda/ephemera/dataSource/perception/AGENT.development.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.development.md)

## Target end state (this initiative only)

```text
Trusted UI look / link (F or K)
  -> executeAction or app.ts: sendActionAssessed { LookComponent, source: uiLook | link }
  -> mtw.ephemera.actions: kickCorrelatedComponentDescription (prepareFeatureKnowledgeRenderForCharacter)
  -> sendPerceptionThreadRegistered (featureDescription | knowledgeDescription)
  -> sendRenderRequested { componentId, perspective, characterId, allowGeneration: false }
  -> orchestrateRenderRequest
       -> intake (F/K branch; markState empty)
       -> ensureAuthoredCatalog (hydrate authored CACHE# rows)
       -> findRender (exact match / catalog pointer; no generateRoomPreview)
  -> renderCache: Render Pertains (or orchestration: Generating / Error on slow hydrate)
  -> perception orchestrate: Generating / Error / terminal PublishMessage (one target)
  -> imperative perceptionMessage F/K branches removed or gated off

Trusted UI look (room) and typed look/l: Action Assessed LookComponent (room) or Parse Requested LookRoom
  -> Look Command Requested -> renderOrchestration (roomDescription thread + orchestrateRenderRequest)
```

Delivery WML continues to use **`featureRenderChannelWmlForFeatureId`** / **`knowledgeRenderChannelWmlForKnowledgeId`** (**`SITUATION#DEFAULT`** only, D9).

## Open decisions (implementation --- plan only)

All FKR rows are **decided** for this initiative. Remove this section when choices are recorded in durable docs at ship time.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| FKR-1 | **Feature perspective:** character-visible assets **intersected** with **ComponentVertical**; **no current room** | Phase A perspective helper | **Decided** ([Perspective model](#perspective-model-feature--knowledge---decided)) |
| FKR-2 | **Knowledge perspective:** same as FKR-1 | Phase A perspective helper | **Decided** (same) |
| FKR-3 | **Mark state:** **`{ markValue: [] }`** (D9 DEFAULT v1 only) | Phase A intake branch | **Decided** ([Mark state](#mark-state-feature--knowledge---decided)) |
| FKR-4 | **Knowledge delivery:** re-enable **`KNOWLEDGE_PERCEPTION_ENABLED`** in Phase B with correlated pipeline | Phase B ingress | **Decided** |
| FKR-5 | **Correlated UX:** **Generating / Error** handling like **`roomDescription`**, not terminal-only | Phase B fan-in | **Decided** ([Delivery correlation UX](#delivery-correlation-ux-decided)) |

## Progress

| Area | State |
| --- | --- |
| Task plan created | Done |
| Open decisions FKR-1..5 (all decided) | Done |
| Phase A: type hygiene (`RenderComponentId`, orchestration guards) | Done |
| Phase A: perspective helper(s) | Done |
| Phase A: F/K intake branch in **`requestIntake`** | Done |
| Phase A: generalize **`findRender`** / resolve types off **`roomId`-only** | Done |
| Phase A: orchestration + cache integration tests for F/K host | Done |
| Phase B: **`PerceptionThreads`** kinds + register commands | Done |
| Phase B: **`orchestrate.ts`** fan-in for F/K | Done |
| Phase B: ingress kicks (Action Assessed trusted UI **`look`**, link API) | Done |
| Phase B: remove / gate imperative F/K paths in **`perceptionMessage`** | Done |
| Durable doc touch-up (perception + renderOrchestration delivery tables) | Done |

---

## Phase A --- Orchestration core (authored cache only)

**Goal:** A single **`orchestrateRenderRequest`** run for **`FEATURE#`** / **`KNOWLEDGE#`** hydrates the authored catalog and emits hit-path orchestration outbounds (**`Exact Match Found`** / **`Current Cache Valid`**) leading to **`Render Pertains`**. No LLM, no **`generateRoomPreview`**.

### Phase A --- Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **Type hygiene**
  - [X] Add **`EphemeraKnowledgeId`** to **`RenderComponentId`** in [`messageBus/baseClasses.ts`](../../../../lambda/ephemera/messageBus/baseClasses.ts).
  - [X] Extend orchestration published-event / ingress guards to accept **`KNOWLEDGE#`** (today: Room / Feature / Map in [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/publishedEvents.ts)).
  - [X] Rename **`RenderResolveInputSuccess.roomId`** -> **`componentId`** (or add alias + migrate call sites) in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/baseClasses.ts) and dependents.
- [X] **Perspective helper** --- new module under **`dataSource/renderOrchestration/`** or **`dataSource/actions/actionHandlers/`** (same *delivery wiring shape* as [`prepareFullRoomDescriptionRenderForCharacter`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts), **different perspective inputs** --- see [Perspective model](#perspective-model-feature--knowledge---decided)):
  - [X] **`prepareFeatureKnowledgeRenderForCharacter(characterId, componentId)`** returns `{ componentId, characterId, perspective, perspectiveKey, threadRegisterCommand, renderCommand }`.
  - [X] Load character-visible asset ids; load **ComponentVertical** hops for **`componentId`**; compute intersected **`mergeParticipationOrder`**; **`computePerspectiveKey`**.
  - [X] Wire or call real vertical reads (replace ephemera **`ComponentVerticals` stub** for this path if needed).
  - [X] Unit tests: mocked **`CharacterMeta`**, **`Global.get('assets')`**, vertical hops --- no **`RoomId`** / **`RoomAssets`** dependency.
- [X] **Intake branch** --- [`requestIntake.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts):
  - [X] Accept **`FEATURE#`** and **`KNOWLEDGE#`** (remove **`RENDER_REQUESTED_NOT_ROOM`** for these ids).
  - [X] Do **not** load **`Meta::Room`** on the feature/knowledge id itself.
  - [X] Set **`markState: { markValue: [] }`** (FKR-3); set **`allowGeneration: false`** (always forced for F/K).
  - [X] Resolve **`pointerHint`** via catalog row only ([`resolvePerspectivePointer`](../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts) --- already host-agnostic); skip legacy **`Meta::Room.currentCacheByPerspective`** for non-room hosts.
  - [X] Update [`requestIntake.test.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.test.ts) and [`orchestrationHandler.test.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) (replace "NOT_ROOM for FEATURE" expectations with success paths).
- [X] **`findRender` / handler wiring**
  - [X] Generalize dependency types (`getExactMatch`, `getCacheRecordById`, `clearPerspectivePointer`) from **`EphemeraRoomId`** to **`EphemeraCacheComponentId`** where still room-typed.
  - [X] Confirm slow path never runs for F/K (**`allowGeneration: false`** -> **`Generation Deferred`** on miss after hydrate; Phase B fan-in delivers Error per FKR-5).
- [X] **Integration test**
  - [X] Extend or add test chaining **`orchestrateRenderRequest`** (F/K **`componentId`**) -> **`renderCache`** subscriber -> authored **`CACHE#`** row + **`Render Pertains`** (pattern: [`passThroughOrchestrationToCache.integration.test.ts`](../../../../lambda/ephemera/dataSource/passThroughOrchestrationToCache.integration.test.ts)).
- [X] **Phase A verification** (see **Verification** below) and update **Progress** / checkboxes.

---

## Phase B --- PerceptionThreads + delivery wiring

**Goal:** Link API and trusted UI **`look`** use the **correlated** pipeline (register thread, kick render, deliver on **`Render Pertains`**). Remove the broken sync-read path from steady-state ingress.

**Reference shape:** Trusted UI component looks (room + Feature/Knowledge) route through **`Action Assessed`** -> **`mtw.ephemera.actions`** (same thin-ingress pattern as UI **`move`** / **`home`**). Parsed bare **`look` / `l`** remains **`Parse Requested`** -> **`LookRoom`** -> **`Look Command Requested`** (character's current room, not a trusted **`EphemeraId`**). Room assessed **`look`** converges on existing **`Look Command Requested`** / renderOrchestration handling; Feature/Knowledge assessed **`look`** uses [`prepareFeatureKnowledgeRenderForCharacter`](../../../../lambda/ephemera/dataSource/renderOrchestration/prepareFeatureKnowledgeRenderForCharacter.ts) + shared kick helper in actions. Delivery fan-in: [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) **`featureDescription`** / **`knowledgeDescription`** / **`roomDescription`**.

F/K threads are **simpler** than room description: single viewer, no multi-target fallback, no header vs full split. **Generating / Error** correlation follows **`roomDescription`** (FKR-5).

### Phase B --- Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **`PerceptionThreads` model** --- [`perceptionThreads.ts`](../../../../lambda/ephemera/internalCache/perceptionThreads.ts), [`localApiEvents.ts`](../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts):
  - [X] Add **`threadKind: 'featureDescription'`** and **`threadKind: 'knowledgeDescription'`** register commands.
  - [X] Fields: **`componentId`** (**`FEATURE#`** / **`KNOWLEDGE#`**), **`perspectiveKey`**, **`characterId`**, optional **`messageGroupId`**, optional **`directResponse`** / session targeting for knowledge.
  - [X] Guards, patch keys, **`register`** / **`update`** branches (mirror **`roomDescription`** simplicity).
  - [X] Unit tests in [`perceptionThreads.test.ts`](../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts).
- [X] **Fan-in** --- [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (mirror **`roomDescription`** Generating / Error / terminal --- [Delivery correlation UX](#delivery-correlation-ux-decided)):
  - [X] Match **`(componentId, perspectiveKey)`** buckets for new thread kinds on **`Render Pertains`**, **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**.
  - [X] **Generating / Error placeholders** for Feature and Knowledge (new placeholder WML helpers or reuse minimal component-shaped placeholders; align **`messageId`** / **`createdTime`** overwrite with room description).
  - [X] Terminal **`PublishMessage`**: build WML via [`featureKnowledgeRenderWmlFromCacheRecord.ts`](../../../../lambda/ephemera/dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts) from **`cacheRecord.renderedContent`** (not partition **`get`**).
  - [X] Targets: **`[characterId]`**; knowledge **`directResponse`** -> **`SESSION#...`** when applicable ([`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts) today).
  - [X] **`metaData`:** **`componentUUID`**, no **`roomChannel`** (not room multi-channel).
  - [X] Terminal dedupe: same **`componentId + perspectiveKey`** terminal skip as room threads.
  - [X] Tests in [`orchestrate.featureKnowledgeStreams.test.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.featureKnowledgeStreams.test.ts).
- [X] **Ingress kicks** (trusted UI **`look`** + link API via **Action Assessed**; handling in **`mtw.ephemera.actions`**)
  - [X] **Contract:** extend **`ActionAssessedOutcome`** in [`localApiEvents.ts`](../../../../lambda/ephemera/dataSource/localApiEvents.ts) with **`LookComponent`** (`componentId`, optional **`directResponse`** for Knowledge); extend **`isActionAssessedCommand`** and **`source`** (e.g. **`uiLook`**). [`parse/executeAction.ts`](../../../../lambda/ephemera/parse/executeAction.ts) **`case 'look'`** emits **`sendActionAssessed`** only --- no direct render/perception kicks (align with **`move`** / **`home`**); remove direct call to [`requestFullRoomDescriptionForCharacter`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts) from **`executeAction`**.
  - [X] **Actions handler:** in [`actions/index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts) **`processAssessedParseResult`** / **`publishStreamEventsForIntent`**, branch **`LookComponent`**:
    - [X] **Room (`ROOM#`):** stream **`Look Command Requested`** (reuse existing payload + [`handleLookCommandRequestedForRenderOrchestration`](../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts)) so typed **`LookRoom`** and assessed UI room **`look`** share one renderOrchestration path.
    - [X] **Feature / Knowledge:** same **`Look Command Requested`** stream; render orchestration handler branches F/K via [`prepareFeatureKnowledgeRenderForCharacter`](../../../../lambda/ephemera/dataSource/renderOrchestration/prepareFeatureKnowledgeRenderForCharacter.ts) (in-DS register + orchestrate; not a bus kick from actions).
  - [X] **Generalized `Look Command Requested` payload** (`componentId` + optional **`directResponse`**); render orchestration owns correlated kicks for room + F/K (deviation from original "kick helper in actions" draft).
  - [X] **`app.ts`** link API: **`sendActionAssessed`** **`LookComponent`** (`source: link`) for Feature/Knowledge --- same actions path as UI **`look`**.
  - [X] **Tests:** [`executeAction.test.ts`](../../../../lambda/ephemera/parse/executeAction.test.ts) (look -> assessed only); [`actions/index.test.ts`](../../../../lambda/ephemera/dataSource/actions/index.test.ts) (assessed **`LookComponent`** room + F/K); link-path tests in [`app.test.ts`](../../../../lambda/ephemera/app.test.ts).
- [X] **Retire imperative steady-state path**
  - [X] Gate or remove Feature / Knowledge branches in [`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts) (keep until ingress migrated; then delete or assert-unreachable).
  - [X] **Re-enable Knowledge:** set **`KNOWLEDGE_PERCEPTION_ENABLED = true`** (or remove flag) once correlated ingress is wired (FKR-4). **Shipped:** flag and imperative branches **removed**; correlated pipeline is steady state.
  - [X] Update [`perception/index.test.ts`](../../../../lambda/ephemera/perception/index.test.ts).
- [X] **Delivery table docs** --- update [`perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative) correlated vs imperative rows for Feature / Knowledge; note trusted UI **`look`** vs typed **`LookRoom`** in [`actions/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.md).
- [X] **Phase B verification** (see **Verification** below) and update **Progress** / checkboxes.

---

## Verification

From [`lambda/ephemera/`](../../../../lambda/ephemera/) (command authority: [`perception/AGENT.development.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.development.md)):

```bash
cd lambda/ephemera

# Baseline before edits
npm test

# Phase A --- orchestration + cache
npx jest dataSource/renderOrchestration/requestIntake.test.ts --runInBand
npx jest dataSource/renderOrchestration/orchestrationHandler.test.ts --runInBand
npx jest dataSource/renderOrchestration/findRender.test.ts --runInBand
npx jest dataSource/passThroughOrchestrationToCache.integration.test.ts --runInBand
npx jest dataSource/renderCache/authoredCatalogHydrateExactMatch.test.ts --runInBand

# Phase B --- perception + ingress
npx jest dataSource/perception/ --runInBand
npx jest internalCache/perceptionThreads.test.ts --runInBand
npx jest dataSource/actions/index.test.ts --runInBand
npx jest perception/index.test.ts --runInBand
npx jest parse/executeAction.test.ts --runInBand
```

**Grep spot-checks after Phase A:**

- No unconditional **`RENDER_REQUESTED_NOT_ROOM`** for **`FEATURE#`** / **`KNOWLEDGE#`** in intake success paths
- **`prepareFeatureKnowledgeRenderForCharacter`** (or chosen name) referenced from tests
- F/K orchestration test asserts **`Exact Match Found`** or **`Current Cache Valid`** -> **`Render Pertains`**

**Grep spot-checks after Phase B:**

- Trusted UI **`look`** (room + Feature/Knowledge) and link API use **`sendActionAssessed`** **`LookComponent`** or shared kick helper in **`mtw.ephemera.actions`** (not imperative **`Perception`** / direct **`executeAction`** render kicks)
- **`orchestrate.ts`** handles **`featureDescription`** / **`knowledgeDescription`**
- Steady-state Feature delivery does **not** rely on sync-only **`RenderCache.get`** in **`perceptionMessage`**

**Manual smoke (when wired):**

- Character in room with authored Feature situation facet -> link click shows prose (not empty **`<Feature>`**).
- Same for Knowledge (link API + guest Knowledge UI).
- Slow hydrate path: Generating placeholder visible before terminal prose (FKR-5).

---

## Related links

| Doc | Role |
| --- | --- |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Parent epic |
| [`AGENT.passThrough.contract.planning.md`](AGENT.passThrough.contract.planning.md) | Pass-through contract (Feature "resolve on read" note) |
| [`renderOrchestration/AGENT.planning.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) | Tier 3 generalization beyond rooms (deferred) |
| [`internalCache/componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md) | F/K no longer use ComponentRender for perception |

## When this plan finishes

1. Record shipped decisions in **`perception/AGENT.md`**, **`renderOrchestration/AGENT.md`**, and **`perception/AGENT.md`** delivery-path table (not in this file).
2. Remove resolved rows from **Open decisions**.
3. Delete or archive this task plan (git retains history).
