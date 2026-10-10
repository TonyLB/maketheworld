# Authored Objects in live graphs

**Status: not started. Next step: [Slice 0](#recommended-order) (verify premises).** Opened 2026-10-10 from [`AGENT.affordanceLudicCache.planning.md`'s D3](../affordanceOrchestration/AGENT.affordanceLudicCache.planning.md#open-decisions-implementation--plan-only), which chose this direction and handed it here.

**Scope in one sentence: make an authored `<Object>` nested under a host become a live node of that host's graph, with its presence binding, at cache time --- without a later re-cache undoing a player's move of it.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md).

---

## Getting Started

1. **The gap, as found.** Cache-time population ([`populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts)) keeps only Room/Feature children, so an authored Object never becomes a live node and gets no binding.
   - The asset lambda's `cacheAsset` writes `assetDB` only, so nothing else places it either.
   - Every live Object today is improvised and placed through `compilePositionKernelOp` (spawn, Coyote Acme delivery, commands, drift repair).
2. **The rule this changes:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), the `Component Updated` (containment population, cache-time) section.
   - It already says "for each child named" with no Room/Feature filter, and its trigger lists Object among the host kinds. The code is narrower than the contract.
   - The same section defers removal and provenance: *"Provenance and removal are out of scope for the CoyoteGame prototype, deferred deliberately."* That deferral was harmless because Rooms and Features never move; Objects do.
3. **The code:**
   - [`containment/populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts): the orchestrator and the id filter.
   - [`containment/containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts): the pure step-computer, with three independent idempotency checks (node, binding, `PartOf` edge).
   - `dataSource/index.ts` `processComponentUpdated`: the trigger, duck-typed on `ludicGraph`.
4. **The single write path for bindings:** the presence-nodes section of [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path). Population is one of the two emitters; this plan adds no third.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/
```

## What is deliberately out of scope

- **Removal on de-authoring.** A child dropped from authored WML keeps its live placement, as the contract already says for Rooms and Features.
- **Room-header display.** [`AGENT.affordanceLudicCache.planning.md`](../affordanceOrchestration/AGENT.affordanceLudicCache.planning.md) reads whatever the cache holds. Once this ships, authored objects appear in the header as a fix, not a regression; no change is needed there.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **What authored nesting can say.** Can authored WML put an Object `On` or `In` another host? Or does `ludicGraph.nodes` carry membership only, so every authored child arrives kind-less? (`processComponentUpdated` passes only `nodes` today, not edges.) This decides [AO1](#open-decisions-implementation--plan-only).
  - [ ] **Who authors nested Objects today.** Find authored assets with an `<Object>` nested under a Room, Feature or Object, and check whether any of their objects is also improvised or player-moved in a live dev world.
  - [ ] **What a re-cache sees after a move.** Trace one `cacheAsset` rerun over a parent whose authored Object a player has since moved elsewhere. Confirm the node check in `containmentPopulationSteps` would re-add it, leaving two hosts, before designing [AO2](#open-decisions-implementation--plan-only)'s fix.
- [ ] **Slice 1. Populate authored Objects.** Shaped by AO1 and AO2.
  - [ ] Widen the id filter to Objects. The emitted edge kind follows AO1, and the re-cache guard follows AO2.
  - [ ] Tests in `containmentPopulationSteps.test.ts`:
    - an authored Object under a Room;
    - an authored Object under an Object;
    - a rerun over unchanged state emits nothing;
    - a rerun after a player move does not put the object back.
- [ ] **Slice 2. Graduate.**
  - [ ] Bring the contract's `Component Updated` section in line with the code, including the edge-kind rule and the re-cache rule.
  - [ ] Update `manipulation/AGENT.implementation.md`'s containment rows.
  - [ ] Graduation sweep: grep for inbound links (including D3 in the affordance plan), then delete this file.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **AO1** | **Which edge kind does a populated authored Object get?** Population always writes `PartOf`, and the contract reserves `In` (and `On`) for mobile placement, which is what Objects are. Depends on Slice 0's first question: if authoring can state `On`/`In`, use it; if not, pick a default (likely `In`, as an unstated hosting relation already means). | Slice 1 | Open (pending Slice 0) |
| **AO2** | **How does a re-cache tell "authored here and still here" from "authored here, since moved away"?** Population is additive and keyed on "is the child a node of the parent", so a `cacheAsset` rerun after a player move would put the object back and give it two hosts. Rooms and Features never move, which is why the contract could defer provenance. Objects force the question. Candidates to weigh after Slice 0: populate only an Object that has no live host anywhere (a membership-containers read); or record that population has already happened for that child. | Slice 1 | Open |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/   # Slice 1
cd lambda/ephemera && npm run test -- --watchAll=false                                                  # before calling Slice 1 done
```

Manual check (the user's): author an Object under a Room, cache the asset, and see it in the room's header. Move it with a command, re-cache, and see it stay where it was moved.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Not started |
| 1. Populate authored Objects | Not started |
| 2. Graduate | Not started |
