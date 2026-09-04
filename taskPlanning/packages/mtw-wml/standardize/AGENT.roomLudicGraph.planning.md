# Room ludicGraph -- give StandardRoom a graph shape matching StandardArea

**Status: Not started. Prerequisite slice for RD-4 in [`AGENT.presenceRefactor.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.presenceRefactor.planning.md) --- Feature/Room and Feature/Feature presence-port population cannot be written until this lands.**

This is a **standard-variant** task plan (see [`taskPlanning/AGENT.md`](../../../AGENT.md)).

## Why this exists

`StandardArea` (WML authoring layer) carries a `ludicGraph` field (nodes + edges, [`packages/mtw-wml/ts/standardize/components/ludicGraph.ts`](../../../../packages/mtw-wml/ts/standardize/components/ludicGraph.ts)). `StandardRoom` does not --- it only has a plain `_features: ReferenceList` for Feature containment, the same shape as its unrelated `_guidance` and `_characters` fields.

At the **runtime** (ephemera) layer this looks backwards from what it actually is. `EphemeraLudicGraphData` is already fully host-kind-agnostic --- Room gets one exactly like Area, Object, and Feature do (`fromRoomMeta`, [`lambda/ephemera/dataSource/positions/ludicGraph/index.ts:516`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts)). The **only** thing Room-specific in that file is a fallback: when the `Meta::Room` row has no stored `ludicGraph` field, it seeds the graph from `activeCharacters` instead (a legacy presence-only seed). Every other host kind just does `record.ludicGraph ? EphemeraLudicGraph.fromFieldPayload(...) : EphemeraLudicGraph.empty(hostId)`.

So the runtime consumer is already waiting for `record.ludicGraph` on a Room's Meta row. Nothing populates it today because nothing upstream --- neither `StandardRoom` nor `cacheAsset` --- produces a `ludicGraph` field for Room to begin with. Feature-in-Room containment (`_features`) never reaches the runtime graph by any path. This plan closes that gap on the **authoring side only**; the runtime read path needs no change.

**Not investigating from scratch:** this was scoped in chat 2026-09-04 by an Explore agent survey of `_features` call sites and of the ephemera ludicGraph build code. See that survey's findings folded into this plan's Getting Started and Recommended order --- do not re-derive them.

## Non-goals

- **`_characters` and `_guidance` are untouched.** Character-in-Room already reaches the runtime graph through presence-port population (RD-1, shipped) with no WML-authoring dependency; this plan does not touch that path. `_guidance` is not a containment field at all.
- **No presence-port population, and no `PartOf`/`In` runtime edge synthesis.** Both are RD-4's, in the sibling plan (2026-09-04 addendum to that row). This slice only gives `StandardRoom` somewhere to hold Feature containment nodes in the same shape Area already uses; it does not write ports or runtime hosting edges. Per PR-7 in `AGENT.presence.planning.md`, a `PartOf`/`In` edge and a `Present` port are independently-authored facts about the same relationship --- neither is a byproduct of this slice's node-shape work.
- **No WML surface-syntax change.** Room already nests `<Feature>` children the same way Area nests `<Room>`/`<Feature>` children; this is an internal representation change in `StandardRoomPayload`, not a new authoring tag.

## Getting Started

1. **Read the testing doc first:** [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). It is the command authority for this package. Note the **Optional regression searches (Area)** section --- it already gives the `ludicGraph`-focused test filter to reuse for Room.
2. **Command authority / working directory:** from repo root, `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` must pass; package tests run via `npm --prefix packages/mtw-wml run test -- --watchAll=false --testPathPattern="area|ludicGraph|room"`.
3. **Baseline before editing:** run the command above and confirm green, plus `npm run build` in `charcoal-client` (per the testing doc, front-end errors from `mtw-wml` changes surface there).
4. **Read the pattern to mirror, not this file's summary of it:** [`packages/mtw-wml/ts/standardize/components/area.ts`](../../../../packages/mtw-wml/ts/standardize/components/area.ts) --- every method that touches `_ludicGraph` (constructor, `fromSchema`, `toJSON`, `schema`, `nestedSchema`, `merge`, `invert`, `assureReferences`, `removeReferences`, `remapReferences`, `withChild`, `isEmpty`, `equals`) is the template for the equivalent `_features`-handling method in [`room.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.ts).
5. **Read the runtime consumer before assuming it needs a change:** [`lambda/ephemera/dataSource/positions/ludicGraph/index.ts`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts), `fromRoomMeta` (~line 516) and `fromPlainHostMeta` (~line 540) --- confirm the generic path really does fire once `record.ludicGraph` is non-empty, and find (don't assume) the code that copies a cached component's `ludicGraph` field into its `Meta::<Kind>` row, so step 1 below can confirm it is generic across host kind rather than Area-special-cased.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement this slice. Do not copy into package `AGENT.md`/concepts docs. When decided, record the rule in the relevant durable doc (see step 4 of Recommended order) and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **RLG-1** | Does `StandardRoom` reuse the full `StandardLudicGraph` type (nodes + edges), matching `StandardArea` exactly, or a nodes-only lighter type, since Room has no `<Exit>`-equivalent between Features today? | Step 2 (field shape) | **Decided 2026-09-04 (user): reuse the full type.** Runtime projection code stays untouched; does not foreclose Feature-to-Feature edges later. **Correction, same day: "edges always empty" is not a choice this slice makes --- `StandardLudicGraph._edges` is typed `ExitEdgeList` at the WML layer, so it structurally can only ever hold `Exit` edges regardless. This is unrelated to the separate `PartOf`/`In` runtime edge question --- see Non-goals and RD-4.** |
| **RLG-2** | Field name on `StandardRoom`: `_ludicGraph`/`ludicGraph`, matching Area's naming exactly, or something Room-specific? **Recommendation: match Area's naming exactly** (`_ludicGraph` internal, `ludicGraph` on `toJSON()`/wrapper getter) --- the runtime already reads the row field by the literal name `ludicGraph` (`fromRoomMeta`), so this is close to forced, not a real fork, but recorded because a reviewer should be able to see it was checked, not assumed. | Step 2 | Open --- confirm during step 1 investigation, likely resolves itself |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as they are done, so partial progress on a multi-part step is visible.

- [X] **1. Investigate the asset-to-ephemera projection path for `ludicGraph`.** **Finding, 2026-09-04 (Explore agent survey):**
  - The DB-write path is fully generic. `cacheAsset.ts:119-128` just spreads `fileComponent.toJSON()` into the DB row via polymorphic dispatch; the `ludicGraph` key exists only because `StandardArea.toJSON()` (`area.ts:144-149`) conditionally includes it. Once `StandardRoom.toJSON()` (and `referenceKeys()`, `merge()`, etc.) are updated the same way, `cacheAsset.ts` needs **zero changes** --- it will serialize and write Room's `ludicGraph` automatically.
  - One place **is** Area-hardcoded: `lambda/assets/componentTopology/topologyDiff.ts:56` (`component.tag === 'Area' && component instanceof StandardArea`), which reads `area.ludicGraph.edges` (Exit edges only) to compute Room-connectivity for `TopologyInvalidated`. **Investigated further and ruled out as relevant here:** `TopologyInvalidated` only feeds the affordance-catalog bump (`lambda/ephemera/dataSource/affordanceCache/handleTopologyInvalidated.ts`) --- it has no subscriber that touches `internalCache.Positions`/`projectComponentGraphFromStoredLudicGraph`. That cache reads `record.ludicGraph` straight off Dynamo on every miss (`lambda/ephemera/internalCache/ludicGraphCache.ts`), independent of any event. So **no change to `topologyDiff.ts` is needed** for Room's own `_ludicGraph` to reach the runtime read path --- `cacheAsset` writing the row is already sufficient. (`topologyDiff.ts` stays Area-only because it's answering an Area-specific question --- which Rooms does this Area's Exit graph connect --- not a generic "did some ludicGraph change" question.)
  - Runtime read side (`fromRoomMeta`/`fromPlainHostMeta`) was already confirmed generic in the earlier chat survey; re-confirmed here, no further change needed.
  - **Net effect on RLG-1/RLG-2 and step 3 scope: none.** No revisiting needed.
- [ ] **2. Add `_ludicGraph: StandardLudicGraph` to `StandardRoomPayload`/`StandardRoom`**, per RLG-1/RLG-2, mirroring `area.ts`'s field and every method listed in Getting Started step 4. `fromSchema` routes `Feature` children (the tags currently collected into `_features`) into `_ludicGraph.nodes` instead.
  - [ ] Constructor / clone / `fromJSON` / `toJSON`
  - [ ] `fromSchema` (Feature-tag routing)
  - [ ] `schema()` / `nestedSchema()`
  - [ ] `merge()` / `invert()`
  - [ ] `assureReferences()` / `removeReferences()` / `remapReferences()`
  - [ ] `withChild()` / `isEmpty()` / `equals()`
  - [ ] Remove `_features` and its `get features()` accessors once every read site is migrated (step 3) --- do not leave it as a dangling unused field.
- [ ] **3. Migrate the ~3 production call sites off `_features`** (per the 2026-09-04 survey; re-grep to confirm the list hasn't moved):
  - [ ] `charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts` (`roomFeaturesListAccessor`) --- retarget at `_ludicGraph`'s node list, or at whatever accessor shape `area.ts`'s equivalent (if any) already uses for its nodes.
  - [ ] `charcoal-client/src/components/Workbench/RoomEdit/FeatureListEditor.tsx` --- update to the new accessor.
  - [ ] `charcoal-client/src/lib/buildGenerationContextSubset.ts:37` --- replace `payload._features = new ReferenceList([])` with the `ludicGraph`-equivalent clear.
  - [ ] Update the ~6 test files identified in the survey (`room.test.ts`, `component.test.ts`, `standardForm.removeComponent.test.ts`, `standardForm.finalize.test.ts`, `roomReferenceListAccessors.test.ts`, `addImportToDraft.test.ts`, `Maps/Controller/index.test.tsx:172`).
- [ ] **4. Update durable documentation.** Per [`taskPlanning/AGENT.md`](../../../AGENT.md) governance, this is part of **done** for the slice, not a follow-up:
  - [ ] [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) --- if it describes Room's containment fields or the `_features`/`_guidance`/`_characters` trio as a pattern, correct it to reflect Room's `ludicGraph` field and note Area is no longer the only component with one.
  - [ ] [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) --- update Room's field list/architecture notes.
  - [ ] [`packages/mtw-wml/ts/standardize/components/AGENT.usage.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.usage.md) --- update any Room-Feature usage examples still showing `_features`.
  - [ ] Check [`packages/mtw-wml/ts/standardize/components/dataTypes/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/dataTypes/AGENT.md) for a Room/Area field-shape table that needs the same correction.
  - [ ] [`charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) --- if it lists Room's Feature list as a `ReferenceList` example, correct or drop the example.
  - [ ] **Remove RLG-1/RLG-2 from Open decisions** once decided, and fold RLG-1's verdict into whichever doc above states Room's field shape.
  - [ ] Update [`AGENT.presenceRefactor.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.presenceRefactor.planning.md)'s RD-4 row to note this prerequisite shipped, so RD-4 no longer needs to route around Room's missing graph.
  - [ ] Update this plan's own **Recommended order** checkboxes and **Progress** table as the last step, after tests pass (per [`taskPlanning/AGENT.md`](../../../AGENT.md#recommended-order-checkboxes)).

## Progress

| Phase | State |
| --- | --- |
| Investigation (asset-to-ephemera `ludicGraph` projection) | Done --- write path is generic, no `topologyDiff.ts` change needed |
| `StandardRoom` field + methods | Not started |
| Call-site migration (charcoal-client + tests) | Not started |
| Durable doc updates | Not started |

## Verification

From repo root:

```bash
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
npm --prefix packages/mtw-wml run test -- --watchAll=false --testPathPattern="area|ludicGraph|room"
npm run build --prefix charcoal-client
```

Then the full `mtw-wml` suite (not just the filtered pattern above) before calling the slice done, per the testing doc's general expectation that a filtered run is for iteration, not sign-off:

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false
```

**Confirm no `_features` references remain outside history:**

```bash
rg "_features\b" packages/mtw-wml charcoal-client --glob "*.ts" --glob "*.tsx"
```
