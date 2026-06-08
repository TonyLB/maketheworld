# Topology relations refactor (partial edges + invariant naming)

**Status:** Phases 1-3 complete; Phase 4 in progress --- durable docs cleanup; optional Coyote exit smoke-test deferred. Steady-state invariant names live in [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md#topology-invariants). Overlay topology pattern and exit inventory: [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md).

This plan is task-scoped. Archive or delete it after the work ships; move lasting norms into package `AGENT.md` files next to code.

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

**Parent initiative:** Area topology exits platform initiative **shipped** (Milestones 0-6 complete). Steady-state norms live in [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md), ephemera affordance pipeline AGENT files, and related package docs. This follow-up fixes authoring UX and relaxes storage rules without reopening runtime affordance / migration scope unless tests require it.

---

## Purpose

Three related slices, in order:

1. **Retire decision-point IDs (`D4`, `D27`, `D29`, ...)** as the way we refer to design invariants. Those markers came from a numbered decisions register in the area-topology task plan. They should not remain in durable docs, error strings, test names, or client helper names once the concepts are documented under plain language.
2. **Make partially specified Area exit edges first-class in storage and edit algebra** --- an edge may exist with only a stable `uuid` (and optional `Forward` / `Back` labels), with `From` and/or `To` unset until the author fills them in. Incomplete edges are **valid authoring data**, not parse/merge errors. Semantic consumers (room exit projection, navigation resolution) **ignore** edges that are not complete enough to matter; they do not treat them as illegal.
3. **Refactor the Workbench exit-edge editor** to match: add creates a stub row immediately; From and To are edited independently on the row (the row editor already supports this --- the add flow and validation layer do not).

---

## Background (current behavior)

### Authoring UI bug

[`ExitEdgeListEditor`](../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeListEditor.tsx) uses a two-step add wizard (From, then To). [`ComponentSelectorDialog`](../../../charcoal-client/src/components/Workbench/foundations/ComponentSelector/ComponentSelectorDialog.tsx) always calls `onClose()` after `onSelect()`. The first dialog binds `onClose` to `closeAddFlow`, which clears `pendingFrom` before the To step runs --- so selecting a room appears to do nothing.

### Storage constraints today

Area topology edges use the [`standardize/keys/edges/`](../../../packages/mtw-wml/ts/standardize/keys/edges/) pattern (see [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)):

- Stable **`uuid`** per edge within one Area `positionGraph`.
- **`From`** / **`To`** as editable reference slots (Parent-style child tags, not attributes).
- **`Forward`** / **`Back`** literal payload.

**Parse / construct (today):** [`edgeFactory.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/edgeFactory.ts) **requires** both `<From>` and `<To>` child tags; empty endpoint values throw in [`endpointReference.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/endpointReference.ts).

**StandardArea validation (today):** [`area.ts`](../../../packages/mtw-wml/ts/standardize/components/area.ts) enforces that when **both** endpoints resolve, at least one must match a participant in `positionGraph.nodes` --- otherwise standardization throws (currently labeled `D4` in messages). Unresolved endpoints are skipped in that check.

**Semantic projection (already tolerant):** [`projectRoomExits`](../../../packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts) emits a room `ExitFacet` only when the room matches an endpoint **and** the peer ref and label are present. Incomplete edges already produce **no play effect** --- the gap is upstream treating them as **illegal** rather than **incomplete**.

---

## Invariant glossary (steady-state names)

Use these names in durable docs, comments, and user-facing copy. Do **not** introduce new `D*` IDs.

| Steady-state name | Meaning (summary) | Replaces (legacy plan ID) |
| --- | --- | --- |
| **Bidirectional topology** | Every Area exit edge is traversable in both directions; `Forward` from the From room, `Back` from the To room. | D1, D26 |
| **Edge list pattern** | `positionGraph.edges` is a uuid-keyed list of `{ uuid, from, to, payload }` items parallel to facets but not using `facetClassFactory`. | D27 |
| **Area exit endpoint tags** | Area `<Exit>` uses `<From>` / `<To>` child tags (ComponentUUID string bodies), not `from=` / `to=` attributes; rejects legacy `to=` under Area. | D29 |
| **Edge uuid identity** | Merge/diff/edit identity is the edge `uuid` within one Area, not the `(from, to)` pair. | D28 |
| **Participant endpoint rule** | When **both** endpoints are resolved, at least one must match a ref in `positionGraph.nodes` for the edge to participate in topology semantics (portal: one inside, one outside is allowed). | D4 |
| **Incomplete edge** | An edge with missing and/or unset `From` and/or `To` (may still carry `uuid` and labels). Valid in asset storage; ignored by semantic projection until complete. | *(new)* |
| **Position graph shape** | `StandardArea.positionGraph` is `{ nodes, edges }`; Exit is the first edge union member. | D3 |
| **Room wire projection** | Runtime `StandardRoom.exits` is synthesized from Area edges, not stored on the room blueprint row. | D16 |

Full runtime / caching decisions are documented in ephemera affordance AGENT files and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md); this refactor only **renames** cross-cutting invariants we touch and **extends** storage rules for incomplete edges.

---

## Scope

### In scope

- Rename / replace `D*` references in `packages/mtw-wml`, `charcoal-client` Workbench Area edit code, and linked durable docs touched by this work.
- Optional `From` / `To` in WML round-trip, JSON types, constructors, merge/diff, and `StandardArea` ingest.
- Move **participant endpoint rule** enforcement out of "always throw on standardize" into:
  - **Authoring:** non-blocking warnings in Workbench (replace `d4Error` / `assertEdgeD4` blocking paths where appropriate).
  - **Semantic layer:** `projectRoomExits` and downstream navigation continue to skip edges that cannot produce a facet (unchanged behavior, explicit docs).
- Workbench: stub add flow, unset-endpoint display, fix selector close bug.
- Tests across `mtw-wml` and `charcoal-client` for the above.

### Out of scope (link only)

- Room-local exit forbid and **`ExitEditor`** removal --- shipped (parent initiative M6); Map drag UI remains no-op until Area authoring Phase 3+.
- Ephemera affordance pipeline changes beyond confirming projection still skips incomplete edges.
- Map editor exit drag (legacy map path) --- separate from Area Workbench editor.
- Second edge union member / `StandardEdgeEndpoint` extraction (noted in [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) as future work).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **WML package:** [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)
3. **Area + edges (steady state):** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md), [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)
4. **Projection (semantic filter):** [`packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts`](../../../packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts)
5. **Workbench Area editor:** [`charcoal-client/src/components/Workbench/AGENT.md`](../../../charcoal-client/src/components/Workbench/AGENT.md), [`AreaEdit/`](../../../charcoal-client/src/components/Workbench/AreaEdit/)
6. **Steady-state topology norms:** [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (exit provenance / affordance compose)

**Test command authority:**

- `mtw-wml`: [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md)
- `charcoal-client`: [`taskPlanning/charcoal-client/AGENT.development.md`](../../charcoal-client/AGENT.development.md)

**Baseline (before edits):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/components/area.test.ts ts/standardize/keys/edges/exitEdge.test.ts ts/standardize/projection/projectRoomExits.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit

cd ../../charcoal-client
npm run test:single -- src/components/Workbench/AreaEdit/
```

**Inventory (Phase 1 starting point):**

```bash
rg '\bD[0-9]+b?\b' packages/mtw-wml charcoal-client --glob '*.{ts,tsx,md}'
rg 'edgeSatisfiesD4|assertEdgeD4|findEdgesViolatingD4|d4Error' packages/mtw-wml charcoal-client
```

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| **1** | Invariant naming cleanup (`D*` -> glossary names) | Complete |
| **2** | Partial / incomplete edges in WML + Standardize + edit algebra | Complete |
| **3** | Workbench exit-edge editor refactor | Complete |
| **4** | Smoke-test (optional), durable docs cleanup, close task | In progress |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

### Phase 1 --- Invariant naming cleanup

- [X] Run inventory greps; list files to touch (docs, error messages, tests, client helpers).
- [X] Update [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) to use [Invariant glossary](#invariant-glossary-steady-state-names) names only (no `D27` / `D29` / `D4` headings).
- [X] Update [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) **StandardArea** section similarly.
- [X] Update [`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md) Area exit examples (plain language, link to `AGENT.edges.md`).
- [X] Replace `D*` in thrown errors in [`edgeFactory.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/edgeFactory.ts) and [`area.ts`](../../../packages/mtw-wml/ts/standardize/components/area.ts) with descriptive messages (no parenthetical IDs).
- [X] Rename client helpers: `edgeSatisfiesD4` -> `edgeSatisfiesParticipantRule` (or similar), `findEdgesViolatingD4` -> `findEdgesMissingParticipantEndpoint`, `assertEdgeD4` -> remove or restrict to optional strict paths; update [`areaEditMutations.ts`](../../../charcoal-client/src/components/Workbench/AreaEdit/areaEditMutations.ts) and tests.
- [X] Rename test `describe` / `it` strings that say `D4` / `D29` to glossary terms.
- [X] Add a short "Topology invariants" subsection to [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) (or [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)) so the glossary survives deletion of this task plan.

### Phase 2 --- Incomplete edges in storage and manipulation

- [X] **Types:** Make `from` / `to` optional in [`StandardExitEdgeData`](../../../packages/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge.ts) and `isStandardExitEdgeData` (absent vs empty vs Remove/Replace envelopes --- document the distinction).
- [X] **WML parse:** [`parseExitEdgeFromSchema`](../../../packages/mtw-wml/ts/standardize/keys/edges/edgeFactory.ts) --- require `uuid`; allow omitted `<From>` and/or `<To>`; keep rejecting legacy `to=` attribute and bare String body under Area Exit.
- [X] **WML emit:** `schema()` omits `<From>` / `<To>` children when unset; round-trip tests for uuid-only and one-sided edges.
- [X] **Endpoint wrappers (unset/absent):** [`endpointReference.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/endpointReference.ts) --- allow undefined / absent endpoints without throw on construct; `reference()` returns `undefined` when unset; empty `<From />` / `<To />` normalizes to absent.
- [X] **Merge / diff / invert:** Verify [`edgeFactory.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/edgeFactory.ts) and [`edgeListFactory.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/edgeListFactory.ts) with fixtures: stub + layered Replace on one endpoint; uuid-only + add To in overlay.
- [X] **StandardArea ingest:** [`area.ts`](../../../packages/mtw-wml/ts/standardize/components/area.ts) --- store incomplete edges; **remove throw** for participant endpoint rule from `fromSchema` / `fromJSON` / `merge` (or gate behind an explicit strict mode if a caller needs it --- default asset mode must not throw for incomplete or participant-less edges).
- [X] **Participant endpoint rule:** Keep as **pure helper** (e.g. `edgeSatisfiesParticipantRule(area, edge)`) for UI warnings and optional lint; not a standardize hard error.
- [X] **Semantic layer (confirm only):** Document in [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) that [`projectRoomExits`](../../../packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts) is the filter boundary; add tests for uuid-only / missing-peer edges producing zero facets.
- [X] **Client mutations:** Add `addEmptyExitEdge(area, edgeUuid?)`; relax `addEdgeToArea` / `updateEdgeInArea` so they do not throw on participant rule; allow `retargetEdgeEndpoint` to set From or To on a stub.
- [X] **Schema converter tests:** Extend [`components.test.ts`](../../../packages/mtw-wml/ts/schema/converters/components.test.ts) and [`index.test.ts`](../../../packages/mtw-wml/ts/schema/index.test.ts) for partial topology shapes.

### Phase 3 --- Workbench exit-edge editor

- [X] Fix add flow: **Add exit edge** calls `addEmptyExitEdge` and shows a new row immediately. **Decision:** remove the two-step From/To wizard (`addStep`, `pendingFrom`, add-flow `ComponentSelectorDialog` pair in [`ExitEdgeListEditor`](../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeListEditor.tsx)); authors set endpoints on the new row via existing row selectors.
- [X] **Unset display:** [`ExitEdgeRowEditor`](../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeRowEditor.tsx) --- show `From: (unset)` / `To: (unset)` instead of `Unknown` when endpoint absent; keep independent selectors.
- [X] **Warnings, not blocks:** Participant rule violation styling (rename `d4Error` prop); do not disable save/add for incomplete or participant-less edges.
- [X] **Endpoint selector scope (row edit):** In [`ExitEdgeRowEditor`](../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeRowEditor.tsx), filter `ComponentSelectorDialog` Room list by the **other** endpoint's participant status. **Decision:** when **To** is resolved and **not** in `positionGraph.nodes`, restrict **From** to participant rooms only; when **From** is resolved and **not** in `positionGraph.nodes`, restrict **To** to participant rooms only. When the other endpoint is unset or is a participant, show the full asset Room list (portal edges: one inside, one outside). Implement via a shared helper (e.g. `roomsForExitEndpointSelector(area, edge, endpoint)`).
- [X] **Tests:** [`areaEditMutations.test.ts`](../../../charcoal-client/src/components/Workbench/AreaEdit/areaEditMutations.test.ts) for stub add + retarget; component test or RTL test for add button creating a visible row.
- [X] Update [`charcoal-client/src/components/Workbench/AGENT.md`](../../../charcoal-client/src/components/Workbench/AGENT.md) Area editor section if behavior description exists.

### Phase 4 --- Smoke-test, docs cleanup, close task

**Prerequisite (cache / `referencedBy`):** Single-pass **`referencedBy`** on `diff._components` in **`cacheAsset`** / **`decacheAsset`** (shipped 2026-06-08). **Met** --- overlay `Cache Consistency Finding` re-cache x2; Dynamo correct; second pass removed. See [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) and [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md).

- [X] **Author Coyote topology** in a **separate overlay asset** (not `ASSET#primitives`): import `AREA#WORLD` + Coyote rooms from primitives; author four bidirectional edges on imported `AREA#WORLD`. Canonize overlay when confident. `ASSET#primitives` stays component inventory only (empty `AREA#WORLD` stub + room stubs).
- [ ] **Smoke-test (optional):** at merged stack perspective (`ASSET#primitives` + overlay asset in `mergeParticipationOrder`): enter play mode from each Coyote room; confirm exit chips and movement match exit inventory in [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md) (**Overlay asset topology**).
- [ ] **Durable docs cleanup** --- move anything still only in this plan, then drop task-plan links:
  - [X] Coyote exit inventory and overlay-asset topology pattern -> [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md)
  - [ ] Replace task-plan links in [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) and [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) with Coyote / edges steady-state pointers
  - [ ] Confirm [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) still covers topology invariants and incomplete-edge projection boundary; grep steady-state docs for lingering `D*`
- [ ] **Delete this task plan** per [`taskPlanning/AGENT.md`](../../AGENT.md) (git retains history)

---

## Coyote exit inventory (smoke-test reference)

Moved to [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md) (**Overlay asset topology**). Optional play-mode verification; not required to close partial/incomplete-edge authoring work in this plan.

---

## Design notes (Phase 2)

### What "first-class" means here

| Layer | Incomplete edge behavior |
| --- | --- |
| WML parse / emit | `<Exit uuid=(...)>` may omit `<From>` and/or `<To>`; may include `<Forward>` / `<Back>` alone. |
| `StandardExitEdge` / `ExitEdgeList` | Item exists in list; merge/diff keyed by `uuid`; endpoint fields optional. |
| `StandardArea` asset mode | Ingest and persist without throw. |
| Workbench `updateStandard` | Add/update/remove stubs and partial edges freely. `addEmptyExitEdge` creates uuid-only stubs; `addEdgeToArea` / `updateEdgeInArea` do not throw on participant rule (warnings via `edgeSatisfiesParticipantRule` only). |
| `projectRoomExits` / navigation | Skip edge unless room matches a resolved endpoint **and** peer + label satisfy existing rules. |
| UI warnings | Participant endpoint rule and "unset endpoint" are visible to authors; not save gates. |

### Endpoint diff on unset base (implementation note)

`endpointReference.diff` when the base endpoint is unset now returns the incoming payload as the delta (not its invert), so `merge(base, diff(base, incoming))` round-trips for uuid-only -> partial edge transitions. Replace overlays on an unset endpoint adopt the envelope as-is (Replace cannot apply until a match value exists on the base).

### Participant endpoint rule (relaxed)

Previously enforced at standardize time: when both endpoints resolve, at least one must be in `positionGraph.nodes`.

**After refactor:** Same predicate, but used for **warnings** and **semantic eligibility**, not storage rejection. An edge with both endpoints set but neither in participants is still storable (e.g. mid-edit after removing a participant); it simply will not project to room exits until fixed.

### WML example (uuid-only stub)

```xml
<Exit uuid=(edge-a1b2c3d4) />
```

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <Forward>east</Forward>
</Exit>
```

Full edge (unchanged normative shape):

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <To>ROOM#townCenter</To>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

---

## Design notes (Phase 3)

### Add flow (decided)

**Remove the two-step wizard.** **Add exit edge** calls `addEmptyExitEdge` in one `updateStandard` pass and renders the new row with unset From/To. Do not patch `ComponentSelectorDialog` close behavior for a wizard that no longer exists.

### Endpoint selector scope (decided)

Portal edges need one endpoint inside the Area (`positionGraph.nodes`) and one outside. To nudge authors without blocking storage:

| Other endpoint state | Selector being opened | Room list |
| --- | --- | --- |
| Unset | From or To | Full asset `Room` list |
| Participant (in `positionGraph.nodes`) | From or To | Full asset `Room` list |
| Resolved, not a participant | **From** (other = To) | Participant rooms only |
| Resolved, not a participant | **To** (other = From) | Participant rooms only |

Authors can still create participant-less edges (warning styling); restrictions apply only to selector options, not to `updateEdgeInArea`.

---

## Verification

After each phase, run:

```bash
# mtw-wml
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/components/area.test.ts ts/standardize/keys/edges/ ts/standardize/projection/projectRoomExits.test.ts ts/schema/converters/components.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit

# charcoal-client Area edit slice
cd ../../charcoal-client
npm run test:single -- src/components/Workbench/AreaEdit/

# No legacy D* labels in touched steady-state docs (allow parent task plan until archived)
rg '\bD[0-9]+b?\b' packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md packages/mtw-wml/ts/standardize/components/AGENT.implementation.md
```

Manual Workbench check (Phase 3):

1. Open an Area with at least one participant Room.
2. **Add exit edge** --- a row appears immediately with uuid and unset From/To.
3. Set From and To independently; Forward/Back optional.
4. Confirm edge persists after navigation away and back (flush/debounce).
5. Confirm incomplete edge does not appear as a playable exit in play mode (semantic filter).

**Phase 4:** See [Phase 4 smoke-test](#phase-4----smoke-test-docs-cleanup-close-task) checklist above.

---

## When this task finishes

Phase 4 closes the initiative: smoke-test passes, durable docs absorb any remaining task-only content, then delete this file per [`taskPlanning/AGENT.md`](../../AGENT.md). Phases 1-3 already moved the [invariant glossary](#invariant-glossary-steady-state-names) and incomplete-edge rules into [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md).
