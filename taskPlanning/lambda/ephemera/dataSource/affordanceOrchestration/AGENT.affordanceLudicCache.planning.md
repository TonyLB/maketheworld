# Room affordances on `ludicCache`: one level of nested contents

**Status: Slice 0 done (premises verified, D1 decided). Next step: [Slice 1](#recommended-order).** Branch `iss8260-first-draft-affordance-refactor-design`.

**Scope in one sentence: build the room-affordance channel's object list from the same exhaustive `ludicCache` handles the command path already uses, and show one level of contents beside each room-level object --- `Table (with Red cup)`, `Table (with Red cup, Blue cup)`, and `Table (with several objects)` past three.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). Deleted when the work lands; lasting rules move to the durable docs named in [Slice 5](#recommended-order).

---

## Getting Started

1. **Read [`positions/AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 5** (the cache) and [`positions/AGENT.concepts.md`'s `ludicCache` entry](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#ludiccache-the-attention-scoped-read-structure). The five clauses bound what this plan may do; clause 3 (a hit returns a handle, never a subgraph) is the one this plan touches.
2. **Read the two affordance docs:** [`affordanceOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md) (ingress, fan-out, the `Object Moved` room filter) and [`affordanceCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) (the `Affordance::` row --- exits only, unchanged by this plan).
3. **The code this plan changes:**
   - [`internalCache/affordanceRoomDeliverable.ts`](../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) --- the compose. Today objects come from the room's own shard (`ludicGraph.objectIds`) with shortNames from `ImprovisationComponentData` only.
   - [`positions/ludicCache/catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts) and [`fold.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/fold.ts) --- the handle seam this plan extends.
   - [`affordanceOrchestration/roomsAffectedByObjectMoved.ts`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/roomsAffectedByObjectMoved.ts) --- the refresh filter.
   - [`charcoal-client/src/slices/messages/roomHeaderContents.ts`](../../../../../charcoal-client/src/slices/messages/roomHeaderContents.ts) --- `formatRoomContentsLine`, the client formatter.
4. **The wire precedent to copy, not reinvent:** the `look <object>` path's `resolveHostedNodeWmlData` in [`perception/orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) ships an object's contents as the object stub's own `ludicGraph` (bare references) plus **sibling name stubs** in the same `StandardForm`, and the client's `formatObjectContentsLine` already reads that shape via `nonRootComponentRefs`. The room header uses the same shape one level down; no new wire field.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) for the lambda, [`charcoal-client/AGENT.testing.md`](../../../../../charcoal-client/AGENT.testing.md) for the client. Baseline before the first edit, both should pass:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/affordanceOrchestration/ dataSource/affordanceCache/ dataSource/positions/ludicCache/ internalCache/
cd charcoal-client && npm run test:single -- src/slices/messages/roomHeaderContents.test.ts
```

`npm run test`, not `npm test`, in the lambda; `*.integration.test.ts` files sit outside the tsconfig, so run the full lambda suite after any rename.

## What is deliberately out of scope

- **No `On`/`In` differentiation, no attention scoping.** The cache stays exhaustive (clause 2 deferred, as chosen). A cup in a closed box on the floor shows as `Box (with Cup)`. Known and accepted for this draft.
- **One level only.** The cup in the box on the table does not appear; `Table (with Box)` is the whole story. Contents on `look table` is a later step.
- **Exits and the character roster** stay on their current sources (`Affordance::` row, `getRoomCharacterList`). The cache does not model exits.
- **Persistence** (`ludicCacheRebuild` Slice 6). This plan adds a second cold-rebuild consumer; it does not persist.
- **Held inventory.** The cache walk never recurses into a character-hosted shard except as seed; characters' holdings stay out of the room header.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Record each answer inline here before Slice 1.
  - [X] **Can a member/host pair be stated by neither side?** The cache states direct membership twice: the host's own binding's cover lists its direct members (`presenceCacheNodesFromFold` in [`mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts), member entry present even without the member's own binding), and the member's own binding names the host (`fromHostId`). It is lost only when the member was placed without a move **and** the host itself has no binding --- [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path): *a thing placed without a move never had one minted*. Find which placement paths (authored WML nesting, improvised creation in place, Coyote placement) mint no binding, and whether any produce that double-unbound pair. The seed room never has a binding, so room-level membership is always the fallback (no bucket = on the floor), and the double-unbound pair is exactly what that fallback misfiles. Answer decides [D1](#open-decisions-implementation--plan-only).
    - **Answer: no live path produces one; every Object in a live graph has a binding.** Every writer that puts an Object into a live host graph goes through [`compilePositionKernelOp`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts), which always appends `presenceBindingStepsForMove` (one binding per rehost, any host kind):
      - player commands (`planObjectMoveTransfer`);
      - improvised spawn and Coyote Acme delivery (`spawnImprovisationObjectsBatch` / `applyObjectsChange` → `executeMembershipTransfer`);
      - Coyote clearing (`clearCoyoteGameImprovisationObjects`);
      - drift repair (`repairObjectPlacementDrift`).
    - **Authored Objects never reach a live graph.** The asset lambda's `cacheAsset` writes `assetDB` only. Cache-time population ([`populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts)) filters children to Room/Feature ids, so an authored `<Object>` nested under a host is dropped: no node, no binding.
      - That is the one "placed without a move" case. It yields an absent object, not a double-unbound pair.
      - [`positions/AGENT.contract.md`'s `Component Updated` rule](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) says "for each child named" without the filter. That mismatch is [D3](#open-decisions-implementation--plan-only).
    - **Feature hosts get their binding from that same population path** (Feature-in-Room).
    - The only remaining way to have an unbound host is a graph written before presence nodes shipped (legacy dev data). That is defensive territory, not a placement path to fix.
  - [X] **Placement on a non-room host emits `Object Moved`** with `to` = the table (not only `Objects Changed`), so [Slice 3](#recommended-order)'s filter sees it. If creation-in-place emits only `Objects Changed` (`createdIds`, no host), note how its room fan-out finds the room today and whether a nested create reaches it.
    - **Answer: yes, for every host kind.** In `factsForStep.ts`, each Object `transferMembership` step yields one `Object Moved` fact `{froms, to}` with no host-kind filter. `commitStepSequence` streams it through `streamObjectMembershipFact`.
    - Spawn goes through `executeMembershipTransfer`, so a created object streams `Object Moved` with `froms: []` and `to` = the room, alongside `Objects Changed`.
    - Spawn always targets a room (`targetRoomId`), so **no nested create exists today**. A cup only reaches a table by a later move, which carries `to` = the table.
  - [X] **ShortName coverage.** Compare the handle's `shortName` (from `resolveComponentCacheFields`) with the deliverable's current improvisation-only read on one authored and one improvised object. Note any room-level object that appears or disappears from the header when the source switches --- an authored object newly appearing is a fix, not a regression, but say so.
    - **Answer: no change in practice.** `resolveComponentCacheFields` ([`objects/objectShortName.ts`](../../../../../lambda/ephemera/dataSource/objects/objectShortName.ts)) reads the merged aggregate over `assetStack` plus `ASSET#IMPROVISATION` (the same pair-row table `getImprovisationObject` reads). The deliverable reads the improvisation layer alone.
    - Every live object is improvised (Q1), with a freshly minted id no authored asset defines, so the two give the same shortName. Both drop an object whose shortName is unresolved (`catalogHandles.ts` skips `shortName === undefined`). No room-level object appears or disappears.
    - The "authored object newly appearing" case can't arise until authored Objects are populated.
    - **Unchanged and worth knowing:** an Object on a Feature (cup on an authored counter) is in the room's cache but is not room-level, and Features aren't in the `Contents:` line. It stays out of the header, as it is today.
  - [X] **Wire round trip of a nested stub inside a room form.** Confirm an `Object` stub carrying `ludicGraph` survives `ephemeraWire` print/parse inside a room `StandardForm`, as it does inside an object form on the look path.
    - **Answer: it survives.** I ran a throwaway probe in `mtw-wml` (since deleted): a `StandardForm` of Room (graph → table), table Object (graph → cup) and cup Object stub, printed with `schemaToWML([form.schema])` as `publishAffordancePerceptionForCharacters` does, then reparsed in `ephemeraWire`.
    - The printer inlines the definitions (`<Room><Object uuid=(table)><ShortName/><Object uuid=(cup)>…</Object></Object></Room>`). On reparse, the room's `nonRootComponentRefs` = `[table]`, the table's = `[cup]`, and the cup's shortName is intact.
    - No committed test covers a room-rooted form with a nested object graph, so Slice 2's deliverable test should assert the reparsed shape, not just the built `StandardForm`.

- [ ] **Slice 1. Read direct hosts off what the cache already states ([D1](#open-decisions-implementation--plan-only)).** No new cache field and no new `buildLudicCache` output.
  - [ ] In `catalogHandles.ts`, derive each object's direct hosts from the cache: the owners of bindings whose cover lists it (what `bucketsByMember` already walks), plus the `fromHostId` of its own bindings; the seed room when neither names anything (the existing fallback). Whether that surfaces as a new handle field or the deliverable groups on the existing `presence` field is a free choice --- pick whichever keeps the handle flat.
  - [X] ~~If Slice 0 found double-unbound pairs, fix them at the placement path that skips the binding.~~ Not needed: Slice 0 found none.
  - [ ] Tests in `catalogHandles.test.ts`: object on room floor; cup on a bound table (cover side); cup with its own binding on an unbound table (member side --- only legacy pre-presence data produces an unbound table, so this is the defensive case, not a live one); spring in box and contraption (both hosts); held item excluded. The command path (`roomObjectCatalogForCharacter.ts`) stays green without edits.

- [ ] **Slice 2. Compose the room header from handles.**
  - [ ] `AffordanceRoomDeliverableData` calls `ludicCacheObjectHandles(roomId, affordanceRow.assetStack)` in place of `getImprovisationObject` per id. The room row's own `ludicGraph` wire field is unchanged (still the room's shard).
  - [ ] **Room-level objects** = handles whose `hosts` include `roomId`. For each, its **contents** = handles whose `hosts` include that object. Each room-level object's stub carries a `ludicGraph` of bare references to its contents (root excluded, as `toWireLudicGraphFull` already does), and each content object travels as a sibling name stub --- the look path's shape.
  - [ ] Depth stops there: a handle hosted only by a content object (cup in box on table) gets no stub and no reference.
  - [ ] Drop `getImprovisationObject` from `AffordanceRoomDeliverableObjectReads` if nothing else reads it; thread the handle function as a dep instead, so tests inject it without the cache walk.
  - [ ] Tests in the deliverable's suite: the three cases from Slice 1 produce the expected stubs and references; an object whose shortName is unresolved is dropped at both levels, as today. Assert on the form **reparsed** from `schemaToWML([form.schema])` in `ephemeraWire` (Slice 0 found no committed test of a room-rooted form carrying a nested object graph).

- [ ] **Slice 3. Refresh the room when a room-level object's contents change.**
  - [ ] `roomsAffectedByObjectMoved` also returns, for each non-room host in `froms`/`to`, the rooms its **presence chain** reaches: read the host's own graph (`internalCache.Positions.getLudicGraph`) and take each of its bindings' `fromHostId` that is a room. **This is the general rule cut to one step:** the room whose cache owns a binding is found by walking the binding's ancestor chain (bindings form a forest rooted at rooms --- [`AGENT.concepts.md` --- Presence as a cover](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#presence-as-a-cover)), and one level of contents shown means a change one level below a room-level object is the only one that can alter the header. Not the adjacency reverse index: presence is the axis the cache is built along, so walking it is what "which cache holds this" means. **The full walk already exists:** `roomsForHost` in [`positions/ludicGraph/presenceRooms.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceRooms.ts) (narration-audience resolution, used by `commitAttempt.ts`). Write the one-step read beside it, sharing its `getGraph` dependency shape, rather than inside affordanceOrchestration. Calling `roomsForHost` itself would over-refresh (a cup moving inside a box on a table would refresh the room although the header can't change) --- harmless, but not the rule.
  - [ ] **What the walk depends on, stated so it is not later rediscovered as a bug.** (i) **A host with no binding has no chain** --- an object placed on the floor without a move would not refresh its room when its contents change. Slice 0 found no live placement path that leaves an Object unbound (every one goes through `compilePositionKernelOp`), so only legacy pre-presence data can hit this; `roomsForHost` documents the same dead end as an accepted false negative. (ii) **Inherited arity is unwritten**, so a binding can have two parents. That does not affect a one-step walk (a host's own bindings are read directly) but does affect any deeper walk --- do not extend this past one level without it.
  - [ ] The function becomes async; update `index.ts`'s caller. `bumpNonRoomHostCatalogsForObjectMoved` (the look-path sibling) is unchanged.
  - [ ] Tests: cup placed on table refreshes the table's room; cup moved from box-on-table to table refreshes the room once (dedupe); cup moved between two boxes inside a box refreshes nothing.
  - [ ] Rewrite the "room-scoped filter by design" paragraph in `affordanceOrchestration/AGENT.md` --- Rooms are still the only live-update channel; what changes is that a room now cares about its objects' direct contents.

- [ ] **Slice 4. Client formatting.**
  - [ ] `formatRoomContentsLine` renders each room-level object as `Name` when it hosts nothing, `Name (with A)`, `Name (with A, B)`, `Name (with A, B, C)`, and `Name (with several objects)` at four or more. Contents come from the object stub's `ludicGraph.nonRootComponentRefs`, names from `componentDisplayLabel`, exactly as `formatObjectContentsLine` resolves them; an unresolvable content ref is dropped before counting.
  - [ ] The outer Oxford join stays: `Contents: Table (with Red cup, Blue cup), Chair, and Lamp`.
  - [ ] Tests in `roomHeaderContents.test.ts`, built from WML text (match the file's existing style): zero, one, two, three, four contents; a content ref with no stub; two room-level objects with contents.
  - [ ] **Payoff test at the observable output:** a `RoomDescription` render test asserting the visible `Contents:` line for a room whose table holds a cup, starting from wire WML in the shape Slice 2 emits.

- [ ] **Slice 5. Graduate and dispose.**
  - [ ] Rules to durable docs: how a handle's direct hosts are read in [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (beside "A catalog handle's `presence`"); object source and one-level contents in [`affordanceCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) / the gateway doc's Consumers table; client formatting rule in [`charcoal-client/src/components/Message/AGENT.md`](../../../../../charcoal-client/src/components/Message/AGENT.md).
  - [ ] Update the primer's cache **Status** paragraph ([`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 5): two consumers.
  - [ ] Tell `AGENT.ludicCacheRebuild.planning.md` what this adds: a second cold-rebuild consumer on every room refresh (evidence for Slice 6).
  - [ ] Graduation sweep: grep for inbound links to this file, then delete it.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **D1** | **Where does an object's direct host come from?** From the cache's existing presence data: host-side cover membership, member-side `fromHostId`, seed room as fallback. A separate membership record (new cache field or build output) would duplicate what presence already states. **Slice 0 (2026-10-10): no live placement path leaves an Object unbound** --- all go through `compilePositionKernelOp`, which always mints a binding; authored Objects never reach a live graph at all. Member-side `fromHostId` stays as a defensive second source for legacy pre-presence data. | Slice 1 | Decided |
| **D2** | **Threshold and wording.** List up to three contents, aggregate to `several objects` at four or more; comma-separated inside the parentheses, no "and". Taken from the request; the formatter keeps the threshold as one named constant. | Slice 4 | Decided |
| **D3** | **Should authored `<Object>`s reach live graphs?** Slice 0 found that cache-time population ([`populateContainmentAtCache.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts)) keeps only Room/Feature children, so authored Objects never become live nodes, while [`positions/AGENT.contract.md`'s `Component Updated` rule](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) says "for each child named". **Decided 2026-10-10: yes, they should** --- forwarded to [`positions/AGENT.authoredObjectPopulation.planning.md`](../positions/AGENT.authoredObjectPopulation.planning.md), which owns the edge kind and the re-cache-versus-player-move question. Nothing here depends on it: Slices 1--4 hold either way, and once it ships authored objects appear in the header as a fix, not a regression. | --- | Decided (forwarded) |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicCache/ dataSource/actions/   # Slice 1
cd lambda/ephemera && npm run test -- --watchAll=false internalCache/ dataSource/perception/                   # Slice 2
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/affordanceOrchestration/                    # Slice 3
cd charcoal-client && npm run test:single -- src/slices/messages/ src/components/Message/                     # Slice 4
cd lambda/ephemera && npm run test -- --watchAll=false                                                        # before calling any lambda slice done
```

Manual check (the user's): in a dev room, put a cup on a table and see `Table (with Red cup)` in the header without a `look`; add three more and see `several objects`; take one off and see the list return.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Done (2026-10-10) |
| 1. Direct hosts from presence | Not started |
| 2. Compose from handles | Not started |
| 3. One-step presence-chain refresh | Not started |
| 4. Client formatting | Not started |
| 5. Graduate and dispose | Not started |
