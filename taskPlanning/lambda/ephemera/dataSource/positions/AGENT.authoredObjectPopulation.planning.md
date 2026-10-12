# Authored Objects in live graphs

**Status: Slice 0 done. Next step: [Slice 1](#recommended-order) (place newly authored Objects).** Opened 2026-10-10 from [`AGENT.affordanceLudicCache.planning.md`'s D3](../affordanceOrchestration/AGENT.affordanceLudicCache.planning.md#open-decisions-implementation--plan-only), which chose this direction and handed it here.

**Scope in one sentence: an authored `<Object>` newly added to an asset becomes a live node at its authored position, with its presence binding; one removed from the asset is removed from wherever it is; and nothing else an author or a re-cache does moves a live Object.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md).

---

## Getting Started

1. **The gap, as found.** Cache-time population ([`populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts)) keeps only Room/Feature children, so an authored Object never becomes a live node and gets no binding.
   - The asset lambda's `cacheAsset` writes `assetDB` only, so nothing else places it either.
   - Every live Object today is improvised and placed through `compilePositionKernelOp` (spawn, Coyote Acme delivery, commands, drift repair).
   - Ephemera does not consume `Component Removed` at all, although `cacheAsset` emits it ([`cacheAsset.ts`](../../../../../lambda/assets/dataSource/caching/cacheAsset.ts), when a component leaves the file and nothing references it).
2. **The rule this changes:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), the `Component Updated` (containment population, cache-time) section.
   - It already says "for each child named" with no Room/Feature filter, and its trigger lists Object among the host kinds. The code is narrower than the contract.
   - The same section defers removal and provenance: *"Provenance and removal are out of scope for the CoyoteGame prototype, deferred deliberately."* That deferral was harmless because Rooms and Features never move; Objects do. This plan lifts it for Objects only.
3. **The code:**
   - [`containment/populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts): the orchestrator and the id filter.
   - [`containment/containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts): the pure step-computer, with three independent idempotency checks (node, binding, `PartOf` edge).
   - `dataSource/index.ts` `processComponentUpdated`: the trigger, duck-typed on `ludicGraph`.
   - [`kernel/kernelStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts): `transferMembership` already has a pure-remove shape (`toHostId: null`, "destroy/clear"), but no production code emits it yet.
4. **The single write path for bindings:** the presence-nodes section of [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path). Population is one of the two emitters; this plan adds no third. Removal goes through the kernel too.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/
```

**Ordering (the user, 2026-10-11):** starts after [`AGENT.presenceRemainder.planning.md`](AGENT.presenceRemainder.planning.md) Slices 1-4, which are done. Population is therefore written against the `fromHostPresence` emitter shape. That plan's Slices 5+ follow this one.

## Design (the user, 2026-10-11)

An Object is its own component. Its position exists only as a reference inside its parent's component. So the three authored cases map directly onto component events, and none of them is decided parent by parent:

| Case | What the asset diff shows | Live effect |
| --- | --- | --- |
| **Added** | A new Object component, plus a reference to it in some parent | Placed at the authored position, by population of that parent |
| **Removed** | `Component Removed` for the Object | Removed from wherever it is now, including a character's hands. Its contents move to its host (see [AO3](#open-decisions-implementation--plan-only)) |
| **Repositioned by the author** (listed under A, now under B) | `Component Updated` for A and B only; the Object itself emits nothing | **None, for this iteration.** Telling "still where it was authored" from "moved since" is deferred |

**The one test that makes this hold ([AO2](#open-decisions-implementation--plan-only)):** population places an authored Object only if it has **no live host anywhere**. Population reruns for every child a parent lists, whatever triggered it. Without this test, B's `Component Updated` in the repositioned case would add the Object to B while it is still live elsewhere. The same would happen when an authored edit to A, or a drift heal of A, reruns population after a player moved the Object out. With the test, one rule covers all three: a new Object has no live host and is placed; a repositioned or player-moved Object has one and is skipped.

## What is deliberately out of scope

- **Author repositioning.** See the table above; a later plan can take provenance on.
- **Removal of Rooms and Features.** They never move, so the contract's deferral still holds for them.
- **Room-header display.** [`AGENT.affordanceLudicCache.planning.md`](../affordanceOrchestration/AGENT.affordanceLudicCache.planning.md) reads whatever the cache holds. Once this ships, authored objects appear in the header as a fix, not a regression; no change is needed there.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [X] **What authored nesting can say.** Can authored WML put an Object `On` or `In` another host? Or does `ludicGraph.nodes` carry membership only, so every authored child arrives kind-less? (`processComponentUpdated` passes only `nodes` today, not edges.) This decides [AO1](#open-decisions-implementation--plan-only).
    - **Answer: membership only, no kind.** Room, Feature, Object and Character each take nested node tags (`LUDIC_GRAPH_NODE_TAGS`) as plain `ludicGraph.nodes` references. See the `<Object>` consumer comment in `packages/mtw-wml/ts/standardize/components/room.ts`. `In`/`On`/`PartOf` exist as edge types, but [`AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) says they have "no WML surface tag or author path yet". AO1 therefore picks a default.
  - [X] **Who authors nested Objects today.** Find authored assets with an `<Object>` nested under a Room, Feature or Object, and check whether any of their objects is also improvised or player-moved in a live dev world.
    - **Answer (repo): none.** None of the repo's three `.wml` files (`lambda/assets/tests/Test.wml`, `TestCharacter.wml`, `packages/mtw-wml/ts/dungeon.wml`) authors an `<Object>`, so no checked-in content depends on today's behaviour. **The dev-world overlap check is the user's** (it needs the DB).
  - [X] **The "live host anywhere" read.** A presence binding lives on the mover's own graph, so "has a live host" should be one read of the Object's graph: does it hold any binding with a parent pointer? Confirm that read exists or is cheap. Also confirm it is correct for an Object held by a character and for one inside another Object.
    - **Answer: it exists and is one read.** `parentBindingsOf(objectId, getGraph)` in [`ludicGraph/presenceParent.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceParent.ts) reads only the owner's graph; `presenceParent.test.ts` asserts a single `getGraph` call. A non-empty result means a live host.
    - **Inside another Object:** the binding's parent is the container (the `cup-shelf` fixture in `presenceParent.test.ts`).
    - **Held by a character:** a take is a `move` with `to` = the character. `presenceBindingStepsForMove` (the single move-binding emitter) mints the binding on the mover's graph for any mover and any destination kind, with `fromHostPresence: { host: to }`, so the parent is the character.
  - [X] **When `Component Removed` fires for an Object.** `cacheAsset` emits it only when the component leaves the file **and** nothing references it. Confirm that holds when the author deletes an Object along with its parent's reference. Find the case where a lingering reference suppresses it.
    - **Answer: holds** ([`cacheAsset.ts`](../../../../../lambda/assets/dataSource/caching/cacheAsset.ts), the `componentsUpdated`/`componentsRemoved` reduce). It fires when the component is in the diff, `fileAsset._lookup` misses, and `referencedBy` is empty. Deleting the Object together with its parent's reference meets that.
    - **Lingering reference:** if a parent still lists the Object, `referencedBy` is non-empty. `cacheAsset` writes a reference-only stub row, and no `Component Removed` fires, so the Object stays live. That is acceptable for this iteration.
    - **For Slice 2:** the same reduce also emits `Component Updated` for **every** diffed component, removed ones included. A removed Object therefore also reaches `processComponentUpdated` (see Slice 2).
  - [X] **What removal can reuse.** Does the reducer handle `transferMembership` with `toHostId: null` for an Object, and what happens to the Object's own graph record? Find how contents are listed (members of the Object's bindings) so they can move to its host.
    - **Answer: reuse the existing object-lifecycle `move` op; Slice 2 needs no new kernel step.**
      - `compilePositionKernelOp` with `{ kind: 'move', moved: objectId, froms: <every live host>, to: null }` is the disconnect/destroy shape (tested in `compilePositionKernelOp.test.ts`).
      - `applyStepSequenceCore` handles the resulting pure-remove `transferMembership` kind-agnostically, and it is tested in four kernel test files. It throws on a residual edge, so the op's `dissolvedEdges` must name every edge the Object carries.
      - `presenceBindingStepsForMove` emits one `removePresenceBinding` per entry in `froms`, and no add when `to` is null. That is the missing-clear fix, so the Object's own bindings are cleared.
      - The Object's own graph row is left in place, with no bindings. That matches every other destroy today.
    - **Contents:** the members of the removed Object's bindings. Each one moves with an ordinary `move` op `{ moved: content, froms: [objectId], to: <host> }`, the same shape a command already emits.
    - **Keying caveat:** `removePresenceBinding` is still addressed by `fromHostId`, not `fromHostPresence`, so one step clears every binding the Object has under that host. For a removal that is exactly what's wanted.
- [ ] **Slice 1. Place newly authored Objects.** Shaped by AO1 and AO2.
  - [ ] Widen the id filter to Objects. The emitted edge kind follows AO1 (`In`); the "no live host anywhere" check follows AO2 (`parentBindingsOf` non-empty, per Slice 0).
  - [ ] Character parents: Slice 0 found that a Character's component can also list an Object, i.e. an authored carried item. Decided (the user, 2026-10-11): handle it with the same rule. It is placed `In` the character, under the same live-host check, with no character-specific branch. Add a test for an authored Object under a Character.
  - [ ] Tests in `containmentPopulationSteps.test.ts` (or `populateContainmentAtCache.test.ts`, wherever the live-host read sits):
    - an authored Object under a Room;
    - an authored Object under an Object;
    - a rerun over unchanged state emits nothing;
    - a rerun of A after a player moved the Object out does not put it back;
    - an author repositioning from A to B leaves the Object where it is live.
- [ ] **Slice 2. Remove de-authored Objects.** Shaped by AO3.
  - [ ] An ephemera consumer for `Component Removed` on an Object id: subscribed-event guard, a dispatch branch in `dataSource/index.ts`, and the detail-type on the `EphemeraFunction` rule in `template.yaml` (without it the event is never delivered).
  - [ ] It removes the Object from every live host through the kernel, after moving its contents to its host. Per Slice 0, both halves are existing `move` ops through `compilePositionKernelOp`: contents first, then `{ moved: objectId, froms: <live hosts>, to: null }` with `dissolvedEdges` covering the Object's edges.
  - [ ] Slice 0 found that a removal also emits `Component Updated` carrying the removed component. Confirm that `processComponentUpdated` does nothing harmful with it: it must not populate from the removal diff's nodes, and must not race the removal handler.
  - [ ] Tests: removal from a Room, from a character's hands, and from inside another Object; contents land in the removed Object's host; a removed Object with no live host is a no-op; a real-serializer round trip into the real handler (cross-lambda convention).
- [ ] **Slice 3. Graduate.**
  - [ ] Bring the contract's `Component Updated` section in line with the code: the edge-kind rule, the live-host rule, and the lifted removal deferral for Objects. Add the `Component Removed` rule.
  - [ ] Update `manipulation/AGENT.implementation.md`'s containment rows.
  - [ ] Graduation sweep: grep for inbound links (including D3 in the affordance plan and the presenceRemainder plan), then delete this file.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **AO1** | **Which edge kind does a populated authored Object get?** Population always writes `PartOf`, and the contract reserves `In` (and `On`) for mobile placement, which is what Objects are. Depends on Slice 0's first question: if authoring can state `On`/`In`, use it; if not, pick a default (likely `In`, as an unstated hosting relation already means). Decided (the user, 2026-10-11, approving Slice 0): **`In`**. Slice 0 found that authoring has no surface for any membership kind, so every authored child is kind-less. `In` is what an unstated hosting relation already means, and it is the mobile placement kind the contract reserves. | Slice 1 | Decided |
| **AO2** | **How does population tell a new Object from one already placed?** Decided (the user, 2026-10-11): **place an authored Object only if it has no live host anywhere.** Population reruns for every child a parent lists, so the parent-local "is it a node of this parent" check would re-add an Object a player moved out (after an authored edit to the parent, or a `Containment Population Drift Finding` heal). It would also add one the author repositioned while it is still live elsewhere. The live-host test covers both, plus the new-Object case, and needs no record of what the parent listed before. Rejected: recording that population already ran for a child (a second record of what the graph already says). | Slice 1 | Decided |
| **AO3** | **What happens to a removed Object's contents?** Decided (the user, 2026-10-11): they move to the removed Object's host, like emptying a box before throwing it away. Deleting them with it would destroy player-placed things because of an author's edit. Where the removed Object has several bindings, Slice 0's removal premise picks which host the contents of each binding go to. | Slice 2 | Decided |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/   # Slice 1
cd lambda/ephemera && npm run test -- --watchAll=false                                                  # before calling Slices 1 and 2 done
```

Manual check (the user's):
- Author an Object under a Room, cache the asset, and see it in the room's header.
- Move it with a command, edit the room's description, re-cache, and see the Object stay where it was moved.
- Move its authored listing to another Room, re-cache, and see it stay put.
- Delete it from the asset, re-cache, and see it gone, with anything that was in it left in its host.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Done (2026-10-11); dev-world overlap check is the user's |
| 1. Place newly authored Objects | Not started |
| 2. Remove de-authored Objects | Not started |
| 3. Graduate | Not started |
