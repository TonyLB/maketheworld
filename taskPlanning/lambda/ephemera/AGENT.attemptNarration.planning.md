# Attempt narration: narration copy from the command attempt, audience from the kernel

**Status:** In progress, opened 2026-10-06. Slices 0-1 done (all-or-nothing commit; template carrier, with today's verb-from-delta copy as a bridge). Next: slice 3, which now also carries slice 2's relational delivery work (folded in 2026-10-06; see slice 2's line). This plan resolves [CA-4](dataSource/actions/AGENT.commandAttemptPhase.planning.md#open-decisions-implementation--plan-only) and absorbs the deleted `AGENT.relationalNarration.planning.md` (see [What was absorbed](#what-was-absorbed-from-relationalnarration)).

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md). It is an implementation plan, not the design variant: the representation was settled in conversation (2026-10-06), the evidence corpus already exists (see [Getting Started](#getting-started)), and what is left are forks inside slices.

## Why

Narration is built from **kernel ingredients**. `compilePositionKernelOp` derives a verb from the delta (`to` is a room -> drop, a `from` is a room -> take, neither -> give), and `presentStepSequence`'s `buildNarrationCopy` assembles `characterName` + verb + `objectShortName`. Relational copy is the same idea in the old fan-in (`publishObjectManipulationPresentation.ts`): a per-relation-kind verb table, with `Custom` putting the relation label where the verb goes. Rebuilding an act from its outcome does not scale, in three escalating ways:

1. **Leaky.** `coins: Table -> Pouch` has a room on neither side, so the forward rule says "Tess gives the coins". Each fix adds a rule that reconstructs an intent the attempt already held.
2. **Not deterministic at all.** `rope -[Custom: tied]-> pole` is a state. State -> act is many-to-many (tie / lash / knot, "to" / "around"), and a facilitating dissolve is worse: untying and cutting leave the same graph, which [`actions/AGENT.concepts.md`](../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#commandattempt) names as manner. Kernel-sourced narration would need an LLM hop *after* commit, on the latency-critical path, to describe what a hop *before* commit already read.
3. **Manner is absent by construction.** "Tess stuffs the coins hurriedly into the pouch" has no source in `coins from: Table to: Pouch`. The only sidecar that holds it is the attempt, which already rides to positions on `Ludic Network Change Requested`.

And one case outcome-sourced narration cannot reach at all: a failed attempt has no kernel outcome.

## Target shape

**Split the legacy decision; keep half of it.** It bundled *when and to whom* narration happens with *what it says*.

- **When and to whom stays with the kernel, unchanged.** Narrate only on commit, audience captured mid-walk, delivery order from declared slots. Every clause of [`positions/AGENT.contract.md` --- Narration and presentation](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-and-presentation) still applies.
- **What it says comes from the attempt.**

**Narration and attempt actions are many-to-many**, along three axes, and the representation follows from that:

| Axis | Cases |
| --- | --- |
| Actions -> lines | One action, several lines (leave/arrive today). Several actions, one line ("picks up the tray, leaving the cup behind": a facilitating dissolve + the primary). Zero actions, one line (Coyote outcome pipeline, ambient). One action, no line (assertions, administrative moves). |
| Line -> audiences | Same event, different text by vantage, on two axes (AN-2): by role (actor vs. witness, RN-1; later recipient), and by captured audience: one capture vs. another (a move's leave and arrive rosters), each room's end of a crossing. An audience is a **capture**: a room's roster at one point in the step timeline. A narration unit declares it by referent ("the rope, before"); compile resolves it to a room (AN-7). |
| Line -> outcomes | A line is written against an expected outcome; "stuffs the coins into the pouch" is false if that action did not commit. |

So:

- **A narration unit is its own value, not a field on an action.** It names the actions it **covers** and carries a **template** whose slots are the actor and `stableRefKey`s (filled at flush, so second person and per-viewer naming stay possible).
- **Every action carries a minted id (a UUID), not its index** (2026-10-06). An index is stable only at commit (`commitAttempt` iterates the attempt's own actions in order and does not re-expand), but narration units are authored upstream, and Expansion prepends facilitating actions after Plan builds the attempt, so a Plan-time index would silently point at the wrong action. Ids are minted where an action is created (Plan's templates, Expansion, later a backtrack exchange) and carried through every copy (`grounded()`, `withChallenges()`, `toJSON`/`fromJSON`). Grounding copies one Plan attempt per identity candidate, so candidates share a Plan action's id; that is intended, since one narration unit authored per command must fit whichever candidate Selection publishes.
- **An attempt commits all-or-nothing** (slice 0). The attempt is what the player intended, as a whole: verdicts gate it whole and Selection picks it whole. Today it is not committed whole. `commitAttempt` writes in one `transactWrite`, but an action whose fragment cannot be built (a derived referent unresolvable, membership drift off the grounded `from`, the actor not in exactly one room, `planRelationalEdgeTransfer` refusing) silently becomes an empty fragment while its siblings still commit. So `[dissolve lashing, take rope]` with the take dropped unties the rope for nothing. (The reverse, dissolve dropped, is already refused by the dry run as an uncovered edge.) After slice 0, any action that cannot be built refuses the attempt. An action whose desired result **already holds** (a take of something already held) is refused too, with its own "already on" message (decided 2026-10-06, superseding an earlier "satisfied" reading): the take the player meant did not happen as written.
- **So a committed attempt's narration units are valid by construction.** Every action in a committed attempt either committed or was already satisfied, which is what a narration unit was written against. No per-narration-narration unit validity check runs at commit. So a narration unit carries no expected outcome until failure narration (slice 5) needs one, and then it is a per-attempt condition (a success template vs. a failure template), since the whole attempt went one way. The one remaining mismatch is a covered action that was already satisfied (AN-6).
- **Narration comes from whatever creates the action, never from a positions-side default** (2026-10-06, superseding an earlier "deterministic default per action kind" floor). Plan's templates, Expansion and later a backtrack exchange each know *why* they created an action; positions knows only the delta, so any copy it derives is a guess from a closed verb set (the leak in [Why](#why), item 1). So each creator authors the narration unit over the actions it creates (Expansion's dissolves included), and positions only fills labels and delivers. An action no narration unit covers narrates nothing. **Until an author exists, today's verb-from-delta copy runs as a bridge:** the old family structure represented in the new template format (`defaultTransferMembershipParts` / `objectMoveVerb`), deleted when the first author covers the object family. It is not a floor and grows no new members.
- **Narration units cover only what their author could see,** and a narration unit never spans attempts: a compound command is one attempt, and cooperation (two characters' attempts) is shelved (AN-1). Within one attempt there is one commit and one capture set, so no join is needed.

**Who authors a narration unit is open (AN-3), and the premise behind "the plan LLM writes it" is false today.** Plan is deterministic templates (`planSkeleton`); the LLM plan fallbacks are stubs. The one LLM hop that already sees the player's words on every object-manipulation command is **Parse** (`runParseStage`).

## Scope

In: object take/drop/give, containment and relational (establish/dissolve) narration, on the command-attempt routes that commit through `commitAttempt`. Out: character membership narration (navigate/home/connect/disconnect have no attempt; `membershipMove` stays a kernel-ingredient family), look/describe (already presentation-kernel `describe`), Coyote execution narration (the outcome pipeline's).

## What was absorbed from relationalNarration

That plan (seeded 2026-07-31, never started) planned a `reposition` `NarrationSpecification` family built from kernel ingredients, which is the pattern this plan replaces. Its remaining substance moves here:

- **Phase 1 (what is a reposition op?) splits.** The *copy* clause dissolves: copy no longer comes from the op's family. The *audience* clause recurs: which host(s) a relational action captures, for an intra-host relation and for a crossing. That was AN-5, now absorbed into AN-7's general rule.
- **Phase 3 (move relational narration onto the compiled kernel, retire the fan-in)** is in slice 3 here (it was slice 2 until folded, 2026-10-06), with copy authored by Expansion rather than a relational verb table.
- **Phase 4 (RN-2's delivery order, pinned by a test)** is in slice 3.
- **RN-1 and RN-2** are carried below.
- **The crossing bug.** `objectManipulationPresentationLegAdapters.ts` gates narration on `isEphemeraRoomId(hostId)`, so a relational establish/dissolve across a shard boundary narrates nothing (found live 2026-09-02, `tie string to cup`). Slice 3 retires that adapter; its exit criterion is that a crossing narrates, tested directly.

### RN-1 (carried, still deferred)

**`ACTOR` / `!ACTOR` target kinds for second-person copy.** Deliberately deferred 2026-07-28, and still deferred. Its representation is now set by AN-2: a **role variant** on the narration unit, delivered once to the actor and deducted from every witness capture, not a property of any capture. Nothing here builds it; slice 3 only shapes narration units so it adds without re-keying. `!CHARACTER#` and `GLOBAL` have zero production producers.

### RN-2 (carried, resolved as (b))

**Does a severed boundary edge narrate?** Resolved 2026-07-30 as **(b), its own line**: "George takes the glass off the tray." / "George picks up the tray." Narration units change the cost of the alternative, not the verdict: **(c), one merged line, is now just a narration unit covering both actions**, with no compiler change. Revisit trigger unchanged: several relations severing at once.

**The obligation (b) creates, still undischarged:** the dissolve's line must be **delivered** before the move's. Step order is already right (`[dissolveRelation*, transferMembership]`); delivery order comes from **declared slot order**, so dissolve slots must be declared first. Load-bearing for comprehension; pin it with a test, not a comment (slice 3).

## Getting Started

1. [`taskPlanning/AGENT.md`](../../AGENT.md), once.
2. The kernel half that stays: [`positions/AGENT.contract.md` --- Narration and presentation](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-and-presentation), [`positions/manipulation/AGENT.implementation.md` --- Presentation kernel](../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md).
3. The attempt half: [`actions/AGENT.concepts.md` --- `CommandAttempt`](../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#commandattempt), [`commitAttempt.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/commitAttempt.ts) (per-action fragments, one commit).
4. The code being replaced: `buildNarrationCopy` in [`presentStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/presentStepSequence.ts); `NarrationSpecification` in [`kernelStep.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts); the relational fan-in ([`objectManipulationPresentationFanIn.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.ts), [`objectManipulationPresentationLegAdapters.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationLegAdapters.ts), [`publishObjectManipulationPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts)).
5. **Corpus (cite, don't rebuild):** the [iterations corpus](dataSource/actions/AGENT.objectManipulationIterations.planning.md) rows 2 (boulder, "painstakingly"), 4 (`balance`), 6 (lashed rope, untie vs. cut) and 8 (`throw` paper: manner only in the words); [slice 0's worked examples](dataSource/actions/AGENT.commandAttemptPhase.slice0Examples.temp.md).

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md) --- `npm run test`, not `npm test`, from `lambda/ephemera`. If commands conflict, that file wins.

**Hazard:** `*.integration.test.ts` sit outside the tsconfig include and mock modules by path, so `npx tsc --noEmit` cannot catch a break in them. Run the full suite after any rename or deletion, and grep module paths, not only symbols.

Baseline (should pass before edits, from `lambda/ephemera`):

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/ \
  dataSource/perception/ \
  dataSource/actions/commandAttempt/ \
  dataSource/messageOrchestration/
```

## Progress

| Slice | Subject | Status |
| --- | --- | --- |
| 0 | An attempt commits all-or-nothing | Done |
| 1 | Template carrier on the narrate step (object family) | Done |
| 2 | Relational narration onto the compiled kernel | Folded into slice 3 (2026-10-06) |
| 3 | Narration units on the attempt; Expansion's dissolves onto the kernel; fan-in retired | Not started |
| 4 | Authoring narration units (payoff) | Not started |
| 5 | Failure narration | Not started; may reduce to "no" |
| 6 | Durable docs, retire this plan | Not started |

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes.

- [X] **Slice 0. An attempt commits all-or-nothing.** A correctness fix in [`commitAttempt.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/commitAttempt.ts), independent of narration, and the premise slice 3's simplicity rests on. Any action that cannot be built refuses the whole attempt (nothing written), including an already-held take, which keeps its "already on" refusal message.
  - [X] Each empty-fragment path classified as refused (no satisfied class survives). Already-held take: refused with its own message (user decision 2026-10-06). Zero or several containers: refused. A dissolve with no chain: refused (a `defer` from the planner, as before). Duplicate establish: **refused** (decided 2026-10-06), checked against the live graph before commit (`isEdgeAlreadyPresent`), since the graph patch alone would be idempotent but the attempt would still narrate. Only the same-host case has a test; a duplicate crossing (cross-shard) is not verified, and slice 3 (crossings) should check it.
  - [X] Tests: `[dissolve lashing, take rope]` with the take having no single live host commits nothing; the already-held take refuses the attempt with its message; a dissolve that cannot be built refuses the take too.
  - [X] Corrected [`positions/AGENT.contract.md` --- `Ludic Network Change Requested`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-network-change-requested-positions-owned) (new All-or-nothing clause, the "makes a mixed-kind plan atomic" claim removed), `commitAttempt`'s doc comment, and its row in [`positions/AGENT.implementation.md`](../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).
- [X] **Slice 1. The narrate step carries a template, not family ingredients (object family only).** Replaced `ObjectMoveNarrationSpec`'s family ingredients (now `TemplateNarrationSpec`, [`narrationTemplate.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/narrationTemplate.ts)) with a template plus slot fills, produced by the per-primitive **default** for `transferMembership` (today's verb-from-delta, unchanged). `membershipMove` stays as it is. This is the carrier every later slice writes into, built once so slice 2 never has to add a `reposition` family that slice 3 would retire.
  - [X] Strings preserved verbatim: existing take/drop/give expectations pass unedited (the regression pin, as when the object family landed).
  - [X] The default lives positions-side. It is built in the compiler (`compilePositionKernelOp`, where the verb is derived), not beside `resolveObjectMovePresentationLabels`; the labels still arrive from `commitAttempt`.
  - [X] **The default is a bridge, not a floor** (2026-10-06): the verb-from-delta parts are the old family structure in the new format, kept only so object narration keeps working until an author covers the object family (slices 3-4), then deleted. See the Target-shape bullet "Narration comes from whatever creates the action".
  - [X] The carrier names no role (2026-10-06 correction of a first cut that had `fills: { actor, object }`): parts are text, the actor slot, and `ref`s to entity ids, filled from one `labels` map; the op input is `{ kind: 'template', actorName, labels }`, not an `objectMove` family. Relational narration (now slice 3, authored by Expansion) should be new parts over the same arm, not a new field or family. The verb-from-delta floor is the one family-shaped residue left, and it only picks the literal text between refs.
- [ ] **Slice 2. Folded into slice 3 (2026-10-06).** Kept as a numbered line so outside references to "slice 2" still resolve. Since the retirement of deterministic peer-relation parsing, no deterministic route creates or player-dissolves a peer relation: until the LLM Plan fallback exists, the only relational actions that commit are **Expansion's facilitating dissolves** (`take the rope` when it is lashed). Today the fan-in mostly fails to narrate those: the fact leg's host is the subject's host *after* commit, so when the subject is the moved object (now held by a character) the leg is dropped; when it is the stationary end, the line reads from edge direction ("takes the pole off the rope") and is published off the kernel, with no order against the take's line (RN-2). Building a relational verb-table bridge to fix that would contradict "the bridge grows no new members", and Expansion authors its own narration (AN-3). So the delivery work (captures, slots, RN-2's order, the crossing fix, fan-in retirement) moves into slice 3, after action ids, with Expansion as the first narration-unit author. Relational *establish* narration waits for the LLM Plan fallback, its natural author (AN-3 (c)).
- [ ] **Slice 3. Narration units on the attempt; Expansion's dissolves onto the kernel; fan-in retired.** Large; may ship as more than one commit, in the order of the sub-steps below.
  - [ ] **Action ids.** Mint at creation (Plan's templates, Expansion), carry through every copy method (`grounded()`, `withChallenges()`) and the JSON round trip; tests inject the generator or match `expect.any(String)` rather than pin random values.
  - [ ] **Presence on referents (AN-7 stage 1).** Optional `groundedPresence` beside `groundedId`: Grounding stamps it from the `ludicCache` bucket Identify matched through; Expansion stamps its dissolves' referents from the edge or chain endpoint. Carried through the JSON round trip.
  - [ ] **Narration units on `CommandAttempt`** (covers by action id, template, witness variants per AN-2, audiences as `(ref, phase)` per AN-7), through `toJSON`/`fromJSON`. Decide AN-4 (where a narration unit sits in slot order) and AN-6 (a covered action that was already satisfied). On commit (all-or-nothing after slice 0), the kernel delivers each narration unit in place of its covered actions' bridge copy; membership actions no narration unit covers keep the bridge copy, and its host-derived captures, while it exists. A relational action no narration unit covers narrates nothing: there is no relational bridge.
  - [ ] **Audience resolution at compile (AN-7 stage 2).** Presence -> room(s) resolver (extending `presenceAncestry.ts`'s walk to follow bindings), and `commitAttempt` emitting room-keyed capture steps before/after the covered actions, ids derived from (unit, ref, phase). The kernel's capture step does not change. Tests: an attempt with two moves delivers each unit's arrive line to its own audience (the old `capture:to` collision); a referent with no `groundedPresence` uses AN-7 (iii)'s default; a multi-room presence resolves to every room it reaches.
  - [ ] **Relational fragments onto the kernel.** `planRelationalEdgeTransfer` fragments gain slots (today `slots: []`, narration via `relationalEdges` -> facts -> fan-in); their captures come from the covering unit's audiences, so no relational-specific capture rule exists. `Object Relation Changed` facts are still emitted; only perception's narration use of them goes.
  - [ ] **Expansion authors its dissolves' narration.** `attemptActionsFromBoundaryOutcomes` adds one narration unit per dissolve it creates, from a fixed template over the dissolve's two `stableRefKey`s (e.g. "Tess frees the rope from the pole"; exact wording at implementation), worded from which end is the moved object, not from edge direction, with audiences declared on both refs, *before*. This is an author, not a bridge: slice 4 does not delete it.
  - [ ] **RN-2:** dissolve slots declared before the move's slot, pinned by a test on delivered order (`take the rope` when lashed: the dissolve's line, then the take's).
  - [ ] **Crossing:** a cross-shard relation's dissolve narrates to the room(s) whose rosters it touches, tested directly through an Expansion dissolve (no establish command exists to drive it). Also check slice 0's unverified duplicate-crossing refusal here.
  - [ ] **Retire the relational fan-in**: `objectManipulationPresentationFanIn.ts`, `objectManipulationPresentationLegAdapters.ts`, `publishObjectManipulationPresentation.ts`, `resolveRelationalPresentationLabels`, their tests, cluster store and subscriptions in `perception/`; correct [`perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md) and the follow-on row in [`messageOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md). Grep module paths, not only symbols (integration tests).
  - [ ] Tests with hand-built narration units for Plan-sourced actions (Expansion is the only producer until slice 4): a narration unit replaces its covered actions' bridge copy; an uncovered membership action in the same attempt still narrates its bridge copy, in slot order; a refused attempt delivers nothing; a narration unit with distinct witness variants for a move's two captures delivers each only to its own capture's roster (AN-2); AN-6's case behaves as decided.
- [ ] **Slice 4. Authoring narration units (payoff).** Decide AN-3 and wire the author.
  - [ ] **Payoff test, at the observable output:** `stuff the coins hurriedly into the pouch` and `tie the rope around the pole` each publish a `WorldMessage` whose text carries the player's verb and manner, to the captured audience. Assert on the published message, not on the narration unit. The `tie` half needs the LLM Plan fallback (relations have no deterministic route; peer relations come only from the LLM Plan fallback); if the fallback has not landed, this slice ships the coins half and the `tie` half moves with the fallback.
  - [ ] Mixed coverage: `take the rope` when it is lashed delivers the authored line for the take and Expansion's own line for the dissolve, in RN-2's order. The object-family bridge (`defaultTransferMembershipParts`, `objectMoveVerb`) is deleted here.
- [ ] **Slice 5. Failure narration.** Needs a contract amendment: a narrate path with no committed mutation and a live-roster audience (the [narrate-on-commit clause](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-is-presented-only-for-a-committed-mutation) forbids it today). Scope it once slices 3-4 have shipped; it may reduce to "no".
- [ ] **Slice 6. Durable docs; retire this plan.** Contract clauses for narration units (and that positions derives no copy) in `positions/AGENT.contract.md`; vocabulary (narration unit, covers) in `actions/AGENT.concepts.md`; code map in both `AGENT.implementation.md` files. Remove CA-4's forwarding row and slice 5 line in the command attempt plan. Grep inbound links to this file before deleting it.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement upcoming slices. When one ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| AN-1 | **Will narration units ever span attempts?** Representation settled: minted action ids are global by construction. Compound commands are one attempt, not a spanning case; cooperation, the one real spanning case, is deferred as a UI problem (2026-10-06). Forwarded to [`actions/AGENT.implementation.md` --- Shelved: compound commands and cooperative actions](../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#shelved-compound-commands-and-cooperative-actions). Gates nothing here. | --- | Shelved, forwarding row only |
| AN-2 | **Vantage: variants inside one narration unit, or separate narration units?** **Decided 2026-10-06: variants, on two axes.** (1) **Witness variants, keyed by captured audience** (AN-7 decides how a narration unit reaches its captures): each is delivered to that capture's roster. (2) **Role variants, per narration unit, not per capture**: at most one line per role (actor; later recipient, as in "Tess gives you the coins"), each delivered once to that character wherever they are, and that character is removed from every witness capture. A missing role variant means that character gets the witness line for their capture, which is today's behaviour. Roles stay off the capture because a capture says who was *there* (positional) and a role says how a recipient *relates to the event* (identity): the mover is in both a move's from and to captures by construction, an actor can be in no capture at all (acting on a non-present whole, a remote order), and a recipient shares a room roster with the witnesses. Roles come from the narration unit's own slots (the actor) and its covered actions' `stableRefKey`s (a recipient). Variants over separate narration units because every variant's validity is identical and only text and audience differ; separate narration units would let one audience's line drop while another's is delivered, and no case wants that. Building role variants is RN-1's work and stays deferred; slice 3 builds witness variants only, shaped so role variants add without re-keying. (This row first said "keyed by capture side"; leave/arrive belong to one compiled move, not to a narration unit.) | 3 | Decided (variants, two axes) |
| AN-3 | **Who authors a narration unit?** Candidates: (a) the **Parse** hop emits a third-person template with span slots; already paid for on every object-manipulation command, sees the words, but runs before Plan, so its narration unit covers the Plan-sourced actions of whichever attempt is selected, never Expansion's facilitating actions. (b) A **deterministic skeleton replay**: the skeleton is the verbatim command, so conjugating its leading text token and substituting short names keeps verb and manner at zero LLM cost; needs verb inflection, which is not a closed lexicon. (c) The **LLM plan fallbacks**, once they exist; only off the fast path. Not exclusive. **Expansion authors its own** (2026-10-06): with no positions-side floor, Expansion's facilitating actions are not "left to the default" under (a); Expansion writes the narration unit over each action it adds. So AN-3 decides the author of *Plan-sourced* actions only. Expansion's narration units are built in slice 3, as the first producer. | 4 | Open (Expansion's half decided) |
| AN-4 | **Where a narration unit sits in delivery order.** At its first covered action's slot, its last, or a slot of its own. RN-2's dissolve-before-move obligation constrains it; a narration unit covering both dissolves the obligation. | 3 | Open |
| AN-5 | **Which host(s) a relational action captures** (the surviving clause of the absorbed Phase 1). **Absorbed into AN-7 (2026-10-06):** a relational action's audiences are its narration unit's declared referents (subject, target), each resolved through its own presence to rooms, so an intra-host dissolve reaches one room and a crossing reaches both ends' rooms with no relational-specific rule. The non-present-whole case raised in the [abstraction-layers corpus](dataSource/positions/AGENT.abstractionLayers.corpus.planning.md) is AN-7's sub-point (ii). Forwarding row only. | --- | Absorbed into AN-7 |
| AN-6 | **Does a narration unit covering an already-held action still narrate?** Partly decided 2026-10-06 (slice 0): an action whose desired result already held at commit (the coins were picked up since the dry run) **refuses the whole attempt**, so no narration unit covering it can deliver. Nothing is left to decide for the attempt-level case. Still open for slice 3: whether a *covered* action's line can ever describe an act that did not happen, which now reduces to the already-held-at-**dry-run** window and any future no-op action kind. | 3 | Partly decided (2026-10-06), narration half open |
| AN-7 | **How a narration unit reaches its audiences.** **Decided 2026-10-06: declared by referent, compiled to a room; the kernel is unchanged.** Both earlier options were rejected as not general: (a) stamping steps with action ids ties audiences to how one op compiles; (b) positional names ("the actor's room before commit") make every author reason about hosts. **Declaration:** a narration unit names each audience as **(ref, phase)**, where ref is one of its own `stableRefKey` slots (or the actor) and phase is *before* or *after* its covered actions. Authors reason about the things in the sentence, never about hosts. **Two-stage resolution.** (1) **Referent -> presence, upstream**, because the perspective exists only there and is lost after: Grounding stamps an optional `groundedPresence` beside `groundedId`, from the `ludicCache` bucket Identify saw the object through (`roomObjectCatalogForCharacter` flattens it away today); Expansion stamps its own referents from the edge it walked (same presence as the subject within one host; a crossing's `PRESENCE#`-tagged chain endpoint, as `findRelationalChain` already resolves). Optional upstream, required only where an audience is resolved. (2) **Presence -> room(s), at compile in `commitAttempt`** (positions-side, against fresh graphs, like the rest of the commit-time recheck): walk up from the presence node (`fromHostId` locates the parent's shard; the parent binding whose cover is `Full` or holds `{ host, presence }` is the next step) until rooms, which have no presence nodes. This extends the walk in `presenceAncestry.ts` to follow bindings and return rooms. *before* resolves from the referent's presence; *after* resolves from the destination host, since a binding a move mints does not exist at compile. The result is a set of rooms: a `Full` cover or a multiply-covered binding (PN-22) legitimately spans rooms. **Kernel:** `commitAttempt` emits ordinary `capture { hostId: room, captureId }` steps, placed before or after the covered actions, and the unit's narrate steps point at them; the kernel's capture step stays "this room's roster at this point in the walk". Capture ids derive from (unit, ref, phase), which also fixes the two-moves `capture:to` collision. Action ids remain, for what a unit covers and where before/after fall in the step order. Navigation (no attempt, out of scope) would reproduce today's captures under the same resolver, since a character has exactly one presence. **Open sub-points:** (i) compile-time resolution reads ancestor graphs outside the commit footprint, so a container moved between compile and commit gives a stale audience; same class as the contract's "no world-legality re-check under lock" gap, leaning accept rather than lock the ancestor chain. (ii) A non-present whole (moonbase computer) resolves in the membership sense to every room holding a part, which over-notifies; apprehensibility is declared, not derivable. Player-named referents are narrowed by their perspective; an Expansion referent on a multi-room whole needs a rule (candidate: only rooms the actor's presence reaches). (iii) Default when `groundedPresence` is absent: the thing's only presence, else the one sharing the actor's room. | 3 | Decided (sub-points (i)-(iii) open) |

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/ \
  dataSource/perception/ \
  dataSource/actions/commandAttempt/ \
  dataSource/messageOrchestration/

# Full suite before marking a slice done --- integration tests are NOT covered by tsc
npm run test -- --watchAll=false

npx tsc --noEmit
```

Grep checks, from the repo root:

```bash
# Narrate and capture steps are constructed only inside the compiler.
grep -rn "kind: 'narrate'\|kind: 'capture'" --include="*.ts" lambda/ephemera \
  | grep -v node_modules | grep -v "\.test\.ts" \
  | grep -v "manipulation/kernel/compile/" | grep -v "manipulation/kernel/kernelStep.ts"

# After slice 3: the relational fan-in is gone in its entirety
grep -rn "ObjectRelationalPresentationFanInCluster\|objectManipulationPresentationClusterFromLeg" \
  --include="*.ts" lambda/ephemera | grep -v node_modules
```
