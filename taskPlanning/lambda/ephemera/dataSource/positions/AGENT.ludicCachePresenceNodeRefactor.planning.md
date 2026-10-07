# ludicCache presence nodes: nest each binding on its owner

**Status:** Open, 2026-10-07; Slice 0 shipped 2026-10-07, Slice 1 next. Found while stamping presence on referents ([`AGENT.attemptNarration.planning.md`](../../../AGENT.attemptNarration.planning.md#recommended-order), slice 3), whose sub-step "Owner on cache presence nodes" points here and resumes when [Slice 2](#recommended-order) ships. [PNR-1 and PNR-2](#open-decisions-implementation--plan-only) decided 2026-10-07. Slice 0 (a cover-entry bug found while planning Slice 1) added and shipped 2026-10-07; [PNR-3](#open-decisions-implementation--plan-only) decided the same day.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is an implementation plan.

## Getting Started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md): durability and content split, once.
2. [`positions/AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 4 (presence as a cover) and 5 (the cache): the present-tense primer.
3. [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path), "Presence nodes": the rules this plan must keep. In particular: `cover.members` states provenance and never holds the root; the guard's two integrity checks have opposite verdicts on purpose; exterior addressing carries a `PRESENCE#` tag.
4. The code, all in [`positions/ludicCache/`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/): `types.ts` (`EphemeraLudicCacheNode`, `EphemeraLudicCacheSupportHop`, `isEphemeraLudicCacheData`), `mergeReducer.ts` (`presenceCacheNodesFromFold`, `collapsedEdgeIdentityKey`, `collapseCrossingPorts`), `fold.ts` (`buildLudicCache`), `catalogHandles.ts` (the one reader).
5. The live sibling plan, [`AGENT.ludicCacheRebuild.planning.md`](AGENT.ludicCacheRebuild.planning.md): its D11 (endpoint justification on the node record, `supportedBy` for traversal only) and Slice 6 (persist, not started).

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- `npm run test`, not `npm test`, from `lambda/ephemera`. If commands conflict, that file wins. Baseline before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicCache/
```

## Why

In a `ludicGraph`, a host's bindings sit in `graph.presenceNodes`, and the graph belongs to that host: the container names the owner. The cache flattens every walked host's bindings into one `nodes` list beside the component nodes ([`fold.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/fold.ts), `nodes.push(...presenceNodes)`), and `EphemeraLudicCacheData.hostId` is the seed, not any binding's owner. `presenceCacheNodesFromFold` knows the owner (`graph.hostId`) and keeps it nowhere; `cover.members` leaves out the root by contract (provenance, not coverage). So nothing in the cache says whose binding a presence node is, and a binding with no members leaves no trace of its owner at all.

The first reader to need it: Grounding stamps a referent with every bucket the thing is seen in. A host is in each of its own buckets, so a whole bound into several rooms (a breadboard, "kick the table") should be stamped with all of its own bindings; today it gets only the room it was walked from. Every later reader that needs a host's own bindings would otherwise work around the same gap.

## Target shape

- **Each binding nests on its owner's cache node**, mirroring the graph: the presence arm leaves `EphemeraLudicCacheNode`'s top-level union and becomes a list on the component arm. The owner is structural, so a binding without one is unrepresentable. `cover` keeps excluding the root ([PR-18](AGENT.presence.planning.md#open-decisions-design--plan-only) is not disturbed: "which buckets show this host" is a coverage question, answered by its own bindings, not a membership one).
- **The cache's top-level `nodes` are components only.** Readers stop skipping presence nodes.
- **A cover entry `{ host, presence }` resolves by path**: the host's node, then that binding on it.
- **Every reference to a binding names its owner** ([PNR-2](#open-decisions-implementation--plan-only)): a cache edge ending at a binding uses the exterior form `{ owner, port: 'PRESENCE#...' }`, and a `supportedBy` hop names its host.
- `EphemeraLudicCacheNode` is lambda-local (`ludicCache/types.ts`, kept out of `mtw-interfaces` by CC0b), and the cache is rebuilt per read, not persisted (rebuild plan Slice 6 not started), so there is no stored data to migrate. `EphemeraLudicGraphStructureNode` in `mtw-interfaces` does not change.

## Recommended order

Pending work uses `[ ]`, completed work `[X]`; mark nested lines `[X]` as each finishes.

- [X] **Slice 0. Cover entries name the member's own binding (bug fix).** The contract says a cache cover entry `{ host, presence }` names *which of `host`'s own bindings* is meant ([`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path), "cover"). `presenceCacheNodesFromFold` writes the covering binding's own key there instead: it reads the cover through `nodesFromPresenceBinding`, which returns host ids only. So a box X's binding into a room, covering a plank Z, records `{ Z, X's binding into the room }`, not `{ Z, Z's binding into X }`. Nothing reads the field at runtime and the guard has no runtime caller, which is why it went unnoticed. Slice 1's path check (the host's node, then that binding on it) would reject every real cache until this is fixed.
  - [X] Graph-side `Enumerated` cover: the cache entries copy the graph's own entries (root and the binding's own id filtered out, as now). The parent side is authoritative ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)'s `fromHostId` comment), so no cross-check against the member's graph.
  - [X] Graph-side `Full` cover (what every move writes, via `applyStepSequenceCore.ts`): one entry per member binding whose `fromHostId` is the owner, read from the member's own graph. A member bound into the owner more than once gets one entry per binding: all of the owner is present, so every way the member sits in it comes along. `foldSameHostBuckets` gains a lookup argument for this; `buildLudicCache` builds it from the `graphs` map it already holds.
  - [X] A member with no binding into the owner (its graph not walked, or it was placed without a move) keeps its entry with `presence` absent (PNR-3): the cache cover's entry type becomes cache-local with `presence?`, and `isEphemeraLudicCacheNode` checks entries itself rather than through the graph-side cover guard, which requires `presence`.
  - [X] Tests: `fold.test.ts`'s fixture covers name real bindings (`x_to_room` covers `{ objZ, z_at_x }`), and the expected cache entries change accordingly; a `Full`-cover case; `mergeReducer.test.ts`'s "cover matching the graph-side binding" case asserts the graph-side values it names (its dummy-`presence` fixture comment goes).
- [ ] **Slice 1. Nest bindings on their owner.**
  - [ ] `types.ts`: move the presence arm onto the component arm as a required `presenceNodes` list (PNR-1); update the "superset" doc comment.
  - [ ] `presenceCacheNodesFromFold` / `foldSameHostBuckets` return bindings keyed by owner; `buildLudicCache` attaches them to the owner's component node. Assert every owner has a component node (Pass 1 builds one per walked host; test it with a non-room seed).
  - [ ] `isEphemeraLudicCacheData`: the cover-entry check resolves by path (absent host node or absent binding on it FAILS; needs Slice 0, and an entry without a binding per PNR-3 checks the host step only); the edge-to-absent-binding check still PASSES (contract clause unchanged in meaning).
  - [ ] `catalogHandles.ts` `bucketsByMember` reads the nested lists; the object loop's presence skip goes.
  - [ ] Tests: fold, merge, guard and handle tests move to the nested shape; a binding with an empty cover still names its owner.
- [ ] **Slice 2. A host's own bindings on its handle (the payoff).**
  - [ ] `ludicCacheObjectHandles`: a host's `presence` is every bucket that holds it plus every one of its own bindings, deduped, cache order; the seed-room fallback stays for a thing no bucket holds.
  - [ ] Remove the known-gap paragraphs: `catalogHandles.ts` header, and the Grounding bullet in `AGENT.attemptNarration.planning.md`.
  - [ ] Tests: a whole bound into two rooms gets both bindings on its handle; end to end, a span naming that whole is stamped with both (`groundedPresence` on the `objectSpan`).
  - [ ] Tick the attemptNarration sub-step.
- [ ] **Slice 3. Owner on references to a binding** (PNR-2).
  - [ ] Edges ending at a binding: lift bare `PRESENCE#` terminals to the exterior form at fold (`foldSameHostBuckets`: owner `graph.hostId`; `collapseCrossingPorts`: a child-side outer terminal gets `childGraph.hostId`). `collapsedEdgeIdentityKey`'s presence branch goes (every terminal keys as `owner#port`); the guard rejects a bare `PRESENCE#` terminal on a cache edge.
  - [ ] `EphemeraLudicCacheSupportHop` gains `host`, minted in `collapseCrossingPorts` as `childGraph.hostId`; rewrite the type comment (host *beside* binding, not instead of it).
  - [ ] Tests: dedup of the two address forms still holds under the new normal form; a hop names its host.
- [ ] **Slice 4. Durable docs; retire this plan.** `positions/AGENT.contract.md` "Presence nodes" (cache shape, guard checks, exterior addressing; a cache cover entry names the member's own binding, and its `presence` is absent when the fold could not find that binding, PNR-3), `AGENT.ludicNetwork.md` section 5's "Presence in the cache" paragraph, `positions/AGENT.implementation.md`'s `ludicCache/` notes. Grep `](` for links into this file, then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PNR-1 | **Field name and optionality for the nested list.** | Slice 1 | Decided 2026-10-07: `presenceNodes`, required (`[]` when the host has none). Every component node in the cache is a walked host whose graph was read, so `[]` is a true "none", not "unread"; optional-by-kind (rooms) would encode a kind rule in the shape. If attention-scoped depth later adds unwalked nodes, "unread" is a cache-wide question for then. |
| PNR-3 | **A `Full`-cover member with no binding into the owner: what does its cache entry say?** Slice 0 reads each member's binding from the member's own graph. Two ways there is none: the walk never reads a character's shard unless it is the seed (`enumerateShards.ts`, rebuild Slice 4), so a character inside an object has no graph to look in; and a thing placed without a move (authored placement) may never have had a binding minted. Options: (a) keep the entry with `presence` absent, via a cache-local entry type with `presence?` (the thing is still covered; only which binding is unknown); (b) drop the entry, which drops the thing from that bucket and `catalogHandles.ts` falls back to the seed room, losing a true coverage fact; (c) throw, which fails the whole catalog read on such data. | Slice 0 | Decided 2026-10-07: (a). The thing is still covered, so the entry stays; only which binding is unknown, and an optional field says exactly that. The graph-side `EphemeraPresenceCoverEntry` in `mtw-interfaces` does not change. |
| PNR-2 | **Does every reference to a binding name its owner?** Nesting makes lookup a path (owner, then binding), but two references carry only the bare `PRESENCE#` id. | Slice 3 | Decided 2026-10-07: yes on both. **(a) Edges:** an edge ending at a binding uses the exterior form `{ owner, port: 'PRESENCE#...' }` in the cache (normalize UP, reversing PN-24's DOWN). PN-24's reason ("the id is globally unique, so `owner` carries no information") fails once the owner is the lookup path. Interior edges in a host's own `ludicGraph` stay bare (the graph names the owner), and `ephemeraLudicTerminalsEqual` in `mtw-interfaces` is untouched; the lift happens at fold. **(b) `supportedBy`:** a hop becomes `{ host, port, presenceBucketIds }`. Checked 2026-10-07: in `collapseCrossingPorts` the hop's `port` comes from `childGraph.ports` and its binding from `childGraph.presenceNodes` (`fold.ts` passes the raw child graph, no stubs), so one host per hop holds and it is `childGraph.hostId`. `{ host, port }` is exactly the crossing port's exterior address, so this also closes the ambiguity of a port id unique only within its host. D11 untouched: this changes how a hop addresses a binding, not what the register holds. |

## Verification

From `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/positions/ludicCache/ dataSource/actions/
npm run test -- --watchAll=false   # full suite: integration tests sit outside tsc
npx tsc --noEmit
```

Smoke test after any fold change (rebuild plan Slice 4's lesson): pick up an object, then drop it.

## Progress

| Slice | State |
| --- | --- |
| 0 --- cover entries name member's binding | Done |
| 1 --- nest bindings | Not started |
| 2 --- host's own bindings (payoff) | Not started |
| 3 --- owner on references | Not started |
| 4 --- docs, retire | Not started |

## Lifecycle

Delete this file at Slice 4, after the graduation sweep. Land Slices 0--3 before the rebuild plan's Slice 6 (persist): until then the cache shape is free to change.
