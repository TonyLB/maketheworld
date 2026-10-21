# Position-qualified referents: telling the rope in the room from the rope on the table

**Status: opened 2026-10-21; PR-1 to PR-5 decided by the user the same day. Slice 0 (the corpus, [`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md)) done 2026-10-21, which settled PR-1's `extendedBindingUuid` question (subsume) and sharpened PR-2 and PR-4. Slice 1 (the `view` field) shipped 2026-10-21. Next step: [Slice 2](#recommended-order).** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md), with a corpus-first opening because the open decisions outnumber the steps (see [Shape of this plan](#shape-of-this-plan)). It is one slice of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), not a new rung. It exists because three things deferred by [`AGENT.connectedTo.planning.md`](../positions/AGENT.connectedTo.planning.md) wait on it ([Why now](#why-now)).

## Goal

Let a command, and the pipeline behind it, tell apart **one object seen in several positions**: the rope in the room, the same rope on the table, or both. Today a referent names an object; an object that has been extended or spread has several bindings, and nothing between parse and commit chooses among them.

**Payoff, stated at the observable output:** with a cloth draped over a table (one binding under the room, one under the table), `get cloth` does something the player can predict and the game can narrate. Where the actor's own position does not pick one part (PR-2), the command asks, with options naming the positions ("the cloth on the table", "the cloth in the room"), and the answer moves that part. This iteration reaches the part only by asking (PR-3); typing `get the cloth on the table` to name it is a follow-on task.

## Why now

Three deferrals in ISS8310 stop at the same missing capability:

- **What does it mean to take a spread object?** The user deferred this on 2026-10-21 and the take rule stayed a shim: a take lifts every binding (`alsoLeaving` in `commitAttempt.ts`, the multi-host exception and `multiPresent` in `attemptCandidates.ts`, the `anyHost` fallback in `buildReferentAssignment.ts`). The ConnectedTo plan's Slice 5 holds those deletions until a take has a meaning to replace them.
- **Which part a thing lands on.** A destination holding several bindings takes the mover on the deepest part, a first-iteration hack the user called out as leading toward *ask the player* once a command can name a part (`destinationBindingForMove`, `resolvePresenceMoves.ts`).
- **Slice 4 item 3, preconditions that judge the view.**

## What exists (read from code and plans, 2026-10-21)

- **One handle per object, naming every place it is seen.** `ludicCacheRoomObjectHandles` returns one handle per object with `presence`, every binding that holds it ([`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts)); the catalog entry carries it ([`roomObjectCatalogForCharacter.ts`](../../../../../lambda/ephemera/dataSource/actions/roomObjectCatalogForCharacter.ts)); `stampCandidateReferents` copies it onto the referent as `groundedPresence`. The header says the pool is "exhaustive, not bucket-filtered" by deliberate choice and that choosing *which* thing a phrase means is the caller's perspective's job.
- **`groundedPresence` has two jobs.** `planStep.ts` defines it as "every place a referent is seen, so an audience walks up from all of them to every room that can see the thing change". The commit side also reads it to narrow a mover (`moverGroundedPresence` in `resolvePresenceMoves.ts`), which is a different meaning: *the part I mean*, not *everywhere it is visible*. ISS8310 Slice 4 added `extendedBindingUuid` rather than overload it further; Slice 1 of this plan replaced that with the general `view` field.
- **Same-text referents are keyed by occurrence, not by position.** BD-23 (shipped 2026-07-19) lets "put bench on bench" resolve to two distinct objects. It does not cover one object at two positions; the closest it gets is the `stableRefKey` per occurrence, which this plan can reuse.
- **Asking the player exists in part.** The persistent command row, `referentAnswers` keyed by `stableRefKey`, the resolution order agreed 2026-10-09 (scan validity, choose the plan, choose identities one referent at a time) and `Consult` all ship. [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) "Shelved: asking the player" names the open pieces, among them option labels and `{ objectSpan, qualified }` **qualified referents**, which "do not exist" yet. That shelf is this plan's seed.
- **The catalog has no position axis.** Two cups, one on the table and one on the floor, are two objects and already ask ("which cup"). One rope with two bindings is one handle, so nothing asks.

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../../AGENT.md)** once, for how implementation plans work.
2. **Testing:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the command authority. From `lambda/ephemera/`: `npm run test -- --watchAll=false`. Slice 1 widens a shared referent type, so run the full suite (`*.integration.test.ts` files sit outside `tsc`), after `npm run test -- --clearCache` once.
3. **Baseline before any edit:** the full ephemera suite green, plus `npx tsc --noEmit` in `lambda/ephemera/`.
4. **Read the primer, [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), section 4** (presence, covers, bindings): a view is a set of bindings.
5. **Read the corpus, [`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md):** facts F1 and F2, then the requirements table (R1--R10), which maps each case onto a slice.
6. **Read the ConnectedTo plan's [instruction set](../positions/AGENT.connectedTo.planning.md#the-instruction-set-extend-contract-and-a-move-of-a-view)** (extend, and a move of a view) and its paused Slice 4 item 3 and Slice 5, which this plan releases.
7. **The harness to reuse:** [`objectSpreadPayoff.integration.test.ts`](../../../../../lambda/ephemera/dataSource/objectSpreadPayoff.integration.test.ts). Its catalog entries carry no `presence`; tests that turn on views should build the catalog with `ludicCacheRoomObjectHandles` and `getHeldInventoryCatalogForCharacter`, as the Slice 0 probes did (corpus, *How the baseline was taken*).

## Shape of this plan

An implementation plan with a corpus-first Slice 0 (its cases are in [`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md)), like [OD-6](../positions/AGENT.connectedTo.planning.md#open-decisions-implementation--plan-only) in the ConnectedTo plan. The decisions below are hypotheses for the corpus to test, not settled rules. If Slice 0 shows the questions outnumber the buildable steps, convert to the design-stage variant ([`AGENT.designVariant.md`](../../../../AGENT.designVariant.md)) at that point.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. The corpus.** In [`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md). Worked cases, each with: the world (objects, bindings, parents, `ConnectedTo` edges), the command, the readings a player could mean, what each should do, and how it should be narrated. No code.
  - [X] The user's three readings of **one rope, two positions**: (a) the part in the room, (b) the part on the table, (c) both. For each of `get`, `drop`, `put on`, `look`.
  - [X] **Draped cloth with a plate on it:** `get cloth` (and what happens to the plate), `put cup on cloth` (the deepest-part hack's case). Takes of the hanging part, the table part and the whole, each recorded as what PR-5's rule does, unreal or not.
  - [X] **A rope across two rooms:** `get rope` from either end; `drop rope` while holding one end.
  - [X] **Two cups, one in the room and one on the table:** already two objects, kept as the control. The corpus must show where "the cup on the table" works today.
  - [X] **A command that names a position**: "get the cloth on the table", "put the plate on the part of the cloth over the table". Only what it does in this iteration (PR-3: no phrase parsing), so the follow-on task starts from a recorded baseline.
  - [X] Read the requirements off the corpus, check them against the decided [PR-1](#open-decisions-implementation--plan-only) to PR-5, and settle PR-1's `extendedBindingUuid` question.
- [X] **Slice 1. A referent can carry a view.** The representation settled by PR-1: a list of the referent's own binding ids (corpus R1), which subsumes `extendedBindingUuid` (deleted here; its consumers read the view plus the attempt's earlier extend step, `viewMintedByExtend`); absent means the whole object, so every existing path behaves as today (the shim stays, now explicitly the default). Producers and consumers of `groundedPresence` are separated by meaning, with the audience reading unchanged. Pure type and plumbing, no new behavior.
- [ ] **Slice 2. The catalog offers views.** Needs each own binding paired with its parent buckets, which the catalog's flat `presence` set cannot give (corpus F1, R2), and PR-2's predicate as corpus R3 states it. Identify can offer an object's positions as distinct readings when its bindings differ in where they sit, and says which are alike (two bindings under the same parent are one reading). Nothing asks yet: the default for an unqualified referent is PR-2's rule.
- [ ] **Slice 3. Asking the player.** Where PR-2's rule cannot pick one view, the command holds on a referent question through the existing persistent command row, with option labels that name the position ("the cloth on the table", "the cloth in the room", "both"); the same label source serves two same-named objects (corpus C4, R5). This is the first iteration of "ask the player", and it needs no phrase parsing.
- [ ] **Slice 4. Consumers read the view.** `take`, `drop`, `put on` and `look` act on the named view. The `anyHost` fallback, `alsoLeaving` and the multi-host take, and the `multiPresent` refusal retire here (ConnectedTo Slice 5 then deletes the rest of the spread code), and the deepest-part hack gives way to a question. This is ConnectedTo's Slice 4 item 3.

## Not in scope

- **Naming a position by phrase** (PR-3, a follow-on task): parse and grounding handle "the X on the Y" as a qualifier on the referent, not a destination. Shelved in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) when this plan finishes.
- **Contraction and OD-6** (ConnectedTo's own open decision); this plan only needs a take to leave the world in a state that decision covers.
- **Features and Characters as referents** (the CPG-5 remainder).
- **Pulling a rope along its edge** (`pull rope`, objectManipulationIterations row 7): the tug read.
- **Takes of a part that read as unreal** (PR-5, a later iteration): for example, taking the table part of a draped cloth carries the plate on it into the actor's hands, and a short cloth held by its hem stays spread across the room. Telling apart objects that can stay spread across a distance (rope) from objects that can't (cloth), and deciding what happens to things resting on the part taken, is a new axis on the object. Slice 0 records what each case does in this iteration as the baseline. Shelved in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) when this plan finishes.
- **A general spatial language** ("behind", "next to the second table"). Positions here are the bindings an object already has.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **PR-2** | **What does an unqualified referent mean when its object has several positions?** *Decided 2026-10-21 (user):* the actor's own position when it is unique (the rope end in my room), else ask. The shim's "every binding" stays only as the default until Slice 4 lands. Checked against the corpus 2026-10-21: an own binding is *at the actor's position* when its parent walk reaches the actor's room without passing through another room; for a held object, the held binding. One such binding is taken unasked (the rope across rooms); several ask (the draped cloth, the Goal's payoff) ([corpus R3](AGENT.positionReferents.corpus.planning.md#requirements-read-off-the-corpus)). | Slices 2--4 | Decided |
| **PR-3** | **Does the first iteration let a command name a position by phrase, or only ask?** *Decided 2026-10-21 (user):* ask only, as the smaller first iteration. Naming by phrase is a follow-on task ([Not in scope](#not-in-scope)); a phrase ("on the table") competes with the destination reading of the same words ("get the cloth on the table" versus "put the cloth on the table"), which is a parse question. | --- | Decided |
| **PR-4** | **What is reading (c), "both"?** *Decided 2026-10-21 (user):* one move of the whole, as today's take does. From the corpus 2026-10-21: "both" is offered as an option whenever a view question is asked, since otherwise the whole-object take (the reset the take-rule shelf relies on) needs two commands ([corpus R5](AGENT.positionReferents.corpus.planning.md#requirements-read-off-the-corpus), C3). | Slices 3--4 | Decided |
| **PR-5** | **What does a take of one part of an extended object leave behind?** *Decided 2026-10-21 (user):* one rule for every extended object, rope or cloth. The object stays extended with the actor holding the part taken, and the `ConnectedTo` edge stays. The take is an ordinary move of that part's binding, so whatever rests on the part follows today's move rules. This is a crude first iteration, and the user accepted that. Where it reads as unreal (taking the part of a draped cloth that holds a plate, or walking off with the hem of a short cloth), the case is shelved for a later iteration ([Not in scope](#not-in-scope)) rather than solved here. | Slice 4 | Decided |

## Verification

Per slice, from `lambda/ephemera/`: `npx tsc --noEmit` and `npm run test -- --watchAll=false`, the full suite (`*.integration.test.ts` files sit outside `tsc`; run `--clearCache` once first, per [`AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md)).

- Slice 1: `grep -rn "groundedPresence" lambda/ephemera --include='*.ts'` lists each reader and writer with its meaning (audience or part) recorded in Progress.
- Slice 4: `grep -rn "anyHost\|alsoLeaving" lambda/ephemera --include='*.ts'` returns nothing, and the spread payoff in [`objectSpreadPayoff.integration.test.ts`](../../../../../lambda/ephemera/dataSource/objectSpreadPayoff.integration.test.ts) asserts a take of one part at the observable output (`look` in both rooms).

## Progress

| Slice | State | Files touched (dependency tag) |
| --- | --- | --- |
| 0 | Done 2026-10-21 | Corpus file only ([`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md)); no code. Probes were run and deleted. |
| 1 | Done 2026-10-21 (full ephemera suite and `tsc` green; +5 tests). **Design as built:** `ObjectSpanReferent.view?: EphemeraPresenceNodeId[]` replaces `extendedBindingUuid`; `matchSpreadTemplate` stamps `[PresenceKey(presenceUuid)]`; `viewMintedByExtend(object, steps)` (`plan/planStep.ts`) is the one reader of "does this binding exist yet", used by the spread describer and the `expandAndAdjudicateCandidates` skip in `attemptCandidates.ts` (new `planStepsOf` helper); `commitAttempt` takes `moverBinding` from a one-binding view. A wider view is representable with no consumer (Slice 4). `GraphNodeReferent` not widened. **`groundedPresence` classification:** *audience* readers: `presenceRooms.ts` (`roomsForReferent`), `commitAttempt.ts` `resolveAudienceRooms`/`referentGroundingByRef`, `presenceSubGraph.ts` (bucket walk), `planStep.ts` doc; *part* readers (still reading `groundedPresence`, the shim, to move to `view` in Slice 4): `commitAttempt.ts` `moverGroundedPresence`/`toGroundedPresence` and `buildExtendFragment`, and `resolvePresenceMoves.ts` args; writers: `stampCandidateReferents.ts` (from the catalog) and `graphNodeRef`. | `plan/planStep.ts` (+test), `plan/matchSpreadTemplate.ts` (+test), `plan/planSkeleton.test.ts`, `attemptCandidates.ts`, `stampCandidateReferents.test.ts`, `positions/manipulation/commitAttempt.ts` (+test), `objectSpreadPayoff.integration.test.ts`; `actions/AGENT.contract.md`, `actions/enrich/objectManipulation/AGENT.md`, `positions/AGENT.contract.md` |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |

## When this plan finishes

The view representation and the take/put rules move into [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md) and [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md); the "Shelved: asking the player" bullets this plan builds are removed from [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), and the phrase-naming follow-on (PR-3) is shelved there with Slice 0's baseline for it. PR-1's bridge-state question (what `groundedPresence` still provides once richer referents reach every consumer) is shelved there too, along with PR-5's unreal takes and Slice 0's baseline for them. The ConnectedTo plan's Slice 4 item 3 and Slice 5 hold are released. Then this file and its corpus ([`AGENT.positionReferents.corpus.planning.md`](AGENT.positionReferents.corpus.planning.md)) are deleted, after a grep for inbound links; the corpus's C5 (phrase naming) and C2 (unreal takes) baselines go to those shelves first.
