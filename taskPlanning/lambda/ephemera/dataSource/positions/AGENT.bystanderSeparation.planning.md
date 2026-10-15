# Bystander separation: character moves stop writing room graphs

**Status: Slices 0, 1, 1b, 2, 3 and 4 done. Next step: [Slice 5](#recommended-order).** Branch `iss8291-separate-bystander-storage`.

**Scope in one sentence: move a room's record of its **bystanders** (present characters not entangled with the room; today, every present character) out of the room's `ludicGraph` and into a small `LudicCache::Characters` row on the room that lists every present character ([BS-6](#open-decisions-implementation--plan-only)), so that a character's arrival or departure writes the character's own graph, its adjacency row and the characters row --- never `Meta::Room`, never a cache marker, never the `LudicCache::` row --- and the room header reads its structure from one consistent `getItems` over the cache rows.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). Delete it when the work lands; lasting rules move to the durable docs named in [Slice 6](#recommended-order).

---

## Why

Character movement is the most frequent change a room sees, and today every arrival or departure costs three things:

1. **A `Meta::Room` write.** The room's graph holds the character's node (`characterIds`), so the room is in the kernel's `MultiKeyUpdate`. The write is billed on the whole item, which holds every object, feature, edge, port and binding in the room. It is billed twice over because it's transactional. Its optimistic check also contends with object commits in the same room.
2. **A marker bump and a full cache rebuild.** The room is a written host, so it is marked. The header's `Ludic Cache Invalidated` subscriber then rebuilds the whole row.
3. **Cache content that no consumer reads.** The cache holds the character as a leaf node, and the room's `Remainder` cover lists it as an entry. Both stored-cache readers ([`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts), [`roomObjectContents.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/roomObjectContents.ts)) read Objects only.

**Removing bystanders from the room's graph solves all three at the source.** The rule is about bystanders, not characters: a future participant goes back into the room graph (see [out of scope](#what-is-deliberately-out-of-scope)), and its arrival rightly marks the room.

- A character-only commit writes no room-side graph, so the existing walk marks nothing: it already skips character hosts as starting points.
- The cache walk never meets a character, so the leaf form, the `Remainder` cover entries and `leafHostIds` all disappear.

An earlier draft of this plan kept characters in the graph and projected them out in both the fold and the kernel. That stopped the invalidation but not the `Meta::Room` write, so it was dropped.

**The header's reads.** Today [`affordanceRoomDeliverable.ts`](../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) reads the room graph for two things: the roster (`getRoomCharacterList`, via `characterIds`) and the room-level object ids (`objectIds`). It also reads the two cache rows. After [Slice 1](#recommended-order) the object ids come from the cache, and after [Slice 3](#recommended-order) the roster comes from the characters row. All three rows then travel in one `getItems`. The room's wire `ludicGraph`, also built from the whole room graph today, is projected from the cache read (Slice 1b), so after Slice 3 the header reads no `Meta::Room`. The per-character `CharacterMeta` and session reads that hydrate the roster are unchanged.

## Getting Started

1. **Read the rules being changed:**
   - [`positions/AGENT.contract.md` --- Ludic cache staleness and rebuild](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild): the leaf-node bullet and the inventory-marks-no-room bullet;
   - the presence-node section's "Membership follows binding count", and "Pointers govern; the cover is their stored index" (the characters row becomes the room-side index for characters, and the cover stops being it);
   - the Remainder rule: "a room keeps exactly one, hostless".
   
   For the mechanism, see [`AGENT.implementation.md` --- Stored row: read, mark, rebuild](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#stored-row-read-mark-rebuild).
2. **The code this plan changes:**
   - [`manipulation/kernel/commitStepSequence.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) (cascade, footprint, `RoomUpdate`) and [`manipulation/kernel/settleMembership.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/settleMembership.ts) (a node arrives at, or departs, a host).
   - [`ludicCache/store.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/store.ts): the row pair becomes a row triple; its `getItems` gains a key.
   - [`ludicCache/enumerateShards.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/enumerateShards.ts) and [`fold.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/fold.ts): the leaf form goes away.
   - [`internalCache/affordanceRoomDeliverable.ts`](../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) and [`internalCache/hydrateRoomRoster.ts`](../../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts): the header's reads.
   - **Every reader of a room graph's `characterIds`: about 20 files across `ephemera` and `diagnostics`**, censused in Slice 0.
   - [`ludicCache/invalidationCompleteness.integration.test.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/invalidationCompleteness.integration.test.ts): its character cases flip from marking to marking nothing.

**Test orientation.** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the authority for commands. Use `npm run test`, not `npm test`. `*.integration.test.ts` files sit outside the tsconfig, so run the full suite after any rename. `connections` and `diagnostics` each run their own suite from their own directory. Run this baseline before the first edit; it should pass:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ dataSource/affordanceOrchestration/ internalCache/ dataSource/perception/
```

## What is deliberately out of scope

- **Participants.** A participant is a character whose holdings are relationally entangled with the room: holding a rope tied to a post, or holding up a tent-pole. Today none can exist:
  - `takeHold` refuses any boundary edge the attempt doesn't dissolve;
  - `planCharacterMoveTransfer` does no chain sweep.
  
  This plan writes the rule as *a bystander is not in its room's graph*, never *a character is not*, so the participant feature adds to it rather than retracting it. A participant almost certainly returns to the room graph: a rope held by a character and tied to a post is an edge crossing between the room's graph and the character's, and it needs the character's node on the room side to land on. The commit that turns a bystander into a participant writes the room graph and marks the room, which is correct. In code, every character is a bystander today, so Slice 4's change is "no character mover writes a room graph"; the predicate it checks should still be named for bystanders, so the participant work has one place to change. The rest is the entanglement feature's design; the [Slice 6](#recommended-order) shelved section records what has been sketched so far.
- **The seed's own inventory.** A character-seeded walk still expands its seed.
- **Incremental cache maintenance.** It remains shelved. Nothing here maintains the cache by delta; the cache simply stops containing characters.
- **Roster display data.** The characters row holds membership, not names, colors or sessions. Those stay on `CharacterMeta` and `CharacterSessions`.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Answers recorded inline; one pinning test added (`fold.test.ts`, "covers every direct Object of a room across its bindings...").
  - [X] **The cache can give the room-level object ids. Confirmed by test.** `presenceCacheNodesFromFold` (`ludicCache/mergeReducer.ts`) expands the room's hostless `Remainder` through `unclaimedComponentNodes` (`ludicGraph/presenceSubGraph.ts`), so the room node's cover lists every direct member. The new fold test shows the Objects across the room node's bindings equal `graph.objectIds`; the character is covered too but is not an Object. **Two rules for Slice 1:** union the covers over *all* the room node's bindings, not just the Remainder (an explicit claim by a non-Remainder binding moves an object out of it; none exist today); and apply the same stored-`shortName` filter to both sides of any comparison, since `roomObjectContents` drops unnamed nodes. The "cache can't say direct members" claim is in no doc (searched `positions/`, `affordanceOrchestration/`, `affordanceCache/`); the text to rewrite is `AGENT.contract.md`'s "the caller states the room level: `graph.objectIds`" (~L629, L651), now on [Slice 6](#recommended-order). The dev-room check is the user's.
  - [X] **Census of `characterIds` readers. The count of 18 was wrong:** 15 of the listed files read a room graph's occupants. Not graph reads (an unrelated `characterIds` payload): `publishAffordancePerceptionForCharacters`, `ephemeraUpdate`, `fetchEphemera`, `persistentCommand/clear.ts`, `connections/staleSessionTeardown`, `connections/dataSource/charactersDataSource`, and the mtw-interfaces event type. **Missing from the list, add to Slice 3:** `affordanceOrchestration/fanOutAffordanceRefreshForRoom.ts`, `coyoteGame/utilities/collectActiveCharactersInCoyoteRooms.ts`, `internalCache/affordanceRoomDeliverable.ts`, `publishMessage/index.ts`, and `diagnostics/roomOccupancyDriftSweep/classification.ts` (`listGraphCharacterIds`). **Plain reads** (roster, fan-out, teardown), nearly all through `getRoomCharacterList` (`hydrateRoomRoster.ts`): that single seam moves them to the row. **Four that do not just move:**
    - `ludicGraph/index.ts` (the `characterIds` getter, `addCharacter` idempotence): the graph's own API, stays. Slice 3's grep must exempt it.
    - `kernel/applyStepSequenceCore.ts` (`capture` step): snapshots `graph.characterIds` *mid-sequence* for fan-out, so a row read can't replace it. After Slice 4 that snapshot is empty. **Slice 4 must decide what the capture reads** (probably the mover set from the steps themselves).
    - `perception/orchestrate.ts` `resolveHostedNodeWmlData`: reads `characterIds` for *any host*, not only rooms. Slice 3 must say what a non-room host does.
    - `repairRoomOccupancyDrift.ts` and `diagnostics roomOccupancyDriftSweep`: read the stored graph *to find drift*. After Slice 4 they see no characters at all (see the presence-rules premise).
    
    No reader needs the list in the same transaction as a graph write.
  - [X] **What a character move writes to a room graph. Confirmed: only the node** (`addCharacter` in `settleMembership.ts` on arrival; `removeCharacter` via `applyDeparture` on departure; `applyDeparture` skips boundary-edge handling for characters). No port, edge or explicit cover entry; the room's `Remainder` covers a character only because its node is in `nodeIds`. Presence steps write the mover's own graph. Nothing extra for Slice 4 to relocate. The explicit `{host, presence}` cover entry exists only in the folded cache.
  - [X] **Presence rules vs. the `Remainder`. The premise was wrong in detail:** a character absent from the room graph reads as *nothing*, not as stale. `classifyPresenceCoverDrift` iterates `wholeMembersOf(room)` (nodes in the room graph), so it never visits the character; `coverRebuildsFor` skips Remainder bindings, so nothing rewrites the room cover. The cover-drift sweep and heal need no change for characters. **The real Slice 4 work is the room-occupancy sweep and `repairRoomOccupancyDrift`,** which read the room graph's `characterIds` and go blind. Also check the reverse direction: a character's pointer naming a room that no longer lists it is caught only from the character's side.
  - [X] **The header refreshes on an arrival without `Ludic Cache Invalidated`. Confirmed.** `commitStepSequence.ts` publishes `RoomUpdate` for each *footprint* room regardless of `invalidatedRooms`; `roomUpdate/index.ts` sends `Affordances Requested` (reason `roster`); `fanOutAffordanceRefreshForRoom` reads the live roster and sends one request per occupant perspective; the compose is full. `froms` and `to` are both covered today because both are in the footprint. After Slice 4 neither is, so `RoomUpdate` must follow `membershipChangesOf` (already a Slice 4 bullet).
  - [X] **How a character rename reaches headers. One path only:** `processComponentUpdated` (`dataSource/index.ts`) calls `markHostsStale(..., { includeCharacterStarts: true })`, which publishes `Ludic Cache Invalidated`, which fans out a refresh (reason `objects`). There is no `CharacterMeta` update event, and the recompose reads `CharacterMeta` live, so a refresh is all that is needed. **Slice 5 therefore cannot simply drop `includeCharacterStarts`:** it takes its second branch (publish the refresh without the marker bump), or accepts stale names until the next `RoomUpdate`. [BS-3](#open-decisions-implementation--plan-only) now carries this.

- [X] **Slice 1. Header room-level ids from the cache.** Done; suite green (`ludicCache/`, `internalCache/`, full `ephemera`).
  - [X] `ludicCacheRoomObjectContents(roomId, assetStack, deps)` derives the room-level ids from the union of covers over *all* the room node's bindings, filtered to Objects with a stored `shortName`. It returns `{ objectIds, objects }`; `objectIds` is the stored-name-filtered set (not viewer-label-filtered) that feeds `appendImprovisationToPerspective`.
  - [X] `AffordanceRoomDeliverableData` takes `objectIds` from the reader (called right after the affordance row, before the aggregate call). The wire `ludicGraph` was still the room's stored graph until Slice 1b.
  - [X] Tests: `roomObjectContents.test.ts` (fixture room graphs now carry the hostless `Remainder`, as real ones do; new cases for the multi-binding union and for character/unnamed exclusion); `affordanceRoomDeliverable.test.ts` (ids follow the reader, not the graph). Behavior change: object order now follows cover order, not `graph.objectIds` order.
  - [X] `AGENT.contract.md` L629/L651 corrected now (L651 said the compose "must" use `graph.objectIds`); the rest of the contract rewrite stays in Slice 6.

- [X] **Slice 1b. The room's wire `ludicGraph` from the cache read (BS-7).** Done; suite green (`internalCache/`, full `ephemera`, `charcoal-client` `roomHeaderContents`). The header reads no `ludicGraph`.
  - [X] `AffordanceRoomDeliverableData` sets `roomRow.ludicGraph` to `{ rootId: roomId, nodes: [roomId, ...objects.map(({ objectId }) => objectId)] }` and only when there are objects, matching the object stubs' contents graphs. It drops `getLudicGraph` from `AffordanceRoomDeliverableObjectReads` and from the adapter in `internalCache/index.ts`.
  - [X] Tests: the deliverable reads no graph (no `getLudicGraph` dependency left to mock), and the room's wire graph lists exactly the labelled room-level objects in reader order. `roomHeaderContents.test.ts` already builds room-nested Object refs, so it covers the new shape unchanged.
  - [X] `AGENT.contract.md` L651: the wire `ludicGraph` is projected from the reader; the stored graph is read only for the roster.

- [X] **Slice 2. The characters row, written alongside the room graph.** Done; suite green (full `ephemera`, `mtw-utilities`). This is a dual write: the room graph still holds character nodes, so nothing that reads them changes yet. Code: `ludicCache/charactersRow.ts`.
  - [X] **Shape ([BS-5](#open-decisions-implementation--plan-only)):** as written below (`bindingIdsInto` reads the ids from the character's own graph: bindings whose parent host is the room).
    - `EphemeraId: <roomId>`, `DataCategory: 'LudicCache::Characters'`;
    - one top-level attribute per present character, keyed by its id and holding its binding ids into the room;
    - plus `complete: true`, set by a rebuild (**retired in Slice 4, [BS-9](#open-decisions-implementation--plan-only)**).
    
    Top-level attributes because a `SET` on a path into a missing map attribute fails, while `SET #id` creates the item.
  - [X] **Written in the kernel's `cascade`,** from `membershipChangesOf`, for every room in a character's `left` or `arrived`: `REMOVE #id` or `SET #id = :bindings`. **Two things the plan didn't foresee, both fixed:** (1) `PrimitiveUpdate` could carry no attribute names beyond reserved-word projections, and an id like `CHARACTER#Alpha` needs a `#` placeholder, so `PrimitiveUpdate` gained an optional `ExpressionAttributeNames` (`mtw-utilities` `mixins/transact.ts`, merged with the projected ones); (2) a transaction may not name one item twice, and two characters can pass through one room in one commit, so `charactersRowItemsFor` writes **one item per room** with numbered placeholders. **Premise checked, by inspection:** a character holds one binding per room (the only producers of an extra binding, split and containment population, act on object and container wholes), so `membershipChangesOf`'s net node change is enough; the row's binding ids never go stale inside a room.
    - Unconditioned: the character's own graph, which is in the `MultiKeyUpdate`, serializes moves of that character.
    - Count the items against `TRANSACT_ACTION_LIMIT` with the rest.
  - [X] **Absent or incomplete row.** The reader rebuilds the row from the room graph's `characterIds` and each character's bindings, with `complete: true`, conditioned on `attribute_not_exists(complete)`. **The write is an `UpdateItem` with `if_not_exists` per character, not a `Put`:** a `Put` would pass the condition on a kernel-created partial row and overwrite an arrival that landed between the rebuild's graph read and its write. **Residual, accepted:** a *departure* landing in that same window is undone (the rebuild writes the id back) until the occupancy drift sweep heals it from the pointer ([BS-5](#open-decisions-implementation--plan-only)). After the write the rebuild re-reads the row and returns what is stored.
    - **What to check before accepting (proved):** a kernel `SET` on an absent row creates an incomplete row, so an arrival that lands before the first rebuild leaves a partial row. `charactersRow.test.ts` proves a partial row reads as incomplete and is completed without losing the arrival, and that the real rebuild expression is `if_not_exists` under the condition.
    - Slice 4 retired the rebuild altogether ([BS-9](#open-decisions-implementation--plan-only)); this bullet and the two above describe the dual-write phase.
  - [X] **Read:** `readRoomCharacters(roomId)` is exported from `charactersRow.ts` (a strongly consistent `getItem`; an absent or incomplete row is rebuilt, never answered as empty). **Deviation:** `store.ts`'s `getItems` stays at two keys in this slice, since nothing reads the row from the cache path yet and a third key would cost every cache read an item for no reader. **Slice 3 added the third key** (opt-in) when the header became its consumer.
  - [X] Tests (`charactersRow.test.ts`, `commitStepSequence.test.ts`, `invalidationCompleteness.integration.test.ts`, `persistClearStoredLudicGraphs.test.ts`):
    - each membership change (arrive, depart, connect, disconnect, room to room) writes the expected `SET`/`REMOVE`;
    - an absent row rebuilds;
    - a partial row is completed and nothing is lost;
    - the row equals the graph's `characterIds` after every completeness-test case. This is the dual-write invariant, and it is the safety net for Slice 3. **It found a writer:** the Coyote clear removes a room's graph, character nodes included, outside the kernel. It now also deletes each cleared room's characters row (an absent row rebuilds from the graph on next read). The completeness test's fake parses the real `SET`/`REMOVE` expressions, and was checked non-vacuous by disabling the cascade write (the move and disconnect cases fail). **For Slice 3's census:** any other writer that adds or removes a character node in a room graph outside the kernel must update the row; the heals were checked and don't (they rewrite structure, not membership).

- [X] **Slice 3. Readers move to the row.** Done; suite green (full `ephemera`, `connections`, `diagnostics`; `tsc` clean).
  - [X] `getRoomCharacterList` reads `readRoomCharacters`, so every roster caller moved with it (fan-outs, `publishMessage`, perception, Coyote collection, the header). **Third key, opt-in:** `readLudicCacheWithOutcome(roomId, { withCharacters: true })` adds `LudicCache::Characters` to the same `getItems` and returns it as `characters`; the command path does not set it, so it pays no extra item (the reason Slice 2 deferred the key). The header reader `ludicCacheRoomObjectContents` sets it and returns `characterIds` when the row is complete; the deliverable hydrates those, and falls back to `getRoomCharacterList` (which rebuilds) when the row is absent or incomplete, never answering empty. `characterIdsOf` / `isCompleteCharactersRow` and the row type moved to a leaf, `charactersRowShape.ts`, so `store.ts` and `charactersRow.ts` don't import each other at runtime. The deliverable's suite asserts the header reads no room graph.
  - [X] **Each census reader, disposed:**
    - Moved through the seam: `affordanceRoomDeliverable`, `fanOutAffordanceRefreshForRoom`, `fanOutStateChangedToPassiveRenders`, `handleAffordancesPertain`, `kickRoomHeaderBroadcast`, `perception/orchestrate.ts` (`getRoomCharacterList` at L109), `perception/index.ts`, `publishMessage`, `collectActiveCharactersInCoyoteRooms`.
    - Moved directly: `repairRoomOccupancyDrift` (dep `getLudicGraph` became `getRoomCharacters`, default `readRoomCharacters`), so it does not go blind in Slice 4.
    - **Stays on the graph, by reason:** `resolveHostedNodeWmlData` (`perception/orchestrate.ts`) takes an `EphemeraObjectId`, never a room, and the row is room-keyed; Slice 4 removes bystanders from *Room* graphs only, so an object host's graph stays the source. The `roomOccupancyDriftSweep` (diagnostics) reads stored `Meta::Room` rows to find drift, so it stays an independent check on the row until Slice 4 rewrites it (already a Slice 4 bullet). No `mtw-gateways` gateway was needed: no `connections` or `diagnostics` reader moved.
  - [X] The five readers Slice 0 found missing were all seam callers or the sweep above; none needed a separate change.
  - [X] **Grep gate.** Production code that still reads a room graph's `characterIds`: `ludicGraph/index.ts` (the graph's own getter), the kernel's `capture` step (`applyStepSequenceCore.ts`), `rebuildCharactersRow` (`charactersRow.ts`, the rebuild source until Slice 4), and `resolveHostedNodeWmlData` (object hosts). The diagnostics sweep reads the stored payload through `extractCharacterIdsFromLudicGraph`. Every other `characterIds` hit is an unrelated event payload.

- [X] **Slice 4. Bystanders leave room graphs.** Done; suite green (full `ephemera`, `connections`, `diagnostics`; `tsc` clean). The check sits behind one predicate, `isBystanderMove(moverId, hostId)` (`manipulation/kernel/bystander.ts`: character mover at a Room host); the participant work amends only that.
  - [X] **Six things the slice text did not foresee, all found in the code and handled:**
    1. **`membershipChangesOf` read changes from room-graph `nodeIds`,** so once rooms hold no character node a character move would have produced *no* change (no adjacency rows, no characters-row items, no containers cache, no `Character Moved` fact). For a bystander it now reads the rooms from the mover's *own* bindings (parent hosts, before vs after). This is the load-bearing change.
    2. **`movePresenceBinding` read the destination room graph** to confirm the destination binding (`destinationBindingMissing`); that read is what kept the room in the footprint. Skipped for a bystander ([BS-8](#open-decisions-implementation--plan-only)).
    3. **`seedGraphMemos` invalidated the room's `AffordanceRoomDeliverable` / `ComponentEphemeraMeta` memos only for rooms in `committedGraphs`;** a room no longer written would keep a stale memoised roster. `commitStepSequence` now invalidates them for every room in the net membership change.
    4. **`capture` steps** snapshot a room's occupants for narration. See the capture bullet below.
    5. **Legacy-data ordering.** Stored room graphs still hold character nodes; with the leaf branch gone, a room walk would expand such a node's whole shard. So the migration (below) runs *before* the cache change deploys.
    6. **`repairRoomOccupancyDrift` did not strip graph-resident nodes,** so "run the strip through the existing drift heal" needed a heal that does.
  - [X] **`settleMembership` / footprint / `movePresenceBinding`:** a bystander arriving at or departing a Room touches no room graph; `computeStepSequenceFootprint` leaves the Room out for a bystander (`to`, `from`, `fromHostPresence`) and `capture` contributes nothing, so `Meta::Room` is neither fetched, locked nor written. The `staleTransferCandidate` check for a character departure is the mover's own binding check (`presenceBindingMoved`). `applyDeparture` is not reached.
  - [X] **`commitStepSequence`:** `RoomUpdate` is published for footprint rooms *and* every room in the net change's `left`/`arrived`; the room memos are invalidated for the same rooms. The marker walk needed no change (a character-only commit writes no room-side host, so nothing is marked). Slice 2's row writes already rode `changes`.
  - [X] **`capture` (decided Slice 0's open question):** `resolveCaptureOccupants` (`kernel/captureOccupants.ts`) reads each capture host's occupants from the row *before* the transact (`commitStepSequence` and `dryRunStepSequence`, both with an injectable `getRoomCharacters`) and passes them to `applyStepSequenceCore` as `initialOccupants`; the core moves a running set positionally with each bystander presence step and snapshots it at the capture. A capture on a host with no resolved occupants is `stale` / `hostNotInFootprint`. Accepted: the baseline is read outside the transaction, so a race costs one stale narration audience.
  - [X] **The cache:** `leafHostIds` (`enumerateShards.ts`), the fold's leaf branch and `leafPresenceCacheNodes` are deleted; a room's `Remainder` cover no longer lists characters. A character-seeded walk still expands its seed.
  - [X] **The row is the authority; the rebuild is retired ([BS-9](#open-decisions-implementation--plan-only)).** Superseded the plan's "rebuild from the adjacency index" idea (the user's call: do not lean further on the legacy index). `rebuildCharactersRow`, the `complete` flag and `isCompleteCharactersRow` are deleted; `readRoomCharacters` is a `getItem`; an absent row is an empty room (the first arrival creates it). The header reader always returns `characterIds` and the deliverable no longer falls back to a roster read. This supersedes Slice 2's `complete`/`if_not_exists` rebuild and Slice 3's incomplete-row fallback.
  - [X] **Existing data.** `migrateRoomBystanders` (`manipulation/membership/`), called first by `repairRoomOccupancyDrift`: for a room whose stored graph names characters, (1) `if_not_exists`-write the row for each character whose *own binding points at the room* (a graph node with no pointer is a ghost and is dropped, not indexed), then (2) strip the nodes in a `MultiKeyUpdate` conditioned on the graph read, bumping the room's marker and invalidating its memos. A no-op once clean.
  - [X] **Diagnostics sweep:** now row-forward. It queries `LudicCache::Characters` rows by `DataCategory` (`allFields`) and compares each character on a row against session adjacency and membership containers; a room whose stored graph still names any character is drift (that finding triggers the migration through the heal). **Deviation:** no `mtw-gateways` function was needed; the sweep already inlines its `DataCategoryIndex` queries, and the row parse is a pure helper in its own `classification.ts`.
  - [X] **Presence rules:** unchanged, per Slice 0 (a character absent from the graph is never visited by the cover-drift classifier).
  - [X] **Tests:**
    - completeness test: "moves between rooms", "disconnects" and "connects" now mark no room (`marksNothing` asserts no marker moves); new case "a character arrives in the same commit that moves an object in the room" marks the room; the invariant is now *the row equals the characters whose own bindings point at the room, and no room graph names a character*; the Coyote clear case also clears the active character. "Every structural step kind is exercised" stays green (the object cases cover `movePresenceBinding` / `releasePresenceBinding`). "A character is renamed" still marks R1 (Slice 5) but no longer changes the cache.
    - kernel: a character-only commit has only the character in its `MultiKeyUpdate` keys, no `LudicCacheVersion::` item, no `Ludic Cache Invalidated`, the characters-row items for both rooms, and a `RoomUpdate` for each; the footprint, settle, core, capture, `membershipChangesOf` and `isBystanderMove` have unit cases.
    - **A caught false positive:** the old "marks both rooms for a character move" kernel test passed vacuously, because its `bumpKeys` helper collected every `PrimitiveUpdate` key, including the characters-row items. It is replaced.
  - **Deploy order and the dev check (the user's, not a build step):** run the sweep (or call `repairRoomOccupancyDrift` per room) *before* the new cache code serves traffic, so no room walk meets a legacy character node; confirm the sweep then reports clean.

- [ ] **Slice 5. Character renames ([BS-3](#open-decisions-implementation--plan-only)).** Slice 0 found no other refresh path, so the second branch below is the recommendation.
  - [ ] If headers pick up a rename by another path, or if waiting for the next `RoomUpdate` is acceptable: remove `includeCharacterStarts` from `roomsInvalidatedByHosts`, `markHostsStale` and `processComponentUpdated`, and flip the completeness case "a character is renamed" to marking no room.
  - [ ] Otherwise, `processComponentUpdated` publishes the header refresh for the renamed character's room (read from the character's containers) without bumping the marker, and then makes the same removals.

- [ ] **Slice 6. Graduate and dispose.**
  - [ ] **[`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md):**
    - rewrite the room-header text that says the caller states the room level via `graph.objectIds` (~L629, L651), per Slice 1;
    - rewrite the staleness section's row list (two rows plus the characters row);
    - replace the leaf-node bullet with "a bystander (a present character other than the seed and not a participant) is not in its room's graph or cache; the characters row indexes it";
    - in the presence section, state that a Room's character membership is indexed by the characters row, and that a bystander is not in the room's graph (pointers still govern);
    - add to the move bundle that `RoomUpdate` follows membership changes, not only the footprint.
  - [ ] **[`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md):** update the rows for the walk, the store and the kernel cascade. Also shelve the object look path's version of the wire-graph projection (Slice 1b): `resolveHostedNodeWmlData` (`perception/orchestrate.ts`) still ships `toWireLudicGraphFull` of the object's own graph. It can't simply read the room's cache row, because a held object sits in a character shard, which the room walk doesn't enter.
  - [ ] **A shelved section in `AGENT.implementation.md`, "Shelved: participant characters"**, recording the design sketched so far:
    - **Status from the graph.** A participant is a character whose shard holds a crossing or boundary edge to a host outside its own subtree.
    - **Room-side representation.** A participant's node returns to the room graph, which carries its entanglement edges. Becoming a participant writes the room graph and marks the room; ceasing to be one removes the node.
    - **Inclusion.** Expand the participant's whole shard, rather than following edges, so the walk's "no edge is ever followed" rule holds.
    - **Found vs available.** Decide per actor at read time, from the cover path: a node held by another character has `CHARACTER#other` on its path.
    - **Prerequisites.** `takeHold` must be relaxed, and character moves need a chain sweep.
  - [ ] **[`affordanceOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md):** say that a roster change refreshes on `RoomUpdate` and never on `Ludic Cache Invalidated`, and that this is deliberate. Update the header's read list to the three cache rows.
  - [ ] **[`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 5, and `positions/AGENT.concepts.md`:** check for any statement that a room's graph holds its characters.
  - [ ] **Graduation sweep:** grep `taskPlanning/`, the code and the other lambdas for inbound links to this file and for `leafHostIds`, then delete the file.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slices. When one ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **BS-1** | **Build a `LudicCache::Characters` row?** Yes. With Slice 1 moving the room-level ids onto the cache, the row replaces the header's only remaining `Meta::Room` read. All three structural rows then travel in one `getItems`. Taking characters out of the room graph (Slice 4) also needs the row as the room-side index. | Slice 2 | Decided (2026-10-14) |
| **BS-3** | **Does a character rename still mark a room?** After Slice 4, the cache holds no character name, so `includeCharacterStarts` marks a row whose content can't have changed. It exists only so the room header refreshes the renamed character's roster entry. Slice 0 found no other path; Slice 5 acts on the answer. | Slice 5 | Open. Slice 0: the only refresh path is `Ludic Cache Invalidated`; recommendation is to publish the header refresh without the marker bump |
| **BS-4** | **Characters row, or query the existing adjacency rows?** Every character move already writes `positionAdjacency#<roomId>` on the character, in the same transaction. Querying `DataCategoryIndex` for a room's `CHARACTER#` rows would give the roster with no new write. **Rejected for the live read:** a GSI can't be read with strong consistency, and the header refresh fires straight after the commit, so it could miss the arrival that triggered it. It also costs a query per header instead of riding the cache rows' `getItems`. Not used as a rebuild source either: see BS-9. | Slice 2 | Decided (2026-10-14, recommendation; revisit if the per-move write proves costly) |
| **BS-5** | **What the row holds, and its authority.** It holds membership only: character id mapped to its binding ids into the room (Slice 2 also kept a `complete` flag; retired in Slice 4). It holds no name, color or session. **It is an index, not an authority:** the character's own binding pointer governs, as with covers ("Pointers govern; the cover is their stored index"). So drift between the two is healed from the pointer, by the occupancy drift sweep. **Built in Slice 2;** the rebuild's departure-race residual is accepted on this basis. | Slice 2 | Decided (2026-10-15, built) |
| **BS-8** | **Does a bystander move still confirm the destination room's Remainder binding at commit?** No. Confirming it needed the room graph in the footprint (a read-only `ConditionCheck`), which would keep `Meta::Room` fetched and contending with object commits. Pointers govern (BS-5): a re-minted destination binding leaves a dangling pointer that the drift sweep heals. | Slice 4 | Decided (2026-10-15, built) |
| **BS-9** | **Rebuild the characters row from the adjacency index, or make the row the authority?** The row is the authority. After the one-time migration every room's row is right and the kernel keeps it so; an absent row is an empty room. The rebuild, the `complete` flag and the adjacency-index rebuild source are all retired; drift is healed from the character's pointer by the sweep. Supersedes BS-4's "candidate rebuild source". | Slice 4 | Decided (2026-10-15, built) |
| **BS-6** | **Does the row list every present character, or only bystanders?** **Recommendation: every present character.** A future participant is then in both the row and the room graph, with the graph adding its entanglement edges, and the roster stays on one source. Listing only bystanders would make every roster reader merge the row with the graph's participants. The row is named for what it lists: `LudicCache::Characters`. Moot until participants exist, but it fixes what Slice 2's row means. | Slice 2 | Decided (2026-10-14): every present character; row named `LudicCache::Characters` |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicCache/ internalCache/ dataSource/actions/                    # Slices 1, 1b (done)
cd charcoal-client && npm run test -- roomHeaderContents                                                                                    # Slice 1b (confirm the runner in charcoal-client's AGENT.md)
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ internalCache/                                                 # Slice 2 (done)
cd packages/mtw-utilities && npx jest                                                                                                     # Slice 2 (the `PrimitiveUpdate` names; done)
cd lambda/ephemera && npm run test -- --watchAll=false                                                                                     # Slices 3-6, and before calling any slice done
cd lambda/connections && npm run test -- --watchAll=false                                                                                  # Slice 3 (census readers there)
cd lambda/diagnostics && npm run test -- --watchAll=false                                                                                  # Slices 3-4 (occupancy sweep)
grep -rn "characterIds" --include='*.ts' lambda packages | grep -v node_modules | grep -v "\.test\.ts"                                      # Slice 3 done: no room-graph roster reads remain
grep -rn "leafHostIds\|leafPresenceCacheNodes\|rebuildCharactersRow" --include='*.ts' lambda packages | grep -v node_modules            # Slice 4 done: none
```

Confirm each package's runner in its `AGENT.testing.md` / `AGENT.md` before trusting the `connections` and `diagnostics` lines.

**Payoff check (the user's, on the dev instance):** walk a character into an occupied room that has objects, and confirm:

- no `stored-rebuild` line for that room;
- no `Ludic Cache Invalidated`;
- no `Meta::Room` write (the consumed WCU on the transaction drops to the character's graph plus the small rows);
- the occupants' headers still show the arriving character;
- picking up a cup in that room does log a rebuild, and the cup leaves the header.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Done (pinning test in `fold.test.ts`; dev-room check is the user's) |
| 1. Header room-level ids from the cache | Done |
| 1b. Room wire `ludicGraph` from the cache read | Done (header reads `Meta::Room` only for the roster) |
| 2. Characters row (dual write) | Done (`charactersRow.ts`; Coyote clear also deletes the row) |
| 3. Readers move to the row | Done (roster via the row; header's `getItems` third key is opt-in; diagnostics sweep rewritten in Slice 4) |
| 4. Bystanders leave room graphs | Done (built; deploy-order migration run is the user's) |
| 5. Character renames | Not started (BS-3, recommendation recorded) |
| 6. Graduate and dispose | Not started |
