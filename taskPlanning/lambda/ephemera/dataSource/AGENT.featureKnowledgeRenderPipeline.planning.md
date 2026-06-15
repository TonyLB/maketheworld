# Feature / Knowledge render pipeline (orchestration + perception delivery)

**Status:** Phase A slice 1 (type hygiene) done. **Next step:** Phase A slice 2 --- perspective helper (`prepareFeatureKnowledgeRenderForCharacter`).

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

## Problem (current gap)

| Layer | Room (working) | Feature / Knowledge (broken) |
| --- | --- | --- |
| Ingress kick | **`sendRenderRequested`** + thread registration | Link API / feature **`look`** -> imperative **`Perception`** only |
| Orchestration | **`intakeRenderRequested`** -> **`ensureAuthoredCatalog`** -> **`findRender`** | Intake **rejects** non-room ids (`RENDER_REQUESTED_NOT_ROOM`) |
| Cache populate | Hydrate + exact match on resolve | Never runs |
| Delivery | Correlated fan-in (**`roomDescription`**) or aligned imperative read | Sync **`RenderCache.get`** -> often empty -> [`featureKnowledgeRenderWmlFromCacheRecord.ts`](../../../../lambda/ephemera/dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts) prose-free |

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

**Ephemera implementation note:** [`internalCache/index.ts`](../../../../lambda/ephemera/internalCache/index.ts) currently registers a **`ComponentVerticals` empty-hops stub** for aggregate slice shape only. Phase A perspective work should **replace or bypass the stub** for F/K resolve --- e.g. register **`createImportVerticalMetaCacheHandler`** (**`queryImportVerticalMeta`** on **`assetDB`**) or a dedicated helper that loads vertical hops before computing intersection. Do **not** reuse **`filterRoomCanonStackByCharacterAssets`** / **`resolveRoomAssetStackForRoom`** on this path.

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
Link / look (F or K)
  -> prepareFeatureKnowledgeRenderForCharacter(characterId, componentId)
  -> sendPerceptionThreadRegistered (featureDescription | knowledgeDescription)
  -> sendRenderRequested { componentId, perspective, characterId, allowGeneration: false }
  -> orchestrateRenderRequest
       -> intake (F/K branch; markState empty)
       -> ensureAuthoredCatalog (hydrate authored CACHE# rows)
       -> findRender (exact match / catalog pointer; no generateRoomPreview)
  -> renderCache: Render Pertains (or orchestration: Generating / Error on slow hydrate)
  -> perception orchestrate: Generating / Error / terminal PublishMessage (one target)
  -> imperative perceptionMessage F/K branches removed or gated off
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
| Phase A: perspective helper(s) | |
| Phase A: F/K intake branch in **`requestIntake`** | |
| Phase A: generalize **`findRender`** / resolve types off **`roomId`-only** | |
| Phase A: orchestration + cache integration tests for F/K host | |
| Phase B: **`PerceptionThreads`** kinds + register commands | |
| Phase B: **`orchestrate.ts`** fan-in for F/K | |
| Phase B: ingress kicks (link API, feature **`look`**) | |
| Phase B: remove / gate imperative F/K paths in **`perceptionMessage`** | |
| Durable doc touch-up (perception + renderOrchestration delivery tables) | |

---

## Phase A --- Orchestration core (authored cache only)

**Goal:** A single **`orchestrateRenderRequest`** run for **`FEATURE#`** / **`KNOWLEDGE#`** hydrates the authored catalog and emits hit-path orchestration outbounds (**`Exact Match Found`** / **`Current Cache Valid`**) leading to **`Render Pertains`**. No LLM, no **`generateRoomPreview`**.

### Phase A --- Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **Type hygiene**
  - [X] Add **`EphemeraKnowledgeId`** to **`RenderComponentId`** in [`messageBus/baseClasses.ts`](../../../../lambda/ephemera/messageBus/baseClasses.ts).
  - [X] Extend orchestration published-event / ingress guards to accept **`KNOWLEDGE#`** (today: Room / Feature / Map in [`publishedEvents.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/publishedEvents.ts)).
  - [X] Rename **`RenderResolveInputSuccess.roomId`** -> **`componentId`** (or add alias + migrate call sites) in [`baseClasses.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/baseClasses.ts) and dependents.
- [ ] **Perspective helper** --- new module under **`dataSource/renderOrchestration/`** or **`dataSource/actions/actionHandlers/`** (same *delivery wiring shape* as [`prepareFullRoomDescriptionRenderForCharacter`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts), **different perspective inputs** --- see [Perspective model](#perspective-model-feature--knowledge---decided)):
  - [ ] **`prepareFeatureKnowledgeRenderForCharacter(characterId, componentId)`** returns `{ componentId, characterId, perspective, perspectiveKey, threadRegisterCommand, renderCommand }`.
  - [ ] Load character-visible asset ids; load **ComponentVertical** hops for **`componentId`**; compute intersected **`mergeParticipationOrder`**; **`computePerspectiveKey`**.
  - [ ] Wire or call real vertical reads (replace ephemera **`ComponentVerticals` stub** for this path if needed).
  - [ ] Unit tests: mocked **`CharacterMeta`**, **`Global.get('assets')`**, vertical hops --- no **`RoomId`** / **`RoomAssets`** dependency.
- [ ] **Intake branch** --- [`requestIntake.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts):
  - [ ] Accept **`FEATURE#`** and **`KNOWLEDGE#`** (remove **`RENDER_REQUESTED_NOT_ROOM`** for these ids).
  - [ ] Do **not** load **`Meta::Room`** on the feature/knowledge id itself.
  - [ ] Set **`markState: { markValue: [] }`** (FKR-3); set **`allowGeneration: false`** (override ingress unless explicitly passed).
  - [ ] Resolve **`pointerHint`** via catalog row only ([`resolvePerspectivePointer`](../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts) --- already host-agnostic); skip legacy **`Meta::Room.currentCacheByPerspective`** for non-room hosts.
  - [ ] Update [`requestIntake.test.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.test.ts) and [`orchestrationHandler.test.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) (replace "NOT_ROOM for FEATURE" expectations with success paths).
- [ ] **`findRender` / handler wiring**
  - [ ] Generalize dependency types (`getExactMatch`, `getCacheRecordById`, `clearPerspectivePointer`) from **`EphemeraRoomId`** to **`EphemeraCacheComponentId`** where still room-typed.
  - [ ] Confirm slow path never runs for F/K (**`allowGeneration: false`** -> **`Generation Deferred`** on miss after hydrate; Phase B fan-in delivers Error per FKR-5).
- [ ] **Integration test**
  - [ ] Extend or add test chaining **`orchestrateRenderRequest`** (F/K **`componentId`**) -> **`renderCache`** subscriber -> authored **`CACHE#`** row + **`Render Pertains`** (pattern: [`passThroughOrchestrationToCache.integration.test.ts`](../../../../lambda/ephemera/dataSource/passThroughOrchestrationToCache.integration.test.ts)).
- [ ] **Phase A verification** (see **Verification** below) and update **Progress** / checkboxes.

---

## Phase B --- PerceptionThreads + delivery wiring

**Goal:** Link API and feature **`look`** use the **correlated** pipeline (register thread, kick render, deliver on **`Render Pertains`**). Remove the broken sync-read path from steady-state ingress.

**Reference shape:** Room **`look`** --- [`requestFullRoomDescriptionForCharacter`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts) + [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) **`roomDescription`** handling.

F/K threads are **simpler** than room description: single viewer, no multi-target fallback, no header vs full split. **Generating / Error** correlation follows **`roomDescription`** (FKR-5).

### Phase B --- Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [ ] **`PerceptionThreads` model** --- [`perceptionThreads.ts`](../../../../lambda/ephemera/internalCache/perceptionThreads.ts), [`localApiEvents.ts`](../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts):
  - [ ] Add **`threadKind: 'featureDescription'`** and **`threadKind: 'knowledgeDescription'`** register commands.
  - [ ] Fields: **`componentId`** (**`FEATURE#`** / **`KNOWLEDGE#`**), **`perspectiveKey`**, **`characterId`**, optional **`messageGroupId`**, optional **`directResponse`** / session targeting for knowledge.
  - [ ] Guards, patch keys, **`register`** / **`update`** branches (mirror **`roomDescription`** simplicity).
  - [ ] Unit tests in [`perceptionThreads.test.ts`](../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts).
- [ ] **Fan-in** --- [`orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (mirror **`roomDescription`** Generating / Error / terminal --- [Delivery correlation UX](#delivery-correlation-ux-decided)):
  - [ ] Match **`(componentId, perspectiveKey)`** buckets for new thread kinds on **`Render Pertains`**, **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**.
  - [ ] **Generating / Error placeholders** for Feature and Knowledge (new placeholder WML helpers or reuse minimal component-shaped placeholders; align **`messageId`** / **`createdTime`** overwrite with room description).
  - [ ] Terminal **`PublishMessage`**: build WML via [`featureKnowledgeRenderWmlFromCacheRecord.ts`](../../../../lambda/ephemera/dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts) from **`cacheRecord.renderedContent`** (not partition **`get`**).
  - [ ] Targets: **`[characterId]`**; knowledge **`directResponse`** -> **`SESSION#...`** when applicable ([`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts) today).
  - [ ] **`metaData`:** **`componentUUID`**, no **`roomChannel`** (not room multi-channel).
  - [ ] Terminal dedupe: same **`componentId + perspectiveKey`** terminal skip as room threads.
  - [ ] Tests in [`orchestrate.test.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.test.ts) (or new focused file).
- [ ] **Ingress kicks**
  - [ ] **`app.ts`** link API: replace direct **`Perception`** publish for **Feature and Knowledge** with **`sendPerceptionThreadRegistered`** + **`sendRenderRequested`** using Phase A helper.
  - [ ] **`parse/executeAction.ts`** feature **`look`**: same pattern (room **`look`** already uses room path; non-room **`look`** today goes to imperative **`Perception`**).
  - [ ] Optional thin wrapper **`requestFeatureKnowledgeDescriptionForCharacter`** (mirror **`requestFullRoomDescriptionForCharacter`**) exported for tests and ingress.
  - [ ] Update [`executeAction.test.ts`](../../../../lambda/ephemera/parse/executeAction.test.ts), link-path tests as they exist.
- [ ] **Retire imperative steady-state path**
  - [ ] Gate or remove Feature / Knowledge branches in [`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts) (keep until ingress migrated; then delete or assert-unreachable).
  - [ ] **Re-enable Knowledge:** set **`KNOWLEDGE_PERCEPTION_ENABLED = true`** (or remove flag) once correlated ingress is wired (FKR-4).
  - [ ] Update [`perception/index.test.ts`](../../../../lambda/ephemera/perception/index.test.ts).
- [ ] **Delivery table docs** --- update [`perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative) correlated vs imperative rows for Feature / Knowledge.
- [ ] **Phase B verification** (see **Verification** below) and update **Progress** / checkboxes.

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
npx jest perception/index.test.ts --runInBand
npx jest parse/executeAction.test.ts --runInBand
```

**Grep spot-checks after Phase A:**

- No unconditional **`RENDER_REQUESTED_NOT_ROOM`** for **`FEATURE#`** / **`KNOWLEDGE#`** in intake success paths
- **`prepareFeatureKnowledgeRenderForCharacter`** (or chosen name) referenced from tests
- F/K orchestration test asserts **`Exact Match Found`** or **`Current Cache Valid`** -> **`Render Pertains`**

**Grep spot-checks after Phase B:**

- Link API / feature **`look`** use **`sendRenderRequested`** + **`sendPerceptionThreadRegistered`**
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
