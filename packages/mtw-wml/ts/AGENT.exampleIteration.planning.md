 # Example / Situation Iteration - Conceptual Notes

 **Status: IN PROGRESS (Phases 1–4 implemented; Phases 5–5.7 done where noted; Phase 6 planned)**

 This document captures a **second-iteration** direction for how Examples and world-state dependent descriptions might be modeled in WML and the standardization system. It is intentionally conceptual only:

 - It does **not** describe committed schema changes.
 - It does **not** prescribe specific migration steps or timelines.
 - It exists so that first-MVP work (especially ephemera caching and componentExamples enrichment) can proceed without fear of painting the system into a corner.

 Future iterations can refine this document into a full planning artifact when we are ready to implement the pattern.

 ## Current Approach (Pre-Iteration)

 Today, the WML / StandardComponent model treats `Example` as a first-class component:

 - `Example` has its own `uuid` and can appear multiple times in an asset.
 - Rooms, Features, Knowledge, etc. reference Examples via `examples: ReferenceList`.
 - Each Example both:
   - defines a **world-state slice** (via Mark facets), and
   - stores the **render content** (DisplayName / Summary / Description via StandardRender).

 This has several architectural advantages:

 - Fits the general component pattern: globally identifiable, additively merged, referenceable from multiple places.
 - Integrates with edit algebra and diff/merge at the component level.
 - Works with layered assets and imports: Example content can be refined across assets.

 But it also creates a semantic mismatch:

 - Conceptually, Example prose usually belongs to a specific parent component and a specific world-state point, not as a reusable blob.
 - The model encourages the idea of "an Example that just happens to look exactly like this Room," rather than "how this Room looks in this situation."
 - Cross-parent sharing of an Example (for instance, between a Tavern and a Desk Lamp) is allowed by the model but rarely makes semantic sense.

 At the same time, ephemera caching is already treating Examples primarily as **state slices plus render content**:

 - The ephemera cache schema stores:
   - `componentId` (e.g. `ROOM#...`),
   - `markState` (Mark / Match pairs),
   - `renderedContent` (DisplayName / Summary / Description as RenderTree),
   - `provenance` and `perspectiveId`.
 - The cache key is deliberately **synthetic** (one row per distinct render, per perspective), not `RoomId + ExampleId`.
 - Lookup in v1 is by component and Mark pattern, not by Example id.

 That design already nudges the system toward "this component, in this world-state, looks like this," rather than "there exists a free-floating Example that multiple components share verbatim."

 ## Conceptual Second Iteration: Situations and Facets

 The conceptual direction in this document is to **separate "world-state" from "component-specific prose"**:

 - Introduce a `Situation` component that represents **only** a world-state slice.
 - Move parent-specific prose into **facets** on the parent component.

 ### Situations as World-State Components

 In this model, we would:

 - Replace the current `Example` tag with a `Situation` tag (or otherwise introduce `Situation` as a first-class component).
 - Treat `Situation` as an independent component that:
   - Carries a **MarkFacetList** describing a particular combination of Mark values (illumination: bright, mood: somber, etc.).
   - Does **not** store DisplayName / Summary / Description fields.
 - Allow `Situation` to be referenced by many parents (Rooms, Features, Maps, etc.) as a reusable definition of "what state we are talking about."

 Semantically, this shifts the question from:

 - "Should we share this Example between a Tavern and a Desk Lamp?"

 to:

 - "Can we share the **Situation** 'illumination: bright, mood: somber' between a Tavern and a Desk Lamp?"

 The answer to the second question is usually "yes" (shared world-state), even when the prose for each component in that state is entirely different.

 This aligns well with:

 - The Mark / Guidance / Example rendering docs (world-state as a point in Mark space).
 - The future "Guidance-constellation" search direction (cluster and compare states, not prose blobs).

 ### Parent-Specific Descriptions as Situation Facets

 Once `Situation` is responsible for the world-state, the **parent component** becomes responsible for how it looks in that state.

 Conceptually:

 - Each parent component would gain a homogeneous facet list of "situation facets."
 - Each facet references a `Situation` and carries a payload describing how that parent renders in that Situation.

 Examples of possible facet lists and payloads:

 - Rooms:
   - `examples: SituationRoomFacetList`
   - Payload type: something like `{ name?: StandardRender, summary?: StandardRender, description?: StandardRender }`
 - Features:
   - `examples: SituationFeatureFacetList`
   - Payload type: something like `{ description?: StandardRender }` (no summary needed for many UI flows)
 - Maps (future):
   - `examples: SituationMapFacetList`
   - Payload type: a map-specific structure, potentially very different from Rooms and Features.

 These lists:

 - Are **homogeneous** (one facet type per list), matching existing FacetList design.
 - Use the existing facet pattern:
   - `StandardFacet<TPayload>` = reference to a `Situation` + payload.
   - Facets support Replace operations over payloads and integrate with edit algebra.

 Under this approach:

 - `Situation` defines "which world-state are we in?"
 - Each parent facet payload defines "how does this particular thing look in that state?"
 - Sharing is now about reusing **state** (Situation), not reusing **prose**.

 ### Typical Editing Patterns

 With this split in place, edits naturally fall into two categories:

 - **Global state edits** (rare, more expensive):
   - Editing a `Situation` (changing its MarkFacetList) is a global change.
   - The system may need to walk layered assets and inheritance graphs to find all components that reference that Situation.
   - This is appropriate for "big" changes that intentionally affect many parents.

 - **Local rendering edits** (common, cheaper):
   - Editing a Room's description for a given Situation is a facet-payload edit on that specific Room.
   - No need to rediscover which parents reference the Situation; the edit is anchored to a known parent.
   - Enrichment and event logic can treat this as a local change: "Room R, Situation S, payload changed."

 This mirrors how ephemera caching and `componentExamples` enrichment already think about changes, but makes the distinction explicit in the data model.

 ## Relationship to Ephemera Caching

 The first MVP ephemera cache schema already avoids committing to Examples as the unit of reuse:

 - Cache keys use a **synthetic** `CACHE#uuid` per record.
 - Each record stores:
   - `componentId` (e.g. `ROOM#...`),
   - `markState` (Mark / Match pairs),
   - `renderedContent`,
   - `provenance`,
   - `perspectiveId`.
 - Lookup is by component and Mark pattern (and optionally perspective), not by Example id.

 This leaves room for a future where:

 - `markState` is derived from referenced `Situation` components.
 - The cache record optionally records a `situationId` to identify which Situation the render corresponds to.
 - The "one cache record per distinct render per perspective" rule stays the same.

 Because the cache already avoids keying by Example or canonical Mark state, it is **not** painting the system into a corner for this iteration:

 - The second iteration can introduce Situations and situation facets.
 - The cache can be extended to understand Situations without changing its core strategy.

 ## Impact on Existing Patterns (High-Level)

 This conceptual iteration would, if implemented, have several likely effects:

 - **Authoring semantics**:
   - Authors would define Situations (Mark combinations) early.
   - They would then describe how each component looks in those Situations via facet payloads on the component.
   - The notion of "sharing prose" between semantically unrelated components would recede; sharing state would become the norm.

 - **Standardization and components**:
   - The core component patterns (StandardForm, StandardComponent, StandardRender, References, Facets) remain intact.
   - `Example` as "state + prose" could be decomposed into:
     - `Situation` for state (Marks),
     - situation facet lists for prose (component-specific payloads).

 - **Search and enrichment**:
   - Global, inheritance-aware searches ("find all parents referencing this Situation") would be reserved for truly global changes.
   - Typical edits would be facet payload changes on a specific parent, which are computationally simpler to reason about and process.
   - `componentExamples` enrichment logic could eventually be simplified to work over situation facets rather than full Example components.

 ## Scope and Non-Commitments

 This document is intentionally limited in scope:

 - It does **not** define final WML syntax for `Situation` or situation facet tags.
 - It does **not** specify exact TypeScript types for payloads or facet lists.
 - It does **not** commit to a particular migration strategy from existing `Example` components.
 - It does **not** schedule or prioritize this work relative to other roadmap items.

 Instead, its purpose is to:

 - Capture the main semantic fault-line in the current Example model.
 - Outline a direction (Situation + situation facets) that aligns with existing architecture:
   - StandardForm and StandardComponent patterns.
   - Reference vs Facet separation.
   - Mark / Guidance / rendering design.
   - Ephemera caching and future Guidance-constellation search.
 - Provide enough clarity that first-MVP work (especially ephemera caching) can proceed without concern that it will block or complicate this possible second iteration.

 As we approach an iteration where we want to implement this pattern, this file should be revisited and expanded into a full planning document with:

 - Concrete schema and WML syntax proposals.
 - Migration strategies for existing assets and Examples.
 - Detailed changes to componentExamples enrichment, StandardComponent implementations, and ephemera caching.
 - UI and authoring flows for editing Situations and situation facets.

---

## Implementation

**Status: PLANNING (phased approach; Phases 1–5.6 done)**

This section outlines a phased plan to implement the Situation + situation-facets model. The playbook for adding a new component type is documented in [`standardize/components/AGENT.implementation.md`](./standardize/components/AGENT.implementation.md) under "Adding a New Component Type." Each phase below maps to that playbook where applicable.

### Phased Overview

1. **Phase 1: Situation component only** – Introduce `<Situation>` as a first-class component (world-state slice only). Establishes the new tag in the WML schema and StandardForm storage without changing Room/Feature/Knowledge references. *Steps detailed below.*
2. **Phase 2: Situation facets in StandardForm** – **Add** a new `situations` property (SituationFacetList) to **Room only** as a first iteration; Feature and Knowledge are deferred to a later iteration. Data model and WML/serialization only; no UI or lambda changes yet. Do not remove or replace `examples` in this phase.
3. **Phase 3: Lambdas (non–render cache)** – Migrate `assets` and `ephemera` lambdas to use `situations` (Situation/situation-facet data) as the primary source; optionally keep `examples` as fallback. Leaves renderCache for Phase 4.
4. **Phase 4: Render cache** – Larger refactor of the render cache (and any related systems) to key and store by Situation/situation-facet model instead of Example.
5. **Phase 5: Client UI** – Add Situation component editor and SituationFacetList editor (at least for Room); migrate client to use `situations`. Example remains supported until Phase 6 optional cleanup.
6. **Phase 6: Example deprecation (optional tech-debt cleanup)** – Optionally remove `examples`, `<Example>`, and `StandardExample` once migration to `situations` is complete. Can be deferred or skipped.

**Execution approach**: We plan to **build Phase 1 first** (the `<Situation>` tag and component), then **return to this document** to iterate and refine the planning for Phases 2–6. Having Situation concretely implemented will anchor discussion on migration, situation facets, lambdas, render cache, and UI: we can reason from a real component and schema rather than from outline alone. The steps below are therefore fully specified only for Phase 1; later phases remain high-level until we revisit after Phase 1 is done.

The following steps focus on **Phase 1: creating the `<Situation>` tag and component**.

### Phase 1: Create the `<Situation>` Tag and Component

Situation is a component that carries **only** a `MarkFacetList` (world-state slice). It does **not** store DisplayName, Summary, or Description. The implementation pattern is closest to **StandardGuidance** (marks-only, with `StandardizeConsumerFacetListMark` and `StandardizeConsumerInline` for hosted Mark children). Reference: [`standardize/components/AGENT.implementation.md`](./standardize/components/AGENT.implementation.md) "Adding a New Component Type" and the existing Guidance/Example implementations that use `MarkFacetList`.

#### Step 1: Schema layer support (`@tonylb/mtw-base`) **(DONE)**

**Location**: `packages/mtw-base/ts/schema/` (in the `@tonylb/mtw-base` package)

- [x] Add schema type (e.g. `SchemaSituationTag`) to schema type definitions.
- [x] Add `isSchemaSituation` type guard.
- [x] Add `'Situation'` to:
  - `SchemaComponent` union type
  - `isSchemaComponentTag()`
  - `isSchemaComponent()`
  - `isSchemaTag()`
- [x] Ensure the WML parser can parse `<Situation>` from WML strings. (Schema layer in mtw-base is complete; converter registration in Step 2 completes parsing.)

**Reference**: Same pattern as `SchemaMark`, `SchemaGuidance`, or `SchemaExample` in `@tonylb/mtw-base/ts/schema/`.

#### Step 2: Schema converter registration (`schema/converters/components.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/schema/converters/components.ts`

- [x] **Prefix key**: Add `'SITUATION'` to `PrefixKey` in `packages/mtw-utilities/ts/types.ts` (for typed UUIDs and `enforceTypedKey` / `stripTypedKey`).
- [x] **Imports**: Import `isSchemaSituation` and `SchemaSituationTag` from the appropriate schema module.
- [x] **componentTemplates**: Add `Situation` entry with `uuid`, `key`, `from`, `origin`, `ref` (and any other standard component properties).
- [x] **componentConverters**: Add `Situation` with `initialize` that validates properties and returns `SchemaSituationTag`; handle `uuid` with `enforceTypedKey('SITUATION')`, and `ref` with `validateExpressionAsNonNegativeInteger` if present.
- [x] **componentPrintMap**: Add `Situation` entry to render the tag and properties (use `tagRender()` and `stripTypedKey('SITUATION')` for `uuid`).

**Reference**: Same pattern as `Mark`, `Guidance`, or `Example` in `components.ts`.

#### Step 3: Component type system (`standardize/components/dataTypes/abstract.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts`

- [x] Add `'Situation'` to the `ComponentTag` type union (if not already included via schema).
- [x] Add case to `componentTagFromUpperCase()`: `case 'SITUATION': return 'Situation'`.

#### Step 4: Component data types (`standardize/components/dataTypes/situation.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/situation.ts` (new file)

- [x] Define `StandardSituationData` extending `StandardBaseData`:
  - `tag: 'Situation'`
  - Optional `shortName?: StandardEditableData<string>` for a Situation short name (parallel to Room `shortName`).
  - Optional `marks?: FacetListData<string>` for the MarkFacetList serialization (same pattern as `StandardGuidanceData` in `guidance.ts`).
- [x] Add `isStandardSituationData` type guard using `checkAll()` and `checkTypes()`.
- [x] Export from `dataTypes/index.ts`: export type and type guard; add to `StandardComponentNonEditData` union and to `isStandardComponentData()`.

**Reference**: For marks-only structure, see `guidance.ts` (or `example.ts`) data type and how `MarkFacetList` is represented in serialization; Situation extends this with optional `shortName`.

#### Step 5: Component implementation (`standardize/components/situation.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/components/situation.ts` (new file)

- [x] **Payload** (`StandardSituationPayload`): Store `_shortName?: StandardLiteral` and `_marks: MarkFacetList` (no summary/description). Implement `ComponentConstructorMethods<StandardSituationData>`: constructor, `fromJSON`, `fromSchema`, getters, `toJSON`, `schema`, `nestedSchema`, `merge`, `subset`, `referencedKeys`, `isEmpty`, `invert`, `mapContents`, `remapReferences`. No `assureReferences` or `withChild` (Situation has no ReferenceLists); hosted Mark children are handled via **inline remainder**.
- [x] **fromSchema**: Process-and-remainder pipeline with entry typeguard `treeNodeTypeguard(isSchemaSituation)`; consumers `StandardizeConsumerStandardLiteral` for `<ShortName>`, then `StandardizeConsumerFacetListMark` for Mark facets, then `StandardizeConsumerInline`. No `StandardizeConsumerReferenceList`.
- [x] **Component class** (`StandardSituation`): `componentClassFactory(StandardSituationPayload, 'StandardSituation')`; getters delegate to payload; overrides `_wrap`, `clone`, `equals`.

**Reference**: `guidance.ts` for marks-only + facet-list consumer + inline remainder; `AGENT.implementation.md` for fromSchema pipeline and two-remainder shape; Situation extends this with optional `shortName`.

#### Step 6: Factory integration (`standardize/componentFactory.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/componentFactory.ts`

- [x] Import `StandardSituation`, `isStandardSituationData`, and `isSchemaSituation`.
- [x] In `standardComponentFactory()`: data branch — when `isStandardSituationData(arg)`, return `{ component: new StandardSituation(arg), remainder: [] }`; schema branch — when `treeNodeTypeguard(isSchemaSituation)(node)`, build instance, call `fromSchema(node)`, return `{ component: instance, remainder }`.

#### Step 7: Processing integration (`standardize/index.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/index.ts`

- [x] Add `'Situation'` to `COMPONENT_ORDER` (after `'Guidance'`, before `'Mark'`).
- [x] Add `(value instanceof StandardSituation) ||` to `isStandardComponent()`.

#### Step 8: Unit tests (`standardize/components/situation.test.ts`) **(DONE)**

**Location**: `packages/mtw-wml/ts/standardize/components/situation.test.ts` (new file)

- [x] Construction from JSON; construction from WML schema (string); construction from schema node; `toJSON` and round-trip (empty marks and WML with marks); `schema`; merge; equals; `isEmpty`; `invert`; `MarkFacetList` (parsing Mark + Match children, multiple facets, zero marks); clone.

**Reference**: `guidance.test.ts` and `example.test.ts` for MarkFacetList and fromSchema tests.

### Verification (Phase 1)

After Phase 1, the following should hold:

- [x] `<Situation key=(...) uuid=(...)>` with nested `<Mark>`/`<Match>` children parses from WML.
- [x] Situation can be created from JSON and via `standardComponentFactory` from schema.
- [x] Situation is in `COMPONENT_ORDER` and passes `isStandardComponent()`.
- [x] Situation can be stored in `StandardForm` and serialized/deserialized (round-trip).
- [x] Situation has no ReferenceLists; Marks under Situation are consumed into `MarkFacetList` and do not create a reference list on Situation.
- [x] All new unit tests pass.

### Phase 2: Situation facets in StandardForm

**Goal**: **Add** a new `situations` property (SituationFacetList) to **Room only** (first iteration; Feature and Knowledge deferred) alongside the existing `examples` (ReferenceList). Facets reference Situations and carry the rendering payload (DisplayName/Summary/Description for Room). Do **not** replace or remove `examples` in this phase; migration of call sites from `examples` to `situations` is incremental in later phases. Cleanup of `examples` and StandardExample is deferred to Phase 6 (optional tech-debt).

**Scope** (data model and standardization only; no client UI or lambda behavior yet):

- Define situation-facet payload types and list types for **Room only**: `SituationRoomFacetList`, `StandardSituationRoomFacet` with payload `{ displayName?, summary?, description? }` (StandardRender/DisplayName/Summary/Description). Analogous types for Feature and Knowledge can be added in a later iteration.
- Add `situations: SituationRoomFacetList` to `StandardRoom` only. Keep existing `examples: ReferenceList` unchanged. Follow existing facet-list patterns (e.g. `StandardizeConsumerFacetList*`; no change to `assureReferences` for situation facets).
- Update WML schema and serialization: define how situation facets are represented in WML (e.g. `<Situation ref=(...)><DisplayName>...</DisplayName></Situation>` or equivalent) and ensure round-trip with StandardForm.
- StandardForm merge/diff/subset and component factory must work with the new `situations` facet list on Room. No requirement in Phase 2 to migrate existing code that reads `examples`; that migration is incremental in Phases 3–5.

**Depends on**: Phase 1 (Situation component exists).

#### Implementation (Phase 2) **(DONE)**

- [x] **Situation room facet** ([`standardize/keys/facets/situationRoom.ts`](./standardize/keys/facets/situationRoom.ts)): Define `SituationRoomFacetPayloadType`, `SituationRoomFacetPayload` class, `StandardSituationRoomFacet`, `SituationRoomFacetList`, `isSituationRoomFacetPayload`; implement fromSchema (parse DisplayName/Summary/Description from Situation node children), renderFacet, merge/diff/invert; export from keys index.
- [x] **Room data type** ([`standardize/components/dataTypes/room.ts`](./standardize/components/dataTypes/room.ts)): Add `situations?: FacetListData<SituationRoomFacetPayloadType>` and `situations: 'facetList'` in type guard; add `features: 'referenceList'` for consistency.
- [x] **fromSchema consumer** ([`standardize/components/fromSchemaPipeline.ts`](./standardize/components/fromSchemaPipeline.ts)): Add `StandardizeConsumerFacetListSituation`; match Situation children, build SituationRoomFacetList, strip DisplayName/Summary/Description for return remainder.
- [x] **Room payload and component** ([`standardize/components/room.ts`](./standardize/components/room.ts)): Add `_situations`, constructor/fromJSON/toJSON/getter; insert Situation consumer before Example in fromSchema; wire merge, invert, referencedKeys, remapReferences, isEmpty, schema(), nestedSchema(), equals.
- [x] **Tests**: [`standardize/keys/facets/situationRoom.test.ts`](./standardize/keys/facets/situationRoom.test.ts) (payload, facet, list, round-trip toJSON); [`standardize/components/room.test.ts`](./standardize/components/room.test.ts) (Room with situations from JSON, Room with Situation facet from WML and round-trip).

#### Verification (Phase 2)

After Phase 2, the following hold:

- [x] Room has `situations: SituationRoomFacetList` alongside `examples`; both coexist.
- [x] Room from JSON with `situations` round-trips; Room from WML with `<Situation ref=(...)><DisplayName>...</DisplayName></Situation>` under Room parses and emits Situation in schema (facet reference and key preserved).
- [x] StandardForm merge/diff/subset and component factory work with Room's `situations`; no change to `assureReferences` for situation facets.
- [x] All new unit tests pass.

**Note**: Full WML round-trip of situation-facet payload (DisplayName/Summary/Description) from parse can be refined in a follow-up if the aggregator does not populate Situation node children in all parse paths; JSON round-trip and schema emission are correct.

---

### Phase 3: Lambdas (non–render cache) **(DONE)**

**Goal**: Migrate **assets** and **ephemera** lambdas to use `situations` (Situation/situation-facet data) as the primary source for world-state-specific content. Excludes the render cache; that is Phase 4. During and after migration, `examples` can remain supported (e.g. fallback or legacy) until Phase 6 cleanup.

**Scope**:

- Identify all places in `lambda/assets` and `lambda/ephemera` (and any shared lambda patterns they use) that read Room/Feature/Knowledge `examples` or otherwise special-case Example data.
- Refactor those codepaths to read from `situations` (e.g. enumerate Situations referenced by a Room’s situation-facet list; key or attribute data by situation id and component id). Optionally support fallback to `examples` during transition.
- Preserve existing behavior where it is equivalent (e.g. “list of world-state-specific descriptions for this room”); change only the data source to situation facets.
- Do **not** yet change how the render cache is keyed or populated; that is the larger refactor in Phase 4.

**Depends on**: Phase 2 (StandardForm and WML have `situations` facet lists).

#### Implementation (Phase 3) **(DONE)**

- [x] **Scope**: Room-only; Feature and Knowledge remain on `examples`. Stream and event names unchanged (`mtw.assets.componentExamples`, ExampleAdded/Updated/Removed). `exampleId` may be an Example uuid or a Situation uuid; situation-facet payload uses the same shape as Example payload. Render cache keying/population unchanged (Phase 4).
- [x] **Event contract** (`packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.ts`): Migration comments (e.g. `exampleId` may be Example or Situation uuid).
- [x] **Assets**: `exampleAssociatedFilter` (Room associated only when `situations`; not `examples`); `exampleEnrichment.situationFacetToCacheShape`; `componentExamples/index` Room path emits situation-facet events on `mtw.assets.componentExamples`.
- [x] **Ephemera**: `componentRender` Room branch prefers `queryCacheRecordsForComponent` then falls back to ExamplesData; wiring in `internalCache/index.ts`.
- [x] **EphemeraId** (`packages/mtw-interfaces/ts/baseClasses.ts`): Added `SITUATION` to EphemeraId, `EphemeraSituationId`, `isEphemeraSituationId` so `ComponentData.get` accepts Situation ids.

#### Verification (Phase 3)

After Phase 3, the following hold:

- [x] Room is Example-associated only when it has non-empty `situations`; `examples` does not drive Room association.
- [x] Assets Room path emits situation-facet events (exampleId = situation uuid); Feature/Knowledge paths unchanged.
- [x] Ephemera componentRender Room branch prefers render cache, then falls back to ExamplesData.
- [x] Render cache keying/population unchanged (Phase 4).

---

### Phase 4: Render cache **(DONE)**

**Goal**: Refactor the render cache (and any systems that depend on it) so that cache keys and stored data align with the Situation/situation-facet model instead of the Example model.

**Scope**:

- Redefine cache keys/records so they are expressed in terms of component + Situation (or equivalent), not component + Example. Align with the ephemera cache design notes in the conceptual section of this document (e.g. optional `situationId`, `markState` derived from Situation).
- Update cache read/write and invalidation to use the new keying and payload shape. Ensure enrichment and event logic that depend on the cache are updated.
- This phase is intentionally called out separately because it is a “bigger refactor” with broad impact; it may be broken into sub-steps (e.g. dual-write, then cutover) as needed.

**Depends on**: Phase 3 (lambdas already use Situation/situation facets where applicable).

#### Implementation (Phase 4) **(DONE)**

- [x] **Room-only**: Feature and Knowledge remain on `authoredExampleId`; StandardForm output unchanged (Option B).
- [x] **baseClasses.ts**: Add optional `situationId?: EphemeraSituationId` to `EphemeraCacheRecord` and `EphemeraCacheDynamoItem`; keep `authoredExampleId` for Feature/Knowledge.
- [x] **cacheAccess.ts**: Add `situationId` to `PutCacheRecordInput`; include in put item when provided.
- [x] **Ephemera dataSource (componentExamples.ts)**: Write path set `situationId` when `isEphemeraSituationId(exampleId)`, else `authoredExampleId`. Invalidation filter by `situationId === exampleId || authoredExampleId === exampleId`.
- [x] **componentRender.ts**: Room branch use `stateSliceId = firstRecord.situationId ?? firstRecord.authoredExampleId ?? 'EXAMPLE#rendered'` in all three places.
- [x] **Tests**: cacheAccess (situationId include/omit), componentExamples (Room path situationId write, ExampleRemoved by situationId), componentRender (situationId on mock, prefer situationId over authoredExampleId).
- [x] **Documentation**: renderCache/AGENT.md updated; planning doc checklist added.

#### Verification (Phase 4)

- [x] Room path writes cache records with `situationId` (not `authoredExampleId`).
- [x] Feature/Knowledge path continues writing `authoredExampleId`.
- [x] ExampleRemoved deletes Room records when `situationId === exampleId`.
- [x] ExampleRemoved deletes Feature/Knowledge records when `authoredExampleId === exampleId`.
- [x] componentRender Room branch uses `situationId ?? authoredExampleId` for state slice id.
- [x] StandardForm output unchanged: Room.examples + StandardExample.

---

### Phase 5: Client UI

**Goal**: Add editors for Situation and for situation facets (at least on Room); migrate the **Workbench** to use `situations` as the primary source for world-state-specific content. Short-term aim is to get **Preview** working with Situations. Playing-side (e.g. RoomDescription, message panel) is out of scope for this phase; Example remains supported until Phase 6 cleanup (no requirement to remove Example from client in this phase).

**Scope**:

- **Situation component editor**: Add a dedicated editor in the client UI for the Situation component (create/edit Situations: edit MarkFacetList / world-state slice). Situations remain first-class components in StandardForm and in the asset; the client must be able to create and edit them.
- **SituationFacetList editor**: Add an editor for the `situations` facet list on at least the **Room** component UI (view/edit which Situations a Room has facets for, and edit the rendering payload per Situation—e.g. DisplayName, Summary, Description). Feature and Knowledge can be added later if desired.
- **Migrate to situations (Workbench only)**: Prefer or use `situations` when reading/writing world-state-specific content for Room within the Workbench (including Preview). Playing-side consumers (e.g. RoomDescription) are unchanged in Phase 5. Client may still show or edit `examples` in the Workbench during transition; removal of Example from the client is deferred to Phase 6 (optional cleanup).

**Decisions** (for implementation planning):

- **Situation label in lists**: Use a **Marks-summary** to label Situations in lists (component selector, Room's situation list, breadcrumbs). Situation has no shortName; derive a human-readable label from the Situation's MarkFacetList. Prefer the format `"markKey: matchValue, markKey: matchValue"` (e.g. "illumination: bright, mood: somber"). Use a fallback (e.g. "Situation" or key) when marks are empty or unavailable.
- **Breadcrumb stack for situation-facet layered context**: Use stack shape **`[RoomId, SituationId]`** when editing a Room's situation-facet payload. The user navigates from the Room into the layered view; keeping RoomId as the second-from-top entry makes it easy to navigate back to the Room they came from. (Top-level Situation component editor remains a single entry `[SituationId]`.)
- **Situation creation**: Support a **create+add** pattern. From the Room editor, "add situation facet" may either pick an existing Situation (selector) or **create a new Situation and add a facet** in one flow. Situations are also createable at asset level (add component) as first-class components.
- **SituationFacetList editing UX**: When editing facet payload (DisplayName, Summary, Description) from the Room editor, use the **layered-tab pattern**: one tab per situation facet, with LayeredContext doing the UI heavy lifting (tabs + single payload editor for the selected facet). Siblings are derived from `room.situations.payload`; the selected "layer" is one situation facet (e.g. by situationId). Add/remove/reorder facets stays in the Room editor (list management); the layered view is for payload-only editing, consistent with Examples/Guidance.
- **Migration scope**: Phase 5 migrates **Workbench only**. Goal is Preview working with Situations; no revamp of playing-side or entire system in this phase.
- **Future shortName on Situation**: Many places (lists, breadcrumbs, selector) need a compact label for a Situation. For Phase 5 we use Marks-summary with fallbacks. Where relevant, add **comments** in code or docs noting the possible future value of adding `shortName` to the Situation component payload: it would allow an author-defined label with Marks-summary (or key) as fallback, simplifying UX and consistency across the Workbench.

**Depends on**: Phases 2–4 (data model, lambdas, and render cache support `situations` so the UI can rely on them).

---

### Phase 5.5: Perception messages alignment

**Status**: DONE (implemented in componentRender, perception WML, and RoomDescription)

**Goal**: Align server-side perception rendering and client-side Room perception display with the Situation-first model, so that WML emitted in PerceptionMessage is schema-valid and prefers `Situation`/situation facets over `Example` where available.

**Scope**:

- **Server-side Room perception (componentRender.ts, Room branch)**:
  - When the render cache record is **Example-backed** (has `authoredExampleId = EXAMPLE#...` and no `situationId`):
    - Continue to construct a `StandardExample` with `universalKey = EXAMPLE#...`.
    - Continue to emit Room WML that references that Example (e.g. via `examples` ReferenceList) so existing Example-based perception remains supported.
  - When the render cache record is **Situation-backed** (has `situationId = SITUATION#...`):
    - Construct a `StandardSituation` with `universalKey = SITUATION#...` and `marks` derived from the cache `markState`.
    - Attach a **SituationRoomFacet** to the Room (via `situations`), whose payload carries the rendered prose for that Situation (DisplayName/Summary/Description) and whose reference points at the `StandardSituation` by `SITUATION#...`.
    - Emit WML where:
      - The Situation appears as a top-level `<Situation>` component in the asset (with marks rendered from its `MarkFacetList`).
      - The Room contains a situation facet (e.g. `<SituationFacet>` in schema terms) that links the Room to the Situation and carries the world-state-specific prose payload.
    - Note: This section specifies which `StandardSituation` components and SituationRoom facets must exist in the StandardForm. The result will be accomplished by adding a reference to StandardForm.topLevel. The exact WML nesting (whether `Situation` appears at asset level, under `Room`, or both) is determined by SchemaOrganization/TagTree from the reference graph and implicitParent rules, and should not be manually overridden here.
- **PerceptionMessage WML contract**:
  - For Room PerceptionMessages, `wmlContent` always contains a StandardForm-derived tree where:
    - Situation-backed cache records emit `Situation` + situation facets (no `<Example uuid=(SITUATION#...)>`).
    - Legacy Example-backed cache records continue to emit `Example` components and Room `examples` references as before.
  - This preserves schema validity: `<Example>` `uuid` values remain `EXAMPLE#...` only; `SITUATION#...` ids appear on `Situation` components and SituationRoom facets.
- **Client-side Room perception (RoomDescription + selectors)**:
  - When rendering a Room from PerceptionMessage WML, prefer **Situation-first**:
    - Check for a SituationRoom facet and its payload (DisplayName/Summary/Description) for the active world-state slice; use it when present.
    - Fall back to Example-based content only when there is no matching Situation facet (e.g. legacy rooms or before migration is complete).
  - Keep the overall RoomDescription UI unchanged in Phase 5.5; the change is in where it sources prose (Situation facets first, Examples as fallback).

**Decisions**:

- **No generalization of Example uuids**: Do not relax the Example WML converter to accept `SITUATION#...`. Instead, generate the "right" component for each id:
  - `EXAMPLE#...` → `StandardExample` + Room `examples` reference.
  - `SITUATION#...` → `StandardSituation` + Room SituationRoom facet.
- **Single state-slice abstraction**: On the ephemera/render-cache side, continue to treat `stateSliceId` as a `ComponentUUID` (`EXAMPLE#...` or `SITUATION#...`) when reading from cache. The distinction between Example vs Situation is handled when constructing the StandardForm (which component type to synthesize and how to attach it to the Room).
- **Client precedence order**: Document that Situation facets are the canonical source of world-state-specific prose for Room in perception; Example-based content is explicitly treated as a compatibility path and may be removed or further de-emphasized in Phase 6.

**Depends on**: Phases 2–5 (Situation component, SituationRoom facets, and Workbench support for `situations` are in place so the perception path can rely on them).

---

### Phase 5.6: Situation ShortName and UI labels

**Status**: DONE (Situation ShortName data + Workbench labels implemented)

**Goal**: Add a `ShortName` field to the Situation component and update Situation-related UI to use it as the primary label, falling back (when ShortName is absent) to a label of the form `"Untitled (<aggregate>)"`, where `<aggregate>` is the same marks-summary string that is currently used as the primary label.

**Scope**:

- **Situation data model and WML**:
  - Extend the Situation component payload to include an optional `ShortName` (parallel to Room shortName), with a corresponding `<ShortName>` tag in WML and StandardForm serialization.
  - Ensure StandardForm and schema round-trip support for Situation shortName, including parsing from WML and emitting to WML.
- **Workbench and selectors**:
  - Update `situationIdToLabel` and any Situation pickers/selectors to **prefer** Situation shortName as the label.
  - When no shortName is present, build the label as `"Untitled (<aggregate>)"`, where `<aggregate>` is the existing marks-summary aggregate (or a generic `"Situation"` placeholder when no marks are available), so that the label always communicates both "no short name" and the underlying aggregate.
  - Audit Workbench components that list or reference Situations (e.g. Room editor, component selectors, breadcrumbs) to ensure consistent use of the new label precedence.
- **Perception and previews**:
  - Where Situation labels are surfaced in perception or preview UIs (e.g. tabs, headers, debugging views), adopt the same precedence and fallback rules for Situation display labels.
  - Keep RoomDescription behavior for Room names unchanged; this phase only affects how Situations themselves are named and displayed.

**Depends on**: Phases 1–5.5 (Situation component, SituationRoom facets, Workbench Situation editing, and perception alignment are in place so ShortName becomes an additive refinement rather than a structural change).

---

### Phase 5.7: Perspective refactoring (cache matching and event contract)

**Status**: DONE (implemented).

**Goal**: Align how we represent and match "perspective" (the set of assets in play and their relevance) across client, Assets lambda, and Ephemera render cache, so that Preview and cache lookups use a consistent, domain-correct notion of when a cache record applies to a given request. This phase introduces first-class Perspective and PerspectiveMatcher shapes and moves "what invalidates a match" into the Assets domain.

**Context**:

- The client already derives a room-scoped perspective from Room + Situations + Marks origin chains (mergeOriginChainsToOrderedAssets, derivePerspectiveForRoom) and passes it as assetStack to generateRoomPreview. The Ephemera lambda hashes assetStack to perspectiveId and filters cache records by exact perspectiveId match.
- To support matcher-based matching (e.g. "this cache record is valid for any perspective that includes assets A,B and does not include asset E"), we need: (1) a shared data shape for perspective and matcher; (2) the Assets lambda to publish a PerspectiveMatcher (requiredAssetIds, optional forbiddenAssetIds) with each mirroring event, since only Assets can answer "which assets not in the stack would invalidate this render if included?"; (3) Ephemera to store and match using that matcher.

**Scope** (high-level; refinable):

- **Data shapes (mtw-interfaces)**:
  - Perspective: `{ assetStack: AssetUUID[] }` (exact ordered list). PerspectiveMatcher: `{ requiredAssetIds: AssetUUID[]; forbiddenAssetIds?: AssetUUID[] }`. Helper: `perspectiveMatches(matcher, perspective): boolean`. These already exist in mtw-interfaces/ts/perspective.ts; no change required in this phase unless we extend them.
- **Outgoing event contract (mtw.assets.componentExamples)**:
  - Extend the mirroring event payload (in mtw-interfaces and Assets publisher) to include a perspective matcher: e.g. `perspectiveMatcher: PerspectiveMatcher` (or equivalent required/forbidden fields). Required set: minimal assets that must be in the stack for this merged example to be valid. Forbidden set: assets that, if added to the stack, would change the merged Room/Situation or situation-facet payload and thus invalidate this cache record.
  - **Bounded forbidden computation**: The Assets DynamoDB structure already encodes, per component (AssetId = ROOM#... or SITUATION#...), one row per asset where that component is edited (DataCategory = ASSET#...). So the set of assets that have a stake in this Room/Situation is exactly the byAssets set (or Meta::Room / Meta::Situation cached list). Forbidden candidates are therefore bounded to (byAssets \ assetStack). Only those assets need to be considered for "would including this asset change the merge?"; no need to reason about every asset in the system.
- **Assets lambda**:
  - When building ExampleAdded/ExampleUpdated (and optionally ExampleRemoved) events, compute requiredAssetIds (from the ancestry used for this example) and forbiddenAssetIds (from the bounded set above, e.g. by what-if merge or a cheaper heuristic). Emit perspectiveMatcher (or equivalent) in the event. Details (e.g. when to omit forbidden, performance of what-if merges) to be refined at implementation time.
- **Ephemera lambda**:
  - Consume the new perspectiveMatcher from the event. Store it on cache records (or a stable id derived from it, e.g. hash of canonical matcher encoding). When servicing generateRoomPreview (and mirroring lookups), use perspectiveMatches(matcher, requestPerspective) instead of (or in addition to) exact perspectiveId equality. Centralize perspectiveId/computePerspectiveId in internalUtils to support both legacy exact match and matcher-based match during transition if needed.
- **Optional future**: Refactor Ephemera so that we can cheaply list perspective matchers (or perspective ids) per component (e.g. index or secondary structure), then cascade to cache records only for matching perspectives, instead of querying all cache records for the component and filtering in memory.
- **Migration**: If the semantics or encoding of perspectiveId change (e.g. from exact-stack hash to matcher-based id), existing render-cache records may be invalid. Options: version the id (e.g. PERSPECTIVE#v2#...) and support both during transition, or delete existing render-cache records and repopulate via mirroring. For a single existing record, deletion is acceptable.

**Decisions** (to be confirmed when implementing):

- **Switch fully to matcher-based storage and matching** (do not retain exact perspectiveId / hash of assetStack for backward compatibility). The one existing test cache record will be deleted manually; no migration path for old records.
- **Send the full PerspectiveMatcher object** in the event (and at API boundaries). In Ephemera, store the full matcher so we can evaluate perspectiveMatches at request time. We may **also** store a stable hash of the matcher in Ephemera to optimize searches, since we cannot index on the full object in DynamoDB.
- **Forbidden calculation in Assets:** We only consider candidates in (byAssets \ assetStack); the first-origin asset for a component is always already in the perspective (the root). So we never ask this question about the root — any candidate we evaluate is a layer. Therefore we do not need to distinguish edit vs content mode: any Situation marks or Room situation facets present in a candidate's component are edit-mode by definition. **Structural test:** include a candidate in forbiddenAssetIds iff its component has the relevant content types — Situation with marks, or Room with situation facets. No what-if merge and no mode inspection.
- **requiredAssetIds computation:** requiredAssetIds = assetStack filtered to those assets that have the structural content (Room facet for this situationId, or Situation marks), using the same predicates as the forbidden test. So we compute required by applying the structural test to each asset in the stack and keeping only those that pass.

**Implementation questions** (to address one by one before or during implementation):

1. **requiredAssetIds:** Use the **minimal contributing subset** of the stack: only assets that have edit-mode content (Room situation facets or Situation marks). Those are the same assets that would be in the forbidden set if they were candidates; content-only assets (e.g. root that only defines the Room with no facets) need not be in required. That yields a better hit rate (e.g. request [A,B,C] and [B,C] both match when required = [B,C]). Resolved: requiredAssetIds = assets in assetStack that have the structural "forbidden" content (situation facets or marks).
2. **byAssets for forbidden (Room + Situation):** Yes. byAssets = **union** of `ComponentData.get(roomId).byAssets` and `ComponentData.get(situationId).byAssets` (by AssetId); candidates = that set \ assetStack. For each candidate, include in forbiddenAssetIds iff **either or both**: (a) the Room (for this roomId) is in that asset and has situation-facet content **for the given situation** (facet referencing this situationId), and/or (b) the Situation (for this situationId) is in that asset and has an update to mark facets. Resolved.
3. **Example path (Feature/Knowledge):** Emit perspectiveMatcher with requiredAssetIds = assetStack and forbiddenAssetIds = [] (conservative band-aid). Comment in code that this is temporary until Feature/Knowledge are refactored to Situations; edge-cases are acceptable for the interim. Resolved.
4. **Ephemera schema and lookup:** Add `perspectiveMatcher: PerspectiveMatcher` to EphemeraCacheRecord/EphemeraCacheDynamoItem; change internalCache.RenderCache.getExactMatch/generateRoomPreview to take `perspective: Perspective` (or assetStack) and filter by `perspectiveMatches(record.perspectiveMatcher, perspective)`. **Keep** perspectiveId on the record for now; comment that it is **known inactive** (not used for matching), kept pending possible later use for search optimization. Resolved.
5. **Concrete predicates for structural test:** Pin exact APIs: **Room** = has a situation facet **for the situation under consideration** (facet referencing this situationId), not just "any situation facets" (e.g. find in `room.situations?.items` a facet whose reference.universalKey === situationId). **Situation** = has marks (e.g. `situation.marks?.items?.length > 0` or the actual StandardSituation getter). Resolved.
6. **ExampleRemoved:** Include perspectiveMatcher in the payload (may be needed for invalidation or matching; rationale TBD). Resolved.

**Depends on**: Phases 2–5.6 (Situation component, SituationRoom facets, mirroring pipeline, and client perspective derivation are in place). Client-side perspective-from-origins and getPerspective selector are already implemented; this phase focuses on the event contract and backend handling.

**Implementation (Phase 5.7) (DONE)**:

- [x] **mtw-interfaces:** Add `perspectiveMatcher: PerspectiveMatcher` to ComponentExamplesLifecycleBase (event contract).
- [x] **Assets:** Add perspectiveMatcher to ExampleLifecycleBase; implement `roomHasFacetForSituation`, `situationHasMarks`, `computePerspectiveMatcherForRoomSituation` in exampleEnrichment; Room path emits perspectiveMatcher on ExampleUpdated and ExampleRemoved; Example path emits conservative matcher (requiredAssetIds = assetStack, forbiddenAssetIds = []) with band-aid comment.
- [x] **Ephemera:** Add perspectiveMatcher to EphemeraCacheRecord/EphemeraCacheDynamoItem and PutCacheRecordInput; comment perspectiveId as known inactive; dataSource sets perspectiveMatcher from event; internalCache.RenderCache.getExactMatch uses perspective and perspectiveMatches; generateRoomPreview builds perspective from assetStack.
- [x] **Tests:** Assets (perspective matcher helpers, Room/Example path payloads); Ephemera (componentExamples, cacheAccess, markStateUtils, generateRoomPreview, componentRender); mtw-interfaces event shape.
- [x] **Documentation:** renderCache/AGENT.md updated for perspectiveMatcher and matcher-based matching.

---

### Phase 6: Example deprecation (optional tech-debt cleanup)

**Goal**: Optionally deprecate and remove the `examples` property, the `<Example>` tag, and the `StandardExample` component type once migration to `situations` is complete. This phase is **optional** and can be deferred or skipped; the system operates correctly with both `examples` and `situations` present.

**Scope**:

- **Evaluation**: Assess whether any remaining WML or code still uses `examples`, `<Example>`, or StandardExample after Phases 1–5.6 (e.g. legacy assets, imports, or tools). If usage is zero or migration is complete, cleanup may be feasible.
- **If deprecating**: Define a deprecation path (e.g. parser still accepts `<Example>` but emits a warning; or one-time migration script from Example to Situation + situation facets). Then define removal steps: remove `examples` from Room/Feature/Knowledge data types and payloads; remove `<Example>` from schema and StandardForm/component factory; remove from any remaining lambda or UI references; delete the Example component implementation and tests.
- **If retaining**: Document that `examples` and Example are retained for backward compatibility and under what conditions they are used. Avoid adding new features to Example.

**Depends on**: Phase 5.6 complete; client and lambdas use `situations` (with ShortName support) as the primary model for world-state-specific prose.

