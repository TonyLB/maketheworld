# Containment drift coverage: implementation

**Status: in progress (queued 2026-10-18; re-scoped 2026-10-19 with the user; Slice 0, 1, 2, 3, 4 and 5 done 2026-10-19). Slice 6 is next.**

**Scope in one sentence: give each containment drift check one named authority. `PresenceCoverDriftSweep` owns pointer ↔ node ↔ cover consistency, for every kind and every producer, and gains the child→parent direction it lacks. `ContainmentPopulationDriftSweep` becomes `FixedContainmentDriftSweep`, which compares the ephemera rows against the authored declaration of nestings that never move.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../AGENT.md). Delete it when the work lands. Lasting rules go to [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md) (both sweep sections) and [`positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (`Component Updated`, and the pointers-govern clause).

**Why.** A drift sweep checks a stored state against a rule. It does not check against whichever producer last wrote that state. The old plan scoped sensing to "what population repairs", which made the live-host rule (a heal's restraint) decide what gets looked at. It also left two sweeps whose authority overlapped. Today:

- [`classification.ts`](../../../lambda/diagnostics/containmentPopulationDriftSweep/classification.ts) reads one row at a time and checks two things: (a) a Room's Area binding that is not an empty carve-out, and (b) a Room or Area with no hostless root. Both are contract rules ([`AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), "The room rule is stored"). Cover drift's `noBase`, `SecondHostless` and `BadUnplaced` belong to the same family.
- `classifyPresenceCoverDrift` ([`classifyPresenceCoverDrift.ts`](../../../packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts)) walks only from the whole's own node list (`wholeMembersOf`). Suppose a child's pointer names a host whose graph lacks the child's node. That orphan pointer is never visited. The occupancy sweep catches it for Characters, and nothing catches it for Rooms, Features or Objects. Objects are the most exposed kind, because player moves, presence moves and removal write their pointers. Nested Objects under a de-authored container are one known source ([`AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), `Component Updated`, "Nested Objects under a de-authored container").
- [`healContainmentPopulation.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/healContainmentPopulation.ts) finds children from the parent's `PartOf` edges. A child that was never populated, or that lost its edge, is therefore never rerun.

## The authority partition (decided 2026-10-19)

| Sweep | Owns | Criterion | Heal |
| --- | --- | --- | --- |
| `LudicGraphStaleStructureSweep` | Rows the shape guard rejects | One row, structural | `healLudicGraphStructure` (unchanged) |
| `PresenceCoverDriftSweep` | Agreement among the denormalized copies: a child's pointer, the parent's node for it, and the parent binding's cover, **in both directions**. Also the binding-set rules (`noBase`, `SecondHostless`, `BadUnplaced`), for every kind. | Contract rules that hold whoever wrote the row | Cover rebuild where it applies, otherwise report-only (`unrepairable`) |
| `FixedContainmentDriftSweep` (renamed) | Conformance of **nestings that never move** (Room-in-Area, Feature-in-Room, Feature-in-Feature) to the authored asset: the child's node on the parent, the `PartOf` edge, a child binding pointing at the parent's root (a carve-out for Room-in-Area), and the root of a Room or Area even when it has no children | The authored declaration is the setpoint | Population rerun from the authored child list |

- **Why Objects and Characters are outside the fixed sweep:** their placement is meant to change. An authored Object's placement is only its initial state, which is also the premise of the live-host rule. Being authored is not the criterion; never moving is.
- **The one overlap:** a Room or Area with bindings and no Base fires both `noBase` (report-only) and the fixed sweep's root check (healed). That is deliberate. Cover drift owns the binding-set rule for every kind. The fixed sweep owns "this fixed whole has the root its nesting requires", because its heal is the one that can mint that root. Once the root is minted, both stop firing.
- **De-authoring is out of scope, and documented as such.** The rows may hold a fixed nesting the asset no longer declares. The contract deliberately defers removal for Rooms and Features (`Component Updated`, "Must not handle removal-on-deauthoring"), so sensing it would only produce findings nothing heals.
- **Cost.** Diagnostics may be slower than ephemera's realtime paths. Walking assets instead of three `DataCategory` scans is acceptable, and only components that declare `ludicGraph.nodes` (or are Rooms or Areas) need any further reads.

---

## Getting Started

1. **Read the sweeps and their consumers:** the [Fixed Containment Drift sweep section](../../../lambda/diagnostics/AGENT.md#fixed-containment-drift-sweep-presence-binding-shape-diagnostics) and the Presence Cover Drift section of `lambda/diagnostics/AGENT.md`; [`fixedContainmentDriftSweep/`](../../../lambda/diagnostics/fixedContainmentDriftSweep/) and [`presenceCoverDriftSweep/`](../../../lambda/diagnostics/presenceCoverDriftSweep/); [`healContainmentPopulation.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/healContainmentPopulation.ts) and [`healPresenceCover.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/healPresenceCover.ts).
2. **Read the setpoints:** the shared comparison, [`classifyPresenceCoverDrift.ts`](../../../packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts); population's `containmentPopulationSteps` and `rootStep` ([`containmentPopulationSteps.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts)); and `processComponentUpdated` in [`ephemera/dataSource/index.ts`](../../../lambda/ephemera/dataSource/index.ts), which hands the authored `ludicGraph.nodes` to population.
3. **Read how diagnostics reads assets:** [`componentVerticalMisalignmentSweep/`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/) (it enumerates an asset's components through `assetDB`) and the diagnostics [`internalCache/`](../../../lambda/diagnostics/internalCache/) (`ComponentData` pair reads).

**Test orientation.** Command authority: [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md); for ephemera-side changes, [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow those. Baseline, which must pass before edits:

```bash
cd lambda/diagnostics && npx jest containmentPopulationDriftSweep presenceCoverDriftSweep && npx tsc --noEmit
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/
cd packages/mtw-gateways && npx jest classifyPresenceCoverDrift
```

## Recommended order

Pending work is `[ ]` and done is `[X]`. Mark nested lines `[X]` as each one is done.

- [X] **Slice 0. Verify premises (no code).** Answered 2026-10-19.
  - [X] **(a) The effective authored nesting.** The premise that `cacheAsset` resolves the component was wrong.
    - **What population receives:** `Component Updated` carries each `diff._components` entry from `StandardForm.diff` (`cacheAsset.ts:156-176`, `mtw-wml/ts/standardize/index.ts:1286`). Its `ludicGraph.nodes` is therefore a per-asset **delta**: added nodes have `ref > 0`, and removed nodes come back inverted with `ref: -n` (`keys/reference.ts:404-417`, `ludicGraphNodeList.ts:311-324`). Nothing resolves imports or `_from` hops. Each asset that declares a nesting populates it when that asset caches.
    - **The authored list** is the union of the positive-ref `ludicGraph.nodes` across the per-asset rows `(AssetId: parentId, DataCategory: assetUUID)`. `cacheAsset.ts:121` writes each as `fileComponent.toJSON()`.
    - **The participating assets** are in assetDB `Meta::<Tag>.cached`. `bumpMetaCached` adds an asset (`cacheAsset.ts:89-105`) and `decacheAsset.ts:54-61` removes it.
    - **Setpoint for both the sweep and the heal:** read `Meta::<Tag>.cached`, then the `ComponentData` pair read across those assets, then take the union of positive-ref nodes. Every zone that caches contributes, matching population today.
    - **Latent bug:** `populateContainmentAtCache` ignores `ref`, so a removed node is re-populated as if it were added. This happens on an edit and on `decacheAsset`'s fully inverted diff. Fixed in Slice 3.
    - **Improvisation is out of scope:** it creates only Objects, through the kernel (contract, "Spawn is one kernel commit").
  - [X] **(b) The heal re-reads the component (decided).** The read is ephemera's `internalCache.ComponentData.getAcrossAssets(parentId, assets)`. The asset list comes from `CacheRoomAssetsData` (`internalCache/assetRooms.ts:57-83`), which today reads `Meta::Room.cached` for Rooms only, so Slice 3 widens it to `Meta::<Tag>` for any membership host. Diagnostics uses the same pair read through `createComponentDataCacheHandler(assetDB)`, so it needs no `exhaustiveScan` whitelist entry.
  - [X] **(c) Producers cross-check.** No producer holds a looser rule than the partition.
    - **Kernel writers:** every pointer write in the kernel is `addPresenceBinding`, `movePresenceBinding` or `repairPresenceBinding`. Each applies `writeCoverIndex` and then `settleMembership` in the same apply (`applyStepSequenceCore.ts:242-317`), so the pointer, the parent's node and the cover are written together. That holds for every emitter: population, `healPresenceCover`, the move compiler (take/drop/give, player moves, `executeMembershipTransfer`, split, join), `membershipChanges`, and component creation and destruction. `destroyComponent` throws while the host still holds contents (`applyStepSequenceCore.ts:220-237`).
    - **Writers outside the kernel:**
      - The Coyote clear (`persistClearStoredLudicGraphs`) REMOVEs room graphs, which orphans any Feature still pointing at a cleared room. The fixed sweep's child-node condition catches that, and population's `!parentGraph.nodeIds.has(childId)` branch heals it.
      - `healLudicGraphStructure` and `healLudicGraphPortMismatch` don't touch pointers or member nodes.
      - `migrateRoomBystanders` handles Characters only.
    - **Conclusion:** orphans come only from writes outside the kernel and from manual edits.
  - [X] **(d) The orphan-pointer heal.**
    - **The write:** one `repairPresenceBinding` on the child, with pointer and cover unchanged. `settleMembership` re-adds the node to the named host if it is absent (`settleMembership.ts:33-34, 85-86`). `writeCoverIndex` re-adds the cover entry, since it writes `after` even when unchanged (`applyStepSequenceCore.ts:25-55`).
    - **Why it's safe:** this is population's existing "correct binding whose node the parent lacks" repair. It mints nothing, so it needs no new emitter. It also needs no mover context, because the pointer governs.
    - **Guard:** heal only if the host's row exists and holds the named binding. Otherwise the case is report-only. The kernel returns `presenceBindingMissing` only for a missing *child* binding, so the guard can't be left to it.
    - **Edges:** the heal writes no edge, because edges are orthogonal to membership.
    - **CD-1** is decided (b) from this.
- [X] **Slice 1. Orphan pointer in the shared comparison.** `classifyPresenceCoverDrift` also walks each member's pointers to the hosts they name. A pointer whose host lacks the member's node becomes a new finding kind, `Orphaned` (working name), carrying `member` and `presence`. The sweep already loads all five kinds, so this needs no new read.
  - **Heal (CD-1 (b)):** `healPresenceCover` emits a `repairPresenceBinding` for the orphaned binding with pointer and cover unchanged. It does so only when the host's row exists and holds the named binding. Otherwise the finding goes to `unrepairable`.
  - **Characters:** a Character pointer at a Room is a bystander, so it stays with the occupancy sweep. Character pointers into other hosts are included here.
  - **Shipped shape:** the finding is judged from the **member's** side (`orphanedPointersOf` / `orphanRepairsFor`), reported on the member's `ephemeraId` through the existing `Presence Cover Drift Finding` (no new event, no reverse index), and healed by `healPresenceCover(member)`'s new member pass. Only report-only orphans (host row or named binding absent) appear as `Orphaned` under `unrepairable`; a repairable one is carried by `healable`. The kernel footprint already includes the pointer's host for `repairPresenceBinding`.
  - **Tests:** unit tests in `mtw-gateways`, `presenceCoverDriftSweep/index.test.ts` (existing fixtures gained an Area row so their carve-out pointers are not orphans) and `healPresenceCover.test.ts`.
- [X] **Slice 2. The fixed classifier.** The sweep compares each fixed nesting the asset declares against the parent's and child's rows, checking the four conditions in the partition table. It reports the parent. The current one-row classifier and conditions (a) and (b) are retired into it.
  - [X] **The setpoint read** (Slice 0(a)): `authoredNestings.ts` reads `Meta::<Tag>.cached` from assetDB, then `internalCache.ComponentData.getAcrossAssets`, then the union of positive-ref, non-presence `ludicGraph.nodes`. Injectable deps; the sweep reads at most 10 parents at once.
  - [X] **Shipped shape:** `isFixedContainmentDrifted(parentId, parentGraph, authoredChildIds, childGraphOf)` in `fixedContainmentDriftSweep/classification.ts`, reusing `presenceGraphViewOf`. Conditions: Room/Area root; child node on the parent; `PartOf` edge (compared with `ephemeraLudicTerminalsEqual`); child binding at the parent's root (Room-in-Area also an empty-member carve-out). A Feature with an authored child and no binding at all is drifted (population mints its root). A parent with several bindings and no root to name is not judged (population refuses it). Objects and wrong-kind children are ignored; de-authored nestings are not sensed. `containmentDriftParentsOf` is deleted.
  - [X] **An extra test** checks that a nesting declared by an importing asset appears in the union (against the injected deps; it shows the union takes every `cached` asset, not that the importing asset's row shares the `universalKey`, which Slice 0(a) established from the code).
  - **Tests:** `classification.test.ts`, `authoredNestings.test.ts`, `index.test.ts` (sweep-level, deps injected). The sweep's section in `lambda/diagnostics/AGENT.md` has the new Evaluation text; Slice 6 still owns the partition rewrite.
- [X] **Slice 3. The heal populates from the authored list.** `healContainmentPopulation` builds the parent's authored list with the Slice 0(a) read and passes its Room and Feature children to `populateContainmentAtCache`, in place of the children it found from `PartOf` edges.
  - [X] **Asset list:** widen `CacheRoomAssetsData` to read `Meta::<Tag>.cached` for any membership host, rather than adding a sibling read.
  - [X] **Ingress fix:** `processComponentUpdated` (`ephemera/dataSource/index.ts:46-49`) keeps only nodes with `ref > 0`. A unit test shows that a removal diff populates nothing.
  - **Shipped shape:** `CacheRoomAssetsData.get` takes a Room, Area or Feature id (`AssetHostId`) and reads the matching `Meta::<Tag>`. `containment/authoredChildren.ts` holds `addedNodesOf` (positive-ref, non-presence), the pure `authoredChildIdsFromNodeLists` and `authoredChildrenOf(parentId)` (Room and Feature ids only), which duplicates diagnostics' `authoredNestings.ts` on purpose, each file naming the other. `healContainmentPopulation` now calls `authoredChildrenOf`; the ingress calls `addedNodesOf`. Tests: `authoredChildren.test.ts`, `assetRooms.test.ts`, `healContainmentPopulation.test.ts` (a never-populated child is reached; a de-authored or removed one is not), `dataSource/index.test.ts`. Slice 6 still owns the contract's `Component Updated` rewrite; the three sentences that said "existing `PartOf` children" were corrected in place.
- [X] **Slice 4. Payoff tests.** For each new condition, in both sweeps: a drifted stored state, the sweep's finding, the consumer's heal (or the `unrepairable` entry, for report-only kinds), and a second sweep reading `emittedCount: 0`. Follow the cross-lambda integration convention (a real-serializer round trip into the real consumer, mocked at the leaves). Include a never-populated authored child, which the old heal could not reach.
  - [X] **Shared scenarios:** `packages/mtw-gateways/ts/ephemera/positions/containmentDriftScenarios.ts` (11 scenarios over one clean Town/Kitchen/Stove/Cup world; `normalizeMintedIds` renames heal-minted uuids).
  - [X] **Diagnostics leg:** `lambda/diagnostics/containmentDriftPayoff.test.ts`.
  - [X] **Ephemera leg:** `lambda/ephemera/dataSource/positions/manipulation/containment/containmentDriftPayoff.integration.test.ts`.
  - **Seam (decided with the user 2026-10-19):** the sweeps (diagnostics) and the heals (ephemera) cannot import each other, so the loop is closed in two legs over the one shared scenario module, rather than moving `isFixedContainmentDrifted` into `mtw-gateways`. The diagnostics leg runs the real sweeps with their default `emitFinding` (only the EventBridge client mocked), reads each finding back through `DiagnosticsEventSerializer`, and sweeps `healed` to zero. The ephemera leg serializes the expected findings the same way, publishes them on the real messageBus, and runs the real consumers and kernel over an in-memory `transactWrite`; it asserts the stored rows equal `healed`, then redelivers and asserts no further write. The EventBridge hop stays manual.
  - **Shipped shape:** scenarios are cover stale entry; orphan pointer repairable (Feature, Object); orphan report-only; never-populated Room and Feature; missing `PartOf` edge; Stove binding naming a vanished Kitchen root; Room-in-Area carve-out carrying members; rootless Room (the `noBase` overlap); de-authored nesting; removed-diff (`ref < 0`) child. Mutation checks: with an empty authored list, the never-populated, missing-edge and wrong-binding scenarios fail; with cover findings withheld, only the three cover scenarios fail, so the carve-out, wrong-binding and rootless scenarios are healed by the fixed heal alone. No production code changed and no bug surfaced.
  - **Facts the tests pinned (not previously recorded):** population mints a child's first binding as `PRESENCE#Base` and later ones as uuids (`containmentPopulationSteps.ts`), so a never-populated Stove ends with `Base` and the Kitchen's Area carve-out is the minted id. A report-only orphan has to be an *orphan* (host lacks the member's node); a host that still lists the member under a vanished binding reads as `Stale` on the host instead. A Stove naming a vanished root yields two `Stale` findings on the Kitchen, not an `Orphaned` one.
- [X] **Slice 5. Rename.** `ContainmentPopulationDriftSweep` became `FixedContainmentDriftSweep`, and `Containment Population Drift Finding` became `Fixed Containment Drift Finding`.
  - **Shipped shape:** a mechanical rename with no behavior change. The sweep directory moved to `lambda/diagnostics/fixedContainmentDriftSweep/`; the detail-type, the API sweep type, the event types and guard (`isFixedContainmentDriftFindingEvent`), the diagnostics and ephemera `subscribedEvents`, `template.yaml`'s EventBridge rule and the doc names and the `lambda/diagnostics/AGENT.md` heading anchor all changed together. There is no transition alias for the old detail-type (pre-rollout, one dev instance). `healContainmentPopulation`, `populateContainmentAtCache` and `containmentPopulationSteps` keep their names, since they name the mechanism. The re-grep found no file the plan's list lacked beyond the ones it named.
  - **Docs:** names and anchors only. Slice 6 still owns the partition rewrite.
- [ ] **Slice 6. Docs and deletion.** Rewrite both sweep sections in `lambda/diagnostics/AGENT.md` with the partition, so each states what it owns, its one overlap, and de-authoring as out of scope. Do the same for the classifier doc comments. Update `positions/AGENT.contract.md`: the `Component Updated` ingress bullet (the event carries a per-asset diff and population reads only `ref > 0` nodes; the heal reads the authored list from `Meta::<Tag>.cached` pairs; Objects sit outside the fixed sweep because they move) and the pointers-govern clause (the orphan direction is sensed, and healed by a same-pointer `repairPresenceBinding` when the host holds the named binding). Update `positions/manipulation/AGENT.implementation.md`'s references. Then delete this plan. Optional follow-up: `invalidationCompleteness.integration.test.ts` and the Slice 4 ephemera leg each carry their own in-memory `transactWrite` fake; extract one shared helper if a third consumer appears. Slice 4 also corrected one stale sentence in the diagnostics Containment Population Drift section (the heal now reads the authored list) and added the payoff-test pointer there and in `ephemera/AGENT.testing.md`.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| --- | None open. CD-1 (the orphan-pointer heal) was decided (b) on 2026-10-19; see Slice 0(d) and Slice 1. | --- | --- |

## Verification

1. `cd lambda/diagnostics && npx jest && npx tsc --noEmit`.
2. `cd packages/mtw-gateways && npx jest && npx tsc --noEmit`.
3. `cd lambda/ephemera && npm run test -- --watchAll=false` (the whole suite, because `*.integration.test.ts` files sit outside `tsconfig`).
4. Every `](...#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Done (2026-10-19) |
| 1. Orphan pointer (shared comparison) | Done (2026-10-19) |
| 2. Fixed classifier | Done (2026-10-19) |
| 3. Heal from authored list | Done (2026-10-19) |
| 4. Payoff tests | Done (2026-10-19) |
| 5. Rename | Done (2026-10-19) |
| 6. Docs and deletion | Ready |
