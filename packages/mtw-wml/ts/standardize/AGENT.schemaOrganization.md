## SchemaOrganization – Parentage and Tree Semantics

### Overview

`SchemaOrganization` is the layer that turns a flat `StandardForm` component list into an **intuitively ordered tree** suitable for:

- Building nested schema / WML for serialization
- Determining “where does this component live?” when rendering or inspecting
- Sorting components so parents come before children in a stable, predictable way

It does **not** own the underlying data; it derives structure from:

- The `StandardComponent` list on a `StandardForm`
- The references exposed by `component.referencedKeys()`
- Explicit `<Parent>` tags parsed into `component.explicitParent`

The core idea is:

- Use graph theory to infer a **default structural tree** (implicit parents).
- Allow explicit parentage to **override where things appear** in that tree.
- Keep a clear semantic separation between those two concepts.

---

### Reference and hosting (independent qualities)

**Reference** and **hosting** are two independent qualities of a parent–child relationship. Component A can reference Component B, host Component B, both, or neither.

- **Reference**: The parent actively tracks the child in data it owns—a reference list (e.g. Room's features and characters, Area's **`positionGraph.nodes`**, Feature's examples) or a facet list (e.g. Map's positions). Either the parent references the child (has it in a list) or it does not. **Area** uses the same reference-vs-hosting rules as other reference-list components (no Area-specific hosting logic).
- **Hosting**: The child's content is rendered under the parent in the tree produced by `SchemaOrganization` (the hierarchy used for serialization and display). A component may be referenced in many places, but its content is centralized in one—that parent is the host. Either the parent hosts the child (we render the child's content here) or it does not.

Common combinations: A Room typically **references and hosts** its Features (they are in its reference list and their content is rendered under it). A Room **hosts but does not reference** a shared Mark (the Mark's content is rendered under the Room in WML for structural convenience, but the Room has no marks list). In other cases, reference and hosting can diverge (e.g. explicit parent overrides). When reasoning about a parent–child edge, ask separately: does the parent reference this child? Does the parent host this child? For how this affects `assureReferences` and schema generation, see [components/AGENT.implementation.md](components/AGENT.implementation.md) (Reference vs. hosting, assureReferences).

---

### Mental Model: “Intuitively Right” Organization

When you look at an asset's WML and its usage patterns, there is usually an “obvious” way to think about **locality**:

- *This* Feature is only ever referenced in `RoomA`, so it is naturally “local to `RoomA`.”
- *That* Feature is referenced from `RoomA`, `RoomB`, and `RoomC`, so it is a shared thing, not owned by any single Room.
- A third Feature might be shared structurally, but explicitly listed as a child of `RoomA` for presentation purposes.

`SchemaOrganization`'s job is to:

- **Infer these structures of locality from references**, even when WML nesting does not directly encode them.
- **Respect legal parentage rules** (e.g., Features cannot become children of tags that are not allowed to reference them).
- **Produce a consistent tree** that matches a human reader's intuition about “what is local to what,” while still allowing explicit overrides where the user wants something different.

Concretely:

- The **implicit tree** answers: “Based on references alone, what is the most natural parent of this component?”
- The **explicit tree** answers: “Given what the author *said* with `<Parent>` tags, where should this component actually appear?”

The public API exposes this distinction:

- `getImplicitParent(standardKey)` – structural default parent
- `getExplicitParent(standardKey)` – author-specified override, if any
- `getChildrenOfParent(parentKey)` – final, visible children for rendering / traversal
- `isParentContext(childKey, parentCandidate)` – “is this child under this parent in the effective tree?”

---

### How the Graph Model Works (High-Level)

At a high level, `SchemaOrganization` constructs a **directed graph** over components:

- **Nodes**: Asset-level pseudo-node + one node per component (keyed by `StandardKey` / `AssetUUID`).
- **Edges**:
  - From **Asset** to components referenced in `topLevel` (asset-level children).
  - From components to other components they reference, using `referencedKeys()`:
    - Positive `Direct` / `Position` references
    - Positive / negative `Facet` references (lower priority tiers)

On top of this graph, SchemaOrganization:

- Groups edges by child and applies a **tiered preference system** (e.g., positive Direct/Position beats Facet).
- Computes a **cycle-aware structure**:
  - Strongly Connected Components (SCCs) identify mutually-referential groups.
  - For each SCC, it looks at incoming edges from outside the SCC (its **external parents**).
  - From those, it derives an **implicit parent** for the SCC as a whole:
    - Asset-level (no component parent) when the Asset is an external parent.
    - A component when there is a clear structural parent chain.
- Writes one `implicitParent` entry per component key in the SCC.

This gives us a **canonical “default parent”** for every component that has at least one structural parent in the graph.

---

### Explicit Parents: User Overrides

Explicit parents come from `<Parent>` tags parsed into `component.explicitParent`. Conceptually:

- They express **author intent**: “Please treat this component as a child of X in the final tree.”
- They are allowed to **contradict the structural graph**:
  - A Feature nested under a Room can still have `<Parent />` (Asset-level).
  - A Feature can be explicitly parented to a different Room than the one that structurally references it.

`SchemaOrganization` keeps this information in a separate explicit-parent map:

- For each component key, it may store a **single explicit parent**:
  - `undefined` → explicit Asset-level parentage (“top-level under the Asset”).
  - A `StandardKey` → explicit component parent.

When deciding **where a component appears in the final tree**:

- **Explicit parent wins** over implicit parent.
- Asset-level explicit parentage (`{ explicitParent: undefined }`) means:
  - The component should show up among the Asset's top-level children.
  - Even if structurally it is reachable under some Room or other ancestor.

This is the core override mechanism: explicit parents express “user intent” and may supersede the structural default.

---

### Semantic Division: Implicit vs. Explicit Parents

It's crucial to keep these concepts separate in your head and in code:

#### Implicit Parent (`getImplicitParent`)

Think of **implicit parent** as:

- The **structural parent** in the reachability graph.
- Derived purely from:
  - `topLevel` references.
  - `component.referencedKeys()` (Direct/Position/Facet).
  - Graph/SCC analysis and tier preference.
- **Independent of `<Parent>` tags**, except insofar as those tags affect references in the future.

Use it when you care about:

- Structural ancestry chains (“who's above me if I follow edges?”).
- Descendant queries (`implicitDescendantsOfAncestor`).
- Sorting and tie‑breaking when parents differ (`sortOrder` uses ancestry chains built from implicit + explicit parents).

Implications:

- When a single Room (or other component) is the **clear, dominant structural referrer** of a Feature in the graph (according to the tiered reference rules), the intent is that the Feature's `implicitParent` will usually be that Room, even if an explicit parent later moves it in the visible tree.
- When debugging: if `implicitParent` looks wrong, the bug is typically in the **graph construction** (references/topLevel), not in the explicit-parent logic.

#### Explicit Parent (`getExplicitParent`)

Think of **explicit parent** as:

- The **author's override** for where this component should appear in the tree.
- Stored as `{ explicitParent: StandardKey | undefined }`:
  - `undefined` → Asset-level explicit parent (child of Asset).
  - `StandardKey` → explicit component parent.

Use it when you care about:

- The effective tree that the UI, renderers, and nested schema should show.
- Cases where explicit intent should override structural defaults:
  - Moving a Feature to a different parent Room.
  - Hoisting a Feature to Asset level even if structurally nested.

Key consumers:

- `getChildrenOfParent(parent)`:
  - Checks explicit parentage first.
  - Falls back to implicit parent only when there is **no explicit parent info**.
- `isParentContext(childKey, parentCandidate)`:
  - Uses explicit parent to answer “is this child under this parent?” for rendering and filtering.
- `buildAncestryChain`:
  - Traverses explicit parent first, then implicit parent, to build the **effective** path from Asset to a component.

---

### Putting It Together: How to Think About SchemaOrganization

When working with or extending `SchemaOrganization`, keep this mental model:

- **Inputs**:
  - `StandardForm._components` (the flat list of StandardComponents).
  - `topLevel` (asset-level references).
  - `component.referencedKeys()` (structural edges).
  - `component.explicitParent` (author overrides).

- **Derived structures**:
  - **Implicit parent map**: structural parent per component, from the graph.
  - **Explicit parent map**: optional override per component, from `<Parent>` tags.
  - **Combined view**:
    - Parents and children for traversal / rendering (`getChildrenOfParent`, `isParentContext`).
    - Ancestry chains and consistent sort order.

- **Guiding principles**:
  - **Structural truth lives in implicit parents**.
  - **User intent lives in explicit parents**.
  - **Effective tree** = “explicit where present, implicit otherwise.”
  - Call sites should **ask the right question**:
    - “Where does this appear in the rendered tree?” → `getChildrenOfParent`, `isParentContext`, `buildAncestryChain`.
    - “What is the structural parent in the graph?” → `getImplicitParent`.

When debugging future issues around parentage:

1. **Inspect the component graph**:
   - Are the right references present in `referencedKeys()`?
   - Is `topLevel` correct for asset-level children?
2. **Check implicit vs. explicit separately**:
   - Does `getImplicitParent` match the structural story implied by references?
   - Does `getExplicitParent` match the `<Parent>` tags you expect?
3. **Only then** look at effective tree behavior:
   - Are `getChildrenOfParent` and `isParentContext` honoring “explicit overrides implicit” correctly?

Keeping this separation clear makes it much easier to reason about changes, tests, and bugs—especially in edge cases where schema structure, explicit parentage, and default graph behavior all interact.

