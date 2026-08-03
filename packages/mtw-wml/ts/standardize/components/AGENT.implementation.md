# Standard Components - Implementation Details

## Overview

This document covers implementation details, architectural patterns, and component type specifications for the `standardize/components` directory. For conceptual overview and future requirements, see [`AGENT.md`](./AGENT.md). For practical usage examples, see [`AGENT.usage.md`](./AGENT.usage.md). For the `fromSchema` process-and-remainder pipeline and consumer pattern, see [fromSchema: process-and-remainder pipeline](#fromschema-process-and-remainder-pipeline) below.

## Technical Debt

### **CRITICAL: StandardImage Storage System Migration** 🔴

**Component**: `StandardImage`

**Problem**: `fileURL` property is brittle and complex to maintain. Images use UUID-based naming with separate `fileName` properties in asset JSON.

**Impact**: Image handling is fragile and requires complex coordination between components and asset storage.

**Proposed Solution**: Migrate to universalKey-based storage (`${universalKey}.png`) to eliminate separate properties and enable automatic cleanup.

**Related Documentation**: [`lambda/assets/AGENT.imageStorage.md`](../../../../lambda/assets/AGENT.imageStorage.md)

**Developer Note**: Current `fileURL` handling is temporary. Feel free to insert temporary stub implementations for images in order to progress on other functionality.

## Architecture: Data-Centric Storage vs. Tree-Structure Serialization

### Separation of Concerns

**Status**: ✅ **COMPLETE** - Migration to separate data-centric storage from tree-structure serialization is complete.

The component system maintains a clear separation between:
- **Data-centric manipulation**: `StandardForm` stores components in a flat list and performs operations (merge, diff, subset) on this data-centric structure
- **Tree-structure serialization**: `SchemaOrganization` converts the flat component data into a hierarchical tree structure for WML/JSON serialization and human readability

### Key Architectural Principles

- **StandardForm operations are data-centric**: Merge, diff, and subset operations work on flat component lists without requiring tree structure
- **SchemaOrganization is for serialization**: Used primarily when converting `StandardForm` to schema (WML/JSON output) and for ordering NDJSON data to match tree ordering
- **On-demand tree conversion**: Tree structure is computed only when needed for serialization, not during manipulation operations
- **Explicit parent precedence**: When building tree structure, explicit parent relationships take precedence over implicit parentage

### Key Components

- **`SchemaOrganization`**: Converts flat component data into hierarchical tree structure for serialization
  - Calculates implicit parents for tree ordering
  - Provides `getImplicitParent()` and `getChildrenOfParent()` for tree construction
  - Used in `StandardForm.schema` getter and `toNDJSON()` for ordering
- **`OrganizationContext`**: Interface providing parentage queries for tree construction during schema generation
- **`assureReferences()`**: Component method that ensures child references are present in parent's reference lists when rendering in parent context (used during schema generation)
- **`isParentContext()`**: Helper method to determine if a component is rendering in its parent's context (used during schema generation)

### Migration Status

- ✅ `implicitParent` field removed from `StandardComponent` interface (no longer stored on components)
- ✅ `StandardForm` operations (merge, diff, subset) work on data-centric structure without tree dependencies
- ✅ `SchemaOrganization` used only for serialization (schema generation and NDJSON ordering)
- ✅ `assureReferences` implemented for all component types with reference lists (used during schema generation)
- ✅ `nestedSchema` uses `OrganizationContext` for on-demand reference assurance during tree construction
- ✅ Component storage uses plain components only (no `StandardRemove`/`StandardReplace` wrappers)
- ✅ Replace operations removed from component/reference level (expressed as Add+Remove pairs)

### Reference and hosting (independent qualities)

**Reference** and **hosting** are two independent qualities of a parent–child relationship. Component A can reference Component B, host Component B, both, or neither.

- **Reference**: The parent **references** the child when it actively tracks that child in data it owns—e.g. a `ReferenceList` (features, examples, rooms, messages, marks) or a facet list (positions on a Map, marks on an Example). Either the parent references the child or it does not.
- **Hosting**: The parent **hosts** the child when the child's content is rendered under the parent in the tree structure (the hierarchy used for serialization and display). A component may be referenced in many places, but its content is centralized in one—that parent is the host. Either the parent hosts the child or it does not.

Common combinations: A Room typically references and hosts its Features. A Room may host a shared Mark without referencing it (the Mark's content is rendered under the Room in WML but the Room has no marks list). When implementing or debugging tree structure, ask separately: does the parent reference this child? Does the parent host this child? See also [AGENT.schemaOrganization.md](../AGENT.schemaOrganization.md) for how the tree is derived.

## shortName (platform contract)

Optional **`shortName`** is a first-class field on every **`StandardComponent`** tag (13/13). It is the human-facing anchor for UI, maps, breadcrumbs, and prompts where a readable label is needed. It is **not** stable identity.

### Identity vs display label

| Concept | Role |
| --- | --- |
| **`universalKey`** | Stable identity across assets and systems |
| **`key`** | Optional WML sugar for authoring and references |
| **`shortName`** | Optional human-readable label stored on the component (`StandardLiteral`) |

**Display labels in the UI** are a **charcoal-client presentation contract**, not part of mtw-wml serialization. mtw-wml exposes field accessors only (`component.shortName`, Character `displayName` via [`hasDisplayName`](../index.ts)). Human-readable titles in the client use [`componentDisplayLabel`](../../../../../charcoal-client/src/lib/componentDisplayLabel.ts) with this fallback chain: **shortName** -> **displayName** (Character only) -> **key** (when `includeKeyFallback` is true, default) -> **Situation marks-summary** when `standardForm` is passed (delegates to [`situationIdToLabel`](../../../../../charcoal-client/src/lib/situationLabel.ts)). The helper does **not** fall back to **universalKey** or uuid suffixes; callers pass **`fallbackLabel`** (e.g. `'Untitled'`) or apply their own default. See [`Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) and [`contentHeaders` slice AGENT.md`](../../../../../charcoal-client/src/slices/contentHeaders/AGENT.md) for call-site patterns.

**Lambda content headers** projection stays **shortName-only** ([`extractHeaderComponent`](../../../../../lambda/assets/contentHeaders/index.ts)) — not the full display-label chain.

### Optional semantics

`shortName` follows **omission-over-empty** everywhere: empty values are omitted from JSON/WML; the field is never required for a component to exist. Editors may still mark the field "required" in UX (e.g. Character) without model enforcement.

### Implementation

- **Interface:** `shortName?: StandardLiteral` on [`StandardComponent`](./baseClasses.ts).
- **Payload helpers:** [`shortNameField.ts`](./shortNameField.ts) (`createShortNameFromJSON`, `mergeShortName`, `invertShortName`, `shortNameSchemaChildren`, `standardizeShortNameConsumer`, etc.). All component payloads with `shortName` (Character, Feature, Guidance, Image, Knowledge, Lens, Map, Mark, Message, Moment, Room, Situation) use these helpers for fromJSON/fromSchema/merge/invert/schema/toJSON.
- **Wrapper access:** `componentClassFactory` exposes `get shortName()` delegating to the payload ([`component.ts`](./component.ts)).
- **Immutable update:** `withShortName(literal)` on [`StandardComponent`](./baseClasses.ts) clones the component and sets payload `_shortName` when the payload is a [`ShortNamePayloadHost`](./shortNameField.ts); otherwise returns an unchanged clone. Does not normalize empty/whitespace (callers such as Workbench `prepareComponentForFlush` apply omission-over-empty before calling).
- **Round-trip tests:** [`shortNameRoundTrip.test.ts`](./shortNameRoundTrip.test.ts) (parameterized matrix across component tags); `withShortName` covered in [`component.test.ts`](./component.test.ts).

**Removed vestiges:** `HasShortName` and exported `hasShortName()` were removed as redundant with `StandardComponent.shortName`. Use `component.shortName` directly. Local `const hasShortName = Boolean(...)` inside payload `isEmpty()` methods is unrelated.

**Direct `_payload._shortName` assignment** is allowed only in: legacy Workbench `updateStandard` editors not on `WorkbenchComponentProvider` (see asset-level exceptions in [Workbench AGENT.md](../../../../charcoal-client/src/components/Workbench/AGENT.md#asset-level-updatestandard-exceptions)), `StandardForm.subset` Room stub copy ([`index.ts`](../index.ts)), and tests. Feature, Knowledge, Room, Area, Guidance, Mark, and Lens shortName editors use the session + **`withShortName()`** on flush (`prepareComponentForFlush`). Prefer **`withShortName()`** for new code.

### Asset `StandardForm._shortName` (not component shortName)

**Asset-level** `_shortName` on `StandardForm` is **asset title metadata**, separate from per-component `shortName`. Do not conflate the two. See [`../AGENT.md`](../AGENT.md) (omission-over-empty and asset metadata).

### Character: `shortName` vs `displayName`

**StandardCharacter** keeps both fields:

- **`shortName`:** Authoring / Workbench "Short Name" tag.
- **`displayName`:** In-world character name (`StandardRender`).

[`HasDisplayName`](./abstract.ts) and [`hasDisplayName`](../index.ts) apply to **displayName only** — not a general shortName guard.

### **StandardObject**

- **Purpose**: Improvisational first-class object merge body (**`shortName`** only on pair JSON; Coyote **`stableKey`** / tropes on **`Meta::Object`**, not here), plus **`situations`** display prose (iteration 10, "object-character-render-hosts")
- **Content Properties**: `shortName` (`StandardLiteral`); **`situations`** as **`SituationProseFacetList`** (shared payload with Room/Feature/Knowledge); optional ephemera **`render`** (`SituationProseFacetPayload`-shaped JSON)
- **Storage / merge**: ephemeraDB pair row under **`ASSET#IMPROVISATION`**; read via **`internalCache.ImprovisationComponentData`** and ephemera composite **`internalCache.ComponentData`**; **`ComponentAggregate`** merges when **`ASSET#IMPROVISATION`** is last in participation order (append via **`appendImprovisationToPerspective`** when objects in scope)
- **Wire**: Room-nested **`<Object>`** under **`<Room>`** feeds **`StandardRoom.objects[]`** for affordance emit (**I6**); top-level **`<Object>`** under **`<Asset>`** in **ephemeraWire** is **`StandardObject`** for merge/storage. Asset mode rejects room **`objects[]`** and defined **`render`** on **`StandardObject`**; top-level **`StandardObject`** itself (including **`situations`**) is allowed in asset mode as of iteration 10.
- **fromSchema**: `ShortName` (required — schema `finalize` still enforces exactly one), **`StandardizeConsumerFacetListSituation`**, `Render` (`StandardizeConsumerSimple`, same DisplayName/Summary/Description-triplet rule as Feature), inline `ref={0}` children. Schema-layer `typeCheckContents`/`finalize` (`schema/converters/components.ts`) admit **`ShortName`**, **`Situation`**, **`Render`**, and (as of iteration 10) **`Replace`/`Remove`** children. **`Render`**'s own parent whitelist (`Render.initialize`) now includes Object, so `<Render>` round-trips under `<Object>` as WML text — that whitelist entry landed once Object's ephemera-wire render path actually shipped (spawn-time `SITUATION#DEFAULT` prose reaching `objectRenderWmlFromCacheRecord.ts`). Note `<Object>` still structurally requires exactly one non-empty `<ShortName>`, so Object emits `<Render>` **alongside** `<ShortName>`, not in place of it (unlike Feature/Knowledge, which emit `<Render>` alone).
- **ShortName Replace/With editing (iteration 10 fix):** unlike Feature/Room, Object's schema converter does its own `typeCheckContents`/`finalize` gatekeeping rather than deferring entirely to the standardize layer, and previously only admitted a bare `<ShortName>` child — silently making `<Replace><ShortName>.../</Replace><With><ShortName>.../</With>` impossible under `<Object>` (the finalize function would find no direct-match `ShortName` node and throw). `finalize` now uses `splitTaggedChildren` (`schema/utils`) — the same Remove/Replace-aware matcher the standardize layer's `StandardizeConsumerStandardLiteral` uses — so a Remove/Replace-wrapped ShortName edit satisfies the "must have a ShortName" requirement and round-trips through merge/diff like every other component's shortName. A bare `<ShortName>` is still canonicalized (concatenated, trimmed, non-empty-validated) as before; a wrapped edit is passed through unresolved, since its final text only exists after merge.
- **Tests**: [`object.test.ts`](./object.test.ts), [`object.ephemeraWire.integration.test.ts`](./object.ephemeraWire.integration.test.ts)
- **Related**: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md), [`packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md`](../../../../../packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md), [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#object-room-placement-nodes-only), [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectCharacterRenderHosts.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectCharacterRenderHosts.planning.md)

## Component Types

### **StandardCharacter** ✅
- **Purpose**: Represents characters with name, shortName, pronouns, and image, plus **`situations`** display prose (iteration 10, "object-character-render-hosts")
- **Content Properties**: `name` (now `StandardRender`), `image` (remains `EditWrappedStandardNode`); **`situations`** as **`SituationProseFacetList`** (shared payload with Room/Feature/Knowledge/Object); optional ephemera **`render`** (`SituationProseFacetPayload`-shaped JSON)
- **fromSchema**: ShortName, Pronouns, DisplayName, Image, **`StandardizeConsumerFacetListSituation`**, `Render` (`StandardizeConsumerSimple`, same DisplayName/Summary/Description-triplet rule as Feature). No **`StandardizeConsumerInline()`** in the pipeline (pre-existing; unrelated to this addition) — unconsumed non-Situation/Render child tags still fail parse.
- **Asset wire policy:** `assetWirePolicyForComponent` has no branch for `StandardCharacter` — falls through unrestricted (including any future `render`); not part of iteration 10's RH-3 scope.
- **Schema layer**: `Character`'s converter has no `typeCheckContents`/`finalize` (unrestricted at parse time already), so no schema-layer change was needed to admit `<Situation>`. `Render`'s parent whitelist includes Character (added when Character's ephemera-wire render path landed); Object joined it later on the same terms.
- **Status**: ✅ Technical debt resolved

### **StandardImage** 🔴
- **Purpose**: Represents images with fileURL
- **Content Properties**: `fileURL` (string)
- **Status**: 🔴 Has critical technical debt (see Technical Debt section below)

### **StandardAction**
- **Purpose**: Represents actions with name and description
- **Content Properties**: `name`, `description` (both `StandardRender`)

### **StandardRoom** 🟢
- **Purpose**: Represents rooms with exits, situation facets, lens, features, guidance, characters, and optional ephemera **`render`** / **`objects`**
- **Content Properties**: `shortName` (`StandardLiteral`); exits as **`ExitFacetList`**; **`situations`** as **`SituationProseFacetList`**; optional ephemera **`render`** (`SituationProseFacetPayload`-shaped JSON)
- **Reference Properties**: **`lens`** (`SingleReference`), **`features`**, **`guidance`**, **`characters`** (`ReferenceList`). **No** serialized **`examples`** field on **`StandardRoomData`**. Room prose is **Situation** facets and optional ephemera **`render`**.
- **Room prose (preferred)**: Author **Situation** facets; resolved wire prose on **`StandardRoom.render`**. See [`../../AGENT.md`](../../AGENT.md) (**Room** bullets) and [`../AGENT.md`](../AGENT.md) (**Room prose**).
- **Ephemera wire**: Optional **`objects`** (`{ uuid: string; shortName: string }[]`) from room-nested **`<Object uuid=(...)><ShortName>...</ShortName></Object>`** children (affordance wire; see **`StandardObject`** for top-level ephemeraWire merge). **`uuid`** values are canonical **`OBJECT#...`** in memory. Asset **`StandardForm.validate()`** rejects non-empty **`objects`**. See **`standardize/AGENT.md`** (**Object dual wire contexts**).
- **fromSchema**: Uses the process-and-remainder pipeline. Consumers include ShortName, Exit, Lens, Feature, Situation (facet list), Guidance, Character, Position (no-op), Grant, DisplayName (no-ops for backward compatibility), plus **`Object`** and **`Render`**. Unconsumed **`<Example>`** (tag removed) fails parse. See [fromSchema: process-and-remainder pipeline](#fromschema-process-and-remainder-pipeline) below.
- **Room-local exits (M6 shipped):** Legacy **`<Exit to=(...)>`** under **Room** is **forbidden in asset authoring**. **`new StandardForm(wml, { standardizeMode: 'asset' })`** throws when room-local exit WML is present; **`validate()`** also rejects non-empty **`exits`**. Area topology exits using **area exit endpoint tags** mis-placed under **Room** are consumed but silently dropped when **`StandardExitFacet`** cannot resolve **`to=`**.
- **ephemeraWire exit source:** At play time, navigable **`StandardRoom.exits`** on affordance/nav wire forms come from **Area** topology projection (**`projectRoomExits`** via gateways **`componentTopology`**), not from room blueprint rows. See [`../keys/edges/AGENT.edges.md`](../keys/edges/AGENT.edges.md).
- **Asset wire policy:** Enforced on **`StandardForm`** with **`standardizeMode === 'asset'`** via **`validateAssetWirePolicy()`**, not in payload **`fromSchema`**. **`toJSON()`** / **`schema`** serialize in-memory state faithfully; see **Mutation bypass risk** in **`standardize/AGENT.md`**.

### **StandardFeature** 🟢

- **Purpose**: Represents features with a short-name and display prose via **Situation** facets
- **Content Properties**: `shortName` (`StandardLiteral`); **`situations`** as **`SituationProseFacetList`** (shared payload with Room); optional ephemera **`render`** (`SituationProseFacetPayload`-shaped JSON)
- **Asset wire policy:** **`validateAssetWirePolicy()`** rejects defined **`render`** on asset **`StandardForm`** instances.
- **fromSchema**: `ShortName`, **`StandardizeConsumerFacetListSituation`**, inline `ref={0}` children; unconsumed **`<Example>`** fails parse

### **StandardKnowledge** 🟢

Same as **StandardFeature**: **`situations`** facet list, shared **`SituationProseFacetPayload`**, DEFAULT-only in v1; no **`examples`** on **`StandardKnowledgeData`**.

- **Purpose**: Represents knowledge items with a short-name and display prose
- **Content Properties**: `shortName` (`StandardLiteral`); **`situations`** as **`SituationProseFacetList`**; optional ephemera **`render`**
- **Asset wire policy:** **`validateAssetWirePolicy()`** rejects defined **`render`** on asset **`StandardForm`** instances.
- **fromSchema**: Same consumer pattern as Feature (Situation facets only; no Example dual-read)

### **StandardMessage** 🟢
- **Purpose**: Represents messages with optional short-name, description, and room references
- **Content Properties**: `shortName` (`StandardLiteral`), `description` (`StandardRender`)
- **Reference Properties**: `rooms` (`ReferenceList`)
- **fromSchema**: Uses the process-and-remainder pipeline (tags: `ShortName`, `Description`, `Room`). Unknown child tags are rejected as unconsumed (subject to schema-layer validation of legal child tags).

### **StandardMoment** 🟢
- **Purpose**: Represents moments with optional short-name and message references
- **Content Properties**: `shortName` (`StandardLiteral`)
- **Reference Properties**: `messages` (`ReferenceList`)
- **fromSchema**: Uses the process-and-remainder pipeline (tags: `ShortName`, `Message`). Unknown child tags are rejected as unconsumed (subject to schema-layer validation of legal child tags).

### **StandardArea** 🟢
- **Purpose**: Large spatial regions (districts, biomes, building complexes, etc.). v1 models **participation in space** via participant references and **topology edges** on `positionGraph`.
- **Content Properties**: `shortName` (`StandardLiteral`); **`positionGraph`** via [`StandardPositionGraph`](./positionGraph.ts) (see [`dataTypes/positionGraph.ts`](./dataTypes/positionGraph.ts)).
- **Reference Properties**: Heterogeneous **`positionGraph.nodes`** (`ReferenceList`) with tags `Area`, `Room`, `Feature`, `Character`. **`positionGraph.edges`**: [`ExitEdgeList`](../keys/edges/exitEdge.ts) (v1 **Exit** member; uuid-keyed merge). See [`../keys/AGENT.referenceList.md`](../keys/AGENT.referenceList.md) and [`../keys/edges/AGENT.edges.md`](../keys/edges/AGENT.edges.md).
- **JSON**: `positionGraph: { nodes?, edges? }`; omit `positionGraph` when both are empty (omission-over-empty).
- **WML**: Participant refs are **direct children** of `<Area>`; **`<Exit uuid=(...)>`** blocks with **`<From>`**, **`<To>`**, **`<Forward>`**, **`<Back>`** populate **`edges`** (see **Area exit endpoint tags** in [`../keys/edges/AGENT.edges.md`](../keys/edges/AGENT.edges.md#topology-invariants)).
- **fromSchema**: Four `StandardizeConsumerReferenceList` consumers append into `positionGraph.nodes`; **`StandardizeConsumerSimple`** for **`Exit`** appends into **`positionGraph.edges`** with **area exit endpoint tags** asset-mode validation (reject **`to=`**, require **`uuid`** + endpoint children). Strict remainder for unknown tags. **Self-reference** in `nodes` throws. Tests: [`area.test.ts`](./area.test.ts), [`../keys/edges/exitEdge.test.ts`](../keys/edges/exitEdge.test.ts).
- **`referencedKeys()`**: Participant refs from `positionGraph.nodes` as **Direct** / **Dependency**; **`From`** / **`To`** endpoint refs from `positionGraph.edges` as **`Edge`** (non-structural; subset cascade **`connectionType: 'Edge'`** -> target Room **`Stub`**). See [`standardForm.subset.test.ts`](../integration/standardForm.subset.test.ts) (area edge cascade).
- **Participant endpoint rule**: When both endpoints resolve, at least one must match a ref in `positionGraph.nodes` (`sameKey`); portal edges allowed. **Not** a standardize hard error --- use [`areaTopologyValidation.ts`](./areaTopologyValidation.ts) for warnings/lint. Incomplete edges are valid in storage. **Semantic filter:** [`projectRoomExits`](../projection/projectRoomExits.ts) skips edges that cannot produce a facet. See [`../keys/edges/AGENT.edges.md`](../keys/edges/AGENT.edges.md#incomplete-edges-and-projection).
- **Ephemera wire**: **`standardizeMode: 'ephemeraWire'`** supported from day one; see [`area.ephemeraWire.integration.test.ts`](./area.ephemeraWire.integration.test.ts). **Top-level** `<Area>` in asset `topLevel` is encouraged (primary candidate for world-region authoring).
- **Cross-package (asset persistence)**: Lambda **`cacheAsset`** writes component rows with `AssetId = AREA#...` and `Meta::Area` via dynamic `Meta::${component.tag}` --- same pattern as Room/Map (see [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../../../lambda/assets/dataSource/caching/AGENT.diff.md)). Persisted **`referencedBy`** on forward rows; skinny **`TopologyInvalidated`** via [`lambda/assets/componentTopology/AGENT.md`](../../../../../lambda/assets/componentTopology/AGENT.md). **Workbench authoring:** [`charcoal-client/src/components/Workbench/AreaEdit/`](../../../../../charcoal-client/src/components/Workbench/AreaEdit/) --- `shortName`, heterogeneous **`positionGraph.nodes`**, uuid-keyed **`positionGraph.edges`** (`From` / `To` / `Forward` / `Back`). Room editor no longer includes exit authoring UI. **Import UI:** `SchemaImportMapping` includes `Area`; charcoal-client `ImportComponentDialog` and reference-list import affordances surface Areas from content headers (e.g. `AREA#WORLD` from primitives). Ephemera render orchestration and `LegalDependencyTag` still exclude Area until play/UI follow-on. **`fetchImports`** subset cascade for Area topology edges remains a separate follow-on.
- **Runtime projection (shipped):** Ephemera affordance pipeline hydrates **`projectRoomExits`** via gateways **`componentTopology`** and **`affordanceCache`** ([`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md), [`affordanceCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md)). Production Coyote overlay topology and exit inventory: [`AGENT.CoyoteGame.implementation.md`](../../../../../AGENT.CoyoteGame.implementation.md) (**Overlay asset topology**). Topology invariants and incomplete-edge projection: [`../keys/edges/AGENT.edges.md`](../keys/edges/AGENT.edges.md). Ephemera affordance compose path: [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) (**Area topology and affordance exits**).

### **StandardImage** 🔴
- **Purpose**: Represents images (see Technical Debt note above for storage)
- **Content Properties**: `shortName` (`StandardLiteral`)
- **Status**: 🔴 Still has storage-related technical debt (see Technical Debt section), but `fromSchema` now uses the process-and-remainder pipeline (tag: `ShortName`) so unknown child tags are rejected as unconsumed.

## Architectural Patterns

### Component Architecture

Each component follows a consistent pattern:
- **Payload Class**: Handles data storage and manipulation logic
- **Component Class**: Provides the public API and inheritance structure
- **Data Types**: Define serialization formats for storage

### Omission-Over-Empty Principle

All StandardComponent `toJSON()` implementations follow the **omission-over-empty** principle:

- **Empty fields are omitted** from JSON output rather than included with empty values (including empty arrays)
- **Non-empty fields are always included** with their actual values
- **Required identifiers** (tag, key, universalKey) are always present

**Examples:**
```typescript
// Room with no exits - exits field is omitted
const emptyRoom = new StandardRoom({ tag: 'Room', key: 'room1' })
emptyRoom.toJSON() // { tag: 'Room', key: 'room1' } - no exits field

// Room with exits - exits field is included
const roomWithExits = new StandardRoom({ 
    tag: 'Room', 
    key: 'room2', 
    exits: [/* exit data */] 
})
roomWithExits.toJSON() // { tag: 'Room', key: 'room2', exits: [...] }
```

This principle ensures that:
- JSON output is compact and contains only meaningful data
- Empty arrays/objects don't clutter serialized data
- Required identifiers are always present for component identification
- Storage and transmission formats remain efficient

### **StandardMark** 🟢
- **Purpose**: Represents marks with optional shortName and description, and can embed rich-text content with links.
- **Content Properties**: `shortName` (`StandardLiteral`), `description` (`StandardRender`)
- **Status**: 🟢 Uses the process-and-remainder pipeline for `fromSchema` (tags: `ShortName`, `Description`). Unknown child tags are rejected as unconsumed.

### **StandardLens** 🟢
- **Purpose**: Represents lenses that attach Marks and rich-text description to other components.
- **Content Properties**: `shortName` (`StandardLiteral`), `description` (`StandardRender`)
- **Reference Properties**: `marks` (`ReferenceList` of `Mark` references)
- **fromSchema**: Uses the process-and-remainder pipeline (tags: `ShortName`, `Description`, `Mark`). Unknown child tags are rejected as unconsumed.

### fromSchema: process-and-remainder pipeline

Payloads that parse from WML schema use a **process-and-remainder pipeline** so that each child is consumed exactly once and unknown tags are rejected.

- **Pattern (single remainder):** The payload builds an ordered list of `StandardizeConsumer` steps and calls `processWithConsumers(this, consumers, node.children)`. Each step consumes one (or more) tag(s) from the current children and returns the remainder for the next step. The runner throws if the final remainder is non-empty.
- **Rule:** Unconsumed child tags are an error (no silent ignore). The error message lists unconsumed tag names (e.g. `Unconsumed child tags: Map`).
- **Simple components:** Use `StandardizeConsumerSimple`, `StandardizeConsumerStandardLiteral`, and/or `StandardizeConsumerReferenceList` with `{ tag, update }`; the order of steps is the contract for what the component accepts. Tags that should be accepted but not stored (e.g. Position, Grant) use a no-op `update`.
- **Pipeline usage:** All component payloads use the process-and-remainder pipeline for `fromSchema`. Most use tag-based consumers only (see component sections above for each component's accepted tag set); Map, Example, and Guidance add facet-list consumers (e.g. `StandardizeConsumerFacetListPosition`, `StandardizeConsumerFacetListMark`).
- **Consumer types:** Use `StandardizeConsumerSimple` or `StandardizeConsumerStandardLiteral` for a single tag → one property; `StandardizeConsumerRender` for rich-text tags (Description, DisplayName, etc.); `StandardizeConsumerReferenceList` for component references (Feature, Example, Room, Message, Mark under Lens, etc.); `StandardizeConsumerFacetListPosition` / `StandardizeConsumerFacetListMark` for facet data (Map positions, Example/Guidance mark facets); `StandardizeConsumerInline` as the last step when the component has reference or facet consumers, to accept and forward hosted component nodes (e.g. Mark under Room) that don't map to a bucket. Implementation: [fromSchemaPipeline.ts](./fromSchemaPipeline.ts), [fromSchemaPipeline.test.ts](./fromSchemaPipeline.test.ts).
- **Shared `shortName` lifecycle:** See [shortName (platform contract)](#shortname-platform-contract) for lifecycle helpers, display-label boundaries, and assignment rules.

#### Division of responsibility (Schema vs Standardize)

**Where to add child-validation rules:** Add new rules for *which child tags are allowed under a parent* in the **Standardize layer** (each component's `fromSchema` consumer pipeline), not in the schema layer.

- **Schema parsing** is responsible for **syntactic correctness** and **property-level validation** (e.g. attributes, content models for tags like Exit, Parent, Key, Description). It does not enforce per-component child-tag whitelists; children are passed through to Standardize.
- **Component payloads** (`fromSchema` pipelines) are responsible for **semantic correctness of child structures**: which tags are accepted, in what combinations. The ordered consumer list is the single source of truth; `processWithConsumers`'s final remainder check throws `Unconsumed child tags: …` for unknown or misplaced children.

#### Typeguard usage rubric

- **Keep** typeguards that express **structural shape** of schema nodes (e.g. `isSchemaMessage`, `isSchemaDescription`, `isSchemaImage`, `isSchemaOutputTag`) and use them where we need to safely manipulate typed trees (building `StandardRender`, handling `Image` payloads, etc.).
- **Keep** root-level typeguards in `fromSchema` as cheap assertions that the payload was called with the correct `Schema*Tag` (good error messages, low complexity).
- **Prefer removing or relaxing** typeguard-based checks whose only purpose is to enforce *which child tags are allowed under a parent* at the schema layer; those rules belong in the component's consumer pipeline and are enforced via the unconsumed-remainder check.
- When auditing existing code: treat "is this node structurally a X?" uses of typeguards as **still valuable**; treat "is X allowed under Y?" uses as **legacy** candidates to move into the Standardize layer.

#### Two-remainder shape and processComponents recursion

The fromSchema pipeline now supports a **two-remainder shape** that is fully integrated with `processComponents`:

- **Parsing remainder:** As before, each consumer returns a `parsingRemainder` (children not consumed by that step). `processWithConsumers` threads this through the consumer list and throws if the final remainder is non-empty. This preserves the existing \"unconsumed children = error\" contract.
- **Return remainder:** Each consumer also returns a `returnRemainderAddition` that represents child schema to be re-exposed to `processComponents` for recursion. `processWithConsumers` aggregates these additions into a single `returnRemainder` and returns it to the payload.
- **Reference and facet consumers:** Reference-list consumers (`StandardizeConsumerReferenceList`) contribute their matched component nodes (Feature, Example, Room, Message, Mark under Lens, etc.) to the return remainder. Facet-list consumers (`StandardizeConsumerFacetListPosition`, `StandardizeConsumerFacetListMark`) contribute cleaned component nodes (e.g., `Room` without `Position`, `Mark` without `Match`) that should be materialized as child components.
- **Component wrapper:** `StandardComponent.fromSchema(node)` strips `Key`/`Parent`, sets wrapper fields, and delegates to `this._payload.fromSchema(nodeWithoutParentAndKey)`. It returns the payload's `returnRemainder`. Constructors that receive schema nodes call `this.fromSchema(node)` and ignore the returned remainder; the remainder is consumed by `processComponents`.

`standardComponentFactory` exposes this shape to the processing pipeline:

- For schema-based construction, the factory builds an \"empty\" component instance, calls `instance.fromSchema(node)`, and returns `{ component: instance, remainder }`.
- For data-based construction, it returns `{ component: new StandardX(data), remainder: [] }` so existing callers remain behavior-neutral.

`processComponents` now **recurses only into this returned remainder**, not into the raw `item.children`:

- When an `isSchemaComponent(item)` is encountered, `processComponents` calls `standardComponentFactory(item)` and recurses into the `remainder` it returns. This remainder is exactly the set of child schema nodes that component payloads have chosen to expose for further processing (via ReferenceList and facet-list consumers).
- Top-level detection, Remove/Replace handling, and `referenceCollection` construction remain unchanged; only the **source of child schema for recursion** has shifted from `item.children` to the payload-controlled `remainder`.

Practically, this means:

- **Only** consumers that contribute to `returnRemainderAddition` (ReferenceList and facet-list consumers) can cause additional components to be discovered beneath a given parent.
- Tags consumed by literal/render/simple consumers are **internal** to the component's payload and are never revisited by `processComponents`.

### assureReferences Method

The `assureReferences` method is the single point where `ref={0}` references are introduced in the component system. It ensures that child components that should be displayed in a parent context are present in the appropriate reference buckets **during schema generation** (when converting data-centric structure to tree structure).

#### Purpose

- **Single source of `ref={0}`**: This is the ONLY place where `ref={0}` references should be introduced (though they can be deserialized from WML format)
- **Component-specific dispatch**: Each component type handles its own bucket structure (e.g., Room dispatches to lens, features, guidance, and characters by tag)
- **Tree structure assurance**: Ensures that components with implicit or explicit parentage appear in their parent's reference lists when building the tree structure for serialization
- **Used during schema generation**: Called on-demand when `nestedSchema` is generating the hierarchical tree structure from the flat component data

#### Method Signature

- **Payload interface** (`ComponentConstructorMethods`): `assureReferences?(children: StandardReference[]): AssureReferencesResult<this>` (optional)
- **Component interface** (`StandardComponent`): `assureReferences(children: StandardReference[]): StandardComponent` (required)
- **Return type** (`AssureReferencesResult<T>`): `{ payload: T; inlineRemainder: StandardReference[] }` — `payload` has bucketed references merged; `inlineRemainder` holds references that are **hosted** by this parent (they appear as tree children but have no reference-list bucket on this component, e.g. Mark under Room)

#### Behavior

- **Pure function**: Returns a result object; does not mutate the original payload
- **Idempotency**: Calling `assureReferences` multiple times with the same children should produce equivalent results (for the payload)
- **Delegation pattern**: Component wrapper delegates to payload's `assureReferences` if available, extracts `payload` for the component, discards `inlineRemainder` (nestedSchema uses payload directly)
- **Reference handling**:
  - Partitions children into bucketed (tag maps to a ReferenceList) vs remainder (no bucket)
  - Bucketed children: merged into payload buckets with `ref={0}` where appropriate; uses `StandardReference.sameKey()` and leaves existing non-zero refs unchanged
  - Remainder: returned in `inlineRemainder` with `ref={0}` for rendering as hosted children at the parent level in schema output

#### Component-Specific Dispatch

Each component type implements its own dispatch logic (bucket tags); all other tags go to `inlineRemainder` (hosted children):
- **StandardRoom**: Buckets Lens, Feature, Guidance, Character (`Example` is **not** a reference-list bucket on Room; inline **`ref={0}`** Examples are tracked separately for schema and subset; see **StandardRoom** section above)
- **StandardFeature**: Situation facets via **`StandardizeConsumerFacetListSituation`** (not Example)
- **StandardKnowledge**: Situation facets via **`StandardizeConsumerFacetListSituation`** (not Example)
- **StandardMoment**: Bucket Message
- **StandardMessage**: Bucket Room
- **StandardLens**: Bucket Mark
- All component types with reference lists now implement `assureReferences` (migration complete)

#### Relationship to Other Operations

- **Non-zero refs elsewhere**: All other reference manipulation (merge, diff, withChild, etc.) should use non-zero refs
- **Used by nestedSchema**: Called on-demand in `nestedSchema` via `OrganizationContext` to ensure references are present when building tree structure for serialization
- **Tree construction integration**: Works with `SchemaOrganization` (via `OrganizationContext`) to determine which children should be assured based on implicit/explicit parentage when converting flat data to tree structure
- **SchemaOrganization integration**: `StandardForm.schema` getter uses `SchemaOrganization.getChildrenOfParent()` to get asset-level children for tree construction and passes `OrganizationContext` to `nestedSchema` calls
- **Not used in data operations**: `assureReferences` is not called during merge, diff, or subset operations - those work on the data-centric structure directly

#### Implementation Pattern

The method follows the same delegation pattern as `invert()`:
1. Component wrapper clones itself
2. Checks if payload has `assureReferences` method
3. If yes, calls it and updates the payload
4. Returns the cloned component

This allows gradual rollout: components without payload implementation return unchanged.

### Reference Mapping Pattern

The component system maintains a clear architectural boundary between the component wrapper and payload implementation regarding reference mappings:

#### Component Wrapper State

- **`_mapping` property**: The component wrapper (`GeneratedComponentClass`) stores reference mappings in a private `_mapping?: StandardReference[]` property
- **Set via `withMapping()`**: Mappings are established when components are prepared for operations that require reference resolution (e.g., schema generation, remapping)
- **Component-level access**: Methods on the component wrapper can access `this._mapping` directly

#### Payload Method Parameters

- **No direct state access**: Payload methods (`ComponentConstructorMethods` implementations) do NOT access component wrapper state directly
- **Mappings passed as parameters**: Payload methods that require mappings accept them as optional parameters:
  - `schema(key?: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag>`
  - `nestedSchema(lookup, options: NestedSchemaOptions)` where `NestedSchemaOptions` includes `mappings?: StandardReference[]`
- **Explicit dependency**: This makes the dependency on mappings explicit and testable

#### Component Wrapper Delegation

The component wrapper passes mappings to payload methods:

```typescript
// Component wrapper schema getter
get schema(): GenericTreeNode<SchemaTag> {
    const payload = this._payload.schema(this.key, this.universalKey, this._mapping)
    // ...
}

// Component wrapper nestedSchema method
nestedSchema(lookup, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
    const payload = target._payload.nestedSchema
        ? target._payload.nestedSchema(lookup, { ...options, mappings: target._mapping })
        : target._payload.schema(target.key, target.universalKey, target._mapping)
    // ...
}
```

#### Benefits

- **Clear separation of concerns**: Payload implementations remain pure and don't depend on component wrapper state
- **Testability**: Payload methods can be tested independently by passing mappings directly
- **Flexibility**: Different mapping strategies can be applied without modifying payload implementations
- **Explicit dependencies**: The need for mappings is clear from method signatures

#### Usage Examples

**Schema generation with mappings:**
```typescript
// Component wrapper automatically passes _mapping to payload
const component = someComponent.withMapping(mappings)
const schema = component.schema  // Uses this._mapping internally

// Payload method receives mappings as parameter
schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
    // Use mappings to remap Links in StandardRender to 'key' format
    this._name?.nestedSchema({ tag: 'Name', mappings })?.[0]
}
```

**Nested schema with mappings:**
```typescript
// Component wrapper passes mappings through options
nestedSchema(lookup, { ...options, mappings: target._mapping })

// Payload receives mappings in options
nestedSchema(lookup, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
    const { mappings } = options
    // Use mappings for reference formatting
}
```

#### Reference remapping contract (`remapReferences` vs `schema`)

Two paths serve different purposes; do not conflate them in tests or UI expectations.

| Mechanism | Typical `mapTo` | Mutates stored payload? | Used for |
|-----------|-----------------|-------------------------|----------|
| **`remapReferences(mapTo)`** on component / payload | `universal`, `both`, or `key` | Yes | `StandardForm.toJSON()`, `finalize()`, merge prep before key-change merge, diff baseline |
| **`schema()` / `nestedSchema({ mappings })`** | Usually resolves to **`key`** for authoring WML | No (display-time lookup) | Human-readable WML in editors; may show local keys while stored exits/links remain universal |

**`remapReferences`** on embedders with situation prose must update **`SituationProseFacetList`** (facet reference + payload prose) and optional **`_render`** (`SituationProseFacetPayload`). **`referencedKeys(mapping)`** and **`remapReferences`** should cover the same link surfaces.

**Situation prose schema emission**: **`StandardFeaturePayload`**, **`StandardKnowledgePayload`**, and **`StandardRoomPayload`** pass **`mappings`** from **`schema(..., mappings)`** / **`nestedSchema(..., { mappings })`** into situation facet **`renderFacet(..., lookup, mappings)`** and **`renderPayloadToSchemaNode(_render, mappings)`**, which thread into **`SituationProseFacetPayload.toProseTripletChildren({ mappings })`** for Summary/Description links.

**Key rename on merge**: After `<Key>` Replace merges, `StandardForm.merge()` runs **`mapContents`** with collected renames so exits, map positions, and situation facet prose links retarget in **stored** data. See `standardForm.keyChangesViaMerge.test.ts`.

## Adding a New Component Type

This section provides a step-by-step guide for adding new component types to the WML system. This process establishes the necessary infrastructure so that new components can be parsed from WML, created programmatically, stored in `StandardForm`, and participate in merge/diff operations.

### Prerequisites

Before adding a new component type, you should understand:

- **Component Architecture Pattern**: Components use a payload/class separation pattern (see "Component Architecture" section above)
- **Data Types**: Components have data types defined in `dataTypes/` for serialization
- **Factory Pattern**: Components are created via `standardComponentFactory()` in `componentFactory.ts`
- **Reference System**: Components can reference other components via `ReferenceList` (see **`StandardRoom`** and **`StandardFeature`** sections above for patterns)
- **Schema Integration**: Components must integrate with the WML schema parsing system

### Step-by-Step Checklist

#### Step 1: Schema Layer Support (`@tonylb/mtw-base` package)

**Location**: `packages/mtw-base/ts/schema/` (in the `@tonylb/mtw-base` package)

**Tasks**:
- Add schema type definition (e.g., `SchemaMarkTag`) to schema type definitions
- Add `isSchema{ComponentName}` type guard function (e.g., `isSchemaMark`)
- Add component tag to `SchemaComponent` union type
- Add component tag to `isSchemaComponentTag()` function
- Add component tag to `isSchemaComponent()` function
- Add component tag to `isSchemaTag()` function
- Ensure WML parser can parse the component tag from WML strings

**Example Pattern**: Look at how `isSchemaRoom`, `isSchemaFeature`, or `isSchemaKnowledge` are implemented in `@tonylb/mtw-base/ts/schema/components.ts`

**Note**: This step may require changes in the `@tonylb/mtw-base` package, which is a separate package. If you don't have access to modify that package, coordinate with the maintainer or document this as a prerequisite.

**Area:** mtw-base `SchemaAreaTag` / `isSchemaArea` shipped; **`StandardArea`** and **`StandardPositionGraph`** implemented — see [**StandardArea**](#standardarea-) above and [`schema/converters/components.ts`](../../schema/converters/components.ts) (`PrefixKey` `'AREA'` in mtw-utilities).

#### Step 2: Schema Converter Registration (`schema/converters/components.ts`)

**Location**: `packages/mtw-wml/ts/schema/converters/components.ts`

**Purpose**: Register the component tag in the WML schema converter system so that `<{ComponentName}>` tags can be parsed from WML strings. Without this step, parsing WML will fail with "Cannot read properties of undefined (reading 'initialize')" errors.

**Tasks**:
1. **Add prefix key to PrefixKey type** (if component uses typed UUIDs):
   - **Location**: `packages/mtw-utilities/ts/types.ts`
   - Add the component's prefix key (uppercase) to the `PrefixKey` type union
   - The prefix key should match the component's universal key prefix (e.g., `'MARK'` for Mark components)
   - Example:
     ```typescript
     type PrefixKey = 'ASSET' | 'CHARACTER' | 'ROOM' | 'EXAMPLE' | 'FEATURE' | 'KNOWLEDGE' | 'MAP' | 'MESSAGE' | 'MOMENT' | 'IMAGE' | 'CONNECTION' | 'SESSION' | 'MARK'
     ```
   - **Note**: This is required for `enforceTypedKey()` and `stripTypedKey()` functions to work correctly. Without this, TypeScript compilation will fail with errors like "Argument of type 'MARK' is not assignable to parameter of type 'PrefixKey'".

2. **Import schema types**:
   - Import `isSchema{ComponentName}` and `Schema{ComponentName}Tag` from `@tonylb/mtw-base/ts/schema/{location}` (e.g., `worldState.ts` for world-state components, `components.ts` for standard components)

3. **Add to componentTemplates**:
   - Add component entry to `componentTemplates` object with property validation template
   - Include standard component properties: `uuid`, `key`, `from`, `origin`, `ref`
   - Example:
     ```typescript
     Mark: {
         uuid: { type: ParsePropertyTypes.Key },
         key: { type: ParsePropertyTypes.Key },
         from: { type: ParsePropertyTypes.Asset },
         origin: { type: ParsePropertyTypes.AssetList },
         ref: { type: ParsePropertyTypes.Expression }
     }
     ```

4. **Add to componentConverters**:
   - Add `{ComponentName}` entry to `componentConverters` object
   - Implement `initialize` function that validates properties and returns `Schema{ComponentName}Tag`
   - Handle `uuid` with appropriate typed key enforcement (e.g., `enforceTypedKey('MARK')(uuid)`)
   - Handle `ref` with `validateExpressionAsNonNegativeInteger` if present
   - Example:
     ```typescript
     Mark: {
         initialize: ({ parseOpen }): SchemaMarkTag => {
             const { uuid, ref, ...rest } = validateProperties(componentTemplates.Mark)(parseOpen)
             const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
             return {
                 tag: 'Mark',
                 uuid: uuid ? enforceTypedKey('MARK')(uuid) : undefined,
                 ...(refValue !== undefined ? { ref: refValue } : {}),
                 ...rest
             }
         }
     }
     ```

4. **Add to componentPrintMap**:
   - Add `{ComponentName}` entry to `componentPrintMap` object
   - Implement print map function that renders the component tag with properties
   - Use `tagRender()` helper function
   - Strip typed key prefix from `uuid` using `stripTypedKey('{PREFIX}')`
   - Example:
     ```typescript
     Mark: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
         if (!isSchemaMark(tag)) {
             return [{ printMode: PrintMode.naive, output: '' }]
         }
         return tagRender({
             ...args,
             tag: 'Mark',
             properties: [
                 { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MARK')(tag.uuid) : '' },
                 ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                 { key: 'from', type: 'key', value: tag.from ?? '' },
                 ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                 ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
             ],
             node: { data: tag, children }
         })
     }
     ```

**Reference Examples**: See how `Room`, `Feature`, `Knowledge`, or `Map` are registered in `components.ts` - follow the same pattern for property validation, typed key enforcement, and print map rendering.

**Common Pitfalls**:
- **Forgetting to add prefix key to PrefixKey type** - will cause TypeScript compilation errors when using `enforceTypedKey()` or `stripTypedKey()`
- Forgetting to import `isSchema{ComponentName}` and `Schema{ComponentName}Tag` - will cause TypeScript errors
- Using wrong typed key prefix (e.g., `'MARK'` not `'Mark'`) - must match the component's universal key prefix and be uppercase
- Missing property in `componentTemplates` - will cause validation errors during parsing
- Missing print map entry - component won't serialize correctly to WML

**Note**: The converter map is automatically exported and used by the schema parsing system. Once registered here, `<{ComponentName}>` tags in WML will be parsed correctly.

#### Step 3: Component Type System (`standardize/components/dataTypes/abstract.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts`

**Tasks**:
- Add component tag (e.g., `'Mark'`) to the `ComponentTag` type union
- Add case to `componentTagFromUpperCase()` function: `case 'MARK': return 'Mark'`

**Example**:
```typescript
export type ComponentTag = Exclude<SchemaWithKey["tag"], 'Asset' | 'Story'>
// ComponentTag will automatically include 'Mark' if it's in SchemaWithKey

export const componentTagFromUpperCase = (tag: Uppercase<ComponentTag>): ComponentTag => {
    switch (tag) {
        // ... existing cases ...
        case 'MARK': return 'Mark'
        default: throw new Error(`Unknown tag: ${tag}`)
    }
}
```

#### Step 4: Component Data Types (`standardize/components/dataTypes/`)

**Location**: Create `packages/mtw-wml/ts/standardize/components/dataTypes/{componentName}.ts` (e.g., `mark.ts`)

**Tasks**:
- Create `Standard{ComponentName}Data` type extending `StandardBaseData`
  - Must include `tag: '{ComponentName}'` literal type
  - Include all component-specific properties
  - Use appropriate types (`StandardEditableData<string>`, `StandardRender`, `ReferenceListData`, etc.)
- Create `isStandard{ComponentName}Data` type guard function
  - Use `checkAll()` and `checkTypes()` helpers (see `knowledge.ts` for pattern)
  - Validate required and optional fields
- Export from `dataTypes/index.ts`:
  - Export the data type and type guard
  - Add to `StandardComponentNonEditData` union type
  - Add to `isStandardComponentData()` type guard function

**Example** (from `knowledge.ts`):
```typescript
export type StandardKnowledgeData = {
    tag: 'Knowledge';
    shortName?: StandardEditableData<string>;
    examples?: ReferenceListData;
} & StandardBaseData

export const isStandardKnowledgeData = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {}, { 
            key: 'key', 
            universalKey: 'string',
            shortName: 'literal'
        })
    )
}
```

**Reference Examples**:
- **Simple component**: `knowledge.ts`, `feature.ts` - Basic properties with optional references
- **Component with references**: `room.ts` - Multiple `ReferenceList` properties
- **Component with complex properties**: `situation.ts`, `character.ts` - Uses `StandardRender`, `EditWrappedStandardNode`, etc.

#### Step 5: Component Implementation (`standardize/components/`)

**Location**: Create `packages/mtw-wml/ts/standardize/components/{componentName}.ts` (e.g., `mark.ts`)

**Tasks**:

1. **Create Payload Class** (`Standard{ComponentName}Payload`):
   - Implement `ComponentConstructorMethods<Standard{ComponentName}Data>`
   - Store private fields for component data (prefixed with `_`)
   - Implement constructor with optional `previous` parameter for cloning
   - Implement `fromJSON()` - Parse from data type
   - Implement `fromSchema()` - Parse from WML schema tree using the **process-and-remainder pipeline** (use `treeNodeTypeguard(isSchema{ComponentName})` at entry; build an ordered list of consumers and call `processWithConsumers(this, consumers, node.children)`). See [fromSchema: process-and-remainder pipeline](#fromschema-process-and-remainder-pipeline) and Consumer types above.
   - Implement getters for public properties
   - Implement `toJSON()` - Serialize to data type (follow omission-over-empty principle)
   - Implement `schema()` - Generate schema tree from payload
   - Implement `nestedSchema()` - Generate nested schema with organization context
   - Implement `merge()` - Combine two payloads
   - Implement `subset()` - Return empty payload
   - Implement `referencedKeys()` - Return array of referenced component keys
   - Implement `mapContents()`, `remapReferences()`, `withChild()` if needed
   - Implement `isEmpty()` - Check if payload is empty
   - Implement `invert()` - Invert edit operations
   - Implement `assureReferences()` if component has reference lists (see `assureReferences` pattern)
   - Implement `removeReferences()` if component has reference lists

2. **Create Component Class** (`Standard{ComponentName}`):
   - Use `componentClassFactory(Standard{ComponentName}Payload, 'Standard{ComponentName}')`
   - Expose public getters that delegate to payload
   - Override `_wrap()` method
   - Override `clone()` method
   - Override `equals()` method (compare payloads)
   - Override `invert()` method if needed

**Reference Examples**:
- **Simple component**: `knowledge.ts`, `feature.ts` - Minimal structure, optional references
- **Component with references**: `room.ts` - Multiple `ReferenceList` properties, `assureReferences()` implementation
- **Component with complex properties**: `situation.ts`, `character.ts` - `StandardRender`, nested structures

**Key Patterns**:
- Use `ReferenceList` for child references (see `room.ts` for multiple buckets)
- Use `StandardRender` for rich text content (see `situation.ts`)
- Use `StandardLiteral` for simple string content (see `knowledge.ts`)
- Follow omission-over-empty principle in `toJSON()` - omit empty arrays/objects
- Use `excludeUndefined` helper when filtering optional fields in schema generation

#### Step 6: Factory Integration (`standardize/componentFactory.ts`)

**Location**: `packages/mtw-wml/ts/standardize/componentFactory.ts`

**Tasks**:
- Import `Standard{ComponentName}` and `isStandard{ComponentName}Data`
- Import `isSchema{ComponentName}` from `@tonylb/mtw-base/ts/schema/components` (or appropriate location)
- Add case to `standardComponentFactory()` function:
  ```typescript
  if ((!isSchemaTreeNode(arg) && isStandard{ComponentName}Data(arg)) || 
      (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchema{ComponentName})(arg))) {
      return new Standard{ComponentName}(arg)
  }
  ```

**Example Pattern**: See existing cases in `componentFactory.ts` - each component has a conditional check for both JSON data and schema tree inputs.

#### Step 6: Processing Integration (`standardize/index.ts`)

**Location**: `packages/mtw-wml/ts/standardize/index.ts`

**Tasks**:
1. **Add to COMPONENT_ORDER**:
   - Add entry to `COMPONENT_ORDER` array in `index.ts` (string, e.g. `'Mark'`)

2. **Add to isStandardComponent()**:
   - Import `Standard{ComponentName}`
   - Add `(value instanceof Standard{ComponentName) ||` to the type guard

**Example**:
```typescript
const COMPONENT_ORDER: string[] = [
    // ... existing entries ...
    'Mark'
]

export const isStandardComponent = (value: any): value is StandardComponent => {
    return (value instanceof StandardCharacter) ||
        // ... existing checks ...
        (value instanceof StandardMark)
}
```

#### Step 8: Write Unit Tests

**Location**: Create `packages/mtw-wml/ts/standardize/components/{componentName}.test.ts` (e.g., `mark.test.ts`)

**Tasks**:
- Test construction from JSON data
- Test construction from WML schema (string input)
- Test serialization (`toJSON()`)
- Test deserialization round-trip (JSON → Component → JSON)
- Test schema generation (`schema()` getter)
- Test nested schema generation (`nestedSchema()`)
- Test merge operations (`merge()`)
- Test diff operations (via `equals()` or direct diff)
- Test `isEmpty()` method
- Test `invert()` method
- Test `assureReferences()` if component has reference lists
- Test reference handling if component has references

**Test Patterns** (see existing test files):
- Use WML strings for component construction in tests for readability
- Use JSON objects for tests specifically targeting JSON structure
- Test edge cases (empty components, missing optional fields, etc.)

**Reference Examples**: `knowledge.test.ts`, `feature.test.ts`, `room.test.ts` - Examine these for test patterns and coverage.

### Common Patterns and Pitfalls

#### Simple Components (No References)

**Example**: `StandardKnowledge`, `StandardFeature`

**Pattern**:
- Minimal payload class with basic properties (e.g., `shortName?: StandardLiteral`); use [`shortNameField.ts`](./shortNameField.ts) for fromJSON/merge/invert/schema consumer wiring when the tag has `shortName`
- Optional `ReferenceList` for child components (e.g., `features: ReferenceList`)
- Simple `toJSON()` with omission-over-empty pattern
- Straightforward `schema()` and `nestedSchema()` implementations

**Common Pitfalls**:
- Forgetting to omit empty arrays in `toJSON()` (use conditional spread: `...(this.situations.items.length ? { situations: this.situations.toJSON() } : {})`)
- Not implementing `assureReferences()` for components with reference lists
- Missing `isEmpty()` implementation

#### Components with References

**Example**: `StandardRoom` (multiple **`ReferenceList`** buckets: `features`, `guidance`, `characters`, plus **`lens`**, **`situations`**, and optional **`render`**; no persisted **`examples`** list; see **StandardRoom** at top of this file)

**Pattern**:
- Multiple `ReferenceList` properties for different child types
- `assureReferences()` implementation that dispatches to appropriate buckets based on child `tag`
- `withChild()` implementation that routes to correct bucket
- `nestedSchema()` uses organization context to get children and assure references

**Common Pitfalls**:
- Forgetting to implement `assureReferences()` - this is required for components with reference lists
- Not filtering children by `tag` in `assureReferences()` - each bucket should only contain appropriate child types
- Missing `removeReferences()` implementation
- Incorrect bucket routing in `withChild()` - must match the dispatch logic in `assureReferences()`

#### Components with Complex Properties

**Example**: `StandardSituation` (mark facets), `StandardCharacter` (has `EditWrappedStandardNode` for images)

**Pattern**:
- Use `StandardRender` for rich text content (name, description, etc.)
- Use `EditWrappedStandardNode` for complex nested structures (images, etc.)
- More complex `fromSchema()` implementations using `SchemaTagTree` filtering
- More complex `schema()` generation with nested structure reconstruction

**Common Pitfalls**:
- Incorrect `StandardRender` reconstruction in `schema()` - use `StandardRender.nestedSchema({ tag, mappings })` and spread or take `[0]` as needed
- Missing mapping parameter handling in `schema()` and `nestedSchema()` for Link remapping
- Not handling edit wrappers (Remove/Replace) correctly in `fromSchema()`: when parsing payload or content tags that may be wrapped in Remove/Replace, use `splitTaggedChildren` (or `findTaggedChildren`) from `schema/utils` and use the **matched** result; do not use direct `children.find(...)` by tag.

#### General Pitfalls

1. **Missing Schema Converter**: Forgetting to register component in `schema/converters/components.ts` - WML parsing will fail with "Cannot read properties of undefined" errors
2. **Missing Type Exports**: Forgetting to export data type and type guard from `dataTypes/index.ts`
3. **Factory Integration**: Forgetting to add component to `standardComponentFactory()` - component won't be created from schema
4. **Template Registration**: Forgetting to add to `COMPONENT_ORDER` - component won't be processed correctly
5. **Type Guard Registration**: Forgetting to add to `isStandardComponent()` - type checks will fail
6. **Case Sensitivity**: Component tags are case-sensitive - ensure consistent casing (`'Mark'` not `'mark'`)
7. **Schema Type Guard**: Must import and use correct `isSchema{ComponentName}` from `@tonylb/mtw-base`
8. **Omission-over-Empty**: Always omit empty arrays/objects in `toJSON()` - don't include `field: []`

### Verification Checklist

After completing all steps, verify your implementation:

- [ ] Component can be parsed from WML string: `<{ComponentName} key="test">...</{ComponentName}>` (requires Step 2: Schema Converter Registration)
- [ ] Component can be created from JSON data: `{ tag: '{ComponentName}', key: 'test', ... }`
- [ ] Component appears in `standardComponentFactory()` lookups
- [ ] Component appears in `COMPONENT_ORDER` array
- [ ] Component passes `isStandardComponent()` type guard
- [ ] Component can be stored in `StandardForm`
- [ ] Component serializes correctly (`toJSON()`)
- [ ] Component deserializes correctly (round-trip: JSON → Component → JSON)
- [ ] Component generates correct schema (`schema()` getter)
- [ ] Component generates correct nested schema (`nestedSchema()`)
- [ ] Component merge operations work correctly
- [ ] Component equals/diff operations work correctly
- [ ] All unit tests pass
- [ ] Component follows omission-over-empty principle in `toJSON()`
- [ ] If component has references: `assureReferences()` works correctly
- [ ] If component has references: references appear in correct buckets

### Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- **Reference Implementation Examples**:
  - Simple component: `knowledge.ts`, `feature.ts`
  - Component with references: `room.ts`
  - Component with complex properties: `situation.ts`, `character.ts`

## Testing

### Running Tests
```bash
# From packages/mtw-wml directory
npm run test -- --watchAll=false ts/standardize/components/situation.test.ts
npm run test -- --watchAll=false ts/standardize/components/character.test.ts
```

### Test Patterns
- Use WML strings for component construction in tests for readability
- Use JSON objects for tests specifically targeting JSON structure
- Mock Redux actions to return proper action objects
- Use `@testing-library/jest-dom` for DOM assertions

## Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`../AGENT.schemaOrganization.md`](../AGENT.schemaOrganization.md) - SchemaOrganization, reference vs. hosting, parentage
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- [`render/AGENT.md`](../render/AGENT.md) - StandardRender system documentation
- [`../AGENT.md`](../AGENT.md) - Parent directory overview

