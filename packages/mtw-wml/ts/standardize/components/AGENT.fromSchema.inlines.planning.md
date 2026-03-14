## Inline Shared Resources – Planning Notes

**Status**: Implementation complete (Phase 2 Items 1 & 2)  
**Created**: February 2026  

This document captures design intent and open questions around **inline / shared resources** in `fromSchema` pipelines – specifically, component instances (e.g. `Mark`) that are **shared between multiple sibling children** of a parent and for which `SchemaOrganization` chooses the **parent** (not any particular child) as the canonical structural home.

---

## Problem Statement

Certain components behave like **resources** rather than purely-local children:

- A `Lens` may attach a `Mark` that is also referenced from an `Example`.
- A `Room` may have several `Examples`, multiple `Lenses`, and shared `Marks` used across them.

From the perspective of:

- **StandardForm** (data-centric): there is one `StandardMark` instance with connections to both the `Lens` and the `Example`.
- **SchemaOrganization** (tree serialization): we want a stable rule for **where in the parent’s subtree that shared `Mark` lives** in WML.

The design intent is that **shared components live under their structural parent**, not under one of the siblings:

- Authoring might start with the Mark’s content nested under a `Lens` (or `Example`) and the other child referencing it by UUID.
- When schema is generated, `SchemaOrganization` can decide that the **canonical parent is the `Room`** and emit WML where:
  - `Lens` and `Example` both reference the Mark by key/UUID.
  - The Mark’s full content appears **once** as a child of the `Room`, commonly referenced by both.

This creates WML where shared resources appear in the **intuitive, parent-level spot**, while still remaining structurally correct and deduplicated.

---

## Concrete Example: Shared Mark Between Lens and Example

Consider this authored WML (simplified):

```xml
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(roomX)>
        <ShortName>Room X</ShortName>
        <Lens uuid=(lens1) key=(lensX)>
            <ShortName>Room X Lens</ShortName>
            <Mark uuid=(markA) key=(markA)>
                <ShortName>Mark A</ShortName>
            </Mark>
        </Lens>
        <Example uuid=(example1) key=(exampleX)>
            <DisplayName>Example using Mark A</DisplayName>
            <Mark uuid=(markA) />
        </Example>
    </Room>
</Asset>
```

Parsing into `StandardForm` yields:

- One `StandardRoom` (`roomX`)
- One `StandardLens` (`lensX`)
- One `StandardExample` (`exampleX`)
- One `StandardMark` (`markA`)
- Connections:
  - `Lens` → `Mark` via a `ReferenceList` (or facet) on the Lens.
  - `Example` → `Mark` via a `ReferenceList` on the Example.

When we then **serialize back to WML**, `SchemaOrganization` can elect to make the **Room** the canonical structural parent for `Mark`:

```xml
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(roomX)>
        <ShortName>Room X</ShortName>
        <Lens uuid=(lens1) key=(lensX)>
            <ShortName>Room X Lens</ShortName>
            <Mark key=(markA) />
        </Lens>
        <Example uuid=(example1) key=(exampleX)>
            <DisplayName>Example using Mark A</DisplayName>
            <Mark key=(markA) />
        </Example>
        <Mark uuid=(markA) key=(markA) ref={0}>
            <ShortName>Mark A</ShortName>
        </Mark>
    </Room>
</Asset>
```

- The **content** for Mark A lives once under `Room`.
- `Lens` and `Example` use **lightweight references** (`Mark key=(markA)`).
- The `ref={0}` at the Room level indicates that this Mark is **structurally present** in the Room’s subtree and **may also be referenced elsewhere**.

---

## Round-Trip Contract (Intended)

Given a StandardForm whose SchemaOrganization chooses to place a shared component under its parent:

1. **StandardForm → schema**  
   - `SchemaOrganization` builds a tree where:
     - Shared components (Marks, etc.) appear as children of their common parent (e.g. Room).
     - Sibling children (Lens, Example) refer to those shared components via `ref` / key / UUID.

2. **schema → StandardForm (processComponents)**  
   - `processComponents` runs over the Room subtree:
     - The Room’s `fromSchema` pipeline **must not reject** the inline shared components as “unconsumed tags”.
     - Instead, those child component nodes must be surfaced to `processComponents` via the **return remainder** channel so that:
       - `StandardMark` is constructed as a child of the Room.
       - The Lens and Example references are reconstructed as usual via their own pipelines and `ReferenceList` / facet consumers.

3. **StandardForm → schema again**  
   - Re-serializing should produce **the same tree structure**:
     - Shared components still appear as children of the parent (with `ref={0}`).
     - Sibling components still point at them via references.

In other words, the choice “this shared Mark lives under Room X” should be **stable under parse→serialize→parse→serialize**.

---

## Current Gaps

The current implementation has **two** distinct gaps: parsing and serialization.

### Parsing Gap (fromSchema / processComponents)

- `StandardRoomPayload.fromSchema` has consumers for:
  - `ShortName`
  - `Exit`
  - `Lens`
  - `Feature`
  - `Example`
  - `Guidance`
  - `Character`
  - (no-op) `Position`, `Grant`, `DisplayName`
- There is **no consumer for `Mark` children** under `Room`.
- Once `SchemaOrganization` has lifted a shared `Mark` to the Room level, the Room’s `fromSchema` pipeline sees the `Mark` as an **unexpected tag** and fails with `Unconsumed child tags: Mark`.

The **intent** is not to make Room “own” Mark content semantically; rather, it is to:

- Allow **structural placement** of shared Marks under the Room in schema.
- Ensure that fromSchema pipelines:
  - **Tolerate** and correctly forward these inline shared resources through the two-remainder machinery.
  - Keep the “unconsumed children = error” rule for truly illegal tags, while recognizing that some children exist solely as **structural hosts for shared resources**.

### Serialization Gap (SchemaOrganization / assureReferences / nestedSchema)

Even if we fix the parsing gap (by adding a Room-level consumer that forwards `Mark` nodes via `returnRemainderAddition`), we still cannot **produce** the desired inline-parent WML shape today:

- `SchemaOrganization.getChildrenOfParent(parentKey)` returns **references**, not full child components.
- `StandardRoomPayload.nestedSchema` uses:
  - `organization.getChildrenOfParent(key)` to obtain children.
  - `this.assureReferences(children)` to ensure that the Room’s **reference lists** contain `ref={0}` entries for children that should be rendered in the Room’s subtree.
  - Rendering logic that walks only:
    - `lens`, `features`, `guidance`, `examples`, `characters`, and exits.
- `StandardRoomPayload.assureReferences` **only dispatches Lens / Feature / Example / Guidance / Character** based on the child’s `tag`. There is **no bucket for `Mark`**, and Mark references are effectively ignored at this stage.

Consequences:

- A `StandardMark` that is structurally a child of the Room (via implicit/explicit parent in `SchemaOrganization`) **cannot reappear** as:
  - `<Mark uuid=(...) key=(...) ref={0}>…</Mark>`
  - under the Room in `nestedSchema` output.
- At best, we can:
  - Parse WML where a `Mark` lives inline under a `Room` (once the parsing gap is fixed).
  - Preserve the fact that the Room is the structural parent in the data-centric representation.
  - But we **cannot yet round-trip back** to a schema where the Room explicitly hosts that Mark node with `ref={0}`; the Mark will not be emitted from the Room’s `nestedSchema`.

In other words: **parsing and structural organization can be made correct before serialization catches up**. The “inline shared resource under parent” contract requires changes both to:

- `fromSchema` pipelines (to accept and forward inline resources), and
- `assureReferences`/`nestedSchema` (to actually render those resources at the parent level).

---

## Inline-Shared-Resource Principle (Draft)

1. **Canonical parent**  
   - When multiple siblings (`Lens`, `Example`, etc.) reference the same component (`Mark`), `SchemaOrganization` is free to choose the **common structural parent** (e.g., `Room`) as the single canonical parent in the schema tree.

2. **Inline host vs. semantic owner**  
   - The parent that hosts the shared component in schema (`Room` hosting `Mark`) is not necessarily the “semantic owner” – it may simply be the **place in the tree where shared resources live**.

3. **Pipeline behavior**  
   - Parent pipelines (e.g., `StandardRoomPayload.fromSchema`) must:
     - **Recognize** inline shared resources as legal children in the structural sense.
     - Surface their schema nodes through the **return remainder** channel to `processComponents`, so child components are still created.
     - Avoid binding those components to parent-specific fields unless that is actually part of the data model.

4. **Error semantics**  
   - The existing “unconsumed children = error” rule remains valid for **unknown or truly misplaced tags**.
   - Inline shared resources count as **known structural children** even if the parent payload itself does not store them in a dedicated field.

---

## First-Draft Architecture Sketch

This section records a first-draft architectural direction for closing the inline shared-resource gap. It is intentionally high-level; details may change as we refine the boundary between `SchemaOrganization` and schema-rendering.

### 1. Parsing Side: Inline Consumer

- **Goal**: Allow parents (e.g. `Room`) to **tolerate** inline shared resources as structural children without binding them to payload fields.
- **Idea**: Introduce a generic inline consumer, e.g. `StandardizeConsumerInline`, with responsibility to:
  - Match “inline shared resource” nodes under a parent:
    - Component tags only (e.g. `Mark`, `Example`, etc., as appropriate).
    - Likely constrained to `ref={0}` (or a similar marker) to avoid consuming truly illegal tags.
  - Leave the parent payload unchanged.
  - Return the matched nodes **entirely via `returnRemainderAddition`**, so that `processComponents` will recurse into them and construct the corresponding child components.

This keeps the parent payload’s fields semantically honest while making the **two-remainder pipeline** expressive enough to represent “hosted but not owned” children.

**Parsing-side implementation (done):** `StandardizeConsumerInline` is implemented in [fromSchemaPipeline.ts](./fromSchemaPipeline.ts). It accepts any direct child that is a component tag with `ref={0}` (via `splitChildrenByPredicate` so Remove/Replace wrappers are respected) and passes it unchanged via `returnRemainderAddition`. It is used as the **last** consumer in all payloads that have a ReferenceList or FacetList consumer: Room, Feature, Knowledge, Message, Moment, Lens, Map, Example, and Guidance. The **serialization gap** (assureReferences / nestedSchema) remains; rendering inline shared resources at the parent level is out of scope for this work.

### 2. Rendering Side: Bucketed vs Inline Remainder at Schema Time

Today’s schema rendering assumes:

- Each payload’s stored data (plus assured references) fully determines what appears under it in schema.
- `SchemaOrganization` is used to decide *which* components are children of a given parent, but not *how* to render children that don’t have a natural payload bucket.

For inline shared resources, we want the parent’s schema-rendering to be driven by **both**:

- Payload-owned fields (shortName, exits, Lens/Feature/Example/Guidance/Character lists), and
- **Parentage information** from `SchemaOrganization` (e.g. “Mark A is structurally under Room X”).

First-draft sketch:

1. **Extend `assureReferences` to return a remainder** — **DONE (Phase 2 Item 1)**  
   - Implemented as `AssureReferencesResult<T> = { payload: T; inlineRemainder: StandardReference[] }`

   - Each payload partitions children by bucket tags; remainder (e.g. Mark under Room) goes to `inlineRemainder` with `ref={0}`
   - `nestedSchema` callers destructure and use `payload`; `inlineRemainder` is available for Phase 2 Item 2

2. **Pass inline remainder into `nestedSchema` / `schema`** — **DONE (Phase 2 Item 2)**  
   - Implemented: payloads (Room, Feature, Knowledge, Moment, Lens) append `inlineRemainder.map(renderReference(...)).filter(excludeUndefined)` to `children` in `nestedSchema`; Map computes remainder (organization children minus position facets and `_images`) and appends the same way. No new option type.
   - `nestedSchema` (and, if needed, `schema`) is able to:
     - Render the **bucketed children** from the payload as before (shortName, Lens, Feature, Example, Guidance, Character, exits).
     - Then, for each reference in `inlineRemainder`:
       - Use the `lookup` function (and `SchemaOrganization`) to find the referenced component.
       - Call that component’s `nestedSchema` to render it inline under the current parent (e.g. produce `<Mark ... ref={0}>…</Mark>` under `Room`).

3. **Per-component responsibility**  
   - Each component’s payload controls:
     - Which child references map into **named buckets** (e.g. Room’s Lens/Feature/Example/Guidance/Character).
     - Which tags it deliberately leaves in `inlineRemainder` to be rendered structurally as child components (e.g. Marks under Room).
   - `SchemaOrganization` remains the source of truth for:
     - Which components are descendants of which parents (implicit/explicit parent relationships).

### 3. Boundary Layer Between SchemaOrganization and Rendering (To Iterate)

This draft suggests a cleaner separation of concerns:

- **SchemaOrganization**:
  - Computes implicit/explicit parentage and children per parent.
  - Provides per-parent child references to rendering (`getChildrenOfParent`, `isParentContext`, etc.).

- **Payload / Rendering**:
  - Decides how to:
    - Project those child references into payload buckets via `assureReferences` (with a remainder).
    - Render:
      - Bucketed children via existing ReferenceList/schema patterns.
      - Inline remainder children by recursively invoking `nestedSchema` on the referenced components.

The exact API shape (new helper vs. extended `assureReferences`, how `inlineRemainder` is threaded through `NestedSchemaOptions`, etc.) is still open and will be refined in a subsequent design pass.

For now, this serves as a **first-draft architecture**:  
parse-time inline consumers plus render-time “bucket + inline remainder” handling form the core of how we intend to support parent-level inline shared resources.

