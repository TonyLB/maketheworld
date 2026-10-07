# ludicCache presence nodes: nest each binding on its owner

**Status:** Open, 2026-10-07; no slice started. Found while stamping presence on referents ([`AGENT.attemptNarration.planning.md`](../../../AGENT.attemptNarration.planning.md#recommended-order), slice 3), whose sub-step "Owner on cache presence nodes" points here and resumes when [Slice 2](#recommended-order) ships. [PNR-2](#open-decisions-implementation--plan-only) (owner on every reference to a binding) is open.

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
- **References to a binding from edges and `supportedBy`**: per [PNR-2](#open-decisions-implementation--plan-only).
- `EphemeraLudicCacheNode` is lambda-local (`ludicCache/types.ts`, kept out of `mtw-interfaces` by CC0b), and the cache is rebuilt per read, not persisted (rebuild plan Slice 6 not started), so there is no stored data to migrate. `EphemeraLudicGraphStructureNode` in `mtw-interfaces` does not change.

## Recommended order

Pending work uses `[ ]`, completed work `[X]`; mark nested lines `[X]` as each finishes.

- [ ] **Slice 1. Nest bindings on their owner.**
  - [ ] `types.ts`: move the presence arm onto the component arm as a list (name and optionality per PNR-1); update the "superset" doc comment.
  - [ ] `presenceCacheNodesFromFold` / `foldSameHostBuckets` return bindings keyed by owner; `buildLudicCache` attaches them to the owner's component node. Assert every owner has a component node (Pass 1 builds one per walked host; test it with a non-room seed).
  - [ ] `isEphemeraLudicCacheData`: the cover-entry check resolves by path (absent host node or absent binding on it FAILS); the edge-to-absent-binding check still PASSES (contract clause unchanged in meaning).
  - [ ] `catalogHandles.ts` `bucketsByMember` reads the nested lists; the object loop's presence skip goes.
  - [ ] Tests: fold, merge, guard and handle tests move to the nested shape; a binding with an empty cover still names its owner.
- [ ] **Slice 2. A host's own bindings on its handle (the payoff).**
  - [ ] `ludicCacheObjectHandles`: a host's `presence` is every bucket that holds it plus every one of its own bindings, deduped, cache order; the seed-room fallback stays for a thing no bucket holds.
  - [ ] Remove the known-gap paragraphs: `catalogHandles.ts` header, and the Grounding bullet in `AGENT.attemptNarration.planning.md`.
  - [ ] Tests: a whole bound into two rooms gets both bindings on its handle; end to end, a span naming that whole is stamped with both (`groundedPresence` on the `objectSpan`).
  - [ ] Tick the attemptNarration sub-step.
- [ ] **Slice 3. Owner on references to a binding** (shape per PNR-2; skip if PNR-2 decides no).
  - [ ] Edges ending at a binding, and `collapsedEdgeIdentityKey`'s normalization.
  - [ ] `EphemeraLudicCacheSupportHop`, minted in `collapseCrossingPorts`.
  - [ ] Tests: dedup of the two address forms still holds under the new normal form; a hop names its host.
- [ ] **Slice 4. Durable docs; retire this plan.** `positions/AGENT.contract.md` "Presence nodes" (cache shape, guard checks, exterior addressing), `AGENT.ludicNetwork.md` section 5's "Presence in the cache" paragraph, `positions/AGENT.implementation.md`'s `ludicCache/` notes. Grep `](` for links into this file, then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PNR-1 | **Field name and optionality for the nested list.** Mirroring the graph suggests `presenceNodes`; required `[]` vs optional (absent for hosts that cannot carry a binding, e.g. rooms). | Slice 1 | Open --- free choice; pick at implementation, one line in the Progress row. |
| PNR-2 | **Does every reference to a binding name its owner?** Nesting makes lookup a path (owner, then binding), but two references carry only the bare `PRESENCE#` id. **(a) Edges.** `collapsedEdgeIdentityKey` normalizes a binding terminal DOWN to the bare id, dropping the exterior form's `owner` (presenceNodes Slice 5 item 3, PN-24), because "the id is globally unique, so `owner` carries no information the id does not". That reason fails once bindings nest: the owner is the lookup path. **Leaning (the user, 2026-10-07): an edge ending at a binding must use the exterior form `{ owner, port: 'PRESENCE#...' }` in the cache**, so normalize UP. Interior edges in a host's own `ludicGraph` may stay bare (the graph names the owner); the lift happens at fold. **(b) `supportedBy`.** A hop is `{ presenceBucketIds, port }`. **Leaning: hops name their host too.** One host per hop fits: the hop's port and every binding it lists belong to the child shard `collapseCrossingPorts` collapsed. It may also close a separate ambiguity: a crossing port id is unique only within its host (the contract's `{ROOM#A, STUB-xyz}` vs `{ROOM#B, STUB-xyz}`), and a hop's `port` names none. Check that before relying on it. The type comment's "identified by their own `PRESENCE#` id rather than by the host they bind" argued against host *instead of* binding; host *beside* binding does not reopen it. D11 (endpoint justification on the node, traversal on `supportedBy`) is untouched: this changes how a hop addresses a binding, not what the register holds. | Slice 3 | Open --- leaning yes on both. |

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
| 1 --- nest bindings | Not started |
| 2 --- host's own bindings (payoff) | Not started |
| 3 --- owner on references | Not started (PNR-2 open) |
| 4 --- docs, retire | Not started |

## Lifecycle

Delete this file at Slice 4, after the graduation sweep. Land Slices 1--3 before the rebuild plan's Slice 6 (persist): until then the cache shape is free to change.
