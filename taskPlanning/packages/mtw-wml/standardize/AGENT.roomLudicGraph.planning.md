# Room ludicGraph -- give StandardRoom a graph shape matching StandardArea

**Status: Shipped 2026-09-04. Was the prerequisite slice for RD-4 in [`AGENT.presenceRefactor.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.presenceRefactor.planning.md) --- Feature/Room and Feature/Feature presence-port population can now proceed.**

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

Both decisions below are resolved; folded into [`AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardRoom** section) and [`dataTypes/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/dataTypes/AGENT.md) (**StandardRoomData**).

- **RLG-1** (full `StandardLudicGraph` type vs. nodes-only): reused the full type, matching `StandardArea` exactly. `edges` stays structurally empty for Room this slice (typed `ExitEdgeList`; unrelated to the separate `PartOf`/`In` runtime edge question --- see Non-goals and RD-4).
- **RLG-2** (field naming): matches Area exactly --- `_ludicGraph`/`ludicGraph`. The `features`/`get features()` accessor was removed entirely (not kept as a compat shim); all call sites now use `.ludicGraph.nodes`.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as they are done, so partial progress on a multi-part step is visible.

- [X] **1. Investigate the asset-to-ephemera projection path for `ludicGraph`.** **Finding, 2026-09-04 (Explore agent survey):**
  - The DB-write path is fully generic. `cacheAsset.ts:119-128` just spreads `fileComponent.toJSON()` into the DB row via polymorphic dispatch; the `ludicGraph` key exists only because `StandardArea.toJSON()` (`area.ts:144-149`) conditionally includes it. Once `StandardRoom.toJSON()` (and `referenceKeys()`, `merge()`, etc.) are updated the same way, `cacheAsset.ts` needs **zero changes** --- it will serialize and write Room's `ludicGraph` automatically.
  - One place **is** Area-hardcoded: `lambda/assets/componentTopology/topologyDiff.ts:56` (`component.tag === 'Area' && component instanceof StandardArea`), which reads `area.ludicGraph.edges` (Exit edges only) to compute Room-connectivity for `TopologyInvalidated`. **Investigated further and ruled out as relevant here:** `TopologyInvalidated` only feeds the affordance-catalog bump (`lambda/ephemera/dataSource/affordanceCache/handleTopologyInvalidated.ts`) --- it has no subscriber that touches `internalCache.Positions`/`projectComponentGraphFromStoredLudicGraph`. That cache reads `record.ludicGraph` straight off Dynamo on every miss (`lambda/ephemera/internalCache/ludicGraphCache.ts`), independent of any event. So **no change to `topologyDiff.ts` is needed** for Room's own `_ludicGraph` to reach the runtime read path --- `cacheAsset` writing the row is already sufficient. (`topologyDiff.ts` stays Area-only because it's answering an Area-specific question --- which Rooms does this Area's Exit graph connect --- not a generic "did some ludicGraph change" question.)
  - Runtime read side (`fromRoomMeta`/`fromPlainHostMeta`) was already confirmed generic in the earlier chat survey; re-confirmed here, no further change needed.
  - **Net effect on RLG-1/RLG-2 and step 3 scope: none.** No revisiting needed.
- [X] **2. Add `_ludicGraph: StandardLudicGraph` to `StandardRoomPayload`/`StandardRoom`**, per RLG-1/RLG-2, mirroring `area.ts`'s field and every method listed in Getting Started step 4. `fromSchema` routes `Feature` children (the tags previously collected into `_features`) into `_ludicGraph.nodes` instead.
  - [X] Constructor / clone / `fromJSON` / `toJSON`
  - [X] `fromSchema` (Feature-tag routing)
  - [X] `schema()` / `nestedSchema()`
  - [X] `merge()` / `invert()`
  - [X] `assureReferences()` / `removeReferences()` / `remapReferences()`
  - [X] `withChild()` / `isEmpty()` / `equals()`
  - [X] Removed `_features` and its `get features()` accessors --- no dangling field; `referencedKeys()` keeps `Direct`-only for `ludicGraph.nodes` (matching the pre-existing test contract, not Area's Direct+Dependency dual emission --- tried the dual-emission mirror first, it broke `room.test.ts`'s `referencedKeys` expectations, reverted to Direct-only).
- [X] **3. Migrate call sites off `_features`.** The actual footprint was wider than the 2026-09-04 survey's list (re-grepping surfaced more), both by field-usage (`.features`/`_features`) and by JSON-literal fixture key (`features: [...]` as `StandardRoomData`/`StandardForm` input):
  - [X] `charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts` (`roomFeaturesListAccessor`) --- retargeted at `_ludicGraph.nodes`, rebuilding the `StandardLudicGraph` on write.
  - [X] `charcoal-client/src/components/Workbench/RoomEdit/FeatureListEditor.tsx` --- no code change needed; it only consumes the accessor, whose external contract didn't change.
  - [X] `charcoal-client/src/lib/buildGenerationContextSubset.ts` --- `payload._features = new ReferenceList([])` replaced with `payload._ludicGraph = new StandardLudicGraph()`. Left the adjacent `payload._inlineRefs = ...` line untouched --- a pre-existing bug (that field doesn't exist on `StandardRoomPayload`; `npx tsc --noEmit` in charcoal-client already flagged it before this slice) unrelated to `_features`/`ludicGraph`.
  - [X] `charcoal-client/src/slices/personalAssets/addImportToDraft.test.ts` --- direct `_features` field reads/writes retargeted at `_ludicGraph`/`_ludicGraph.nodes`.
  - [X] `.features`/`_features` accessor rename across `packages/mtw-wml/ts/standardize/components/room.test.ts`, `component.test.ts`, `packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts`, `standardForm.finalize.test.ts`, `charcoal-client/src/components/Maps/Controller/index.test.tsx`. `roomReferenceListAccessors.test.ts` needed no change (only calls the accessor functions).
  - [X] `features: [...]` JSON-literal fixtures (not caught by the `.features`/`_features` grep) --- `room.test.ts` (9 occurrences), `feature.integration.test.ts`, `room.integration.test.ts`, `standardForm.construct.test.ts` (2 occurrences), `charcoal-client/.../applyWorkbenchFlush.test.ts`, `applyAssetMetaFlush.test.ts` --- rewritten as `ludicGraph: { nodes: [...] }`.
  - [X] `ts/dungeon.test.ts`'s `StandardForm.toJSON()` snapshot updated (`features` → `ludicGraph.nodes` in the serialized shape) via `npm test -- -u`.
- [X] **4. Update durable documentation.** Per [`taskPlanning/AGENT.md`](../../../AGENT.md) governance, this is part of **done** for the slice, not a follow-up:
  - [X] [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) --- corrected the Room `features`/`characters`/`guidance` mentions to note Feature containment lives in `ludicGraph.nodes`; Area is no longer the only component with a `ludicGraph`.
  - [X] [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) --- updated Room's Purpose/Reference-Properties/fromSchema bullets, the bucket-dispatch line, and the "Components with References" example.
  - [X] [`packages/mtw-wml/ts/standardize/components/AGENT.usage.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.usage.md) --- checked, no `.features` usage example existed; no change needed.
  - [X] [`packages/mtw-wml/ts/standardize/components/dataTypes/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/dataTypes/AGENT.md) --- **StandardRoomData** entry now lists `ludicGraph` instead of `features`.
  - [X] [`charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) --- checked; it names the accessor/UI pattern ("Room Features"), not the internal field, so no change needed.
  - [X] Removed RLG-1/RLG-2 from Open decisions, folded into `AGENT.implementation.md` and `dataTypes/AGENT.md` above.
  - [X] Updated [`AGENT.presenceRefactor.planning.md`](../../../lambda/ephemera/dataSource/positions/AGENT.presenceRefactor.planning.md)'s RD-4 row to note this prerequisite shipped.
  - [X] Updated this plan's own **Recommended order** checkboxes and **Progress** table (this edit).

## Progress

| Phase | State |
| --- | --- |
| Investigation (asset-to-ephemera `ludicGraph` projection) | Done --- write path is generic, no `topologyDiff.ts` change needed |
| `StandardRoom` field + methods | Done |
| Call-site migration (charcoal-client + tests) | Done |
| Durable doc updates | Done |

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
