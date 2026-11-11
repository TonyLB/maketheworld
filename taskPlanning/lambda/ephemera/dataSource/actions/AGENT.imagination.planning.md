# Imagination: the generating family's asks, read by hand

**Status (2026-11-11): written; nothing built.** Opened from the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, when the play-by-play plan took its exit (c) ([trail](AGENT.oracleLoop.discussion.planning.md#the-imagination-answers-the-oracles-asks-the-play-by-plays-exit-c-2026-11-11)). That plan's drafting loop found that the play-by-play is one ask of a loop, not a stage: the orchestration layer asks, and the imagination answers one focused ask at a time. "More loops of a process we can _create_ are better than fewer loops of a process that will elude us" (user, 2026-11-11). **Next: step 1,** the rename and the ask as an input.

The imagination is the **family of generating prompts**, beside the oracle, the family of judging prompts (user, 2026-11-11). What the oracle loop plan called the improvisation engine is one of its asks: "propose a filler for this slot". This plan builds the asks one at a time on the piece probe's reading mode, starting with "more detail" from the play-by-play's draft 10. Composing the asks with the oracle's pieces is the composition probe's work, not this plan's.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the stages (a guess), the seam ledger and the corpus. This plan holds one episode. What it shows about a guess goes **up** to the parent's seam ledger.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [Slice 4.5 rows](AGENT.oracleLoop.planning.md#recommended-order), the [subsystem map](AGENT.oracleLoop.planning.md#subsystem-map), [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) and the [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger), newest rows first. The vocabulary (improvement request, improvisation, stretch, slot) is in [The design](AGENT.oracleLoop.planning.md#the-design).
2. Read the trail's [The imagination answers the oracle's asks](AGENT.oracleLoop.discussion.planning.md#the-imagination-answers-the-oracles-asks-the-play-by-plays-exit-c-2026-11-11), then [A stretch is a judgment of an improvisation](AGENT.oracleLoop.discussion.planning.md#a-stretch-is-a-judgment-of-an-improvisation-2026-11-08): the imagination proposes, and only the oracle prices.
3. Read the play-by-play's record, which is this plan's history: [`oracleLoopDrafts/playByPlay/iterations.md`](oracleLoopDrafts/playByPlay/iterations.md), its [disposition](oracleLoopDrafts/playByPlay/iterations.md#disposition-at-the-play-by-play-plans-exit-c-2026-11-11) first; then [`8.notes.md`](oracleLoopDrafts/playByPlay/8.notes.md) (the user's loop sketch, the problems bucket), [`9.notes.md`](oracleLoopDrafts/playByPlay/9.notes.md) and [`10.notes.md`](oracleLoopDrafts/playByPlay/10.notes.md), and [`10.txt`](oracleLoopDrafts/playByPlay/10.txt), ask 1's starting draft.
4. Read [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), the play-by-play's findings included, and the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) with [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece).
5. Read the code it builds on:
   - the probe: [`oraclePieces/`](../../../../../lambda/ephemera/calibration/oraclePieces/): `oraclePiece.ts`, `readPiece.ts`, `handlePieceProbe.ts`;
   - the piece it renames, [`playByPlay.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/playByPlay.ts), and its tests;
   - the oracle probe's cases, [`oracleCases.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/oracleCases.ts), whose requests are the intents and whose candidates' steps are the actions.
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

The parent's [inherited premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled) hold, with their standings. Also:

| Premise or guess | Standing | What this plan can show |
| --- | --- | --- |
| **One judgment per call, with loops, filters and joins in code** (user, 2026-11-10) | Direction (user's call) | |
| **A generator is graded by hand** (user, 2026-11-10): each reply is read against a rubric written before the batch, and code checks only the form | Principle (user) | |
| **Micro is the target** | Principle (user) | |
| **Two families:** the oracle judges and the imagination generates (user, 2026-11-11). The test for a prompt (mine): it picks from a closed answer set (an answered piece, the oracle's), or produces something to read (a read piece, the imagination's) | Direction (user's call); the boundary a guess | Whether every ask stays a generator, and whether anything lands on neither side |
| **The improvisation engine is one of the imagination's asks** (user, 2026-11-11): the orchestration layer asks it to propose a filler for a slot ("a cloth, for wipe [table1]"), and the oracle judges what comes back, the stretch included. The imagination proposes; only the oracle prices (trail, 2026-11-08) | Direction (user's call) | |
| **A possible problem is a deferral** (user, 2026-11-11). The imagination flags what might be a problem and asks whether to treat it as one. The oracle classifies it, and if it is, asks for mitigations. So a flag decides nothing, and an over-flag costs an oracle call, not a wrong answer | Direction (user's call) | How many flags a reply raises that the oracle would throw away, and what that costs a round |
| **The scene is shown in full; possible problems get their own list** (user, 2026-11-11), so the method can be written the ordinary way | Observed for ask 1 on Micro (batch 9: OC-6 and OC-20 from 0 of 3 to 3 of 3; batch 11: 2 of 3 and 1 of 3 plus 2 partly) | Whether it holds on every ask |
| **The intent is the original full command,** given, never derived, and carried unchanged through the rounds (user, 2026-11-11) | Direction (user's call) | |
| **Problems are what work against the intent. Collateral consequences are listed,** not flagged, and the oracle family judges them later, perhaps highlighting them as undesirable (user, 2026-11-11: "Yes, they get highlighted, but No it's not by the imagine engine") | Direction (user's call) | Whether Micro can keep the two apart in the other-things ask |
| **The asks are a small closed set:** more detail; an alternate method; what happens to the other things; a mitigation; a filler for a slot (mine, from the user's loop sketch and the parent's improvement requests). Methods and facts are two kinds, as the parent's method dial keeps them apart (JF-15) | Guess | Whether a sixth ask turns up, or two merge |
| **A prompt per ask, over a shared core assembled by code** (mine; the user agreed in direction, 2026-11-11). The core is the scaffolding (`Reading the scene`, the block's form); each ask has its own Role, Task and examples, where the wording that moves the results lives. The cost (user): a change to the core needs calls on every ask, where a change to one ask's part needs only that ask's cells | Guess | Whether the core holds still across asks, or the asks drift apart |
| **Different asks need different wording** (PB-L22, mine): the premise ("what each … has to do physically for the action to happen") keeps the action succeeding; "how each of the things … moves" frees the knock-on | Guess, from batches 10 and 11 only | The other-things ask's first batch |

**Future subsystems that touch this work:**
- **The orchestration layer** (the parent's loop, imagined): it chooses the ask, carries the intent, takes the flags to the oracle, and owns the loop's cap (IM-3).
- **The rule cell** (settled on draft 3) reads motion lines for a rule's two things. More detail's `actions` block is in that shape.
- **The non-rule blocker,** an oracle piece, reads the imagination's output for "fits".
- **A "not enough detail" oracle piece** (IM-2), the one that asks for more detail in the first place.
- **The composition probe** (user), after the pieces: the asks and the oracle's pieces run in order on a corpus case, with code doing the joins.
- **Relevance by code:** which things an ask is about, computed from the plan's things, what is on or in them, and the ends of the rules naming them. Here a cell lists its things by hand (PB-1).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [ ] **The rename and the ask as an input.** The piece `playByPlay` becomes `imagination`, before a second ask is built, so the name doesn't follow the first ask by default (user, 2026-11-11). **Rests on** the two families and the prompt per ask. **Consumer:** ask 1's first batch (step 2). **Revision trigger:** the reading mode needs more than a registration for a piece with several asks.
   - The registration, the file (`oraclePieces/imagination.ts`), its tests and calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) paragraph are renamed. The probe's reading mode is unchanged.
   - **A cell names its ask** (mine): `moreDetail/OC-6`, and so on. Its inputs are the ask's: an intent where the ask takes one. A payload runs one ask, since its `instructions` are one text, and `cells` picks that ask's cells. The check is the ask's.
   - **The drafts** go in `oracleLoopDrafts/imagination/`, with a directory per ask and its own `iterations.md` (mine, as the pieces' drafts do). The play-by-play's directory stays as it is, as history.
   - **The shared core** is kept once as its own file, and each ask's Role, Task and examples are a file beside it. A script assembles each payload's `instructions`, and each part has its own hash, so a draft's notes say which part changed and so what it costs to test (mine).
   - **Tests:** the play-by-play's tests, renamed and passing; a cell's ask resolves; an intent renders where the ask takes one.
2. [ ] **Ask 1, more detail,** from the play-by-play's [draft 10](oracleLoopDrafts/playByPlay/10.txt) (`93a12284`): the ordinary method and its possible problems.
   - **Its cells:** OC-1, OC-6, OC-19 and OC-20, as the play-by-play's. OC-30/2 is a method already chosen, which this ask doesn't serve.
   - **Open for its drafts:**
     - the problems' scope: securing flagged wherever it is, and generic cautions (spills, injury). Under the deferral premise these cost oracle calls, not answers;
     - OC-20's chain cleared inside the method (PB-P2);
     - OC-1's form (one entry per thing, PB-P1);
     - the carried problems and library entries in the [disposition](oracleLoopDrafts/playByPlay/iterations.md#disposition-at-the-play-by-play-plans-exit-c-2026-11-11).
   - **Exits:** (a) the library has nothing left worth a draft; (b) every reply on every cell meets its look-for and the form, for two drafts running; (c) a batch shows the ask needs a new approach, which gets a seam-ledger entry; (d) a checkpoint with the user every three batches.
3. [ ] **Ask 2, the other things,** with the intent given: what happens to the things the method doesn't name.
   - **Its cell:** `OC-30/2/tip`: tip [table1] so that [teapot1] pours [tea2] into [cup1], with the intent "I want to pour tea from [teapot1]." (OC-30's request). The look-for: the saucer and cup slide off the tipped table, and the cup no longer under the spout is a problem against the intent.
   - **The prompt** (mine, to be drafted): consequences only. The problems are only those that work against the intent; other consequences are listed, not flagged. The examples are consequences only, out of the fixtures' domains (a book set on a shelf, knocking a figurine to the floor, with no problems). The first wording is PB-L22's "how each of the things … moves".
   - **A control** shaped for this ask, a method whose consequences don't work against the intent, is open (mine).
   - Exits as step 2's.
4. [ ] **Booked, not designed:** the alternate method, the mitigation and the slot filler. Each starts from a corpus case: OC-30's alternate method (tip the table, after the glue is flagged), OC-30/3's mitigation (the saucer off first) and OC-7's slot filler (a cloth for wipe [table1]).
5. [ ] **Hand back to the parent:**
   - seam-ledger entries for each ask built, and for the rename's revision trigger;
   - the imagination's rows on the subsystem map and in the stages table, marked Observed where an ask settles;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro);
   - each settled ask's replies kept as candidate inputs for the composition probe.

   Then this plan is deleted. The probe, the piece's registration and its drafts stay with the parent.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PB-1 | Which things an ask describes. Carried from the play-by-play plan. Mine: listed by hand in each cell; computing them is code booked for the composition probe | Every ask's cells | The user's call | Open; mine, by hand |
| PB-2 | Whether an ask sees the rules. Carried. The play-by-play ran `rules: 'none'` since batch 6, with the Fiction's "glued to" in view, and the problems bucket gave the securing somewhere to go | Every ask's render | The drafts | Open; `none` |
| PB-3 | Whether an ask sees the candidate's after-state. Carried | Every ask's render | The drafts | Open; not shown |
| PB-5 | How much of the scene an ask sees: the sub-scene of the listed and named things, or the whole scene. Carried. The other-things ask may need the whole scene most, since its job is the things the method doesn't name | Every ask's render | The drafts | Open; the sub-scene |
| IM-1 | Where the questions about things no rule involves come from: the saucer on the tipped table. Mine: the other-things ask is one source, asked after a method is chosen. Who decides to ask it is the orchestration layer's | Step 3; the parent's loop | The composition probe, or the user's call | Open |
| IM-2 | A "not enough detail to judge" piece, beside the settled rule cell, in the oracle family: the piece that sends ask 1 | Step 2's consumer; the parent's Slice 4.5 | The user's call | Open |
| IM-3 | A cap on the loop of asks, and what returns when it is hit | The parent's loop | The composition probe | Open |
| IM-4 | This plan's place in the parent's order: the parent had the non-rule blocker next, then the composition probe. Mine: this plan runs before both, since it serves the reversal the user chose (the iterative engine first) and the blocker reads an ask's output | The parent's Slice 4.5 order | The user's call | Open; mine, this plan first |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds, except that every reply is read, against a rubric written before the batch (user). So batches stay small.
- The user runs each batch and pastes the result. I write each payload to a file and give its full path, with the assembled instructions without their trailing newline.
- One change per draft, and the notes say which part of the prompt it changes: an ask's own part, or the core.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.
- A cell's look-for is mine unless the corpus or the user gives it, and only the user revises it once it has been reviewed.

## Verification

- **Step 1:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. The renamed piece's cells render the same inputs hashes as the play-by-play's (OC-1 `3a664ea2`, OC-6 `a5a71d32`, OC-30/2 `c3f3bca2`, OC-19 `8ab35bc0`, OC-20 `2bde4926`), where an ask adds nothing to the render.
- **A draft:** its form check, then every reply against the rubric written before the batch.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| The rename and the ask as an input | Not started |
| Ask 1, more detail | Not started; starts from the play-by-play's draft 10 |
| Ask 2, the other things | Not started |
| The booked asks | Booked |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). Then the parent's Slice 4.5 row is checked, and this plan is deleted.
