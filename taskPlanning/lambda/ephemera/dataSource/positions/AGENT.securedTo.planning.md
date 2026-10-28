# SecuredTo: a closed peer kind for "this holds it in place"

**Status:** opened 2026-10-28, as the follow-on that the hosting-kind plan shelved until it shipped. Nothing is built. **Next step: Slice 0** (inventory, no code). Every design point below came out of a discussion and is **Open** until the user settles it; nothing here is a decision. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

A member's hosting kind says where it sits (`On`, `In`, `Held`) or what it helps make up (`PartOf`, `SectionOf`). It says nothing about what *holds it there*. Being secured is a separate fact (a plate glued to a table is `On` the table and `SecuredTo (glued)` it; a rope end is `SecuredTo (tied)` the pole), and it is a relation between two things, so it belongs on an edge.

The proposal is one new **closed peer kind**, `SecuredTo`, carrying an **open manner label** the way `Custom` carries `relationLabel` (`glued`, `tied`, `nailed`). The split follows the closed-lexicon rule: a closed kind where the set can be enumerated (the *fact* of being secured, which deterministic code needs), an open label where the phrasing cannot be (the *manner*, which reasoning reads to decide which act unsecures it and whether that act is feasible).

**Payoff, stated at the observable output:** `take the rope` while its end is tied to the pole is refused or challenged with "unsecure it first" without the code reading the word `tied`; `take the plate` glued to a table likewise; and after `untie the rope` the same `take` succeeds. A thing that is merely `Custom`-related to something it is moved away from (boots under a table) no longer takes the same path as a secured one.

## What exists today (checked 2026-10-28)

- [`classifyInteractionUnderTransfer`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) returns `defer` for **every** stored peer edge (`Custom` and `ConnectedTo`), whichever end moves. `dissolve` is reserved and has no producer.
- Every peer edge touching a mover gets a facilitating dissolve, which the Coyote evaluator judges ([`expandBoundaryChallenges.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts)). So today a `Custom('under')` edge asks the player to dissolve "under" before the boots move, the same as a lashed rope.
- Stored kinds are one set, `STORED_RELATIONAL_EDGE_KINDS` (`Custom`, `ConnectedTo`), shared by the edge guard, the port guard and `ludicGraph/baseClasses.ts` ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)). The hosting-kind work left room: adding a kind is adding a member to the named union and the set, not reopening every site.
- The contract's rule on peer relations ([*Relation kinds*](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds)): there is no deterministic parse of a peer relation; `Custom` comes only from the LLM Plan fallback; no closed peer kinds exist yet.

## Design so far (the discussion's record, condensed; all Open)

- **Placement, securing and composition separate.** Unglue the plate and it is an ordinary thing `On` the table. Removing a `PartOf` member is detaching or breaking it, which is the separate separability question.
- **Precondition versus consequence.** When a related thing moves, two different things can happen. A **precondition**: the move cannot happen until something is done (unsecure it first). A **consequence**: the move happens and something else changes (the rake leaning on the box falls; the boots are revealed). `SecuredTo` is the deterministic precondition. Every other peer relation touching a moved thing goes to reasoning, which decides whether there is a consequence or a challenge after all. The earlier idea that other peer relations "could dissolve freely" was **withdrawn**.
- **The tie can be a crossing edge.** Under `SectionOf` the rope end is a member of the rope's own graph and the pole is a member of the room's, so the tie crosses a boundary. `SecuredTo` must then be a legal **crossing-port kind**, and the existing chain/leg machinery (`buildCrossingLegs`, one kind and label stamped on every leg and the port) carries it. At room scale it composes into "the rope is `SecuredTo (tied)` the pole".
- **Member to its own host's root.** A tag tied to its suitcase is a peer edge from the member to the host's root inside the host's graph. The boundary filter formerly exempted only the mover's hosting edge; with hosting edges gone, nothing forbids a peer edge to the root. Untested.
- **Justification (later, deferred).** Three shapes for "why is this secured" (an engaged latch, a nail): (a) an edge as a terminal (`nail -Secures-> <edge>`; new terminal arm, edge identity must survive the cache merge, `edgeId` would become required), (b) a `securedBy: (node | edgeId)[]` field on the securing edge (no new terminal arm; node-to-edge reference by `edgeId` has precedent in the Arrangement), (c) the fastener as a node (many justifiers are already things; leaves edge-justified securing, such as a latch, uncovered). Not needed for the first slice, and cheap to add later if the kind carries an `edgeId` from the start (SS-4).

## Relationship to other plans

- **The hosting-kind plan shipped and retired** (2026-10-28); its rules are in [`AGENT.contract.md` *Relation kinds*](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds), and the five-kind set is closed to this plan (securing is not a sixth hosting kind).
- **Consequences of a move** (the rake falls, the dishes stay when the cloth is yanked, "will this action have consequences" as a scaling concern) are **not** this plan. They belong to the outcome and effects work (the iterations ladder's "effects that travel along relations" row) and to the spread corpus's world-semantics half. This plan only supplies the deterministic precondition and the candidate set boundary.
- **Minting a rope end or any detail when first addressed** belongs to the abstraction-layers plan ([`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md): AB-14 minting, AB-17 reabsorption). This plan only needs the edge to be representable once the detail exists.
- **WML.** The wire and print side of a new peer kind belongs to [`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md); this plan changes ephemera storage, `mtw-interfaces` types, gateways and diagnostics only, as the hosting-kind plan did.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4 and the crossing-edge section (legs, ports, chains).
3. **Rules this changes:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) *Relation kinds* and *Edge persist shape*; the manner-not-physics paragraph there is the thing `SecuredTo` partly overturns.
4. **Where peer edges are classified:** [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts), [`expandBoundaryChallenges.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts), and [`actions/enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) *Interaction under transfer*.
5. **Edge-as-terminal background (only if SS-4 opens it):** [`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md), which marks edges as terminals unlicensed, and its corpus's `Clamp -[Secures]-> Cord` case.
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Other packages: `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the three package suites. As of 2026-10-28: ephemera 4000, interfaces 775, gateways 308, diagnostics 161.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SS-1 | **A closed peer kind `SecuredTo` with an open manner label**, versus a `Custom` edge with a conventional label. Deterministic code must recognise securing without knowing the verb, which argues for the closed kind. Whether the label is required (as `Custom`'s is) or optional is part of this row. | 1 | Open, the user's call |
| SS-2 | **Which edges `SecuredTo` takes over from the dissolve-everything path.** Proposed: a `SecuredTo` edge touching a mover is the deterministic precondition (a facilitating "unsecure it" action, no judgment of the manner by code); every other unsecured peer edge keeps today's path (facilitating dissolve judged by the Coyote evaluator) until the consequence work exists. The classifier's `dissolve` class has no producer and stays reserved. Open: does `SecuredTo` change the *outcome class* for the mover, or only the action routed to the adjudicator? | 2 | Open |
| SS-3 | **Legal endpoints.** Node to node in one graph; member to its own host's root; and a crossing edge (end section to pole) with `SecuredTo` a legal crossing-port kind. Open: is `SecuredTo` symmetric like `ConnectedTo`, or directional (subject secured to object, as `Custom` is)? The discussion reads it directional ("the plate is secured to the table"). | 1 | Open |
| SS-4 | **Does the kind carry an `edgeId` from the start,** so a later justification (shapes (a) to (c) above) can reference it? Cheap to require at introduction, expensive to retrofit. Deferred otherwise: justification is not in the first slice. | 1 | Open |
| SS-5 | **Does `SecuredTo` ever block rather than challenge?** A glued plate "cannot be moved" until unglued. Open: the facilitating action list is what the player sees; whether a missing means to unsecure (no knife to cut the rope) refuses outright or goes to the evaluator is the Coyote rule (outcomes are genre-dictated, reject only the physically impossible), so likely evaluator. | 2 | Open |

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | |
| 1. The kind: type, guards, crossing port, round trip | |
| 2. Precondition routing in the move path | |
| 3. Authoring: how a `SecuredTo` is produced (planner phrase, LLM fallback) | |
| 4. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Inventory, no code.** Verify the three code facts the discussion left unchecked, and record findings in [Progress](#progress).
    - [ ] Whether a stored peer edge may target a graph's **root** (the plate or tag to its host): read the edge guard, `addRelationalEdge`, `bothObjectsOnGraph`, and the readers that pin `to` (drift sweep, `connectedToLegality`). Write a throwaway test, then discard or keep it as a regression.
    - [ ] Whether the classifier and `boundaryActionsInGraph` really route **every** peer edge to a facilitating dissolve today, and which tests pin it (so SS-2 can say exactly what changes).
    - [ ] Every site that enumerates `HostRelationalEdgeKind` or `STORED_RELATIONAL_EDGE_KINDS` and what adding a member costs (the hosting-kind plan left these as one named union; confirm `buildCrossingLegs`, `findRelationalChain`, `expandSameHost`, `classifyLudicGraphPortMismatch` in gateways, `wireProjection.ts`, `publishedEvents.ts`).
    - [ ] Whether `SecuredTo` as a **crossing-port** kind works through the cut, merge and fold (`presenceSubGraph`, `mergeReducer`) the way `Custom` does, including the `chainId`/`edgeId` invariant.
    - [ ] Settle SS-1 to SS-4 with the user before Slice 1.
- [ ] **Slice 1. The kind: type, guards, crossing port, round trip.**
    - [ ] Add `SecuredTo` to `HostRelationalEdgeKind` and `STORED_RELATIONAL_EDGE_KINDS`; the label rule (SS-1), direction (SS-3), and `edgeId` (SS-4) as settled.
    - [ ] Round-trip tests: stored edge, member-to-root, crossing port with legs, cut and merge.
    - [ ] `STORED_RELATIONAL_EDGE_KINDS`-driven guards need no per-site edits; fix any that list kinds by hand.
- [ ] **Slice 2. Precondition routing in the move path** (per SS-2, SS-5).
    - [ ] `classifyInteractionUnderTransfer` and `expandBoundaryChallenges` treat a `SecuredTo` edge as the deterministic precondition.
    - [ ] **Payoff test** at the observable output: `take the rope` secured to the pole is challenged; after the unsecure action the same take succeeds; a `Custom` edge keeps its existing behavior.
- [ ] **Slice 3. Authoring: how a `SecuredTo` is produced.** Today no phrase produces a peer relation deterministically. Decide whether `tie`, `glue` and `nail` stay LLM-fallback outputs (a closed lexicon for the kind, open for the manner) or get a template; see the closed-lexicon feedback rule.
- [ ] **Slice 4. Durable docs, then delete this plan.** Contract *Relation kinds* (the closed kind, its legality, the manner-not-physics paragraph reworded), concepts vocabulary (precondition versus consequence), `ludicGraph/AGENT.md`, `AGENT.implementation.md`, `objectManipulation/AGENT.md` *Interaction under transfer*; then grep inbound links and delete.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
- After Slice 1: `grep -rn "'ConnectedTo'" --include='*.ts' lambda packages/mtw-gateways/ts packages/mtw-interfaces/ts | grep -v node_modules | grep -v test` and check each hit lists `SecuredTo` where it lists the other peer kinds.
