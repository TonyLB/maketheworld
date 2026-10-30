# Fold as union: derive a cache contribution from each host's graph, and collapse crossings in the union

**Status:** drafted 2026-10-30. Nothing is built. **Next step: Slice 0** (evidence and a failing test). An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). The actor's cache plan's Slice 2 waits on this plan ([`AGENT.actorCache.planning.md`](../actions/AGENT.actorCache.planning.md)).

## Goal

`buildLudicCache` composes edges in two places that use two different rules:
- **Per host**, `foldSameHostBuckets` joins legs that share a stub port.
- **Per parent/child pair**, `collapseCrossingPorts(parentGraph, childGraph)` joins the two legs of a crossing port.

The second needs both raw graphs. So two caches built separately can only be combined if no crossing joins them. That holds for the actor's cache today only because of the bystander rule. A character-to-room crossing breaks it, and that is near-term roadmap work. Such a crossing has its room-side leg in the room's graph (stored row) and its character-side leg in the character's graph (actor fold), so neither walk collapses it.

**`ludicGraph` stays the ground truth, unchanged.** Nothing here replaces, rewrites or stops storing any host's `ludicGraph`, and the engine (dry run and commit) keeps reading it. Everything below is about how the derived `ludicCache` is computed *from* those graphs.

The aim is one composition rule:
1. **Derive each host's cache contribution from its `ludicGraph`**: a small `EphemeraLudicCacheData` holding that host's node and its same-host fold (as today), plus its **open legs** (edges ending at a crossing port this host cannot resolve alone). It is read-only derived data, computed per build; it is never stored per host and never written back to the graph.
2. **A union of caches collapses crossings.** It matches two legs on their shared port address, asserts they agree, and replaces both with the one joined edge. Dedupe stays as it is.
3. **`buildLudicCache` reduces the hosts' cache contributions through that union.** The room row and the actor's cache combine through the same function.
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
- **Open legs are dropped per host.** `foldSameHostBuckets` filters out legs touching the host's own still-open ports (`touchesRemainingPort`, [`mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts)). `collapseCrossingPorts` emits nothing for a port with one leg ("incomplete data, not an error"). Both are side effects of producing only resolved edges, not a decision that reasoning should not see open legs (2026-10-30, FA-1). A parent's leg ends at a port the *child* owns, so it is not filtered by that test. Whether it reaches the cache, and as what, is unverified (Slice 0).
- **The matching rule exists twice:**
  - `collapseCrossingPorts` walks `childGraph.ports` and finds each port's two legs with `hasPortTerminal`, checks `legsAgree`, and rewrites with `outerTerminal`.
  - `mergeSameHostBucket` does the same at graph level for stub ports. Authored crossing ports are never matched there; they are carried forward for the parent.
- **The cache already admits port-address terminals.** `EphemeraLudicCacheTerminalId` includes `EphemeraLudicPortAddress` ([`types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)), so an open leg needs no new edge type. The cache has no `ports` list, and the union does not need one: both legs carry the same `{ owner, port }`.
- **Hazard: a binding is also a port address in the cache.** `liftPresenceTerminal` writes each own-binding terminal as `{ owner, port: PRESENCE#... }`. "Open leg" must therefore mean an edge on a **crossing port** (`EphemeraCrossingPortId`), never a binding address. Otherwise the union tries to match binding addresses as crossings.
- **Who reads cache edges:** in production, only `unionLudicCaches` ([`actorCache.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCache.ts)) and the type guard. Handles and the room header read nodes only. So keeping open legs changes no reader today. Phase 2 readers must read a port-address terminal as "something hosted by its `owner`".
- **Crossing ports are minted in production** by [`buildCrossingLegs.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/buildCrossingLegs.ts) (one port per hop when a relation is established across shards). Those crossings sit inside one walk today. Character-to-room crossings are planned, so this plan builds for them regardless of whether a shipped path can mint one yet.
- **Byte-identical rebuild (3e):** a retried rebuild must produce the same `edges` array (`fold.test.ts`, "run twice"). The union is commutative as a set. The array order comes from reducing in `hostIds` order, as today.
- **The one tie-break:** AC-4 in the actor's cache plan has the later half's node win on a key collision. Colliding nodes are equal by construction (each node is built from its own graph and the same stack, AC-2). So that rule only acts under read skew, and the union stays commutative otherwise.

## Relationship to other plans

- **Actor's cache** ([`AGENT.actorCache.planning.md`](../actions/AGENT.actorCache.planning.md)): its Slice 1 shipped `unionLudicCaches` without crossing collapse. That plan's Slice 2 waits on this plan, so the one catalog is built on the union this plan lands.
- **Shelved: participant characters** ([positions `AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#shelved-participant-characters)): sketches a character's node returning to the room graph. This plan instead combines the two halves at union time and leaves the room walk alone. If that shelf is picked up, re-read its "Room-side representation" bullet against this plan's result.
- **Shelved: incremental `ludicCache` maintenance** (same file): out of scope. A union adds and never removes a host's contribution.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **The cache:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 4--5. [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): the bystander bullet, [Ludic cache staleness and rebuild](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild), and *Edge persist shape*.
3. **The code this reshapes:** `fold.ts`, then in `mergeReducer.ts`: `collapseCrossingPorts`, `foldSameHostBuckets`, `mergeSameHostBucket`, `legsAgree`, `outerTerminal`, `liftPresenceTerminal` and `dedupeEdgesByIdentity`. Then `actorCache.ts` and `actorCacheFixture.ts`.
4. **How crossings are made:** `buildCrossingLegs.ts` and its [synthesize `AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/AGENT.implementation.md).
5. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient on its own, because `*.integration.test.ts` files sit outside `tsconfig`.
6. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`. Last recorded 2026-10-30: 429 suites / 4109 passed / 9 skipped.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| FA-1 | **What happens to unmatched legs.** **Decided 2026-10-30 (revised the same day): they are kept, and nothing drops them.** The stored room row keeps them, which is how the actor half finds its partner, and the actor's cache keeps whatever stays unmatched. An unmatched leg is local information for reasoning: the parent's leg (`String -[tied to]-> Table#PortA`) says the string is tied to something hosted on the Table; the child's leg (`Table#PortA -> Cup`) says the cup is tied to something outside the Table, without naming which host, since the cache keeps no port records. A matched pair is consumed: the union replaces both legs with the joined edge, so no relation appears twice. (First decided as "drop once before reasoning"; that framing came from today's behavior, which drops as a side effect.) | 1, 2 | Decided |

## Progress

| Slice | State |
| --- | --- |
| 0. Evidence: crossing fixture, today's behavior pinned, failing payoff test | Not started; can start |
| 1. Each host's cache contribution (derived from its graph) keeps open legs; the union collapses crossings; the fold reduces through it | |
| 2. Payoff: cross-half collapse and surviving unmatched legs in the actor's cache | |
| last. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Evidence; no production code.**
    - [ ] Record the baseline test count.
    - [ ] Extend `actorCacheFixture.ts` (or a sibling) with a character-to-room crossing: a room-side leg from a room object to `{ owner: actor, port }`, and the actor's leg from that port to a held object.
    - [ ] Pin today's behavior on it:
        - what the room fold emits for the room-side leg (does it reach `edges`, and in what form?);
        - that the actor fold drops the character-side leg;
        - that `unionLudicCaches` holds no collapsed edge.
    - [ ] Add a second crossing from a room object to another character's port (that character is not in the union).
    - [ ] Write the payoff tests as `it.failing`: the actor's cache, built through `buildActorLudicCache`, holds the collapsed edge for the actor's crossing and the unmatched room-side leg for the other character's. Since `ActorLudicCache` exposes no edges, assert through the union function, or add the edge accessor Phase 2 will need anyway (decide at the slice, recording why).
- [ ] **Slice 1. One composition rule.**
    - [ ] A host's cache contribution (derived from its `ludicGraph`; the graph is untouched): `foldSameHostBuckets`' output keeps legs on still-open **crossing** ports (never binding addresses; see the hazard above).
    - [ ] The union matches legs on a shared crossing-port address, asserts `legsAgree`, joins them with `outerTerminal`, and then dedupes. It reuses `collapseCrossingPorts`' rewrite; a mismatch throws, as today.
    - [ ] `buildLudicCache` reduces the hosts' cache contributions through the union in `hostIds` order. Retire `collapseCrossingPorts`' parent/child pairing.
    - [ ] Tests: the union is commutative as a set; "run twice" stays byte-identical; a matched pair leaves only the joined edge. Review each existing fold test whose expected `edges` change: every change must be an open leg now kept.
- [ ] **Slice 2. Payoff.**
    - [ ] Slice 0's payoff tests pass: flip `it.failing` to `it`.
    - [ ] Watch `storedBytes` on the stored row: open legs add bytes to a row with no size guard.
    - [ ] The full suite passes.
- [ ] **Last. Durable docs, then delete this plan.**
    - [ ] Positions contract: cache edges include unmatched crossing legs (in the stored row and the actor's cache); a matched pair appears only as its joined edge; a port-address terminal reads as "something hosted by its owner".
    - [ ] Positions `AGENT.implementation.md`: the fold derives a cache contribution from each host's `ludicGraph` and reduces them through the union.
    - [ ] Headers of `fold.ts` and `mergeReducer.ts`; primer sections 4--5 where they describe parent/child collapse.
    - [ ] Clear the dependency in the actor's cache plan, grep inbound links to this file, and delete it.

## Verification

From `lambda/ephemera/`:

- `npm run test -- --watchAll=false`: the full suite, which includes the integration tests that `tsc` misses. Compare against the baseline.
- `npx tsc --noEmit`: types.
- `fold.test.ts`'s "run twice" case: byte-identical edges.
- After Slice 1: `grep -rn "collapseCrossingPorts(" lambda/ephemera/dataSource` shows no parent/child pairing loop left in `fold.ts`.
