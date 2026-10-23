# Qualified referents: "the cup on the table", "put cup on saucer on table"

**Status: opened 2026-10-23; QR-1 and QR-2 decided by the user the same day. Slice 0 is in progress: the `/test parse` harness is built and the Parse baseline is in [the corpus](AGENT.qualifiedReferents.corpus.planning.md). Next step: repoint the plan to a deterministic first iteration (the user's goal, 2026-10-23), then write the worked cases against it.** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md), with a corpus-first opening like positionReferents'. It is rung 6 of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), and it supersedes that rung's earlier plan (deterministic fast-path improvements, BD-24, deleted 2026-10-23); what it kept from BD-24 is in [What this replaces](#what-this-replaces).

## Goal

Let a command name **which** object, or which part of one, by **where it is**: "get the cup on the table", "get the cloth on the table", "get bag from table". Let a command that stacks such phrases ("put cup on saucer on table") be read every way its words allow, and let the world decide among the readings.

**Payoff, stated at the observable output:**

- Two cups, one on the table and one on the floor: `get the cup on the table` picks up that cup without asking.
- A cloth draped over a table: `get the cloth on the table` takes the table part without asking (today it can only be reached by being asked).
- One bag, on the floor: `get bag from table` is refused with a line that says why.
- `put cup on saucer on table` does what the world allows: if the cup sits on the saucer, the cup moves to the table; if the saucer sits on the table and the cup is elsewhere, the cup moves to the saucer.

## Why now

The seed is the shelf "Shelved: asking the player" in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), left by positionReferents (retired 2026-10-21). Three of its bullets stop at the same missing capability:

- **Naming a position by phrase.** A part of a spread object is reached only by being asked. The bullet names the parse question (a phrase such as "on the table" competes with the destination reading of the same words) and says a label source that qualifies by position is the shared fix for two same-named cups too.
- **Option labels for same-named objects.** An object with no parent to name reads by its bare name "until qualified referents (`{ objectSpan, qualified }`) exist".
- **One object under two keys is never a candidate.** It waits for a command that names two parts of one thing, which cannot be written until a phrase can name a part. This plan makes that command writable; it does not build the change ([Not in scope](#not-in-scope)).

## What exists (read from code, 2026-10-23)

- **Two routes build a skeleton; attachment is not done on either.** The deterministic fast path (`maybeDeterministicManipulationIntent` in [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)) claims every `take`/`drop`, and claims a `get` only when the whole tail is a room label. It makes the whole tail **one** span, so a qualifier is folded in; this is the shelf's `take` baseline. Everything else reaches the Nova Micro Parse ([`parse/buildParsePrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/parse/buildParsePrompt.ts)), which emits a flat skeleton and, as probed 2026-10-23, **always splits** a qualifier into its own span ([corpus](AGENT.qualifiedReferents.corpus.planning.md), O1).
- **The templates are flat and fixed-length.** [`matchContainmentTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchContainmentTemplate.ts) and `matchSpreadTemplate.ts` match exactly four tokens, `matchLookTemplate.ts` exactly two. [`matchMembershipTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchMembershipTemplate.ts) claims the leading verb and ignores any tail ("take X off Y"): its comment says "the tail only narrows which X is meant", but nothing implements that narrowing. So a three-span `put` matches no template.
- **"get bag from table" is refused before any of this matters.** `compileAttemptsFromSkeleton`'s BD-20 arity gate refuses a membership attempt when the skeleton has more than one `objectSpan` (`complexErrorMessage('multiObject')`).
- **Several readings already have a pipeline.** `planSkeleton` returns every template's attempt (their union), and `compileAttemptsFromSkeleton` gates each attempt, pools the survivors into one `proposeAttemptCandidates` call, one dry run and one `selectPlanTuple`. So one attempt per bracketing rides the existing loop.
- **Asking between readings is not built.** A Select needs every alternative to be a distinct referent assignment. Two bracketings of "put cup on saucer on table" assign the same objects to the same keys, so they cannot be asked today; the attempt-choice question (`selectedAttempt`) has no producer (shelf: "Only referent questions are asked").
- **Where things sit is already at the pool site.** Each catalog entry carries `placement`, folded from the room's ludicCache; [`objectViews.ts`](../../../../../lambda/ephemera/dataSource/actions/objectViews.ts) reads it (`readingsOf`, `readingsHere`, `defaultReading`, `placementHostsOfView`). `proposeAttemptCandidates`' `viewChoicesFor` turns it into the readings a referent can mean, stamps a unique one, and asks among several. A qualifier needs no new world read.

## What this replaces

The earlier rung-6 plan (BD-24, named 2026-07-19, never started) was written before `placement` and `view` existed, and before any command was blocked on it. Its gate ("do not begin until a concrete case demands it") is met by the shelf bullets above.

- **Kept:** templates compose an object phrase once (`ObjectPhrase = OBJECTSPAN (PREP ObjectPhrase)?`) rather than listing whole-command combinations, which grow multiplicatively with each optional phrase. The matcher reports structure only and reads no world state.
- **Replaced (QR-2):** one level of attachment, always to the nearest preceding span. That yields only "put cup on (saucer on table)" and can never produce the "(cup on saucer) on table" reading.
- **Replaced (QR-1):** "the verb decides whether an attached phrase is an argument or a modifier." The question is smaller: does the phrase restrict state the system already knows, or fill a destination?
- **Dropped:** emitting a `ContainedByAssertion` for "get bag from table" (BD-14's remaining gap). A take's source is derived (`currentHost(subject)`, or the hosts the referent's view sits under), so a source phrase restricts a value rather than supplying one, and the view filter does the job. An assertion would differ only by checking when the step runs rather than when the command starts, which matters only for compound commands; that note is shelved under "Shelved: compound commands and cooperative actions".

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. The corpus.** A sibling file, [`AGENT.qualifiedReferents.corpus.planning.md`](AGENT.qualifiedReferents.corpus.planning.md). Worked cases, each with: the world (objects, bindings, parents), the command, what Parse emits today, the readings the words allow, what each reading should do, and the line the player sees.
  - [X] **`/test parse` harness** (in-app, per the user 2026-10-23): runs the live Parse stage and then every Plan template over the corpus fixtures or a quoted command, and reports to the caller. It bypasses the deterministic fast path, so it shows the LLM route only. Operator usage in [`actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md).
  - [ ] **Two cups**, one on the table and one on the floor: `get the cup on the table`, `get the cup from the table`, `look at the cup on the table`.
  - [ ] **Draped cloth** (one binding under the room, one under the table): `get the cloth on the table`, `get the cloth from the table`.
  - [ ] **One bag, on the floor:** `get bag from table` (QR-6).
  - [ ] **Cup, saucer, table:** `put cup on saucer on table` with (a) the cup on the saucer, (b) the saucer on the table and the cup in hand, (c) both, (d) neither. Record which readings the dry run already separates and which survive together (QR-5).
  - [ ] **Tails today's membership template ignores:** `take cup off saucer`, `take coin out of box`.
  - [ ] **A qualifier that is also a destination's:** `put the cup on the table in the box` (the qualifier on the subject versus a qualified destination).
  - [ ] **The prepositions:** for each of `on`, `in`, `from`, `off`, `out of`, `onto`, `into`, `under`, whether it can restrict, fill a destination, or both. Only `On` and `In` are relations `placement` can answer; record what the others do.
  - [X] Run Parse on every command so QR-3 is settled from what it emits, not from the prompt's wording. Two `/test parse` runs, 2026-10-23; the corpus's [Parse baseline](AGENT.qualifiedReferents.corpus.planning.md#llm-route-nova-micro-parse), with the fast path's skeletons read from code.
  - [ ] Read the requirements off the corpus; settle QR-3 and QR-4, and the depth cap in QR-2.
- [ ] **Slice 1. Spans and the qualified referent.** Parse emits the object a phrase names as its own span (QR-3), and a referent can carry a qualifier (QR-4). Nothing reads the qualifier yet: every path behaves as today.
- [ ] **Slice 2. The recursive matcher.** The containment, spread, look and membership templates match an object phrase rather than a single span, and Plan emits one attempt per bracketing (QR-2). The BD-20 arity gate counts argument spans only, so a qualified take is no longer `multiObject`. Membership's ignored tail becomes the subject's qualifier.
- [ ] **Slice 3. Qualifiers narrow candidates.** `proposeAttemptCandidates` applies each qualifier to its referent's identity pool and to `viewChoicesFor`, reading `placement`: a cup not on the table is no candidate for "the cup on the table", and only the cloth's table binding is a reading of "the cloth on the table". The player is asked only when narrowing leaves more than one reading. Option labels use the qualifier. A qualifier that matches nothing behaves per QR-6, and two surviving readings with the same objects per QR-5.
- [ ] **Slice 4. Payoff and graduation.** A payoff test per [Goal](#goal) bullet, ending at what the player sees. Rules into the actions contract; the three shelf bullets above are removed or rewritten; this plan's leftovers are shelved; this file and its corpus are deleted after a grep for inbound links.

## Not in scope

- **Two parts of one object as two referents** ("tie the rope end on the table to the rope end in the room"): comparing (id, view) rather than id in `proposeAttemptCandidates`. This plan makes the command writable; the change waits for the user to want it.
- **Named parts** ("the end of the rope", "the part of the cloth over the table"): see "Shelved: wholes with named parts" in [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).
- **Spatial language the bindings do not hold** ("behind the door", "the second table", "next to the lamp").
- **Characters as qualifiers** ("the cup in Tess's hands"): the catalog walks only objects (the CPG-5 remainder).
- **Open phrasing.** Prepositions stay a closed set; a skeleton outside it defers to the LLM fallback.
- **Checking a qualifier again when a later action runs** (compound commands): shelved, see [What this replaces](#what-this-replaces).

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **QR-1** | **What does a phrase attached to an object mean?** *Decided 2026-10-23 (user):* a phrase that describes where something is now ("on the table", "from the table") is a **qualifier**: it restricts which object, and which of its bindings (`view`), a referent means, read from `placement`. A phrase that names where something goes ("put cup on table") is an **argument**, the destination. The preposition is a hint, not a role: "from" can only restrict, "on" and "in" can do either. The verb does not decide; "get bag from table" and "get the bag on the table" are the same filter. | Slices 1--3 | Decided |
| **QR-2** | **How are attachments enumerated?** *Decided 2026-10-23 (user):* the deterministic matcher attaches recursively and enumerates every bracketing as its own Plan attempt; the world (dry run, then selection) chooses. BD-24's one-level cap and nearest-preceding attachment are retired. Still open: a depth cap (bracketings grow quickly with each phrase; harmless at three spans). | Slice 2 (cap: Slice 0) | Decided; cap open |
| **QR-3** | **Does Parse split a qualifier into its own span?** *LLM route, probed 2026-10-23:* yes, always, chains included (corpus O1), so the prompt needs no change for it. Its article handling (O2) and `out of` (O3) are noise a closed preposition set must absorb. *Fast path, read from code:* no. `take`/`drop`, and a `get` whose whole tail is a room label, fold the qualifier into one span. Still open: how the fast path splits (the repoint's first question). | Slice 1 | LLM route answered; fast path open |
| **QR-4** | **How is a qualifier represented?** The shelf's name is `{ objectSpan, qualified }`. A candidate shape: the qualifier is a relation (`On` / `In`) plus the qualifying referent by `stableRefKey`, which may itself be qualified. Where it lives (on the `objectSpan` referent, or beside the attempt) is open. | Slice 1 | Open |
| **QR-5** | **What happens when two readings survive with the same objects?** Either ask (the first producer of the attempt-choice question, `selectedAttempt`, with labels from each reading), or prefer one by a fixed rule. Slice 0's cup-saucer-table cases show how often the dry run already separates them. | Slice 3 | Open |
| **QR-6** | **What does a qualifier that matches nothing do?** Candidate: refuse with a line naming the qualifier ("You don't see a bag on the table."), rather than ignoring the qualifier and taking the bag. | Slice 3 | Open |

## Verification

Per slice, from `lambda/ephemera/`: `npx tsc --noEmit` and `npm run test -- --watchAll=false`, the full suite (`*.integration.test.ts` files sit outside `tsc`; run `npm run test -- --clearCache` once first, per [`AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md)). Baseline before any edit: the same two commands, green.

- Slice 1: re-run `/test parse`; every qualifier is still its own span. The existing template and Parse tests pass unchanged apart from the prompt's examples; no consumer reads the qualifier (`grep -rn "qualif" lambda/ephemera/dataSource/actions --include='*.ts'` lists only the type, Parse and its tests).
- Slice 2: `npm run test -- --watchAll=false dataSource/actions/enrich/objectManipulation/plan/` covers each bracketing of a three-span `put` and the qualified take.
- Slice 4: the payoff tests assert on the player's line and the world after commit, not on attempts.

## Progress

| Slice | State | Files touched |
| --- | --- | --- |
| 0 | In progress: harness built; Parse baseline recorded; worked cases wait for the repoint | `actions/discriminateIntent/objectManipulationParseTestSlashCommand.ts`, `parseObjectManipulationParseTestSlash.ts` (+ test), `deterministicChecks.ts` (+ test), `actions/objectManipulationParseHarnessFixtures.ts`, `actions/actionHandlers/runObjectManipulationParseHarness.ts` (+ test), `actions/baseClasses.ts`, `actions/index.ts`, `plan/planSkeleton.ts` (`matchPlanTemplates`), `actions/AGENT.md`, `actions/AGENT.implementation.md`, `parseCommand.ts` (doc comment), the corpus |
| 1 | Not started | --- |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |
