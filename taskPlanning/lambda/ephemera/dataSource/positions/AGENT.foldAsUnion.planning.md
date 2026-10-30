# Fold as union: derive a cache contribution from each host's graph, and collapse crossings in the union

**Status:** drafted 2026-10-30. Slices 0 (evidence), 1 (one leg-matching rule, `joinCrossingLegs`) and 2 (one composition rule, `unionCaches.ts`) done 2026-10-30. **Next step: Slice 3** (payoff; its test flip already landed in Slice 2, so what remains is the `storedBytes` check and the full-suite run). An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). The actor's cache plan's Slice 2 waits on this plan ([`AGENT.actorCache.planning.md`](../actions/AGENT.actorCache.planning.md)).

## Goal

`buildLudicCache` composes edges in two places that use two different rules:
- **Per host**, `foldSameHostBuckets` joins legs that share a stub port.
- **Per parent/child pair**, `collapseCrossingPorts(parentGraph, childGraph)` joins the two legs of a crossing port.

The second needs both raw graphs. So two caches built separately can only be combined if no crossing joins them. That holds for the actor's cache today only because of the bystander rule. A character-to-room crossing breaks it, and that is near-term roadmap work. The crossing makes the character a **participant**, whose node is in the room's graph (the room's leg needs a node to land on); a bystander's is not (FA-2). Its room-side leg is in the room's graph (stored row) and its character-side leg in the character's graph (actor fold). The room walk does not expand a participant's shard, so neither walk collapses the crossing; the union does.

**`ludicGraph` stays the ground truth, unchanged.** Nothing here replaces, rewrites or stops storing any host's `ludicGraph`, and the engine (dry run and commit) keeps reading it. Everything below is about how the derived `ludicCache` is computed *from* those graphs.

The aim is one composition rule:
1. **Derive each host's cache contribution from its `ludicGraph`**: a small `EphemeraLudicCacheData` holding that host's node and its same-host fold (as today), plus its **open legs** (edges ending at a crossing port this host cannot resolve alone). It is read-only derived data, computed per build; it is never stored per host and never written back to the graph.
2. **A union of caches collapses crossings.** It matches two legs on their shared port address, asserts they agree, and replaces both with the one joined edge. Dedupe stays as it is.
3. **`buildLudicCache` reduces the hosts' cache contributions through that union.** The room row and the actor's cache combine through the same function.
   - **One leg-matching rule underneath both joins:** dedupe exact copies, then join two *distinct* legs that name the same crossing-port address. The same-host merge (stub ports) and the union (authored ports) both use it. Slice 1 landed it as `joinCrossingLegs` on the same-host merge before the union is built.
4. **Unmatched legs are kept**, in the stored room row and in the actor's cache, and nothing drops them (FA-1). A leg whose partner is outside the union is a fact in its own right: `rope -[tied to]-> Bob#Port` says "the rope is tied to something Bob holds", and a planner reasons from it locally.

**Payoff, at the observable output:**
- Every existing cache and payoff test passes. Where a fold test's expected `edges` change, each change is an open leg that today's code dropped (reviewed one by one), never a lost or duplicated edge.
- An unmatched leg survives into the actor's cache: on a fixture where the room's leg points at another character's port, that leg is present.
- On a fixture with a character-to-room crossing, the actor's cache holds the one collapsed edge, which neither half could produce alone.

No consumer reads cache edges yet (see below), so that cache is the furthest observable point until Phase 2 of the actor's cache plan.

## What exists today (checked 2026-10-30)

- **The fold** ([`fold.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/fold.ts)):
  - **Pass 1** builds one component node per walked host.
  - **Pass 2**, for each host, computes `foldSameHostBuckets(graph)` plus `collapseCrossingPorts(graph, child)` for each walked child whose binding has its parent on that host. It then concatenates everything and runs `dedupeEdgesByIdentity`.
  - Each host's contribution is already independent; only the crossing collapse reads two graphs.
- **Open legs are dropped per host.** `foldSameHostBuckets` filters out legs touching the host's own still-open ports (`touchesRemainingPort`, [`mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts)). `collapseCrossingPorts` emits nothing for a port with one leg ("incomplete data, not an error"). Both are side effects of producing only resolved edges, not a decision that reasoning should not see open legs (2026-10-30, FA-1). A parent's leg ends at a port the *child* owns, so it is not filtered by that test: the room's own fold emits `table -> { owner: actor, port }` unchanged (Slice 0, `crossingUnion.test.ts`). Only the child side's leg is dropped today.
- **The matching rule exists twice:**
  - `collapseCrossingPorts` walks `childGraph.ports` and finds each port's two legs with `hasPortTerminal`, checks `legsAgree`, and rewrites with `outerTerminal`.
  - `mergeSameHostBucket` does the same at graph level for stub ports. Authored crossing ports are never matched there; they are carried forward for the parent.
  - **`isStubPort` compensates for matching before deduping.** An authored port's leg can be carried into two buckets (LC10's transit leg), so the same leg arrives from the accumulator and the bucket, and matching it against its own copy splices it to itself. The rule underneath is "a port joins two *distinct* legs": within one host an authored port has one leg (its partner lives in another host), so dedupe-then-match leaves it open without the guard. Stubs never reach the cache (zero-or-all consolidates every bucket, so every stub is matched within its host). The union needs dedupe-first too: a host walked by both halves (the rope's graph is folded in the room row and in the actor's fold) contributes the same leg twice.
- **The cache already admits port-address terminals.** `EphemeraLudicCacheTerminalId` includes `EphemeraLudicPortAddress` ([`types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)), so an open leg needs no new edge type. The cache has no `ports` list, and the union does not need one: both legs carry the same `{ owner, port }`.
- **A binding is also a port address in the cache; the types already separate them.** `liftPresenceTerminal` writes each own-binding terminal as `{ owner, port: PRESENCE#... }`. `EphemeraLudicPortAddress` is `EphemeraLudicCrossingPortAddress | EphemeraLudicBindingAddress`, each with its own guard, and `EphemeraCrossingPortId` is `` `PORT-${string}` | `STUB-${string}` ``. The matcher takes crossing-port addresses only, by type. The distinction is one of meaning: a crossing port is a boundary with exactly two legs, while a binding is an endpoint many distinct edges can end at, and two of those must never be joined.
- **A port-address terminal's owner must be a node of the graph.** `subGraphFromNodes` (`endpointStatus`, [`presenceSubGraph.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceSubGraph.ts)) throws on an owner that is neither the root nor a node (the third form PR-C2 excluded). So a room-side leg to a character's port needs the character's node in the room's graph: a bystander cannot hold one.
- **The walk has no character filter.** [`enumerateShards.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/enumerateShards.ts) expands every membership-host node, characters included; only the bystander rule keeps characters out today. With a participant's node in the room's graph, today's room walk expands its shard: its held inventory enters the stored row, and today's `collapseCrossingPorts(room, actor)` joins the crossing there (pinned in `crossingUnion.test.ts`). FA-2's walk rule removes this.
- **Who reads cache edges:** in production, only `unionLudicCaches` ([`actorCache.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCache.ts)) and the type guard. Handles and the room header read nodes only. So keeping open legs changes no reader today. Phase 2 readers must read a port-address terminal as "something hosted by its `owner`".
- **Crossing ports are minted in production** by [`buildCrossingLegs.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/buildCrossingLegs.ts) (one port per hop when a relation is established across shards). Those crossings sit inside one walk today. Character-to-room crossings are planned, so this plan builds for them regardless of whether a shipped path can mint one yet.
- **Byte-identical rebuild (3e):** a retried rebuild must produce the same `edges` array (`fold.test.ts`, "run twice"). The union is commutative as a set. The array order comes from reducing in `hostIds` order, as today.
- **The one tie-break:** AC-4 in the actor's cache plan has the later half's node win on a key collision. Colliding nodes are equal by construction (each node is built from its own graph and the same stack, AC-2). So that rule only acts under read skew, and the union stays commutative otherwise.

## Relationship to other plans

- **Actor's cache** ([`AGENT.actorCache.planning.md`](../actions/AGENT.actorCache.planning.md)): its Slice 1 shipped `unionLudicCaches` without crossing collapse. That plan's Slice 2 waits on this plan, so the one catalog is built on the union this plan lands.
- **Shelved: participant characters** ([positions `AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#shelved-participant-characters)): sketches a character's node returning to the room graph. FA-2 keeps that "Room-side representation" bullet and reverses its "Inclusion" bullet: the room walk does not expand a participant's shard, and this plan combines the two halves at union time. The Last step amends the shelf.
- **Shelved: incremental `ludicCache` maintenance** (same file): out of scope. A union adds and never removes a host's contribution.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **The cache:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 4--5. [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): the bystander bullet, [Ludic cache staleness and rebuild](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild), and *Edge persist shape*.
3. **The code this reshapes:** `fold.ts`, then in `mergeReducer.ts`: `collapseCrossingPorts`, `foldSameHostBuckets`, `mergeSameHostBucket`, `legsAgree`, `outerTerminal`, `liftPresenceTerminal` and `dedupeEdgesByIdentity`. Then `actorCache.ts` and `actorCacheTestFixtures.ts`.
4. **How crossings are made:** `buildCrossingLegs.ts` and its [synthesize `AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/AGENT.implementation.md).
5. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient on its own, because `*.integration.test.ts` files sit outside `tsconfig`.
6. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`. Last recorded 2026-10-30, after Slice 2: 431 suites / 4129 passed / 9 skipped.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| FA-1 | **What happens to unmatched legs.** **Decided 2026-10-30 (revised the same day): they are kept, and nothing drops them.** The stored room row keeps them, which is how the actor half finds its partner, and the actor's cache keeps whatever stays unmatched. An unmatched leg is local information for reasoning: the parent's leg (`String -[tied to]-> Table#PortA`) says the string is tied to something hosted on the Table; the child's leg (`Table#PortA -> Cup`) says the cup is tied to something outside the Table, without naming which host, since the cache keeps no port records. A matched pair is consumed: the union replaces both legs with the joined edge, so no relation appears twice. (First decided as "drop once before reasoning"; that framing came from today's behavior, which drops as a side effect.) | 2, 3 | Decided |
| FA-3 | **An open leg whose pair another half already joined.** **Decided 2026-10-30:** the union drops an open leg when it holds an edge of the same relationship that the leg is half of (same `edgeId`, `kind`, `relationLabel`, `chainId`, with the leg's non-port terminal on the same side), because a room row can join a crossing whose child the actor's fold walks alone (the half-held rope). Without an `edgeId` the match is not provable, so the leg stays (a stray, never a lost fact). Revisit if a producer mints crossing legs without `edgeId`. | 2 | Decided |
| FA-2 | **Which characters the room graph and room walk hold.** **Decided 2026-10-30:** a participant (a character entangled with the room by a crossing) has a node in the room's graph, so the room's leg has a node to land on; a bystander does not. The room walk never expands a character shard other than its seed, so a participant's inventory stays out of the shared row. The actor's own full walk joins in through the union. Reverses the participant shelf's "Inclusion: expand the participant's whole shard". | 2 | Decided |

## Progress

| Slice | State |
| --- | --- |
| 0. Evidence: crossing fixture, today's behavior pinned, failing payoff test | Done 2026-10-30 (`actorCrossingGraphs`, `crossingUnion.test.ts`); found the walk has no character filter (FA-2) |
| 1. One leg-matching rule (dedupe, then join distinct legs on a crossing-port address); `mergeSameHostBucket` uses it and `isStubPort` retires; no output change | Done 2026-10-30 (`joinCrossingLegs` in `mergeReducer.ts`; `isStubPort` retired, no fallback needed; `collapseCrossingPorts` untouched, it retires in Slice 2) |
| 2. The room walk skips non-seed characters; each host's cache contribution (derived from its graph) keeps open legs; the union joins crossings with Slice 1's rule; the fold reduces through it | Done 2026-10-30 (`unionCaches.ts`; `collapseCrossingPorts` retired; payoff test flipped to `it`, since `it.failing` fails once it passes; FA-3 added) |
| 3. Payoff: cross-half collapse and surviving unmatched legs in the actor's cache | Can start (payoff test already passes) |
| last. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0. Evidence; no production code.**
    - [X] Record the baseline test count (429 / 4109 / 9 before; see Getting Started for after).
    - [X] Extend `actorCacheTestFixtures.ts` with a character-to-room crossing: `actorCrossingGraphs()` puts the actor's node in the room's graph (a participant, FA-2), with `table -[tied to]-> { owner: actor, port: PORT-tether }` in the room and `PORT-tether -[tied to]-> bag` in the actor.
    - [X] Pin today's behavior on it (`crossingUnion.test.ts`):
        - [X] the room's own fold emits the room-side leg unchanged, as an edge to the port address;
        - [X] the actor fold drops the character-side leg;
        - [X] today's room walk expands the participant's shard, so the stored row already joins the crossing and holds the held inventory. This replaced "the union holds no collapsed edge", which is false once the actor's node is in the room's graph.
    - [X] Add a second crossing from the table to another character's port (`CHARACTER#Other`, `PORT-leash`; outside the union).
    - [X] Write the payoff test as `it.failing`; it fails today on the room row holding the bag. It asserts through `unionLudicCaches` on the real room row and actor fold, the composition `buildActorLudicCache` performs. No `edges()` accessor was added: the planning-facing boundary is Phase 2's design (AC-5), and forwarding raw cache edges now would pre-empt it.
- [X] **Slice 1. One leg-matching rule (refactor; no change to the fold's output).**
    - [X] Extract the core from `mergeSameHostBucket`/`collapseCrossingPorts` in `mergeReducer.ts`: dedupe exact copies, then for each crossing-port address named by exactly two distinct legs, assert `legsAgree` (a mismatch throws, as today) and join them with `outerTerminal`. Generic over the terminal type (`HostRelationalEdge<T = …>`) so graph edges and cache edges (presence terminals lifted) share one function, never two copies. Binding addresses are excluded by type (`EphemeraLudicCrossingPortAddress` only).
    - [X] `mergeSameHostBucket` uses it; `isStubPort` retires.
    - [X] Tests: `mergeReducer.test.ts`, `fold.test.ts` (including "run twice") and the full suite pass **unchanged**. New cases for what `isStubPort` guarded: a port-to-port transit leg carried into two buckets is not spliced to itself; an exact duplicate leg is not joined to its copy; an authored port with one leg in the host stays open.
    - [X] Fallback not needed: no case required the guard. `collapseCrossingPorts` is left as is (it retires in Slice 2) and still shares `legsAgree`/`outerTerminal`.
- [X] **Slice 2. One composition rule.**
    - [X] The room walk (`enumerateShards.ts`) skips any `Character` node other than its seed (FA-2). Rewrite the Slice 0 pin of today's walk to assert the inventory stays out; `actorUnion.test.ts`'s AC-1 tests stay green.
    - [X] A host's cache contribution (derived from its `ludicGraph`; the graph is untouched): `foldSameHostBuckets`' output keeps legs on still-open **crossing** ports (never binding addresses; see the hazard above).
    - [X] The union joins legs with Slice 1's rule on cache edges, then dedupes by identity (`dedupeEdgesByIdentity`).
    - [X] `buildLudicCache` reduces the hosts' cache contributions through the union in `hostIds` order. Retire `collapseCrossingPorts`' parent/child pairing.
    - [X] Tests: the union is commutative as a set; "run twice" stays byte-identical; a matched pair leaves only the joined edge. Review each existing fold test whose expected `edges` change: every change must be an open leg now kept.
    - [X] FA-3 (found while planning): `isHalfOf` in the union drops an open leg already joined in the other half; pinned in `unionCaches.test.ts`.
    - [X] Test changes: `collapseCrossingPorts` tests re-expressed through the union in `mergeReducer.test.ts` (two lift-only cases dropped; lifting stays tested under `foldSameHostBuckets`); `actorUnion.test.ts`'s reference fold now seeds at the actor and names the room as a member (a synthetic seed cannot name a character any more); `fold.test.ts`'s bound-twice fixture gained bindings covering its members, since the fold reads graphs through buckets. Each changed expectation was an open leg now kept, none a lost or duplicated edge.
- [ ] **Slice 3. Payoff.**
    - [X] Slice 0's payoff tests pass: flipped `it.failing` to `it` in Slice 2 (it passed as soon as the union landed).
    - [ ] Watch `storedBytes` on the stored row: open legs add bytes to a row with no size guard.
    - [ ] The full suite passes.
- [ ] **Last. Durable docs, then delete this plan.**
    - [ ] Positions contract: cache edges include unmatched crossing legs (in the stored row and the actor's cache); a matched pair appears only as its joined edge; a port-address terminal reads as "something hosted by its owner".
    - [ ] Positions `AGENT.implementation.md`: the fold derives a cache contribution from each host's `ludicGraph` and reduces them through the union.
    - [ ] Headers of `fold.ts`, `mergeReducer.ts` and `enumerateShards.ts` (the walk skips non-seed characters); primer sections 4--5 where they describe parent/child collapse.
    - [ ] Positions contract bystander bullet and the participant shelf in positions `AGENT.implementation.md`: a participant's node is in the room's graph, and the walk does not expand its shard (FA-2; the shelf's "Inclusion" bullet is reversed).
    - [ ] Clear the dependency in the actor's cache plan, grep inbound links to this file, and delete it.

## Verification

From `lambda/ephemera/`:

- `npm run test -- --watchAll=false`: the full suite, which includes the integration tests that `tsc` misses. Compare against the baseline.
- `npx tsc --noEmit`: types.
- `fold.test.ts`'s "run twice" case: byte-identical edges.
- After Slice 1: `grep -rn "isStubPort" lambda/ephemera/dataSource` is empty (verified after Slice 1).
- After Slice 2: `grep -rn "collapseCrossingPorts(" lambda/ephemera/dataSource` matches only the test helper of that name in `mergeReducer.test.ts` (verified).
