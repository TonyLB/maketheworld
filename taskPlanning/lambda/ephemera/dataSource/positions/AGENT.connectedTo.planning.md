# ConnectedTo: topology within one whole, and a rope across rooms

**Status: opened 2026-10-15, not started. Next step: [Slice 0](#recommended-order).** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). The design question it builds on is [EA-12](AGENT.edgeAbstractions.planning.md#ea-12) in the edge-abstractions plan, answered *yes, a kind* by the user on 2026-10-15. The code it licenses is a **Prototype** (see [Licensing](#licensing-a-prototype-with-its-rollback-trigger)).

## Goal

Add `ConnectedTo` as a relation kind that states **topology within one whole**: parts (or bindings) of one conceptual whole, and how they join. Use it first to make a **rope across two rooms** creatable: carrying one end of a rope into the next room splits the rope's presence binding, connects the two bindings with `ConnectedTo`, and moves the new binding into the other room, in one committed step sequence.

**Why a kind and not a `Custom` label** (from EA-12): the motivating consumer is a deterministic retrieval read --- tugging a rope extends the `ludicCache` to the rooms the rope reaches. Retrieval builds the context the adjudicator reasons over, so it cannot ask the adjudicator which edges to follow; it has to select edges by kind. That read is **not** in this plan (see [Not in scope](#not-in-scope)); this plan makes the thing it reads exist.

**The distinction this plan must keep, the user's call:** `ConnectedTo` joins parts of **one** whole. A join between **separate** wholes (`SolderedTo`, plugged into, tied to) is a peer relation, `Custom` with a label, and stays that way. Slice 3 enforces this.

**Payoff, stated at the observable output:** a player carries one end of a rope from room A into room B. A `look` in room B shows the rope, a `look` in room A still shows it, and the rope's own graph holds `{Rope, pA} -ConnectedTo-> {Rope, pB}`.

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../../AGENT.md)** once, for how implementation plans work.
2. **Testing:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the command authority. From `lambda/ephemera/`: `npm run test -- --watchAll=false`. Its section *Two ways a suite lies about being green* applies here: Slice 0 widens a shared union, so run the full suite (not only `tsc`), and run `npm run test -- --clearCache` once before trusting a green run.
3. **Baseline before any edit:** the full ephemera suite green, plus `npx tsc --noEmit` in `lambda/ephemera/` and `packages/mtw-interfaces/`.
4. **Read the primer, [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), sections 2--5.** Section 4 (presence, covers, the rope) is the model this plan builds on.
5. **Read [EA-12](AGENT.edgeAbstractions.planning.md#ea-12)** for why the kind exists and its known costs.
6. **Read the split code:** the split step and its planner were deleted by monotoneCovers Slice 2a-ii (2026-10-18). A split is now a `movePresenceBinding` with a `subCover` part and a `mintedPresence` ([`movePresenceBinding.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/movePresenceBinding.ts), the kernel write and its refusals), with no planner yet (the old `resolvePresenceSplit` had no non-test caller). The contract's binding-addressed move rule is in [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md).

## Licensing: a Prototype, with its rollback trigger

Per [Graduation tiers](../../../../AGENT.designVariant.md#graduation-tiers-when-a-decision-licenses-code), stated before the code exists:

- **Classified:** Prototype. EA-12 is answered but not corpus-grounded; building this is how its evidence arrives.
- **Dependency tag:** the [Progress](#progress) table lists every file each slice touches, so the rollback set stays known. No plan-ID markers in code.
- **Rollback trigger (an invariant, not a cost):** *every `ConnectedTo` edge lives in its whole's own graph, with both endpoints that whole's parts or bindings.* If a fiction forces a `ConnectedTo` edge that cannot satisfy this, the topology/peer distinction is unholdable and the kind rolls back to a `Custom` label. Cost or size surprises are measurements, not triggers.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. The kind.** No producer; the suite stays green with the union widened.
  - [ ] Add `'ConnectedTo'` to `HostRelationalEdgeKind` and to both kind sets ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) `HOST_RELATIONAL_EDGE_KINDS`, and the copy in [`ludicGraph/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts)). Not in `HOSTING_RELATION_KINDS`: it never decides shard placement.
  - [ ] Symmetry, per [OD-2](#open-decisions-implementation--plan-only): `edgesMatch` ([`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts)) and `collapsedEdgeIdentityKey` ([`ludicCache/mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts)) treat `A -ConnectedTo- B` and `B -ConnectedTo- A` as one edge.
  - [ ] `classifyInteractionUnderTransfer` ([`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts)) gets a `ConnectedTo` arm, per [OD-1](#open-decisions-implementation--plan-only).
  - [ ] Sweep every exhaustive switch or kind dispatch the compiler flags, plus string-matched dispatch it cannot (`grep -rn "'Custom'" lambda/ephemera packages --include='*.ts'`): narration, relation-kind parsing, wire types. Record each site in Progress.
  - [ ] WML [`ludicEdge.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge.ts): add `'ConnectedTo'` to the kind union and to the relational kind set, in the class [OD-4](#open-decisions-implementation--plan-only) picks. Required, since `edgeToWire` in [`wireProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/wireProjection.ts) maps `HostRelationalEdgeKind` onto it. Nothing is printed: WML has no written form for relational edges yet ([`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md)).
- [ ] **Slice 1. Split-and-connect at the compile layer.** No player route yet; exercised by kernel tests.
  - [ ] A compile function returning `[movePresenceBinding (with subCover), establishRelation]` in one sequence: the part move (the split, since monotoneCovers Slice 2a-ii), then `establishRelation` with `kind: 'ConnectedTo'`, `hostId` the whole, endpoints `{owner: whole, port: <original binding>}` and `{owner: whole, port: <new binding>}`. The kernel's `movePresenceBinding` step is not widened.
  - [ ] Confirm `confirmCarriedHost` ([`applyStepSequenceCore.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts)) accepts binding terminals owned by the step's own `hostId`. If it does not, that is this slice's fix.
  - [ ] Compose with `movePresenceBinding` for the new binding, so one sequence yields a rope present in two rooms with its bindings connected.
  - [ ] Kernel test: the sequence commits atomically; a stale split refuses the whole sequence, leaving no orphan edge.
- [ ] **Slice 2. The cache reads it.**
  - [ ] Room A's `ludicCache` folds the rope's shard and carries the `ConnectedTo` edge. The far endpoint is an owner-qualified reference to a binding absent from that cache, which the contract already calls legal; confirm `mergeReducer` agrees.
  - [ ] The same from room B.
- [ ] **Slice 3. The legality check.** `establishRelation` with `kind: 'ConnectedTo'` refuses unless both endpoints are nodes or bindings of the step's `hostId`'s whole, excluding [OD-5](#open-decisions-implementation--plan-only)'s open case. This is the [rollback trigger](#licensing-a-prototype-with-its-rollback-trigger)'s invariant, enforced. It also serves the direct case: `ConnectedTo` between two existing parts of one whole (authoring or repairing a whole's topology) is legal through the ordinary `establishRelation`; two siblings in a **room's** graph are separate wholes and are refused.
- [ ] **Slice 4. A player route.** Per [OD-3](#open-decisions-implementation--plan-only).
  - [ ] Lift C2's `multiPresent` refusal for this route only. It now lives at [`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts) (`transferPreconditionFailure`).
  - [ ] Payoff test at the observable output (see [Goal](#goal)): `look` in both rooms shows the rope.

## Not in scope

- **The tug read** (tug-driven `ludicCache` extension along `ConnectedTo`). The motivating consumer, and the next plan once this one ships. It also needs a cache read rooted at several rooms.
- **Wholes with named parts:** the carve-out walk that reads `ConnectedTo` to decide which parts go to which binding's cover. This plan's wholes are partless, so the split *writes* the edge and nothing yet *reads* it to place parts.
- **PR-12's cascade** (re-partitioning a split whole's own contents to depth). Partless wholes have no contents to re-partition.
- **Undoing it:** gathering the rope back into one room. The kernel's join step exists; whether it also dissolves the `ConnectedTo` edge is for the plan that adds that route.
- **Manner** (spliced versus continuous) and **rigid versus slack**: no label slot on `ConnectedTo` in this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **OD-1** | **What `classifyInteractionUnderTransfer` returns for `ConnectedTo`.** It runs over the graph a mover leaves. A `ConnectedTo` edge reaches it only when a part moves out of its own whole, which is tearing the whole apart. Leaning `defer`: an interaction for the adjudicator, as `Custom` does. The alternative is an assert-and-throw like the hosting kinds, which is right only if Slice 3 makes that move unreachable, and it does not | Slice 0 | Open, leaning `defer` |
| **OD-2** | **How symmetry is represented.** Order-insensitive comparison in `edgesMatch` and `collapsedEdgeIdentityKey`, or a canonical endpoint order fixed at write time. Leaning order-insensitive comparison: two sites, and no reader has to know a canonical order exists | Slice 0 | Open, leaning comparison |
| **OD-3** | **What player route produces the split, and how the planner knows a thing can be stretched across rooms.** A rope can; a cup cannot. Candidates: planner judgment emitting a split-and-move step; or a trait on the object, authored or improvised. The largest open question here | Slice 4 | Open |
| **OD-4** | **Where `ConnectedTo` sits in WML's edge classes:** Topology (beside `Navigation`/`Bearing`) or a fourth class. Checked 2026-10-15: no slice here reaches the client. Relational edges reach the server's `StandardForm` but are dropped when it prints WML text (`StandardLudicRelationalEdge.schemaNode()` returns `undefined`), and `LudicEdgeList` does not validate kinds at construction, so the class choice has no runtime effect yet. Giving edges a written form is [`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md). Leaning Topology: arrangement within one whole is what that class means, and Peer is for separate wholes | Slice 0 | Open, leaning Topology |
| **OD-5** | **Whether a binding-to-binding `ConnectedTo` on a whole that also has named parts is legal**, or only partless wholes may connect bindings. Raised by EA-12's known costs. This plan's wholes are partless, so Slice 3 may refuse it until a plan needs it | Slice 3 | Open, leaning refuse |

## Verification

Per slice, from `lambda/ephemera/`:

- `npx tsc --noEmit` (also in `packages/mtw-interfaces/` for Slice 0).
- `npm run test -- --watchAll=false`, the full suite; Slice 0 also runs `--clearCache` first.
- Slice 0: `grep -rn "ConnectedTo" lambda/ephemera packages --include='*.ts'` lists exactly the sites recorded in Progress.
- Slice 4: the payoff test asserts on `look` output in both rooms, not on the graph alone.

## Progress

| Slice | State | Files touched (dependency tag) |
| --- | --- | --- |
| 0 | Not started | --- |
| 1 | Not started | --- |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |

## When this plan finishes

The `ConnectedTo` rules (its meaning, the one-whole invariant, symmetry) move into [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), the kind's vocabulary into [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), and the primer's rope example re-spells `Custom('spliced to')` as `ConnectedTo`. EA-12 graduates in the edge-abstractions plan. Then this file is deleted, after a grep for inbound links.
