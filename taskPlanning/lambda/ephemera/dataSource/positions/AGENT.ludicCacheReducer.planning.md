# ludicCache merge reducer: presence sub-graphs, first draft

**Status:** Not started, opened 2026-09-10 from conversation. Two slices: presence sub-graph utilities, then a pairwise merge reducer that combines a parent graph with a child sub-graph into an `EphemeraLudicCacheData`. **Next step: Slice 0, classify the tier out loud, before any code exists.**

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). **It is an implementation plan, not a design-stage one** --- the deliverable is mergeable code and tests, the worklist outnumbers the open forks, and the evidence it needs is produced by building rather than by writing corpus cases. Do not apply [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md)'s overrides to it. The one clause it *does* borrow is the [tier](../../../../AGENT.designVariant.md#graduation-tiers-when-a-decision-licenses-code) classification below, because the code is a Prototype and the obligations that come with that are due before the first file.

## Getting Started

**Read in this order.** The first two are this file's own and are not optional --- the substrate section is what the code is built on, and the finding section is why the obvious implementation of Slice 1a would be untestable.

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md), once, for the durability split: what belongs here versus in a durable `AGENT*.md` beside the code.
2. **[What already exists to build on](#what-already-exists-to-build-on)** below --- five items, all shipped. Item 5 is a hazard rather than a foundation; read it before Slice 2 is designed, not after.
3. **[The finding that shapes Slice 1](#the-finding-that-shapes-slice-1-nothing-authors-bucket-membership)** below. **If you read nothing else here, read this** --- no shipped writer authors bucket membership, so Slice 1a's input format is invented by its fixtures.
4. [`AGENT.presence.planning.md`](AGENT.presence.planning.md)'s [Presence as a cover](AGENT.presence.planning.md#presence-as-a-cover) section and [PR-8](AGENT.presence.planning.md#open-decisions-design--plan-only). **The cover section is the vocabulary** --- *bucket*, *binding*, *cover* --- and every open row is phrased in it. **Do not read further into that plan than those two before starting**; it is a large design document and this work is deliberately not gated on it (see below).
5. [`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts), as the output contract Slice 2 fills, and [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) for the relational-edge naming table.

**Testing orientation, before any code.**

**Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands anywhere --- including this file --- conflict with it, follow that doc.** There is no `taskPlanning/lambda/ephemera/AGENT.development.md`.

- **Runner:** Jest, invoked as **`npm run test`, not `npm test`**. Client packages in this repo use Vitest and `npm test`; do not carry that habit here.
- **Working directory: `lambda/ephemera`** for every test command below and in [Verification](#verification). Paths passed to Jest are relative to it.
- **`npx tsc --noEmit`** runs from the same directory.

**Two inherited hazards, both cheap to respect and expensive to rediscover:**

- `*.integration.test.ts` files sit **outside** the tsconfig include and mock modules **by path**, so `npx tsc --noEmit` cannot catch a break in them. Run the full Jest suite after any rename or delete, and grep module *paths*, not only symbols.
- After a change that makes a shared field required, run `npm run test -- --clearCache` once before believing a green suite (`ts-jest` caches type-check results per unchanged file, so the suites that break are the ones you did not touch).

**Baseline --- should pass before any edit**, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/positions/
```

**Done, for each slice, includes updating this plan's [Recommended order](#recommended-order) checkboxes** after its tests pass --- not as a follow-up pass.

## Relationship to the presence plan --- and why this is not gated on it

**This work is downstream of [`AGENT.presence.planning.md`](AGENT.presence.planning.md) in subject matter and *not* gated on its open rows.** That is a decision, taken 2026-09-10, and it is recorded here so a later reader does not helpfully reinstate a gate nobody chose:

- **[PR-8](AGENT.presence.planning.md#open-decisions-design--plan-only)** (what the merge-reduce reducer may assume about presence) closes when its verdict is *"a sentence P7 can be written against."* **A working reducer is the cheapest way to produce that sentence.** Waiting for the row first inverts the order: the row would be answered from argument, then the code would grade it, which is the slower path to the same place.
- **[PR-12](AGENT.presence.planning.md#open-decisions-design--plan-only) Obligation A** (the cascade constructor) is write-side. Nothing here constructs anything, so it cannot discharge A --- but the fixtures in Slice 1 are a **specification of A's output by example**, which is worth more to that row than another paragraph.
- **[PR-17](AGENT.presence.planning.md#open-decisions-design--plan-only)** is deferred until `ludicCache` has an operational rebuild pass. **These two slices are the first pieces of one and they do not shorten that wait**; shard enumeration and persistence still stand between. **Do not read a green reducer as an early answer to PR-17** --- the row already guards against exactly that, and hand-authored fixtures measure nothing about load.
- **[PR-C1](AGENT.presence.corpus.planning.md#pr-c1-the-contraption-in-two-rooms-and-whether-covers-nest)**'s intra-graph straddle is the case that makes Slice 1b informative. It is an input here, not a blocker: the reducer has to choose *something* for it, and choosing in code is what grades the row.

**What flows back the other way is findings, on completion of each slice, not before.** Slice 3 is that step, and it is part of *done* rather than a follow-up.

## The finding that shapes Slice 1: nothing authors bucket membership

`nodesFromPresencePort` presupposes that a presence port is connected to the nodes in its bucket. **In shipped code it is not.** Every non-test `'Present'` site in `positions/`:

- [`containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) emits `addPresencePort` and a `PartOf` **relational edge between child and parent**. No edge touching the port.
- [`presencePortStepsForMove.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/presencePortStepsForMove.ts) --- the same: a port, no edge.
- Every other hit is a type guard, a filter, or the heal path.

And **no production code anywhere constructs an `EphemeraLudicPortAddress`** (`{ owner, port }`); `grep -rn "owner:" --include="*.ts"` outside `dist/` returns test files only. `EphemeraPresencePort` is the arm with no *exterior* endpoint ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), and nothing gives it an interior one either. **A presence port is an isolated vertex today.**

**The consequence is a degenerate case, not a defect.** With one presence port per graph, *nodes reached from the port* and *every node in the graph* are the same set, so a walk implementation and a return-everything implementation both pass every test writable from live data. **A green suite over single-bucket fixtures proves nothing about the mechanism.** So:

1. **The input format for Slice 1a is being invented by its fixtures**, not read off storage. Say so in the test file, not only here.
2. **At least one fixture must be a hand-authored two-bucket child**, or the slice is untested in the only case it exists for.
3. **This is not a reason to build the constructor first.** Authoring what the cascade would emit, as a fixture, is the cheap half; building it is PR-12A's job on the write side.

## Tier: Prototype, classified before the code exists

**Prototype, not locked.** Built because building it is the only affordable way to get the evidence PR-8 needs.

- **Dependency tag --- the rollback set is exactly:** `positions/ludicGraph/presenceSubGraph.ts` (+ test), `positions/ludicCache/mergeReducer.ts` (+ test), and their fixtures. **No change to `EphemeraLudicGraph`, to `ephemeraMeta.ts`, or to any write path.** If a slice finds it needs one, that is a scope change to raise, not to take.
- **Rollback trigger, named in advance:** *a bucket cannot be stated from the child's own graph plus its ports* --- i.e. if deciding which nodes are in a binding turns out to require the parent's graph, then presence is not port-indexed and the reducer's premise fails. That is a stated invariant proving unholdable.
- **Not triggers:** fixture verbosity, reducer size, or the number of cases the straddle rule needs. Those are measurements this Prototype exists to take.

## What already exists to build on

1. [`ludicGraph/index.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) --- `EphemeraLudicGraph` with `nodeIds`, `relationalEdges`, `ports`, `clone`, `equals`. Build on the accessors; the class is not the place for these utilities (see LR-4).
2. [`ludicGraph/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts) --- `HostRelationalEdge`, `edgesMatch`, and the terminal helpers `ephemeraLudicTerminalOwner` / `ephemeraLudicTerminalsEqual` / `ephemeraLudicTerminalRefersTo`. **A port-qualified terminal and a bare id on the same owner are deliberately not equal**; the sub-graph rule depends on that distinction and must not paper over it.
3. [`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts) --- `EphemeraLudicCacheData`, `EphemeraLudicCacheNode.homeShards`, `EphemeraLudicCacheEdge.crossings`. **The output contract already ships (CC0b); Slice 2 fills it rather than inventing it.** Note its recorded narrowness: `homeShards` is `EphemeraMembershipHostId`, which excludes `OBJECT#`. Prefer a cache-local alias over re-typing shipped rows.
4. [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) --- the relational-edge naming table, and which duplications are deliberate.
5. **The shape hazard, from PR-8's own flag:** CC1b spells out a **batch concatenation** pass that [P7's staged findings](AGENT.abstractionLayers.ludicCache.corpus.planning.md#mechanism-findings-staged-for-p7) argue against building. **A pairwise reducer is not that shape**, which is why Slice 2 is specified pairwise. What CC1b's flag explicitly does *not* retract is the content --- crossings per hop, never merged, never tie-broken, port-address terminals --- and that is what to reproduce.

## Recommended order

Pending work is `[ ]` and completed work is `[X]`; mark each nested line `[X]` as it is done. Nothing here is built yet.

- [ ] **Slice 0. Classify and record.** Copy the tier block above into the first file's doc comment (Prototype, dependency tag, rollback trigger) so the rollback set is visible from the code, not only from a plan that will be deleted.
- [ ] **Slice 1. Presence sub-graph utilities**, in `positions/ludicGraph/presenceSubGraph.ts`.
  - [ ] **1a. `nodesFromPresencePort(graph, portId)`.** Keyed on `portId`, never on host id (LR-3). Returns the bucket's node set: **the root unconditionally** ([PR-9](AGENT.presence.planning.md#settled-register): the root is in every bucket), plus the nodes the membership rule reaches. **Decide and state the membership rule in the doc comment** (LR-2) --- it is being invented here.
  - [ ] **1b. `subGraphFromNodes(graph, nodes)`.** All the nodes, all the edges **between** them, and edges to ports per LR-1's rule. **Do not silently drop straddlers** --- [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread) makes drop unavailable before the question is argued. Two foundations, decided alongside LR-1 and built first because the rest of 1b calls them:
    - [ ] **1b-i. Edge identity key.** A pure function, local to `presenceSubGraph.ts`, computing a deterministic string from exactly the fields `edgesMatch` ([`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts)) treats as an edge's identity. Deliberately duplicates that field list rather than importing from `baseClasses.ts`, to keep the Prototype's rollback set at exactly its two tagged files (LR-1's dependency tag).
    - [ ] **1b-ii. Stub-port minting.** For an edge with one endpoint outside `nodes`: if the edge already lands on a real port, use it; otherwise mint a stub port keyed on 1b-i's identity key. Minting is transient --- nothing is written to `edge.edgeId` or back to the stored graph.
  - [ ] **1c. Unit tests, including the cases that carry information:** a two-bucket hand-authored child; an edge cut at a real port; **PR-C1's intra-graph straddle with no port at the cut**, now resolved by minting (LR-1); **two distinct edges straddling to the same external node**, to pin non-collision; and **the same graph and bucket derived twice**, to pin that a minted port's id is identical both times. The first two confirm; the third decides; the last two are 1b-i/1b-ii's own correctness, not LR-1's.
- [ ] **Slice 2. First-draft merge reducer**, in `positions/ludicCache/mergeReducer.ts`. Parent graph plus one child sub-graph, present at that parent, in; one `EphemeraLudicCacheData` out. **Pairwise, never batch** (LR-7).
  - [ ] **2a. Collapse of crossing relation ports** --- an edge ending at a port in one graph and continuing from that port in the other becomes one edge carrying a `crossings` entry.
  - [ ] **2b. Merge of two presence sub-graphs for the same child host.** The root arrives twice; `homeShards` must accumulate rather than overwrite (LR-6). **Key the merge on binding, not on host** --- keying on host id collapses the two buckets and re-introduces the one-to-many hop [PR-12](AGENT.presence.planning.md#open-decisions-design--plan-only) Obligation B forbids.
- [ ] **Slice 3. Report back, then decide what is durable.** Write LR-1's chosen convention into [PR-8](AGENT.presence.planning.md#open-decisions-design--plan-only) as the sentence P7 can be written against; note the fixture-as-specification against PR-12A. **Only then** decide whether anything belongs in [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- a Prototype's behavior is not contract text, so the likely answer is *not yet*, and saying so explicitly beats leaving it ambiguous.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the slices above. When one ships, record it where it belongs and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| LR-1 | **What becomes of an edge with one endpoint outside the bucket** --- keep with a dangling terminal, drop, or emit a record of the cut. | Slice 1b | **Decided 2026-09-10.** The cut always lands on a port. **The narrow case is any edge already terminating at a port-qualified terminal, of any relation kind** --- not only `Present`. Whenever an edge's far node genuinely belongs to a *different* graph, its terminal is already port-qualified by construction (a bare id cannot refer across hosts), so `cup -[TiedTo]-> string` with `string` in another graph is handled the same way a presence-port edge is, on the same mechanism, with nothing minted. **Minting is for the remaining, genuinely intra-graph case**: a bare-id peer in *this* graph that simply isn't in the chosen bucket --- PR-C1's straddle, where no port exists anywhere to fall back on. This resolves that case as legal, represented uniformly with the already-qualified case --- **drop stays unavailable** (C7). A stub port's id is derived deterministically from exactly the fields [`edgesMatch`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts) already treats as an edge's identity (`from`, `to`, `kind`, `relationLabel` on `Custom`, `chainId`): two edges can only collide on it if the graph's own comparison already cannot tell them apart, so it is a canonical encoding of existing identity, not a separate scheme. It is computed transiently inside `presenceSubGraph.ts` and never written back to the stored graph. The shipped-but-inert `edgeId` field (EA-8, [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) is deliberately **not** minted or persisted by this decision --- giving edges real, stored identity is EA-10, a separate question this Prototype does not answer. |
| LR-2 | **What bucket membership looks like in the input** --- what a cascade constructor would have to emit for a multi-bucket child. | Slice 1a | **Open.** Being invented by fixtures. Candidate per [PR-4](AGENT.presence.planning.md#settled-register) reading (d): a `Present` edge from port to node. **State the chosen rule in the doc comment**, because no shipped writer produces it. |
| LR-3 | **Key on `portId`, not host id.** | Slice 1a | **Decided 2026-09-10.** [PR-3](AGENT.presence.planning.md#open-decisions-design--plan-only)'s live remainder is arity: the cache path's guard is per-parent, so at most one port per parent from that path, while the type admits N. A host-keyed utility bakes in an assumption the design is holding open. |
| LR-4 | **Where the code lives** --- methods on `EphemeraLudicGraph`, or free functions. | Slice 1, 2 | **Decided 2026-09-10.** Free functions: `ludicGraph/presenceSubGraph.ts` for the graph-generic pair, `ludicCache/mergeReducer.ts` for the reducer. Only the reducer needs cache types, and a Prototype does not belong on the shipped class's surface. |
| LR-5 | **Whether the reducer's output is persisted.** | Not this plan | **Decided 2026-09-10: no.** In-memory only. Persistence is the rebuild pass PR-17 waits on, and adding it here would make the Prototype's rollback set include storage. |
| LR-6 | **`homeShards` accumulation on merge**, and node dedup across buckets. | Slice 2b | **Open.** Non-emptiness is a rebuild invariant, not a structural one, and the guard admits `[]` --- so a merge that overwrites will not fail a type check. Pin it with a test. |
| LR-7 | **Pairwise merge, not batch concatenation.** | Slice 2 | **Decided 2026-09-10**, on PR-8's own flag: taking CC1b's shape would import the premise P7 exists to revisit. |

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/

# Full suite before marking a slice done --- integration tests are NOT covered by tsc
npm run test -- --watchAll=false

npx tsc --noEmit
```

Grep checks, from the repo root:

```bash
# The Prototype's rollback set stays exactly two modules. Any other file importing them is scope creep.
grep -rn "presenceSubGraph\|mergeReducer" --include="*.ts" lambda/ packages/ \
  | grep -v node_modules | grep -v "/dist/"

# No write path acquires a presence-edge writer by accident. Expected: guards, filters, the heal path,
# containmentPopulationSteps and presencePortStepsForMove --- nothing new.
grep -rn "'Present'" --include="*.ts" lambda/ephemera/dataSource/positions/ \
  | grep -v "\.test\.ts"
```

## When this finishes

1. **Slice 3 is not optional.** The findings are the deliverable that outlives the code; the code is a bet with a rollback trigger.
2. **Delete this file** and sweep inbound pointers --- [`AGENT.presence.planning.md`](AGENT.presence.planning.md) links it from its companion note, its PH3 step, its PH3 Progress row, and PR-8's status cell. **A bare `LR-*` marker left in code or docs after deletion is the named dangling-marker anti-pattern**; resolve the markers, do not orphan them.
