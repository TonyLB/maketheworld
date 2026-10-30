# SecuredTo: a closed peer kind for "this holds it in place"

**Status:** opened 2026-10-28, redesigned the same day, and re-scoped 2026-10-29 to a **first iteration: block, with deterministic templates, no supports**. Nothing of `SecuredTo` itself is built. **Unblocked; nothing is gated on a user decision.** **Next step: Slice 0** (inventory, no code). An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**The shape.** `SecuredTo` is a closed peer kind with **no label**, same-graph and single-leg, directional (subject secured to object). **Iteration 1 is a bare edge that blocks a move.** `secure X to Y` writes it and `unsecure X from Y` removes it, as short-term keyword templates in the manner of the spread template, until the Plan LLM fallback inherits those routes. The manner (`glued`, `tied`), the `Custom` support edge and the `Justifies` between them, auto-lapse, and the dissolve-and-judge path are a **named later iteration** ([Later iteration](#later-iteration-manner-support-and-lapse)). The edge-terminal arm and `Justifies` shipped 2026-10-29 for that later iteration and are not used here (rules in [`AGENT.contract.md` "Edge persist shape"](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#edge-persist-shape); the `Justifies` legality there is v1 scope, not its meaning). The capable version is booked in [Owed by the capable version](AGENT.edgeAbstractions.planning.md#owed-by-the-capable-version) and is **not** this plan.

## Goal

A member's hosting kind says where it sits (`On`, `In`, `Held`) or what it helps make up (`PartOf`, `SectionOf`). It says nothing about what *holds it there*. Being secured is a relation between two things, so it belongs on an edge: a plate glued to a table is `On` the table and `SecuredTo` it.

The split follows the closed-lexicon rule: a closed kind where the set can be enumerated (the *fact* of being secured, which deterministic code needs), an open label where the phrasing cannot be (the *manner*). Iteration 1 builds the closed kind and nothing of the manner.

**Payoff, stated at the observable output (player commands, same-graph):** `secure the plate to the table`, then `take the plate` is blocked ("secured": the code never reads a manner word); `unsecure the plate from the table`, then the same `take` succeeds. A thing that is merely `Custom`-related to something it is moved away from (boots under a table) does not take the blocked path; it keeps today's challenged dissolve. *"Untie the rope" unsecuring a tied rope, and a `SectionOf` rope end tied to a pole (a crossing support, Owed item 6), are the later iteration.*

## What exists today (checked 2026-10-29)

- [`classifyInteractionUnderTransfer`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) is an exhaustive switch over `HostRelationalEdgeKind`. `Custom`, `ConnectedTo` and `Justifies` all return `defer`; `dissolve` is reserved with no producer. Adding `SecuredTo` is a compile error here until it picks a class.
- [`boundaryActionsInGraph`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts) turns every `defer` boundary edge into a facilitating dissolve with a `CustomEdgeChallenge`, and **throws** for a `defer` edge that is not `Custom`.
- **The block has a precedent.** `attemptActionsFromTransfer` puts an `ExitEdgeChallenge` on the **primary** action when the mover touches an exit, and the take abstains. A `SecuredTo` block is the same mechanism with its own challenge type, not a new action.
- [`matchSpreadTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchSpreadTemplate.ts) is the pattern for the templates: `defineAttemptTemplate` with a closed verb map, `CommandAttempt.create(kind, command, actions, narrationUnits)`, and a comment that the LLM Plan fallback replaces it. Per the actions contract an attempt's kind is the template's name, and a peer relation is `relation`.
- `establishRelation` and `dissolveRelation` steps carry `subjectId`/`targetId` object ids, which is exactly what a node-to-node `SecuredTo` needs. No new step is required for iteration 1.
- Sites that list the peer kinds by hand: `interactionUnderTransfer.ts` (exhaustive), `expandBoundaryChallenges.ts` (the throw), `publishedEvents.ts` `RELATION_INSTRUCTION_KINDS` (`Custom`, `ConnectedTo` only), `mergeReducer.ts`, `presenceSubGraph.ts`, `presenceParent.ts` and `factsForStep.ts` (each special-cases `ConnectedTo`; confirm `SecuredTo` takes the default path), and `mtw-wml` `dataTypes/ludicEdge.ts` (the wire kind tuples). `STORED_RELATIONAL_EDGE_KINDS` drives the guards, so those need no edit.
- The contract's rule on peer relations ([*Relation kinds*](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds)): no deterministic parse of a peer relation; `Custom` comes only from the LLM Plan fallback. The templates are the first deterministic producer of a peer kind, and the manner-not-physics paragraph there is what `SecuredTo` partly overturns.

## Design record (condensed)

- **Placement, securing and composition separate.** Unglue the plate and it is an ordinary thing `On` the table. Removing a `PartOf` member is detaching or breaking it, which is the separate separability question.
- **Precondition versus consequence.** A **precondition** blocks a move until something is done. A **consequence** lets the move happen and changes something else (the rake falls). `SecuredTo` is the deterministic precondition; every other peer relation touching a moved thing goes to reasoning. The idea that other peer relations "could dissolve freely" was **withdrawn**.
- **Block, not dissolve-and-judge (iteration 1).** A `SecuredTo` on a boundary edge yields no facilitating action. It puts a challenge on the primary action and the move abstains until the edge is gone. Unsecuring is the player's own command.
- **Member to its own host's root.** A tag tied to its suitcase is a peer edge from the member to the host's root inside the host's graph. Nothing forbids it today. Untested (Slice 0).

## Later iteration: manner, support and lapse

Deferred together, by the user's call (2026-10-29), because each is an automation or a richer form of the first iteration. Shelve in `AGENT.implementation.md` when this plan is deleted (Slice 4); none of it is an Open row.

- **The manner and the support.** `Custom(tied to) -[Justifies]-> SecuredTo`, the triple of three edges and two minted ids. It needs a kernel step that adds a `Justifies` (`establishRelation` carries object ids and cannot name an edge). Proposed: one narrow step taking the justified edge and its support by structure plus two caller-minted ids, doing `assignEdgeId` twice and the add atomically. Keep it a stopgap: the presence-op vocabulary aspiration says a rich op language comes later.
- **Auto-lapse.** Removing a `Justifies` that leaves the justified edge with no remaining supports removes the justified edge in the same apply, in the `withoutDanglingEdgeReferrers` fixpoint. `Justifies`-generic, OR only, v1 caveat. Open then: a `SecuredTo` that was never given a support persists as "secured, manner unstated", so only losing the last support lapses it.
- **Dissolve-and-judge.** A `SecuredTo` produces the facilitating dissolve of its supports (the existing `Custom` dissolve with its evaluator challenge) and "untie the rope" unsecures. Whether a missing means to unsecure (no knife) refuses outright or goes to the evaluator is the Coyote rule (outcomes are genre-dictated, reject only the physically impossible), so likely evaluator.
- **Manner verbs.** `tie`, `glue`, `nail` (templates now, the Plan LLM later), writing the triple.
- **Crossing supports.** Owed item 6 in the edge-abstractions plan.

## Relationship to other plans

- **The hosting-kind plan shipped and retired** (2026-10-28): the five-kind set is closed, so securing is not a sixth hosting kind. Rules in [`AGENT.contract.md` *Relation kinds*](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds).
- **Edge abstractions** ([`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md)): owns the capable version. This plan must not build any of "Owed by the capable version", and every `Justifies` legality sentence it writes carries the v1 caveat.
- **Consequences of a move** (the rake falls, the dishes stay when the cloth is yanked) are **not** this plan. They belong to the outcome and effects work and the spread corpus's world-semantics half.
- **Minting a rope end or any detail when first addressed** belongs to [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md) (AB-14, AB-17).
- **WML.** The wire and print side of a new peer kind belongs to [`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md); this plan changes ephemera storage, `mtw-interfaces` types, gateways and diagnostics, as the hosting-kind plan did.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4.
3. **Rules this builds on:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) *Relation kinds* and *Edge persist shape*; and the actions contract ([`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md)) on attempt kinds and Plan templates.
4. **Where peer edges are classified:** [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts), [`expandBoundaryChallenges.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts), and [`actions/enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) *Interaction under transfer*.
5. **The template pattern:** [`matchSpreadTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchSpreadTemplate.ts) and how it is registered with the fast path ([`discriminateIntent/deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts) and the template registry).
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Other packages: `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`; `mtw-wml` from its package.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the package suites. As of 2026-10-29: ephemera 4049 (9 skipped), interfaces 820, gateways 308, diagnostics 161, mtw-wml 2098 (15 skipped).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SS-1 | **A closed peer kind `SecuredTo`, no label.** The manner is the label of a separate `Custom` support edge, in the later iteration. | 1 | Decided (the 2026-10-28 redesign) |
| SS-2 | **Iteration 1 blocks.** A `SecuredTo` on a boundary edge puts a challenge on the primary action (as `ExitEdgeChallenge` does) and the move abstains; no facilitating dissolve, no auto-lapse. | 3 | Decided (the user, 2026-10-29) |
| SS-3 | **Legal endpoints and direction.** Same graph and single leg; node to node, plus member to its own host's root if Slice 0 confirms it works. A crossing `SecuredTo` is refused in v1 (Owed item 6 returns it). Directional: subject secured to object. | 1 | Decided (scope); direction proposed, confirm at Slice 1 |
| SS-4 | **Templates.** `secure X to Y` writes `X -SecuredTo-> Y`; `unsecure X from Y` removes it, unconditionally (no challenge, no evaluator). Closed verbs `secure`/`unsecure` only; `tie`, `glue`, `nail` wait for the manner iteration. Short-term: the Plan LLM fallback inherits the routes. | 2 | Decided (the user, 2026-10-29) |

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | Not started. The hand-listed kind sites are already inventoried above. |
| 1. The kind: type, guards, classifier class, crossing refusal | |
| 2. The `secure`/`unsecure` templates | |
| 3. Block routing in the move path, and the payoff test | |
| 4. Durable docs; shelve the later iteration; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Inventory, no code.** Verify the facts the discussion left unchecked, and record findings in [Progress](#progress).
    - [ ] Whether a stored peer edge may target a graph's **root** (the plate or tag to its host): read the edge guard, `addRelationalEdge`, `bothObjectsOnGraph`, and the readers that pin `to` (drift sweep, `connectedToLegality`). Write a throwaway test, then discard or keep it as a regression.
    - [ ] Which tests pin "every peer edge routes to a facilitating dissolve" (`classifyInteractionUnderTransfer`, `boundaryActionsInGraph`), so Slice 3 can say exactly what changes.
    - [ ] Confirm `mergeReducer`, `presenceSubGraph`, `presenceParent` and `factsForStep` take the default path for a new peer kind (each special-cases `ConnectedTo`), and whether `publishedEvents.ts` `RELATION_INSTRUCTION_KINDS` should list it.
    - [ ] How `spreadTemplate` is registered and claimed on the fast path, whether `secure`/`unsecure` collide with any verb something else claims, and what the existing relation path does when the two ends are in different graphs (the refusal message `secure` needs).
- [ ] **Slice 1. The kind** (per SS-1, SS-3).
    - [ ] Add `SecuredTo` to `HostRelationalEdgeKind` and `STORED_RELATIONAL_EDGE_KINDS` (no label), refuse a crossing `SecuredTo`, and give it a class in the exhaustive classifier (a block outcome beside `defer`).
    - [ ] Round-trip tests: stored edge, member-to-root, cut and fold, wire. Fix any site that lists kinds by hand (Verification grep).
- [ ] **Slice 2. The templates** (per SS-4).
    - [ ] `secureTemplate` and `unsecureTemplate` in the manner of `spreadTemplate`: closed verb map, pattern, attempt kind `relation`, an `establishRelation` / `dissolveRelation` of `SecuredTo` with narration, registered on the fast path.
    - [ ] Tests at the command: the WML-text style the repo uses for templates; `unsecure Y from X` (reverse direction) finds nothing.
- [ ] **Slice 3. Block routing in the move path** (per SS-2).
    - [ ] A `SecuredTo` challenge type; `attemptActionsFromTransfer` puts it on the primary action for a `SecuredTo` boundary edge; `boundaryActionsInGraph` makes no dissolve for it and no longer throws.
    - [ ] **Payoff test** at the observable output (same-graph): `secure the plate to the table`, `take the plate` is blocked, `unsecure the plate from the table`, `take the plate` succeeds; a plain `Custom` edge keeps its existing behavior.
- [ ] **Slice 4. Durable docs, then delete this plan.** Contract *Relation kinds* (the closed kind, its legality, the block rule, the manner-not-physics paragraph reworded), concepts vocabulary (precondition versus consequence), `ludicGraph/AGENT.md`, `AGENT.implementation.md` (including the shelved [Later iteration](#later-iteration-manner-support-and-lapse) and the templates as the stand-in for the Plan LLM), `objectManipulation/AGENT.md` *Interaction under transfer*, the actions docs for the new templates; then grep inbound links (including the SecuredTo mentions in the edge-abstractions and abstraction-layers plans) and delete.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`, and the `mtw-wml` suite.
- After Slice 1: `grep -rn "'ConnectedTo'" --include='*.ts' lambda packages/mtw-gateways/ts packages/mtw-interfaces/ts packages/mtw-wml/ts | grep -v node_modules | grep -v test` and check each hit lists `SecuredTo` where it lists the other peer kinds, or takes the default path on purpose.
