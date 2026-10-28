# Hosting kind on the member node

**Status:** opened 2026-10-27, not started. **Next step: settle [HK-1](#open-decisions-implementation--plan-only)--[HK-4](#open-decisions-implementation--plan-only) (the user's call), then [Slice 0](#recommended-order).** Slice 0 can run before the decisions, because it is an inventory and writes no code. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

Today a member's hosting kind (`On`, `In`, `PartOf`) is stored as a relational edge in its host's `ludicGraph`: `member -K-> rootId`. The plan moves that kind onto the member's own node entry in the host's graph. Graph-wide structures that combine shards (`ludicCache`) get the kind from there, as edges or another form per [HK-4](#open-decisions-implementation--plan-only). The `edges` list keeps only the peer and topology kinds (`Custom`, `ConnectedTo`).

**Why the edge is the wrong shape in a single graph.** The `to` end of every hosting edge carries no information:

- **Every reader and writer pins `to` to the root.** See [`findOwnRootContainmentEdge.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/findOwnRootContainmentEdge.ts), the boundary filter in [`expandBoundaryChallenges.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts) (`boundaryActionsInGraph`), `isPart` in [`connectedToLegality.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/connectedToLegality.ts), the population writer in [`containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts), and the `PartOf` check in [`fixedContainmentDriftSweep/classification.ts`](../../../../../lambda/diagnostics/fixedContainmentDriftSweep/classification.ts).
- **The contract already says hosting kinds persist only as the member's own edge to its host's root, never between siblings** ([*Relation kinds*](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds)). [`classifyInteractionUnderTransfer`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) throws on any other hosting-kind edge it meets.
- **The edge shape still admits what the contract forbids**, and nothing structural stops it:
  - a hosting edge whose `to` is not the root (the container accepts one: `ludicGraph/index.test.ts`, the `OBJECT_A -On-> OBJECT_B` fixture);
  - a hosting edge from a port-qualified terminal, and a crossing port whose `kind` is a hosting kind (`EphemeraCrossingPort.kind: HostRelationalEdgeKind`);
  - two hosting edges for one member in one host, or none (none is read as `In` by the primer's default).
- **Moves maintain the edge separately from the node.** Leaving a host removes the member's node, and then the move has to strip the member's own hosting edge as well (`buildObjectMoveOp` via `findOwnRootContainmentEdge`). The boundary filter has to exclude that same edge. A kind on the node leaves with the node, so both mechanisms go away.

**The concepts' objection does not apply.** [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) ("Contents") and the primer ([`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 3) say the distinction "lives on the edge, never on the node", because typing the node would contradict *whole and part are roles, not kinds*. That warning is against typing the **component**: a "part-kind" object. A node entry in a host's graph is already specific to that host, because **membership is the node list** (primer section 3, point 2). A kind on that entry types the *membership* and carries the same information as today's edge. The component is untyped in its own graph and in every other host's. Those two passages are reworded in Slice 5.

**`ludicCache` is different.** It combines several shards into one graph from one host's viewpoint, so a hosting relation's `to` really does vary there. Today `EphemeraLudicCacheNode` is `EphemeraLudicGraphComponentNode & {...}` ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)). If the kind is a field on the component node arm, the cache node would inherit a field that is ambiguous there (in which host?). [HK-4](#open-decisions-implementation--plan-only) decides what the cache carries instead.

**Payoff, stated at the observable output:** `put the cup on the table`, then `look at the table`, behaves as today. The same holds for `take the cup` and for a cup `In` a box being moved. The difference is in the stored rows: the table's `ludicGraph` row holds the cup's node with kind `On` and no hosting edge, and a stored graph cannot hold a hosting-kind edge or port at all.

## Relationship to other plans

- **[`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md) OD-1 is this question on the authoring side.** It asks whether WML writes the hosting kind on the nested reference or as edge tags, and it leans toward the nested reference "pending a check that no stored hosting edge ever lands on a port rather than the root". Slice 0 here performs that check. Storing the kind on the node in ephemera matches the nested-reference spelling. The wire and print side (that plan's Slice 4) and `LUDIC_EDGE_MEMBERSHIP_KINDS` in [`ludicEdge.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge.ts) stay with that plan; see [HK-5](#open-decisions-implementation--plan-only). Its OD-1 note about a member with two bindings into one host being written twice is the same question as [HK-2](#open-decisions-implementation--plan-only) here.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4 (membership is the node list; edges say *how*; presence is a cover indexed by binding).
3. **Rules this changes:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) *Relation kinds*, *Edge persist shape*, and the `ludicGraph` structural staleness self-heal section (for [HK-6](#open-decisions-implementation--plan-only)'s heal: *never called from a read boundary*).
4. **Container and types:** [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) (*Membership nodes*, *Relational edges*, *Wire projection*), and `EphemeraLudicGraphComponentNode` / `EphemeraLudicRelationalEdgeData` / `EphemeraCrossingPort` in [`mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts).
5. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Other packages touched: `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
6. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the three package suites above.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

HK-1 through HK-4 are the user's to settle (opened 2026-10-27, to return to 2026-10-28). HK-5 and HK-6 are proposals the user can overturn.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| HK-1 | **One kind per membership, or a set.** The concepts table says `In` and `PartOf` are non-exclusive, and that "a thing may be **both**". Read literally of one host, that allows one member to be both `In` and `PartOf` its host, and the edge shape represents that (two edges). **No producer writes it**: move ops carry a single `containment?: 'On' \| 'In' \| 'PartOf'` (`positionKernelOp.ts`, `buildObjectMoveOp.ts`, `planObjectMoveTransfer.ts`), and population writes one kind per child. Slice 0 confirms this against stored rows. **(a) One kind.** The "both" clause is reworded to mean *different hosts*: the spring is `In` the box and `PartOf` the contraption, two memberships in two graphs, which is the primer's own worked example. **(b) A set** (`kinds: HostingRelationKind[]`, non-empty). This keeps the literal clause, at the cost of every reader handling a set that no producer fills. Lean (a): the primer's example is the cross-host reading, and the single-host reading has no fiction in the corpus. | 1 | Open, the user's call |
| HK-2 | **What the kind is per: member, or presence binding.** Today everything keys on the bare member id (`findOwnRootContainmentEdge` matches `edge.from` against the entity id), so the stored fact is per (host, member). A member can hold **several bindings into one host** (a thread passing one room twice: two stretches the contraction rule keeps apart). If those stretches could differ in kind (one `On` the table, one hanging `In` a slot of it), the fact is per (host binding, member binding), and its natural home is the **cover entry** (`EphemeraPresenceCoverEntry`, on the parent binding's presence node). That home is per binding by construction, is written once, and also exists in the cache (`EphemeraLudicCacheCoverEntry`), which bears on HK-4. **(a) Member node:** simplest, and matches every current reader. **(b) Cover entry:** finer, with every hosting read going through presence. **(a) then (b)** if a corpus case needs it is a legitimate order, because widening from (a) to (b) is a move of the field, not a change of meaning. Same question as wmlRelationalEdges OD-1's "written twice" note. | 1 | Open, the user's call |
| HK-3 | **Field shape on the chosen home** (depends on HK-1/HK-2). Proposal for (a)/(a): `containment?: HostingRelationKind` on the component arms of `EphemeraLudicGraphNode`. It is absent on the graph's root node (a root has no host in its own graph) and on presence nodes (the structure arm gets no field). It is **required on every non-root component member, checked by the guard and the container**, not by the type (the type cannot name "non-root"). That retires the primer's default "no hosting edge means `In`": a value of `In` is written explicitly. Characters and population-placed objects get `In`; Rooms and Features under a parent get `PartOf` (today's population rule). The alternative is a separate graph-level map `containment: Record<memberId, kind>`. It is rejected because it reopens the drift the move cleanup exists for: the node and its kind could be removed separately. | 1 | Open (proposed; confirm with HK-1/HK-2) |
| HK-4 | **What `ludicCache` carries.** No cache reader consults a hosting kind today (grep over `ludicCache/` and `internalCache/` finds none), but `On` versus `In` **apprehension** is stated as a cache property in the concepts, so this is forward demand, not a reason to drop the kind. **(a) Reconstructed edges** (the user's framing, 2026-10-27): the fold emits `member -K-> host` per combined membership, so `EphemeraLudicCacheEdge` keeps the hosting kinds while the stored edge type does not. That needs a cache-local edge type (`EphemeraLudicRelationalEdgeData` narrows) and an `Omit` of the field on `EphemeraLudicCacheNode`. **(b) Kind on the cache cover entry**, natural if HK-2 is (b), since the cache cover entry already names member and host. **(c) Kind on a cache-local membership record**, if neither fits. Lean (a) under HK-2 (a), and (b) under HK-2 (b). | 4 | Open, the user's call |
| HK-5 | **Scope boundary with wmlRelationalEdges.** This plan changes ephemera storage, `mtw-interfaces` types, gateways and diagnostics. It does **not** change WML Standard types or printing: `LUDIC_EDGE_MEMBERSHIP_KINDS` and the wire representation of hosting kinds stay with that plan's OD-1 and Slice 4, informed by this plan's verdicts. The gateway read projection ([`project.ts`](../../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts)) carries the node field through in place of the edges it passes through today; the print step already drops non-Navigation edges, so the client sees no change here. | 4 | Proposed |
| HK-6 | **Stored rows: heal, not reset.** Rows holding hosting edges are converted by extending `healLudicGraphStructure` (and `LudicGraphStaleStructureSweep`'s classification) with one more healable shape: a hosting edge `member -K-> rootId` folds into the member node's field. That is derivable from the row alone, the same ground as today's two healable shapes. A hosting edge in any other shape (not to the root, port-qualified, a member with two kinds under HK-1 (a)) is **reported, not healed**. Read boundaries stay strict (the contract's *never called from a read boundary*). A stored-graph reset is rejected because it would lose player-placed kinds (a cup put `On` a table), which no repopulation regenerates. | 3 | Proposed |

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | |
| 1. Field, guard, container accessors (no behavior change) | |
| 2. Writers and readers move to the field | |
| 3. Hosting kinds leave the edge and port types; heal stored rows | |
| 4. `ludicCache` and gateway projection | |
| 5. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Inventory, no code.** Record findings in [Progress](#progress), and pass the port finding to wmlRelationalEdges OD-1.
    - [ ] Every **producer** of a hosting-kind edge (`establishRelation` with a hosting `relationKind`; `containment` on move ops; population; fixtures in `containmentDriftScenarios.ts`). Confirm each writes `member -K-> rootId` and one kind per member.
    - [ ] Every producer of a **hosting-kind port**, including stub ports minted from severed edges (`presenceSubGraph.ts` `subGraphFromNodes`, `mergeReducer.ts` stubs, `stubPortIdFromEdge`). In particular, find out whether a hosting edge can straddle two presence buckets of one host in the fold, which would mint a hosting-kind stub port.
    - [ ] Every **reader** of a hosting kind on an edge or port (start from `grep -rnE "(kind\|relationKind) ?(===\|!==) ?'(On\|In\|PartOf)'\|isHostingRelationKind\|case '(On\|In\|PartOf)'"` over `lambda/`, `packages/mtw-gateways/ts`, `packages/mtw-interfaces/ts`), including narration and `attemptCandidates.ts` (the first-edge kind check).
    - [ ] Dev-instance stored rows: run `LudicGraphStaleStructureSweep` (or a one-off read-only scan) to count rows with hosting edges, and any rows in the shapes HK-6 reports rather than heals.
- [ ] **Slice 1. The field, with no behavior change** (per HK-1--HK-3).
    - [ ] Add the field to the chosen home in `ephemeraMeta.ts`, with its guard (required on non-root component members once Slice 3 lands; optional until then, so stored rows still parse).
    - [ ] Container accessors on `EphemeraLudicGraph` (a read of a member's kind, and setting it as part of adding the member), with unit tests.
    - [ ] `EphemeraLudicCacheNode` omits the field (HK-4), so the cache cannot inherit an ambiguous one.
- [ ] **Slice 2. Writers and readers move to the field.**
    - [ ] Writers: population (`containmentPopulationSteps.ts`), the move compiler's `containment` (the node is added with its kind), and `establishRelation`/`dissolveRelation` for hosting kinds (refused for hosting kinds from here on, if Slice 0 finds a caller other than population and moves).
    - [ ] Readers: `connectedToLegality.ts`, `attemptCandidates.ts`, `fixedContainmentDriftSweep/classification.ts`, narration, and every other reader from Slice 0.
    - [ ] Retire `findOwnRootContainmentEdge` and the own-edge exclusion in `boundaryActionsInGraph`. Leaving a host now removes the kind with the node.
    - [ ] `classifyInteractionUnderTransfer`'s hosting-kind branch becomes unreachable by type (Slice 3); leave a comment until then.
- [ ] **Slice 3. Hosting kinds leave the edge and port types; heal.**
    - [ ] Narrow `HostRelationalEdgeKind` (as stored on `EphemeraLudicRelationalEdgeData`) and `EphemeraCrossingPort.kind` to `Custom \| ConnectedTo`, along with the duplicate `HOST_RELATIONAL_EDGE_KINDS` sets (`ephemeraMeta.ts`, `ludicGraph/baseClasses.ts`, `publishedEvents.ts`). The planner/DTO lane's `relationKind` (`put X on Y`) keeps the hosting kinds: it is an instruction, not a stored edge.
    - [ ] Make the field required on non-root members in the guard.
    - [ ] Extend `healLudicGraphStructure` and the stale-structure sweep per HK-6, with tests for the healed shape and each reported one.
- [ ] **Slice 4. `ludicCache` and gateway projection** (per HK-4, HK-5).
    - [ ] The fold carries the kind in HK-4's chosen form. Fold tests keep the "run twice, byte-identical" case.
    - [ ] `project.ts` carries the field through.
    - [ ] **Payoff test** (an integration test terminating at the observable, on the harness of [`crossingTakePayoff.integration.test.ts`](../../../../../lambda/ephemera/dataSource/crossingTakePayoff.integration.test.ts): real `parseCommand` through `commitAttempt`, `ephemeraDB` leaf mocked): `put the cup on the table`, then `look at the table`, renders as today; the committed table graph holds the cup node with `On` and no hosting edge; `take the cup` leaves no hosting residue; a cup `In` a box moves with the box.
- [ ] **Slice 5. Durable docs, then delete this plan.**
    - [ ] `positions/AGENT.contract.md` *Relation kinds* and *Edge persist shape*: hosting kinds persist on the membership (the node field), not as edges, with the healable shape added to the self-heal section.
    - [ ] `AGENT.concepts.md` "Contents"/"Part" rows and primer section 3: reword "lives on the edge, never on the node" to "lives on the membership, never on the component", and the "both" clause per HK-1.
    - [ ] `ludicGraph/AGENT.md` (*Membership nodes*, *Relational edges*) and `positions/AGENT.implementation.md`.
    - [ ] Grep for inbound links to this file (`grep -rn "hostingKindOnNode" .`), then delete it.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
- After Slice 3: `grep -rnE "kind: '(On|In|PartOf)'" --include='*.ts' lambda packages/mtw-gateways/ts | grep -v node_modules` finds no stored-edge or port construction. Hits that remain should be DTO/planner `relationKind` or `containment` only.
