# Feature and Knowledge: Situation facets and Example retirement

**Status:** Phase 0 complete (2026-05-18). Phase 1 WML storage complete (2026-05-18). Phase 2 may proceed. **Pre-flight decisions confirmed** (see [Decisions](#decisions)). Room **`examples`** removal is **complete**. This initiative migrates **`StandardFeature`** and **`StandardKnowledge`** to situation facets + ephemera **`render`**, then retires **`<Example>`**. **No production data migration:** extant database has no Feature/Knowledge/Example content to convert.

This file is task-scoped and temporary. See [`taskPlanning/AGENT.md`](../../../AGENT.md) for task-plan conventions.

## Purpose and target architecture

### Problem (legacy model)

**`Example`** conflates two concerns:

1. **World-state slice** (Mark facets on the Example component)
2. **Parent-specific prose** (DisplayName / Summary / Description on the Example)

**Room** already split these: **`Situation`** holds marks only; **`Room.situations`** (`SituationProseFacetList`) holds prose keyed by Situation reference. **Feature** and **Knowledge** now use the same **`situations`** facet pattern (Phase 1, 2026-05-18); lambdas and client still reference legacy **`examples`** until Phases 2-3.

### Target (steady state)

| Layer | Feature / Knowledge |
| --- | --- |
| **Storage** | **`situations: Situation*FacetList`** on the parent (homogeneous facet list, same pattern as Room). Each facet references a **`Situation`** and carries a **payload** (prose for that parent in that state). |
| **DEFAULT v1** | **`SITUATION#DEFAULT`** only: sole facet authored in Workbench, sole facet used for **render** / playing UI. Non-DEFAULT situation facets on F/K (list UI, layered tabs, multi-facet consumption) are **out of scope** until a later initiative. |
| **Situation entity** | **`Situation`** is an independent WML component (like any other); it is **not owned** by Room/Feature/Knowledge that reference it via facets (**D8**). |
| **Marks** | Live on **`Situation`** components, not on Example children. |
| **Example tag** | **Removed** in code cleanup (Phase 4); no asset conversion required (**D3**, **D4**). **`StandardExample`** may remain temporarily in TypeScript to ease incremental refactors (**D6**). |
| **Deferred** | Non-DEFAULT F/K facet authoring UI; Lens / Guidance on F/K; multi-facet render by **`markState`**; per-perspective Knowledge facets (**D9**). |

**Why DEFAULT-only rendering is acceptable now:** Consumption already behaves that way. Ephemera **`ComponentRender`** and **`ComponentDescription`** use a **first-example** path, not mark matching. Committing to DEFAULT matches today's behavior while storage becomes future-proof.

### Payload shape (v1)

See **D2** in [Decisions](#decisions): **shared SituationRoomFacetPayload-shaped triplet** for Feature and Knowledge asset facets and (with **D1**) ephemera **`render`**.

**Knowledge / character viewpoints:** See **D9**; **`perspectiveId`** on cache rows remains separate from Situation facets.

## Decisions

**Confirmed** 2026-05-18. Do not reopen without explicit product review.

| # | Question | Resolution | Status |
| --- | --- | --- | --- |
| D1 | Ephemera / perception wire shape | **Mirror Room:** **`render`** on Feature/Knowledge in **`ephemeraWire`** (**`SituationRoomFacetPayloadType`** shape); **`ComponentRender`** uses **renderCache** only; no synthetic **`EXAMPLE#rendered`**; playing UI reads **`render`** then DEFAULT asset facet fallback. | **Confirmed** |
| D2 | Facet payload type | **Shared prose triplet** for Feature and Knowledge (reuse **`SituationRoomFacetPayload`** / shared alias). Summary in model; UI may omit Summary field. | **Confirmed** |
| D3 | Multi-Example **data** migration | **Not required.** Extant database has been stripped of all Features and Knowledge; no legacy Examples to preserve or collapse. | **Confirmed (N/A)** |
| D4 | Standalone **`<Example>`** in production data | **Not required** (no Examples in database). Phase 4 still **removes** Example from schema, selector, and editors; no bulk conversion script. | **Confirmed (N/A)** |
| D5 | Authoring UX (v1) | **DEFAULT inline editor only** on Feature/Knowledge editors (generalize **`DefaultRenderEditor`** / **`SituationFacetRenderFieldsEditor`**). **No** non-DEFAULT situation facet list, **no** layered SituationFacet tabs on F/K until consumption supports more than DEFAULT. | **Confirmed** |
| D6 | Dual-read **`examples`** in **`fromSchema`** | **No.** Nothing in production to read. New WML uses **`situations`** only on **`toJSON`**. **`StandardExample`** / **`<Example>`** may remain in the codebase temporarily to ease TypeScript migration; do **not** implement Example-to-facet parse mapping. | **Confirmed** |
| D7 | Missing DEFAULT facet / empty prose | **Same as Room:** **`createOnEdit` / `removeWhenEmpty`**; playing UI safe defaults (**Unknown** / empty description). | **Confirmed** |
| D8 | Sharing **Situation** across parents | **Allowed.** Situations are **independent** WML entities, not owned by components that reference them via facets. Document; no cross-parent validator in v1. | **Confirmed** |
| D9 | Non-DEFAULT / per-perspective facets | **Out of scope.** Straight DEFAULT-only simplification for this initiative. No differentiated Knowledge facets; multi-situation Feature behavior deferred entirely. **`perspectiveId`** on cache unchanged. | **Confirmed** |

### D1 detail (implementation)

Today Feature/Knowledge perception builds a **`StandardForm`** with a fake **`EXAMPLE#rendered`** child ([`componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts)); Room uses **`render`** from cache.

**Phase 2:** extend **`StandardFeatureData` / `StandardKnowledgeData`** wire serialization; **`situationFacetToCacheShape`** + parent **Updated** branch in **`componentExamples`**; **`ComponentRender`** F/K uses **renderCache** + shared payload mapper.

### Implementation gap (not a product fork)

**`componentExamples`** parent **Updated** / **Removed** on Feature/Knowledge with **`situations`** mirrors Room (2026-05-18). Filter/enrichment on **`situations`** shipped (2026-05-19). Situation-component fan-out via **`getParentIdsForSituation`** and Example path gated on non-empty **`parentIds`** shipped (2026-05-19). Remaining Phase 2 gap: ephemera **`render`** / **`componentRender`** for F/K (**D1**, line 235).

### Pre-flight checklist

- [X] **D1** wire shape -- **Confirmed** (mirror Room)
- [X] **D2** payload -- **Confirmed** (shared triplet)
- [X] **D3** / **D4** production data migration -- **N/A** (empty DB)
- [X] **D5** authoring UX -- **Confirmed** (DEFAULT inline editor only)
- [X] **D6** dual-read -- **Confirmed** (no; TS may keep Example types temporarily)
- [X] **D7** empty DEFAULT -- **Confirmed**
- [X] **D8** / **D9** -- **Confirmed**

**Gate:** Phase 1 may proceed.

### Out of scope (this initiative)

- Non-DEFAULT situation facet list / layered SituationFacet editor on Feature/Knowledge (**D5**).
- Production asset or database migration scripts (**D3**, **D4**).
- **`fromSchema`** dual-read of legacy **`<Example>`** under F/K (**D6**).
- Lens / Guidance on F/K; multi-facet render selection; per-perspective Knowledge facets (**D9**).
- Renaming **`ExampleAdded`** wire events (optional later).

## Current codebase (as of plan refresh)

### WML (`packages/mtw-wml`)

| Component | `examples` | `situations` | Notes |
| --- | --- | --- | --- |
| **Room** | No serialized field; legacy inline **`ref={0}`** Example only for merge/subset | **`SituationProseFacetList`** | Wire prose via **`render`** / **`<Render>`** (`ephemeraWire`). Tests use **`<Situation uuid=(DEFAULT)>`**. |
| **Feature** | *Removed (Phase 1)* | **`SituationProseFacetList`** | [`feature.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.ts); **D6** no Example dual-read |
| **Knowledge** | *Removed (Phase 1)* | **`SituationProseFacetList`** | [`knowledge.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.ts); shared payload in [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) |
| **Situation** | N/A | N/A | Marks-only component ([`situation.ts`](../../../../packages/mtw-wml/ts/standardize/components/situation.ts)) |
| **Example** | N/A | N/A | Still first-class for marks ([`example.ts`](../../../../packages/mtw-wml/ts/standardize/components/example.ts)); not F/K prose parent |

**Naming:** Canonical types are **`SituationProseFacet*`**; **`SituationRoomFacet*`** names are deprecated aliases in [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts).

### Assets lambda (`lambda/assets/componentExamples`)

- **Room:** **`Component Updated` / `Removed`** on Room with non-empty **`situations`** emits **`ExampleUpdated` / `ExampleRemoved`** per facet (**`exampleId` = Situation uuid**), **`situationFacetToCacheShape`**, optional lens marks ([`index.ts`](../../../../lambda/assets/componentExamples/index.ts)). Room is **not** in **`isExampleAssociatedComponent`** for the Example-component path.
- **Feature / Knowledge:** Parent **Updated** / **Removed** with **`situations`** mirrors Room ([`index.ts`](../../../../lambda/assets/componentExamples/index.ts) **`emitParentSituationFacetEvents`**; 2026-05-18). **Situation** component **Updated** / **Removed** fans out to facet parents via **`getParentIdsForSituation`** (2026-05-19). Standalone **Example** path does not discover F/K parents; events publish only when **`parentIds`** is non-empty (marks-only interim until Phase 4).
- **Target (remaining):** Ephemera **`render`** / **`componentRender`** for F/K (**D1**, line 235).

### Ephemera lambda

- **Room prose:** **`renderCache`** only; **`ComponentRender`** does not call **`ExamplesData`** for Room ([`componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md)).
- **Feature / Knowledge:** **`ExamplesData`** + naive **`examples[0]`** in **`ComponentRender`**; cache rows may use **`authoredExampleId`** (Example uuid) or **`situationId`** ([`componentExamples.ts`](../../../../lambda/ephemera/dataSource/componentExamples.ts) already branches on id type).
- **Target:** Feature/Knowledge mirror Room's facet-driven **`componentExamples`** -> **`renderCache`** path; DEFAULT facet only for v1 display selection.

### Client (`charcoal-client`)

| Area | Room (done) | Feature / Knowledge (legacy) |
| --- | --- | --- |
| Editor | **`RoomEditor`**: **`DefaultRenderEditor`**, situation facet list (non-DEFAULT), Guidance refs | **`FeatureEditor` / `KnowledgeEditor`**: **`examples`** **`ReferenceListEditor`**, navigate to **`ExampleEditor`** |
| Layered tabs | Situation / Guidance via **`layeredContextUtils`** | Example siblings via **`parent.examples`** |
| Playing UI | **`RoomDescription`**: **`render`**, then situation facets | **`ComponentDescription`**: first **`StandardExample`** via **`examples.payload[0]`** |
| Primitives | **`assureDefaultSituationFromPrimitives`** (**`SITUATION#DEFAULT`**) | Should reuse for new situation facets |

Reuse **`SituationFacetRenderFieldsEditor`** and a generalized **`DefaultRenderEditor`** for F/K (**D5**). Do **not** port Room's non-DEFAULT situation list or SituationFacet layered tabs to F/K in this initiative.

### Related iteration doc

[`packages/mtw-wml/ts/AGENT.exampleIteration.planning.md`](../../../../packages/mtw-wml/ts/AGENT.exampleIteration.planning.md) Phases 1-5.x for Room/Situation are largely **done**; Phase 2 explicitly **deferred Feature/Knowledge** facet lists. This plan is the follow-up. Phase 6 (Example deprecation) becomes the **final slice here**, not a separate optional cleanup.

## Durable context (read first)

- WML steady-state model: [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md) (**CRITICAL (Feature and Knowledge)**, **Room vs nested Example**).
- Standard components: [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md), [`AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardRoom** vs Feature/Knowledge).
- Facets: [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md).
- Assets pipeline: [`lambda/assets/componentExamples/AGENT.md`](../../../../lambda/assets/componentExamples/AGENT.md).
- Ephemera examples cache (legacy F/K path): [`lambda/ephemera/internalCache/examples.AGENT.md`](../../../../lambda/ephemera/internalCache/examples.AGENT.md).
- Ephemera component render: [`lambda/ephemera/internalCache/componentRender.AGENT.md`](../../../../lambda/ephemera/internalCache/componentRender.AGENT.md).
- Workbench patterns: [`charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md).

## Out of scope (separate initiatives)

- **Guidance** and **Lens** on Feature/Knowledge ([`AGENT.rendering.development.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.rendering.development.md) roadmap).
- **Multi-situation** render selection and LLM interpolation beyond DEFAULT.
- **Map** situation facets (future **`SituationMapFacetList`** in iteration notes).
- Renaming wire events **`ExampleAdded`** / **`ExampleUpdated`** (optional; payloads already accept Situation ids for Room).

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 0 | Code inventory and baseline | Complete (2026-05-18) | Call sites confirmed; baseline greps recorded below |
| 1 | WML: facet types + Feature/Knowledge `situations` | Complete (2026-05-18) | **`SituationProseFacet*`**; **D6** no Example dual-read under F/K |
| 2 | Assets + ephemera: facet-driven cache for F/K | Pending | **D1** render + renderCache; parent **Updated** branch |
| 3 | Client: DEFAULT editor + playing UI | Pending | **D5** inline DEFAULT only; **D1** **`ComponentDescription`** |
| 4 | Remove **`<Example>`** from product surface | Pending | Schema/editors/factory cleanup; tests updated; **D3/D4 N/A** |
| -- | Deferred: constellation / Guidance / Lens on F/K | -- | After steady-state DEFAULT path ships |

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) (durability ladder, checkbox conventions).
2. Read **Durable context** links above (especially **`packages/mtw-wml/ts/AGENT.md`** and **`componentExamples/AGENT.md`**).
3. Skim Room implementation: [`room.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.ts), [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts), [`lambda/assets/componentExamples/index.ts`](../../../../lambda/assets/componentExamples/index.ts) (Room branch).
4. Read [Decisions](#decisions) (all **Confirmed**).
5. Run **Verification** baseline greps before editing.

**Tests (authority):** [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md); package tests via `npx vitest` / project conventions in that package.

## Owner placeholders

- `TBD(feature-knowledge-situation-facets)` - assign when scheduled.

## Known call sites (confirmed 2026-05-18)

Phase 0 walk of seed rows plus related files. **Confirmed** summarizes current behavior; **Target** is steady state after Phases 1-3 unless noted Phase 4.

### Runtime / product

| Location | Confirmed (current) | Target | Phase |
| --- | --- | --- | --- |
| [`ComponentDescription.tsx`](../../../../charcoal-client/src/components/Message/ComponentDescription.tsx) | F/K: **`examples.payload[0]`** -> child **`StandardExample`** for displayName/description; defaults **Unknown** / empty | **`render`** wire, then DEFAULT situation facet payload; same safe defaults (**D7**) | 3 |
| [`RoomDescription.tsx`](../../../../charcoal-client/src/components/Message/RoomDescription.tsx) | **`render`** then first **`situations`** facet via **`SituationRoomFacetPayload`**; no **`examples`** | No change; template for F/K Phase 3 | -- |
| [`layeredContextUtils.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts) | F/K: **`parent.examples`** for layered tabs and sibling checks; Room uses **`situations`** / Guidance | Remove F/K Example path; **no** F/K SituationFacet tabs (**D5**) | 3 |
| [`FeatureEditor.tsx`](../../../../charcoal-client/src/components/Workbench/FeatureEdit/FeatureEditor.tsx) | **`ReferenceListEditor`** on **`_payload._examples`**; navigates to **`ExampleEditor`** | Generalized **`DefaultRenderEditor`** + **`SituationFacetRenderFieldsEditor`**; **`assureDefaultSituationFromPrimitives`** (**D5**) | 3 |
| [`KnowledgeEditor.tsx`](../../../../charcoal-client/src/components/Workbench/KnowledgeEdit/KnowledgeEditor.tsx) | Same as FeatureEditor | Same as Feature | 3 |
| [`ExampleEditor.tsx`](../../../../charcoal-client/src/components/Workbench/ExampleEdit/ExampleEditor.tsx) | Edits **`StandardExample`** fields (displayName, summary, description) | Retire after Phase 4 | 4 |
| [`WorkbenchAssetEditor.tsx`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx) | Routes top-level **`StandardExample`** to **`ExampleEditor`** | Situation / facet routing only | 4 |
| [`WorkbenchContainer.tsx`](../../../../charcoal-client/src/components/Workbench/WorkbenchContainer.tsx) | Breadcrumb labels for Example layers under F/K | Update when Example path removed | 3-4 |
| [`ComponentSelectorDialog.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/ComponentSelector/ComponentSelectorDialog.tsx) | **`instanceof StandardExample`** -> tag Example | Drop Example when Phase 4-ready | 4 |
| [`exampleAssociatedFilter.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.ts) | **Example** only; Room/F/K excluded (early branch) | Future: rename/rescope `componentExamples` | 2 (done) |
| [`exampleEnrichment.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.ts) | **`getParentIdsForSituation`**, **`mergeSituationAcrossStack`**, **`situationFacetToCacheShape`**; **`enrichExampleEvent`** does not perform parent discovery | No change until Phase 4 Example retirement | 2 (done) |
| [`index.ts`](../../../../lambda/assets/componentExamples/index.ts) | Parent facet branch + Situation fan-out; Example path gated on **`parentIds`** | No change until Phase 4 | 2 (done) |
| [`componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts) | F/K: **`ExamplesData.get`** -> first example -> **`examples: ['EXAMPLE#rendered']`** + synthetic **`EXAMPLE#rendered`** child | **`renderCache`** + **`render`** field only (**D1**); drop synthetic Example | 2 |
| [`componentExamples.ts`](../../../../lambda/ephemera/dataSource/componentExamples.ts) | Writes **`RenderCache`**; branches **`situationId`** vs **`authoredExampleId`** by id type | F/K events use Situation ids once assets branch exists | 2 |
| [`examples.ts`](../../../../lambda/ephemera/internalCache/examples.ts) | **`EXAMPLE#`** Dynamo rows for Feature/Knowledge | Deprecate for F/K prose when renderCache-only | 2 |

### WML package (representative)

| Location | Confirmed (current) | Target | Phase |
| --- | --- | --- | --- |
| [`feature.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.ts), [`knowledge.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.ts) | **`situations`** (**`SituationProseFacetList`**); no **`examples`**; no **`render`** on payload yet | Ephemera **`render`** wire (Phase 2) | 2 |
| [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) | **`SituationProseFacet*`** shared by Room, Feature, Knowledge | Deprecated **`SituationRoomFacet*`** aliases for client/lambda imports | 1 (done) |
| [`example.ts`](../../../../packages/mtw-wml/ts/standardize/components/example.ts), [`componentFactory.ts`](../../../../packages/mtw-wml/ts/standardize/componentFactory.ts) | Example still first-class (marks) | Retire from product surface Phase 4 | 4 |
| [`feature.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.test.ts), [`knowledge.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.test.ts) | **`situations`** fixtures; **0** **`.examples`** | Maintain with Phase 2+ changes | 1 (done) |

## Phase 0 baseline (2026-05-18)

Recorded before Phase 1. Re-run [Verification](#verification) after each phase; counts should shrink for F/K **`examples`** patterns.

| Check | Baseline (pre-Phase 1) | Post-Phase 1 (2026-05-18) |
| --- | --- | --- |
| `\.examples\b\|examples:` in `feature.ts` + `knowledge.ts` | **28** (14 each) | **0** |
| `\.examples\b` in `packages/mtw-wml` `*.test.ts` | **56** (`feature.test.ts` 28 + `knowledge.test.ts` 28) | **0** |
| `examples.payload\|_examples\|StandardExample` in `lambda/assets`, `lambda/ephemera`, `charcoal-client` (exclude `*.test.*`) | **52** (assets 12, ephemera 9, client 31) | unchanged (Phase 2-3) |
| `examples:` in `room.ts` + `dataTypes/room.ts` | **0** (regression guard) | **0** |
| `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` | **pass** | **pass** |
| `npm test -- ts/standardize` (`packages/mtw-wml`) | (not recorded) | **pass** (1385+ tests) |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

### Phase 0: Code inventory and contract

- [X] **Decisions** **D1**-**D9** confirmed (see table).
- [X] Confirm behavior at **Known call sites** (playing UI, workbench, assets, ephemera).
- [X] Run **Verification** greps; save baseline hit counts in a PR note or phase-0 commit message.
- [X] Document v1 contract in durable docs when implemented: F/K **DEFAULT-only** author + render; wire via **`render`** (**D1**); Situations are independent entities (**D8**).

### Phase 1: WML storage (`packages/mtw-wml`)

- [X] Add facet list types (shared payload per **D2**; **`SituationProseFacet*`** in [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts)).
- [X] Add **`situations`** to **`StandardFeatureData`** / **`StandardKnowledgeData`** and payloads; **`fromSchema`** accepts **`<Situation>`** facets (DEFAULT in tests); **`toJSON`** emits **`situations`** not **`examples`**.
- [X] **D6:** Do **not** add Example-to-facet **`fromSchema`** mapping. Removed **`examples`** on F/K payloads (**`StandardExample`** type remains until Phase 4).
- [X] Wire merge, invert, diff, **`referencedKeys`**, schema round-trip tests (DEFAULT facet fixtures like Room).

### Phase 2: Lambdas

- [X] **`componentExamples`**: Feature/Knowledge **`situations`** branch on **parent** **Updated** / **Removed** (mirror Room; fix gap noted in Decisions). Shipped 2026-05-18.
- [X] Update **`exampleAssociatedFilter`** / enrichment for **`situations`** (drop **`examples`** gate when Phase 4-ready). Shipped 2026-05-19.
- [X] **`componentExamples`**: Stop standalone **Example** path for F/K parent discovery once facets own prose. Shipped 2026-05-19 (Situation fan-out; Example path no publish when **`parentIds`** empty).
- [ ] Ephemera **D1:** Feature/Knowledge **`render`** + **renderCache**; DEFAULT-only cache selection; remove **`EXAMPLE#rendered`** synthetic form.
- [ ] Tests: [`exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts), [`index.test.ts`](../../../../lambda/assets/componentExamples/index.test.ts), ephemera **`componentExamples.test.ts`**, **`componentRender.test.ts`**.

### Phase 3: Client

- [ ] **`FeatureEditor` / `KnowledgeEditor`**: **D5** -- generalized **`DefaultRenderEditor`** (DEFAULT facet only); **`assureDefaultSituationFromPrimitives`**; remove **Examples** reference list.
- [ ] **`layeredContextUtils`**: remove F/K **Example** layered-tab path; do **not** add F/K SituationFacet layered tabs.
- [ ] **`ComponentDescription`**: **D1** -- read **`render`**, then DEFAULT facet; drop **`StandardExample`** path.
- [ ] Update Workbench **`AGENT.md`**, component selector (**D4** -- drop **Example** when ready).

### Phase 4: Example retirement (codebase only)

- [ ] Remove **`<Example>`** from schema, **`StandardExample`**, factory, **`ExampleEditor`**, top-level Example routes, **`EXAMPLE#`**-only ephemera paths for F/K.
- [ ] Update tests and [`AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) (F/K use **`situations`**, not **`.examples`**).
- [ ] **No** production WML/DB migration script (**D3**, **D4**).
- [ ] Delete or archive this task plan when merged.

## Verification

Baseline before Phase 1; re-run after each phase. From repo root:

```bash
# WML: Feature/Knowledge still on examples (expect hits until Phase 1+)
rg "\.examples\b|examples:" packages/mtw-wml/ts/standardize/components/feature.ts packages/mtw-wml/ts/standardize/components/knowledge.ts

# WML tests: feature/knowledge examples (expect shrink over time)
rg "\.examples\b" packages/mtw-wml --glob "*.test.ts"

# Lambdas + client: Feature/Knowledge examples usage
rg "examples\.payload|_examples|StandardExample" lambda/assets lambda/ephemera charcoal-client --glob "*.{ts,tsx}" | rg -v "\.test\."

# Room should NOT regain serialized examples
rg "examples:" packages/mtw-wml/ts/standardize/components/room.ts packages/mtw-wml/ts/standardize/components/dataTypes/room.ts

# Typecheck WML
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

After Phase 4, Feature/Knowledge tests should prefer **`<Situation uuid=(DEFAULT)>`** under parent tags (same fixture convention as Room). See **Fixture tip** in [`AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md).

## Production data migration

**Not applicable (**D3**, **D4**):** extant database has no Feature, Knowledge, or Example content to convert. Phase 4 is **code and test cleanup** only.

**Tests and fixtures:** rewrite Feature/Knowledge WML snippets to use **`<Situation uuid=(DEFAULT)>`** under the parent (see Room convention in [`AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md)).

**Imported assets (if any appear later):** handle ad hoc; no bulk migrator in scope for this initiative.

Room nested **`<Example>`** in old WML remains non-authoritative; do not use as the F/K target shape.
