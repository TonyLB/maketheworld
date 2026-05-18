# Feature and Knowledge: Situation facets and Example retirement

**Status:** Not started. **Pre-flight decisions confirmed** (see [Decisions](#decisions)). Room **`examples`** removal is **complete**. This initiative migrates **`StandardFeature`** and **`StandardKnowledge`** to situation facets + ephemera **`render`**, then retires **`<Example>`**. **No production data migration:** extant database has no Feature/Knowledge/Example content to convert.

This file is task-scoped and temporary. See [`taskPlanning/AGENT.md`](../../../AGENT.md) for task-plan conventions.

## Purpose and target architecture

### Problem (legacy model)

**`Example`** conflates two concerns:

1. **World-state slice** (Mark facets on the Example component)
2. **Parent-specific prose** (DisplayName / Summary / Description on the Example)

**Room** already split these: **`Situation`** holds marks only; **`Room.situations`** (`SituationRoomFacetList`) holds prose keyed by Situation reference. **Feature** and **Knowledge** still use **`examples: ReferenceList`** pointing at child **`StandardExample`** components.

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

**`componentExamples`** marks Feature/Knowledge with **`examples`** as associated, but only processes **`tag === 'Example'`** updates today. Feature/Knowledge **Component Updated** must get a **Room-style parent branch** on **`situations`** (see [`index.ts`](../../../../lambda/assets/componentExamples/index.ts)). Track in Phase 2.

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
| **Room** | No serialized field; legacy inline **`ref={0}`** Example only for merge/subset | **`SituationRoomFacetList`** | Wire prose via **`render`** / **`<Render>`** (`ephemeraWire`). Tests use **`<Situation uuid=(DEFAULT)>`**. |
| **Feature** | **`ReferenceList`** of **Example** | *Not implemented* | [`feature.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.ts) |
| **Knowledge** | **`ReferenceList`** of **Example** | *Not implemented* | [`knowledge.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.ts) |
| **Situation** | N/A | N/A | Marks-only component ([`situation.ts`](../../../../packages/mtw-wml/ts/standardize/components/situation.ts)) |
| **Example** | N/A | N/A | Still first-class ([`example.ts`](../../../../packages/mtw-wml/ts/standardize/components/example.ts)) |

**No** `situationFeature.ts` / `situationKnowledge.ts` facet modules exist yet; follow [`situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts) and Room **`fromSchema`** consumers as templates.

### Assets lambda (`lambda/assets/componentExamples`)

- **Room:** **`Component Updated` / `Removed`** on Room with non-empty **`situations`** emits **`ExampleUpdated` / `ExampleRemoved`** per facet (**`exampleId` = Situation uuid**), **`situationFacetToCacheShape`**, optional lens marks ([`index.ts`](../../../../lambda/assets/componentExamples/index.ts)). Room is **not** in **`isExampleAssociatedComponent`** for the Example-component path.
- **Feature / Knowledge:** Filter requires non-empty **`examples`** ([`exampleAssociatedFilter.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.ts)). Parent discovery scans **`examples`** refs ([`exampleEnrichment.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.ts) **`getExamplesReferenceList`**).
- **Target:** Mirror the Room branch for Feature/Knowledge **`situations`** (filter on **`situations.items.length`**, facet payload from parent, **`exampleId` = situation uuid).

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
| 0 | Code inventory and baseline | Pending | Call sites + greps; no production data migration |
| 1 | WML: facet types + Feature/Knowledge `situations` | Pending | **D2** shared payload; **no** Example dual-read (**D6**) |
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

## Known call sites (starting inventory)

Expand during Phase 0; treat this table as seed data, not exhaustive.

### Runtime / product

| Location | Role today | Target |
| --- | --- | --- |
| [`charcoal-client/.../ComponentDescription.tsx`](../../../../charcoal-client/src/components/Message/ComponentDescription.tsx) | First **`StandardExample`** via **`examples.payload[0]`** | DEFAULT situation facet payload (or ephemera wire equivalent) |
| [`charcoal-client/.../layeredContextUtils.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts) | Example layering for F/K only | Remove F/K Example path; **no** F/K SituationFacet layered tabs in v1 (**D5**) |
| [`charcoal-client/.../FeatureEditor.tsx`](../../../../charcoal-client/src/components/Workbench/FeatureEdit/FeatureEditor.tsx) | **`examples`** list + navigate to Example | DEFAULT inline editor only (**D5**) |
| [`charcoal-client/.../KnowledgeEditor.tsx`](../../../../charcoal-client/src/components/Workbench/KnowledgeEdit/KnowledgeEditor.tsx) | Same as Feature | Same as Feature |
| [`charcoal-client/.../ExampleEditor.tsx`](../../../../charcoal-client/src/components/Workbench/ExampleEdit/ExampleEditor.tsx) | Edits standalone Example | Remove or repurpose after Phase 4 |
| [`charcoal-client/.../WorkbenchAssetEditor.tsx`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx) | Top-level Example routing | Situation / facet routing only |
| [`lambda/assets/componentExamples/exampleAssociatedFilter.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.ts) | F/K gated on **`examples`** | Gate on **`situations`**; drop standalone **Example** tag when retired |
| [`lambda/assets/componentExamples/exampleEnrichment.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.ts) | **`getExamplesReferenceList`**, **`mergeExampleAcrossStack`** | Facet + Situation merge helpers for F/K |
| [`lambda/assets/componentExamples/index.ts`](../../../../lambda/assets/componentExamples/index.ts) | Example component path for F/K | F/K branch parallel to Room situations |
| [`lambda/ephemera/internalCache/componentRender.ts`](../../../../lambda/ephemera/internalCache/componentRender.ts) | **`ExamplesData.get`** first example for F/K | Align with renderCache / facet payload (Room pattern) |
| [`lambda/ephemera/internalCache/examples.ts`](../../../../lambda/ephemera/internalCache/examples.ts) | **`EXAMPLE#`** cache for F/K | Deprecate when F/K use renderCache-only prose |

### WML package (representative)

- [`feature.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.ts), [`knowledge.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.ts) - **`_examples`**
- [`example.ts`](../../../../packages/mtw-wml/ts/standardize/components/example.ts), [`componentFactory.ts`](../../../../packages/mtw-wml/ts/standardize/componentFactory.ts) - Example factory
- [`feature.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.test.ts), [`knowledge.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.test.ts) - primary **`examples`** tests

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

### Phase 0: Code inventory and contract

- [X] **Decisions** **D1**-**D9** confirmed (see table).
- [ ] Confirm behavior at **Known call sites** (playing UI, workbench, assets, ephemera).
- [ ] Run **Verification** greps; save baseline hit counts in a PR note or phase-0 commit message.
- [ ] Document v1 contract in durable docs when implemented: F/K **DEFAULT-only** author + render; wire via **`render`** (**D1**); Situations are independent entities (**D8**).

### Phase 1: WML storage (`packages/mtw-wml`)

- [ ] Add facet list types (shared payload per **D2**; reuse room facet machinery where possible).
- [ ] Add **`situations`** to **`StandardFeatureData`** / **`StandardKnowledgeData`** and payloads; **`fromSchema`** accepts **`<Situation>`** facets (DEFAULT in tests); **`toJSON`** emits **`situations`** not **`examples`**.
- [ ] **D6:** Do **not** add Example-to-facet **`fromSchema`** mapping. Remove or narrow **`examples`** on F/K when call sites allow (may leave **`StandardExample`** type until Phase 4).
- [ ] Wire merge, invert, diff, **`referencedKeys`**, schema round-trip tests (DEFAULT facet fixtures like Room).

### Phase 2: Lambdas

- [ ] **`componentExamples`**: Feature/Knowledge **`situations`** branch on **parent** **Updated** / **Removed** (mirror Room; fix gap noted in Decisions).
- [ ] Update **`exampleAssociatedFilter`** / enrichment for **`situations`** (drop **`examples`** gate when Phase 4-ready).
- [ ] **`componentExamples`**: Stop standalone **Example** path for F/K parent discovery once facets own prose.
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
