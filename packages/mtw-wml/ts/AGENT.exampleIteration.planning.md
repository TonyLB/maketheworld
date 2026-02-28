 # Example / Situation Iteration - Conceptual Notes

 **Status: PLANNING (implementation plan in place; no implementation work started)**

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

**Status: PLANNING (phased approach)**

This section outlines a phased plan to implement the Situation + situation-facets model. The playbook for adding a new component type is documented in [`standardize/components/AGENT.implementation.md`](./standardize/components/AGENT.implementation.md) under "Adding a New Component Type." Each phase below maps to that playbook where applicable.

### Phased Overview

1. **Phase 1: Situation component only** – Introduce `<Situation>` as a first-class component (world-state slice only). Establishes the new tag in the WML schema and StandardForm storage without changing Room/Feature/Knowledge references. *Steps detailed below.*
2. **Phase 2: Situation facets in StandardForm** – Refactor `examples` on Room, Feature, Knowledge from a ReferenceList of Examples to a SituationFacetList with situation-specific rendering payloads. Data model and WML/serialization only; no UI or lambda changes yet.
3. **Phase 3: Lambdas (non–render cache)** – Refactor `assets` and `ephemera` lambdas to replace special handling of Example data with Situation and situation-facet handling where applicable. Leaves renderCache for Phase 4.
4. **Phase 4: Render cache** – Larger refactor of the render cache (and any related systems) to key and store by Situation/situation-facet model instead of Example.
5. **Phase 5: Client UI** – Remove Example from the components payload and as an editable component in the client; add a Situation component editor; add a SituationFacetList editor at least for the Room component (Feature/Knowledge later if desired).
6. **Phase 6: Example deprecation (evaluate)** – Decide whether to deprecate and remove the `<Example>` tag and `StandardExample` component type; if so, define migration path and removal steps.

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

#### Step 3: Component type system (`standardize/components/dataTypes/abstract.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts`

- Add `'Situation'` to the `ComponentTag` type union (if not already included via schema).
- Add case to `componentTagFromUpperCase()`: `case 'SITUATION': return 'Situation'`.

#### Step 4: Component data types (`standardize/components/dataTypes/situation.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/situation.ts` (new file)

- Define `StandardSituationData` extending `StandardBaseData`:
  - `tag: 'Situation'`
  - Optional `marks?: FacetListData<string>` for the MarkFacetList serialization (same pattern as `StandardGuidanceData` in `guidance.ts`).
- Add `isStandardSituationData` type guard using `checkAll()` and `checkTypes()`.
- Export from `dataTypes/index.ts`: export type and type guard; add to `StandardComponentNonEditData` union and to `isStandardComponentData()`.

**Reference**: For marks-only structure, see `guidance.ts` (or `example.ts`) data type and how `MarkFacetList` is represented in serialization.

#### Step 5: Component implementation (`standardize/components/situation.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/situation.ts` (new file)

- **Payload** (`StandardSituationPayload`):
  - Store only `_marks: MarkFacetList` (no name/summary/description).
  - Implement `ComponentConstructorMethods<StandardSituationData>`: constructor, `fromJSON`, `fromSchema`, getters, `toJSON`, `schema`, `nestedSchema`, `merge`, `subset`, `referencedKeys`, `isEmpty`, `invert`; implement `mapContents` / `remapReferences` / `withChild` if needed. No `assureReferences` (Situation has no ReferenceLists); hosted Mark children are handled via **inline remainder** (Marks under Situation are hosted, not referenced in a list on Situation—they are consumed by `StandardizeConsumerFacetListMark` and contribute to `MarkFacetList`).
  - **fromSchema**: Use the process-and-remainder pipeline. Entry typeguard: `treeNodeTypeguard(isSchemaSituation)`. Consumers: `StandardizeConsumerFacetListMark` (to build `_marks` from Mark children with Match payloads), then `StandardizeConsumerInline` as last step to pass through any hosted Mark nodes for recursion. No `StandardizeConsumerReferenceList` (no reference lists).
- **Component class** (`StandardSituation`): Use `componentClassFactory(StandardSituationPayload, 'StandardSituation')`; expose getters that delegate to payload; override `_wrap`, `clone`, `equals` as needed.

**Reference**: `guidance.ts` for marks-only + facet-list consumer + inline remainder; `AGENT.implementation.md` for fromSchema pipeline and two-remainder shape.

#### Step 6: Factory integration (`standardize/componentFactory.ts`)

**Location**: `packages/mtw-wml/ts/standardize/componentFactory.ts`

- Import `StandardSituation`, `isStandardSituationData`, and `isSchemaSituation`.
- In `standardComponentFactory()`, add a case: when argument is JSON with `isStandardSituationData(arg)` or is a schema node with `treeNodeTypeguard(isSchemaSituation)(arg)`, return `new StandardSituation(arg)`.

#### Step 7: Processing integration (`standardize/index.ts`)

**Location**: `packages/mtw-wml/ts/standardize/index.ts`

- Add `'Situation'` to `COMPONENT_ORDER`.
- Add `(value instanceof StandardSituation) ||` to `isStandardComponent()`.

#### Step 8: Unit tests (`standardize/components/situation.test.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/situation.test.ts` (new file)

- Construction from JSON; construction from WML schema (string); `toJSON` and round-trip; `schema` and `nestedSchema`; merge; diff/equals; `isEmpty`; `invert`; behavior of `MarkFacetList` (parsing Mark + Match children, serialization).

**Reference**: `guidance.test.ts` and `example.test.ts` for MarkFacetList and fromSchema tests.

### Verification (Phase 1)

After Phase 1, the following should hold:

- [ ] `<Situation key=(...) uuid=(...)>` with nested `<Mark>`/`<Match>` children parses from WML.
- [ ] Situation can be created from JSON and via `standardComponentFactory` from schema.
- [ ] Situation is in `COMPONENT_ORDER` and passes `isStandardComponent()`.
- [ ] Situation can be stored in `StandardForm` and serialized/deserialized (round-trip).
- [ ] Situation has no ReferenceLists; Marks under Situation are consumed into `MarkFacetList` and do not create a reference list on Situation.
- [ ] All new unit tests pass.

### Phase 2: Situation facets in StandardForm

**Goal**: Change the internal representation of "examples" on Room, Feature, and Knowledge from a ReferenceList of Example components to a **SituationFacetList** whose facets reference Situations and carry the relevant rendering payload (e.g. DisplayName/Summary/Description for Room; Description for Feature/Knowledge).

**Scope** (data model and standardization only; no client UI or lambda behavior yet):

- Define situation-facet payload types and list types (e.g. `SituationRoomFacetList`, `SituationRoomFacet` with payload `{ name?, summary?, description? }`; analogous for Feature and Knowledge).
- Refactor `StandardRoom`, `StandardFeature`, `StandardKnowledge` to replace `examples: ReferenceList` with `examples: SituationRoomFacetList` (or the appropriate type per component). Follow existing facet-list patterns (e.g. `StandardizeConsumerFacetList*`, `assureReferences` / hosting as needed).
- Update WML schema and serialization: define how situation facets are represented in WML (e.g. `<Situation ref=(...)><DisplayName>...</DisplayName></Situation>` or equivalent) and ensure round-trip with StandardForm.
- StandardForm merge/diff/subset and component factory must work with the new facet lists; any code that today reads Room/Feature/Knowledge `examples` as a list of Example references must be updated to the new shape (within mtw-wml and any direct consumers).

**Depends on**: Phase 1 (Situation component exists).

---

### Phase 3: Lambdas (non–render cache)

**Goal**: Replace Example-specific logic in the **assets** and **ephemera** lambdas with logic that operates on Situations and situation facets. Excludes the render cache; that is Phase 4.

**Scope**:

- Identify all places in `lambda/assets` and `lambda/ephemera` (and any shared lambda patterns they use) that special-case Example data (e.g. enumerating Examples, keying by Example id, or interpreting Example content).
- Refactor those codepaths to use Situation and situation-facet data: e.g. enumerate Situations referenced by a Room’s situation-facet list; key or attribute data by situation id and component id where appropriate.
- Preserve existing behavior where it is equivalent (e.g. “list of world-state-specific descriptions for this room”); change only the data source from Example components to situation facets.
- Do **not** yet change how the render cache is keyed or populated; that is the larger refactor in Phase 4.

**Depends on**: Phase 2 (StandardForm and WML use situation facets).

---

### Phase 4: Render cache

**Goal**: Refactor the render cache (and any systems that depend on it) so that cache keys and stored data align with the Situation/situation-facet model instead of the Example model.

**Scope**:

- Redefine cache keys/records so they are expressed in terms of component + Situation (or equivalent), not component + Example. Align with the ephemera cache design notes in the conceptual section of this document (e.g. optional `situationId`, `markState` derived from Situation).
- Update cache read/write and invalidation to use the new keying and payload shape. Ensure enrichment and event logic that depend on the cache are updated.
- This phase is intentionally called out separately because it is a “bigger refactor” with broad impact; it may be broken into sub-steps (e.g. dual-write, then cutover) as needed.

**Depends on**: Phase 3 (lambdas already use Situation/situation facets where applicable).

---

### Phase 5: Client UI

**Goal**: Remove Example from the client as an editable component and from the components payload; add editors for Situation and for situation facets (at least on Room).

**Scope**:

- **Remove Example from client**:
  - Stop treating Example as an editable component in the UI (no Example-specific editor, no “add Example” flows that create Example components).
  - Remove or refactor any client code that puts Example components in the components payload or that relies on Example as a first-class editable entity. After Phase 2, the payload for “examples” is situation facets on Room/Feature/Knowledge, not a list of Example components.
- **Situation component editor**: Add a dedicated editor in the client UI for the Situation component (create/edit Situations: edit MarkFacetList / world-state slice). Situations remain first-class components in StandardForm and in the asset; the client must be able to create and edit them.
- **SituationFacetList editor**: Add an editor for the situation-facet list on at least the **Room** component UI (view/edit which Situations a Room has facets for, and edit the rendering payload per Situation—e.g. DisplayName, Summary, Description). Feature and Knowledge can be added later if desired.

**Depends on**: Phases 2–4 (data model, lambdas, and render cache all use Situation/situation facets so the UI can rely on them).

---

### Phase 6: Example deprecation (evaluate)

**Goal**: Decide whether to deprecate and remove the `<Example>` tag and the `StandardExample` component type, and if so, how.

**Scope**:

- **Evaluation**: Assess whether any remaining WML or code still uses `<Example>` or StandardExample after Phases 1–5 (e.g. legacy assets, imports, or tools). If usage is zero or migration is complete, deprecation may be feasible.
- **If deprecating**: Define a deprecation path (e.g. parser still accepts `<Example>` but emits a warning; or one-time migration script from Example to Situation + situation facets). Then define removal steps: remove from schema, from StandardForm/component factory, from any remaining lambda or UI references, and delete the Example component implementation and tests.
- **If retaining**: Document that Example is retained for backward compatibility and under what conditions it is used. Avoid adding new features to Example.

**Depends on**: Phase 5 complete; no client or lambdas rely on Example as the primary model for world-state-specific prose.

