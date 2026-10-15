# Bystander separation: character moves stop writing room graphs

**Status: Slices 0 and 1 done. [BS-7](#open-decisions-implementation--plan-only) decided: the room's wire `ludicGraph` is projected from the cache read. Next step: [Slice 1b](#recommended-order) (then Slice 2).** Branch `iss8291-separate-bystander-storage`.

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

**The header's reads.** Today [`affordanceRoomDeliverable.ts`](../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) reads the room graph for two things: the roster (`getRoomCharacterList`, via `characterIds`) and the room-level object ids (`objectIds`). It also reads the two cache rows. After [Slice 1](#recommended-order) the object ids come from the cache, and after [Slice 3](#recommended-order) the roster comes from the characters row. All three rows then travel in one `getItems`. The room's wire `ludicGraph`, also built from the whole room graph today, is projected from the cache read in [Slice 1b](#recommended-order) ([BS-7](#open-decisions-implementation--plan-only)), so after Slice 3 the header reads no `Meta::Room`. The per-character `CharacterMeta` and session reads that hydrate the roster are unchanged.

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
  - [X] `AffordanceRoomDeliverableData` takes `objectIds` from the reader (called right after the affordance row, before the aggregate call). **It still calls `getLudicGraph(roomId)`,** for the roster-adjacent wire projection `roomRow.ludicGraph = toWireLudicGraphFull(graph)` (the room's whole stored graph), so the header still reads `Meta::Room` until Slice 1b ([BS-7](#open-decisions-implementation--plan-only)).
  - [X] Tests: `roomObjectContents.test.ts` (fixture room graphs now carry the hostless `Remainder`, as real ones do; new cases for the multi-binding union and for character/unnamed exclusion); `affordanceRoomDeliverable.test.ts` (ids follow the reader, not the graph). Behavior change: object order now follows cover order, not `graph.objectIds` order.
  - [X] `AGENT.contract.md` L629/L651 corrected now (L651 said the compose "must" use `graph.objectIds`); the rest of the contract rewrite stays in Slice 6.

- [ ] **Slice 1b. The room's wire `ludicGraph` from the cache read ([BS-7](#open-decisions-implementation--plan-only)).** After this slice the header reads no `ludicGraph`.
  - [ ] `AffordanceRoomDeliverableData` sets `roomRow.ludicGraph` to `{ rootId: roomId, nodes: [roomId, ...objects.map(({ objectId }) => objectId)] }` and only when there are objects, matching the object stubs' contents graphs. It drops `getLudicGraph` from `AffordanceRoomDeliverableObjectReads` and from the adapter in `internalCache/index.ts`.
  - [ ] Tests: the deliverable reads no graph (no `getLudicGraph` dependency left to mock), and the room's wire graph lists exactly the labelled room-level objects in reader order. Confirm a `charcoal-client` test round-trips `formatRoomContentsLine` over the new shape.
  - [ ] `AGENT.contract.md` room-header bullet (~L651): the stored graph is no longer read for the wire `ludicGraph`.

- [ ] **Slice 2. The characters row, written alongside the room graph.** This is a dual write: the room graph still holds character nodes, so nothing that reads them changes yet.
  - [ ] **Shape ([BS-5](#open-decisions-implementation--plan-only)):**
    - `EphemeraId: <roomId>`, `DataCategory: 'LudicCache::Characters'`;
    - one top-level attribute per present character, keyed by its id and holding its binding ids into the room;
    - plus `complete: true`, set by a rebuild.
    
    Top-level attributes because a `SET` on a path into a missing map attribute fails, while `SET #id` creates the item.
  - [ ] **Written in the kernel's `cascade`,** from `membershipChangesOf`, for every room in a character's `left` or `arrived`: `REMOVE #id` or `SET #id = :bindings`.
    - Unconditioned: the character's own graph, which is in the `MultiKeyUpdate`, serializes moves of that character.
    - Count the items against `TRANSACT_ACTION_LIMIT` with the rest.
  - [ ] **Absent or incomplete row.** The reader rebuilds the row from the room graph's `characterIds` and each character's bindings. It writes the row with `complete: true`, conditioned on `attribute_not_exists(complete)`, so the rebuild never overwrites a row the kernel already completed.
    - **What to check before accepting:** a kernel `SET` on an absent row creates an incomplete row, so an arrival that lands before the first rebuild leaves a partial row. The rebuild then reads the graph, which already holds the arrival. That ordering is the thing to prove in tests.
    - Once Slice 4 removes characters from the graph, the rebuild source changes. See Slice 4.
  - [ ] **Read:** `store.ts`'s `getItems` fetches the three rows together. A `readRoomCharacters(roomId)` is exported for readers that don't need the cache.
  - [ ] Tests:
    - each membership change (arrive, depart, connect, disconnect, room to room) writes the expected `SET`/`REMOVE`;
    - an absent row rebuilds;
    - a partial row is completed and nothing is lost;
    - the row equals the graph's `characterIds` after every completeness-test case. This is the dual-write invariant, and it is the safety net for Slice 3.

- [ ] **Slice 3. Readers move to the row.** Work through Slice 0's census, one file at a time, header roster first.
  - [ ] `getRoomCharacterList` reads `readRoomCharacters`, so the roster no longer reads `Meta::Room`. With Slice 1b done, the header as a whole then reads no `Meta::Room`; assert that in the deliverable's suite.
  - [ ] Each remaining reader in the census either moves to the row, or is recorded inline here with the reason it needs the graph. A reader in `connections` or `diagnostics` reads the row through a gateway in `mtw-gateways`, not by importing from ephemera.
  - [ ] Add the five readers Slice 0 found missing from the census, and settle `resolveHostedNodeWmlData` (reads `characterIds` of any host, not only rooms).
  - [ ] When this slice is done, no production code outside `ludicGraph/index.ts` (the graph's own getter) and the kernel reads a room graph's `characterIds`. Verify that with a grep.

- [ ] **Slice 4. Bystanders leave room graphs.** This is the slice that delivers the savings. Every character is a bystander today; keep the check behind one bystander predicate (see [out of scope](#what-is-deliberately-out-of-scope)).
  - [ ] **`settleMembership`:** a bystander arriving at, or departing from, a Room doesn't touch the room's graph. The room drops out of the kernel footprint for a bystander-only move, so `Meta::Room` is neither fetched nor written.
    - The `staleTransferCandidate` check for a character departure (the node must be in the room) becomes the character's own binding check, which `movePresenceBinding` already makes.
    - `applyDeparture`'s boundary-edge check has nothing to find for a bystander.
  - [ ] **`commitStepSequence`:** `RoomUpdate` is published for each room in `membershipChangesOf`'s `left` and `arrived`, as well as for each room in the footprint.
    - Slice 2's row writes no longer depend on the room being in the footprint.
    - The marker walk needs no change: a character-only commit writes no room-side host, so nothing is marked.
  - [ ] **The cache:** `enumerateLudicCacheShards` never meets a non-seed character, so `leafHostIds`, the fold's leaf branch and `leafPresenceCacheNodes` (if it has no other caller) are deleted. The room's `Remainder` cover no longer lists characters.
  - [ ] **Presence rules:** per Slice 0, the cover-drift classifier and heal need no change (a character absent from the graph is never visited, so nothing reads as stale). The room-occupancy drift sweep and `repairRoomOccupancyDrift` go blind: teach them to compare the row against session adjacency and membership containers.
  - [ ] **The kernel's `capture` step** (`applyStepSequenceCore.ts`) snapshots the room graph's `characterIds` mid-sequence. Decide what it reads once characters have left the graph (Slice 0).
  - [ ] **Row rebuild source:** after this slice, an absent row can't be rebuilt from the room graph. Rebuild it from the adjacency rows instead (`positionAdjacency#<roomId>` on `DataCategoryIndex`, filtered to `CHARACTER#`), read in that order with each character's own graph to confirm. Alternatively, let the occupancy drift sweep own the heal. Decide when this slice is built; [BS-4](#open-decisions-implementation--plan-only) records why the index isn't the live read.
  - [ ] **Existing data.** Stored room graphs still hold character nodes. Since the project is pre-rollout, run a one-time strip through the existing drift heal (the sweep reports a character node in a room graph as drift) rather than adding a read-time bridge.
  - [ ] **Completeness test:**
    - flip "a character moves between rooms", "a character disconnects" and "a character connects" to: no room marked, next read is a hit, the characters row changed;
    - add "a character arrives in the same commit that moves an object in the room": the room is marked;
    - keep "every structural step kind is exercised" green. `movePresenceBinding` and `releasePresenceBinding` also have object cases; confirm that rather than assume it.
  - [ ] **Kernel unit tests:** a character-only commit has no `Meta::Room` key, no `LudicCacheVersion::` item and no `Ludic Cache Invalidated`. It does have the characters-row items and a `RoomUpdate` for each of `froms` and `to`.

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
  - [ ] **[`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md):** update the rows for the walk, the store and the kernel cascade. Also shelve the object look path's version of BS-7: `resolveHostedNodeWmlData` (`perception/orchestrate.ts`) still ships `toWireLudicGraphFull` of the object's own graph. It can't simply read the room's cache row, because a held object sits in a character shard, which the room walk doesn't enter.
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
| **BS-4** | **Characters row, or query the existing adjacency rows?** Every character move already writes `positionAdjacency#<roomId>` on the character, in the same transaction. Querying `DataCategoryIndex` for a room's `CHARACTER#` rows would give the roster with no new write. **Rejected for the live read:** a GSI can't be read with strong consistency, and the header refresh fires straight after the commit, so it could miss the arrival that triggered it. It also costs a query per header instead of riding the cache rows' `getItems`. It is still a candidate rebuild source once the graph no longer holds characters (Slice 4). | Slice 2 | Decided (2026-10-14, recommendation; revisit if the per-move write proves costly) |
| **BS-5** | **What the row holds, and its authority.** It holds membership only: character id mapped to its binding ids into the room, plus `complete`. It holds no name, color or session. **It is an index, not an authority:** the character's own binding pointer governs, as with covers ("Pointers govern; the cover is their stored index"). So drift between the two is healed from the pointer, by the occupancy drift sweep. | Slice 2 | Proposed |
| **BS-6** | **Does the row list every present character, or only bystanders?** **Recommendation: every present character.** A future participant is then in both the row and the room graph, with the graph adding its entanglement edges, and the roster stays on one source. Listing only bystanders would make every roster reader merge the row with the graph's participants. The row is named for what it lists: `LudicCache::Characters`. Moot until participants exist, but it fixes what Slice 2's row means. | Slice 2 | Decided (2026-10-14): every present character; row named `LudicCache::Characters` |
| **BS-7** | **Where does the room's wire `ludicGraph` come from?** `roomRow.ludicGraph = toWireLudicGraphFull(graph)` ships the room's whole stored graph (nodes incl. characters, edges, ports) and is the header's last `Meta::Room` read. **Decided: project it from the cache read.** The client reads only the Object refs, in order (`formatRoomContentsLine` in `roomHeaderContents.ts`, `nodesByTag('Object')`; the roster comes from `characters`). The render channel's room form carries no `ludicGraph`, so nothing merges one back in. `ludicCacheRoomObjectContents` is already the cache-to-wire projection, so the deliverable builds `{ rootId: roomId, nodes: [roomId, ...objectIds] }` from its `objects` (the same shape each object's contents already ship in) and drops `getLudicGraph`. The cache row itself is not sent: its names are reasoning names, and its bindings, edges and character leaves are internal. Slice 4's character removal then never reaches the wire. | Slice 3's "no `Meta::Room` read" | Decided (2026-10-15): project from the cache read; [Slice 1b](#recommended-order) |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicCache/ internalCache/ dataSource/actions/                    # Slices 1, 1b
cd charcoal-client && npm run test -- roomHeaderContents                                                                                    # Slice 1b (confirm the runner in charcoal-client's AGENT.md)
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ internalCache/                                                 # Slice 2
cd lambda/ephemera && npm run test -- --watchAll=false                                                                                     # Slices 3-6, and before calling any slice done
cd lambda/connections && npm run test -- --watchAll=false                                                                                  # Slice 3 (census readers there)
cd lambda/diagnostics && npm run test -- --watchAll=false                                                                                  # Slices 3-4 (occupancy sweep)
grep -rn "characterIds" --include='*.ts' lambda packages | grep -v node_modules | grep -v "\.test\.ts"                                      # Slice 3 done: no room-graph roster reads remain
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
| 1. Header room-level ids from the cache | Done (header still reads the room graph for the wire `ludicGraph`: BS-7) |
| 1b. Room wire `ludicGraph` from the cache read | Not started (BS-7 decided) |
| 2. Characters row (dual write) | Not started (unblocked) |
| 3. Readers move to the row | Not started |
| 4. Bystanders leave room graphs | Not started |
| 5. Character renames | Not started (BS-3, recommendation recorded) |
| 6. Graduate and dispose | Not started |
