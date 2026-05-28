# Area tag and `StandardPositionGraph` (mtw-wml)

**Status:** Design locked; **mtw-base** `Area` schema shipped (**C1**, **C2**). Next step: [`positionGraph.ts`](../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts) and **`StandardArea`** (or WML converters if parseability is needed first).

Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and recommended-order checkbox conventions.

**Dispose** after the initiative ships and lasting notes live under [`packages/mtw-wml/ts/`](../../../packages/mtw-wml/ts/) (schema, `standardize/components`, and steady-state docs).

---

## Purpose

Introduce **`<Area />`** as a WML component for **large spatial regions** (districts, biomes, building complexes, etc.), backed by **`StandardArea`** as a full **manipulable component** in the standardize layer (merge, diff, subset, factory, schema round-trip).

An Area describes **participation in space** via references to:

- **Other Areas** (child sub-areas and, sometimes, **border** areas that participate in multiple parents)
- **Rooms**
- **Features**
- **Characters**

Each participant **is** one typed `StandardReference` (a v1 graph **node**). They are stored in **`positionGraph.nodes`**, a single heterogeneous **`ReferenceList`**. WML lists them as **direct children** of `<Area>` (by tag); JSON uses **`positionGraph: { nodes }`**; mixing and separating by tag happens in **serialization / deserialization** and in **fromSchema / nestedSchema**, not via a `<PositionGraph>` wrapper tag. Follow-on work adds **edges** and richer graph structure; that is **out of scope** here.

---

## Scope

### In scope (mtw-wml first draft)

| Deliverable | Notes |
| --- | --- |
| **Schema / parse / print** | `Area` in `@tonylb/mtw-base`; WML converter and print map; `uuid=(ABC)` wire form for `AREA#ABC` |
| **`StandardArea`** | `positionGraph` on payload; merge delegates to graph; **ephemera wire parity** (**C6**) |
| **`StandardPositionGraph`** | [`standardize/components/positionGraph.ts`](../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts); v1 `{ nodes }` only |
| **Component plumbing** | Factory, `ComponentTag`, `componentKeys`, schema index, shortName round-trip |
| **Validation** | Reject unconsumed `fromSchema` children (**C5**); reject **self-reference** in `nodes` at standardize (**G4**) |
| **Tests** | Area + positionGraph unit tests; `StandardForm` integration; asset + ephemera wire fixtures |

### Out of scope (follow-on or other packages)

- **Edges**, coordinates, adjacency, graph algorithms
- **`<PositionGraph>`** (or any graph wrapper tag) in WML
- **General cycle detection** (document intent to avoid cycles; only self-reference is enforced in v1)
- **Map** / **Position** facet integration with Areas
- **charcoal-client** Workbench UI for Area (follow existing **ReferenceList** patterns; see **X2**)
- **lambda/assets** / ephemera **Area** behavior beyond generic component rows (same as other tags; see **X1**)
- **RoomAffordances**, render cache, subscriptions, and how Areas affect play (**X3** --- separate follow-on initiative)
- **Authorization** grants on Area (unless required for parse parity)

---

## Conceptual model (locked)

### WML (authoring)

No wrapper tag. Participant references are **direct children** of `<Area>`:

```xml
<Asset uuid=(World)>
    <Area key=(downtown) uuid=(ABC)>
        <ShortName>Downtown</ShortName>
        <Area key=(oldTown) />
        <Room key=(cafe) />
        <Feature key=(fountain) />
        <Character key=(guard) />
    </Area>
</Asset>
```

Universal keys appear in schema as **`uuid=(...)`** on the tag (e.g. `AREA#ABC` stored as `<Area uuid=(ABC) />`), consistent with other components (**C1**).

**Not** used:

```xml
<Area>
  <PositionGraph>
    <Room />
  </PositionGraph>
</Area>
```

**fromSchema:** four **`StandardizeConsumerReferenceList`** consumers (`Area`, `Room`, `Feature`, `Character`) append into **`positionGraph.nodes`**. **Reject** any unconsumed child (**C5**). **Nested `<Area>` content** is allowed where [`SchemaOrganization`](../../../packages/mtw-wml/ts/standardize/AGENT.schemaOrganization.md) and component norms expect it (**G6**); hosting vs reference-only follows the same rules as other components (**C4**), not Area-specific logic.

**Child vs border Areas (**G3**):** single participant stream for Area-typed refs in WML and in `nodes`; distinguish child vs border via **`ref`** (and edit algebra) on those references, not separate lists or tags.

### Standardize (runtime)

| Layer | Shape |
| --- | --- |
| **`StandardPositionGraph`** | `_nodes: ReferenceList` (heterogeneous; tags `Area` \| `Room` \| `Feature` \| `Character`). `merge` / `diff` / `equals` on **`nodes`** via `ReferenceList` (**P2**). |
| **`StandardAreaPayload`** | Holds **`_positionGraph`** (or equivalent); **`StandardArea.merge`** delegates to **`positionGraph.merge`** (**P2**). |
| **JSON / `toJSON`** | **`positionGraph: { nodes }`** only (**P4**); omit when `nodes` is empty (**G5**). No separate four-field JSON surface. |
| **WML emit** | **nestedSchema** / print: walk `nodes` (or serde helpers) and emit the correct child tag per `StandardReference.tag`. |

**Participant = reference:** One entry in `nodes` = one graph node in v1. No `<Node>` tag.

**Cycles (**G4**):** Document that arbitrary Area cycles are undesirable and may be constrained later. **In scope for v1:** at standardize, **reject** when this Area's identity appears in its own `nodes` as an `Area` reference (self-reference).

**Top-level (**C2**):** `Area` may appear in asset **`topLevel`**; it is the component **most likely** to be top-level (world regions before rooms).

**`referencedKeys()` (**C3**):** Expose participant refs from **`positionGraph.nodes`** as **`Direct`** (or the same tiers Room uses for comparable lists), feeding **`SchemaOrganization`** like other reference-list components.

---

## Getting Started

1. **Task-plan framework** --- [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **WML package overview** --- [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md)
3. **Component implementation** --- [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md)
4. **Schema organization** --- [`packages/mtw-wml/ts/standardize/AGENT.schemaOrganization.md`](../../../packages/mtw-wml/ts/standardize/AGENT.schemaOrganization.md) (**C4**, **G6**)
5. **Reference lists** --- [`packages/mtw-wml/ts/standardize/keys/AGENT.referenceList.md`](../../../packages/mtw-wml/ts/standardize/keys/AGENT.referenceList.md) (heterogeneous lists, `ref` semantics)
6. **Exemplars** --- [`room.ts`](../../../packages/mtw-wml/ts/standardize/components/room.ts) (per-tag fromSchema consumers), asset **`topLevel`** patterns in [`standardize/index.ts`](../../../packages/mtw-wml/ts/standardize/index.ts)
7. **Schema** --- [`packages/mtw-base/ts/schema/components.ts`](../../../packages/mtw-base/ts/schema/components.ts), [`schema/converters/components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts)
8. **Testing** --- [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md)

**Baseline verification (before edits):**

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

---

## Decisions and unknowns

### Locked (see [Decision log](#decision-log))

All items through **P4** are decided. Cross-package notes (**X1--X3**) are recorded below; none block mtw-wml v1.

### Cross-package notes (not open questions)

| ID | Resolution |
| --- | --- |
| **X1** | **No separate registry pattern.** `Area` uses the same asset component row model as `Room`, `Map`, etc.: `AssetId` = `AREA#...`, `DataCategory` = `Meta::Area`, body via existing component projection / `StandardForm` paths (see [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) `Meta::${component.tag}`). Follow-on work is only the usual tag-enumeration sweep where lambdas switch on `component.tag` --- not a new storage design. |
| **X2** | **`nodes`** edited like any other **`ReferenceList`** in Workbench (add/remove/import refs). The only UX difference is **heterogeneous** allowed tags (`Area`, `Room`, `Feature`, `Character`) in one list. Out of scope for this task plan; no Area-specific editor framework. |
| **X3** | **Out of scope for this initiative entirely.** Ephemera, render cache, and **RoomAffordances** are **not** part of mtw-wml Area v1. Track **how Areas impact RoomAffordances** in a **later, separate** planned task (not started here). |

---

## Progress

| Area | State |
| --- | --- |
| Task plan + design lock (G*, C*, P*) | Done |
| mtw-base `Area` schema + guards | Done |
| [`positionGraph.ts`](../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts) | |
| `StandardArea` + data types | |
| WML converter / print map | |
| Factory, `ComponentTag`, wiring | |
| Self-reference validation + strict fromSchema | |
| Unit + StandardForm tests (asset + ephemera wire) | |
| Durable package doc updates | |

---

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **Design lock**
  - [X] WML: flat children; no `<PositionGraph>` (**G1**).
  - [X] Participants as `StandardReference`s in **`positionGraph.nodes`** (**G2**, **P4**).
  - [X] Child vs border: same Area refs, **`ref`** semantics (**G3**).
  - [X] Cycles: document intent; enforce self-reference only at standardize (**G4**).
  - [X] Nested Area content + hosting per **SchemaOrganization** (**G6**, **C4**).
  - [X] `AREA#` / `uuid=(ABC)`; top-level Area encouraged (**C1**, **C2**).
  - [X] `referencedKeys` from `nodes` (**C3**); strict fromSchema (**C5**); ephemera wire (**C6**).
  - [X] **`positionGraph.ts`**; merge chain Area -> graph -> nodes (**P1**, **P2**).
- [X] **mtw-base schema**
  - [X] `SchemaAreaTag`, `isSchemaArea`, `SchemaWithKey`, asset legal contents + **topLevel** (**C2**).
  - [X] `AREA#` in component UUID validation (**C1**).
  - [X] Schema unit tests.
- [ ] **`StandardPositionGraph`** in [`standardize/components/positionGraph.ts`](../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts)
  - [ ] Data type: `positionGraph: { nodes?: ReferenceListData }`.
  - [ ] Class: `fromJSON` / `toJSON`, `merge`, `diff`, `equals` on `nodes` (**P2**).
  - [ ] Helpers: filter `nodes` by tag for WML consumers / nestedSchema if useful.
  - [ ] Unit tests: empty omission, heterogeneous merge, diff.
- [ ] **`StandardArea`**
  - [ ] `StandardAreaData` with `positionGraph` only (**P4**); `shortName` via shared helpers.
  - [ ] Payload holds graph; **merge** delegates to **`StandardPositionGraph.merge`** (**P2**).
  - [ ] fromSchema: four reference consumers -> `nodes`; **throw** on remainder (**C5**).
  - [ ] nestedSchema: emit flat children from `nodes` (tag-appropriate).
  - [ ] `referencedKeys` / `assureReferences` from `nodes` (**C3**).
  - [ ] Self-reference check at standardize (**G4**).
  - [ ] `standardComponentFactory`; ephemera wire tests (**C6**).
  - [ ] `shortNameRoundTrip.test.ts`; `area.test.ts` + integration tests.
- [ ] **WML schema layer**
  - [ ] `componentTemplates.Area`, converters, print map, [`schema/index.ts`](../../../packages/mtw-wml/ts/schema/index.ts).
  - [ ] `componentKeys` includes `Area`.
- [ ] **Integration sweep**
  - [ ] `StandardForm` construct/merge with top-level Area fixtures.
  - [ ] `tsc` + charcoal-client if types leak.
- [ ] **Durable docs** then remove/archive this plan.

---

## Decision log

| ID | Decision | Date |
| --- | --- | --- |
| **G1** | No `<PositionGraph>` WML tag. Participant refs are direct children of `<Area>`. | 2026-05-28 |
| **G2** | v1 node = one `StandardReference` in **`positionGraph.nodes`** (heterogeneous list). | 2026-05-28 |
| **G3** | Child vs border Areas: same Area-typed refs; distinguish with **`ref`** semantics, not separate lists. | 2026-05-28 |
| **G4** | Document intent to avoid cycles generally. **In scope:** reject **self-reference** (this Area in its own `nodes`) at standardize only. | 2026-05-28 |
| **G5** | Omission-over-empty: omit `positionGraph` when `nodes` is empty. | 2026-05-28 |
| **G6** | Nested `<Area>` content allowed per component norms; **SchemaOrganization** decides hosting like any other component. | 2026-05-28 |
| **C1** | Universal key prefix **`AREA#`**; schema wire form **`<Area uuid=(ABC) />`** for `AREA#ABC`. | 2026-05-28 |
| **C2** | **`Area` in asset `topLevel`**; primary candidate for top-level authoring. | 2026-05-28 |
| **C3** | **`referencedKeys()`** from **`positionGraph.nodes`** as **Direct** (same pattern as comparable components). | 2026-05-28 |
| **C4** | No Area-specific hosting rules; use **SchemaOrganization** norms only. | 2026-05-28 |
| **C5** | **Reject** unconsumed children in **`fromSchema`** (strict). | 2026-05-28 |
| **C6** | **Ephemera wire parity** from day one (`standardizeMode`). | 2026-05-28 |
| **P1** | **`packages/mtw-wml/ts/standardize/components/positionGraph.ts`**. | 2026-05-28 |
| **P2** | **`StandardPositionGraph.merge`** delegates to **`nodes`** `ReferenceList` merge; **`StandardArea.merge`** delegates to **`positionGraph.merge`**. | 2026-05-28 |
| **P4** | JSON **`positionGraph: { nodes }`** only; heterogeneous `nodes`; tag grouping for WML via serde / fromSchema / nestedSchema. | 2026-05-28 |
| **X1** | Lambda persistence: same component-row pattern as other tags (`AREA#`, `Meta::Area`); no bespoke registry. | 2026-05-28 |
| **X2** | Client: `nodes` = ReferenceList editor with heterogeneous tag picker; no special Area editor in this initiative. | 2026-05-28 |
| **X3** | Ephemera / RoomAffordances / render: **deferred** to a future planned task; not in mtw-wml Area v1 scope. | 2026-05-28 |
| **I1** | **mtw-base:** `Area` is **importable** (same list as Room/Map); asset-legal for direct `<Asset>` children (**C2** prerequisite). WML parse/print and `StandardArea` remain follow-on. | 2026-05-28 |

---

## Verification

Run from repo root unless noted.

**Baseline (before implementation):**

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

**After Area / graph land:**

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false --testPathPattern="area|positionGraph"
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

**Regression greps (repo root):**

```bash
rg "ComponentTag|'Area'|AREA#" packages/mtw-wml packages/mtw-base --glob "*.{ts,tsx}"
rg "<PositionGraph" packages/mtw-wml packages/mtw-base --glob "*.{ts,tsx,md}"
rg "componentKeys" packages/mtw-wml/ts/standardize/keys/reference.ts -n
```

**Self-reference / strict parse (after implementation):**

```bash
rg "self-reference|selfReference" packages/mtw-wml/ts/standardize/components --glob "*area*"
```
