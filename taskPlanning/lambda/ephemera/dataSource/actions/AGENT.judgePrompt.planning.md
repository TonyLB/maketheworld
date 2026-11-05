# Judge prompt: a consolidated rewrite

**Status (2026-11-04):** in progress. Draft v7 is written and waiting for the user's close read. No code has changed, and no draft has been probed. Next: mark up [v7](judgePromptDrafts/v7.txt).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). This is a small, ephemeral plan: delete it and [`judgePromptDrafts/`](judgePromptDrafts/) when the prompt is settled and its lasting findings have moved to the [scene projection plan](AGENT.sceneProjection.planning.md).

## Goal

One readable prompt for the triage judge (Slice 6, SP-11 of the scene projection plan), reorganized as a whole. Ten batches of one-at-a-time wording changes did not free the table in `teaTable`, and the prompt's faults are interconnected (user, 2026-11-04). So we pause testing each step, step through slices of improvement by reading the text, and test the aggregate at the end.

## Getting Started

1. Read the current prompt as delivered, from the [frame modules](../../../../../lambda/ephemera/dataSource/actions/sceneProse/frame/) and [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts).
2. Read the Slice 6 row of the [scene projection plan](AGENT.sceneProjection.planning.md#recommended-order) for what batches 1 to 10 showed.
3. Baseline, only once code changes (Slice 3 on), from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4372 passed, 9 skipped. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md).

## How we work

- Each slice changes the text and writes the next file in `judgePromptDrafts/` for the user to read. No Bedrock calls until the user says the aggregate is ready.
- Drafts are written by hand. The scene and rule text is pasted from the real render, so code only has to reproduce the text once it is agreed.
- The current frame, formats and batch 10 results stay untouched as the control.
- Each change is attributed. Anything not from the user's notes is labelled "mine" until accepted.

## The user's notes (2026-11-04)

1. Sections get specifiers, such as `Role:`.
2. What the data is and what the role should do are separate, in this order: `Role`, `Reading the scene`, `Task`.
3. `Reading the scene` and `Reading player intent` are reusable modules, tuned more broadly than one task. `Reading player intent` is likely global to the system. `Reading the scene` can vary somewhat with the render format.
4. `Reading player intent` carries the expectation that moving an object moves everything on or in it, and that moving a container away from its contents is considered only when the player specifies it or context makes it obvious ("yank the saucer out from under the cup" is a move of the saucer and of the cup's containment on the saucer).
5. `Reading the scene` explains the two registers, and headers make them obvious.
6. The graph representation is probably better wrapped in a Markdown code fence.
7. `Task` says how to use Rules. `Reading the scene` says what they mean, fictionally.
8. Rules is a section the earlier instructions anticipate, with no ad-hoc instructions of its own.
9. Anything after the question must be an explicit callback to the task instructions. It may not be needed: instructions up front, data and input last.
10. The two registers are a fictional description and a graph representation. v1 lost that distinction, so the sections are renamed and `Reading the scene` reinforces it (on v1).
11. Rules is a non-exhaustive list of fictional constraints derived from the graph: a rule's presence constrains explicitly, and its absence defers to the logic of the scene (on v2, reworded on v3).
12. Four labels, with `incomplete` and `impossible` as in JP-10: the reality is agreed and in the way, against the request suggesting the reality is not agreed. v5 uses the label wording I offered, which the user accepted as a direction (2026-11-04).
13. `Role`'s goal is the next step in communication: completing the request, aligning player understanding, or bouncing the question back as a puzzle (on v5).
14. The labels are four distinct categories, not a spectrum, so they have no inherent order; `Task` lists them in the order of `Role`'s next steps (on v6).

## Drafts: changes that are mine, not from the notes

| # | Change | Why | Status |
| --- | --- | --- | --- |
| M1 | Saucer example replaced with "pull the rug out from under the crate" | Earlier batches showed fixture-domain examples leak into answers, and `teaTable` has this cup and saucer | For the user |
| M2 | `LADDER` steps 2 and 3 cut; step 1 kept as `Task` steps 1 and 2 | They say how to reach a goal, and step 2 ("freeing or removing") prescribes what note 4 rules out | For the user |
| M3 | `MOVING` cut | The judge writes no edits; its crate sentence is covered by `Reading player intent` | For the user |
| M4 | "what goes with what" and "their layout is not a rule about what moves" cut from `PRECEDENCE` | Both oppose note 4 | For the user |
| M5 | "A row indented under another row is a thing on or in that other thing"; "Each rule is about the things it names, and no others" | New wording aimed at the glue spreading. The second overlaps note 8's boundary, since it describes Rules rather than instructing | For the user |
| M7 | v2: the names `Fiction` and `Graph`, taken from the labels in the user's `SECURED` passage; "the reality you are reasoning about"; "It adds no facts of its own" | Note 10 asked for new terms and alignment; this wording is mine | For the user |
| M8 | v5: the labels set out as a list | Easier to read | For the user |
| M9 | v6: `(d) passing it to a more capable system` added to the user's three next steps | `complex` otherwise has no next step (the deferred tier, then Abstain) | For the user |
| M6 | `Could I?` and the rule text kept as they were | No note changes them | See JP-1 |

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to settle the prompt. When one is settled, it moves into the draft and the row is removed.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| JP-1 | **Rule wording.** v1 uses `rulesAction`'s sentence, which never says "glued" or "secured", so nothing joins the rule to the row's "glued to". `rules` names the fictional cause. "Cannot leave ... until freed" may also read as a game flag (user's reading, 2026-11-04), and "until freed" names one way past the obstacle as if it were the only one (see JP-10). | Slice 2 | Open |
| JP-2 | **Reasoning and answer order.** Note 2 has `Task` organize the chain of reasoning. v1 keeps the label first, so the three steps cannot be written out before the label. | Slice 2 | Open |
| JP-3 | **Two uses of "you".** `Role` makes "you" the reasoner, and the scene's "You are holding" means the player. Unchanged in v1. | Slice 2 | Open |
| JP-5 | **What of the user's `SECURED` passage returns**, and where. Its fiction paragraph may belong in `Reading the scene`. Its removal was mine and never had its own decision. | Slice 2 | Open |
| JP-6 | **The judgment schema, and the `complex` definition.** The user is thinking out loud (2026-11-04, wording not settled) about four values: `simple` (nothing to figure out, for the player or the model); `impossible` (not doable, and not a puzzle); `complex` (likely straightforward, but sorting it out is beyond this model, e.g. a rope tied around a table leg and then to a doorknob); `incomplete` (a step is not simple for the player, so it goes back to them, e.g. pouring from a teapot glued to the table). The split is whose problem it is. In draft from v5, unproved; `TRIAGE_LABELS` in code still has three until Slice 3. | Slice 2 | Open |
| JP-7 | **Is "text adventure" named anywhere?** v1 describes the behaviour and does not name the genre (see the fixed-in-place suspicion in the scene projection plan's Slice 6 discussion). | Slice 2 | Open |
| JP-9 | **"Nothing that isn't stated is present" is too strong (user, 2026-11-04).** The tavern description mentions no ceiling, and that does not make it open-air. The engine needs some ability to improvise reasonably. The opposing risk is on record: the nonsense batches had a model assume a lighter, a match and a candle into the scene, so improvising cannot mean inventing whatever a request needs. The sentence comes from `READING`, so a change may reach every reader, not only the judge. Unchanged in v4. | Slice 2 | Open |
| JP-10 | **What `incomplete` is** (from JP-6; user, 2026-11-04: "the degree to which I've articulated it seems, well, incomplete"). It is not parallel to `Consult`. Consult asks the player to clarify ("Do you mean the Red cup or the Blue cup?") and asks for no puzzle-solving. `incomplete` says "it's not impossible to pour from the teapot, but it's glued to the table, so you can't do it any normal way. Feel free to try things." It deliberately does not jog the player's elbow: "There's stuff here that I won't solve for you." The invitation's tone is what the system should convey as a whole, not text this check should write (user, 2026-11-04), so the judge supplies at most the obstacle. Freeing is not the only way past it: someone the user described the scene to suggested at once tipping the whole table to pour the tea. So the judge should not name a way past, and cannot be expected to know them all. **Touchstone (user, 2026-11-04, from GMing indie RPGs): respect for player ingenuity.** The lesson is going from "It's an adamantium door locked with ancient magic runes." "Can we get through?" "No man. Didn't you listen?" to "Well, I don't know. Can you? What do you want to try?" **`impossible` is a mismatch of shared reality (user, 2026-11-04), not "stop trying":** "What you're asking me to do makes me think that you aren't on the same page about what reality we're looking at." For the motorcycle in the shoebox: "I don't think you and I have the same idea of the size of shoeboxes or motorcycles." Still to discuss: how it differs from `impossible` when the player cannot tell whether a way exists; whether the name fits. | Slice 2 | Open |
| JP-8 | **Module boundaries in code.** Which parts become reusable modules, and how `Reading the scene` varies by render format. | Slice 3 | Open |

## Progress

| Slice | State |
| --- | --- |
| 1. Reorganize per the user's first notes (v1 to v7) | v7 written; waiting for the close read |
| 2. Iterate the text | Not started |
| 3. Build the agreed prompt as a frame and format | Not started |
| 4. Probe the aggregate | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`.

1. [ ] **Slice 1: v1.** Done when the user has read the latest draft ([v7](judgePromptDrafts/v7.txt)) and the M rows are accepted or struck.
2. [ ] **Slice 2: iterate.** One numbered draft per round of notes, until the JP rows that block this slice are settled.
3. [ ] **Slice 3: build.** A judge frame and format reproducing the agreed text exactly, tested against the draft; the planning frame unchanged.
4. [ ] **Slice 4: probe the aggregate on Micro,** with criteria agreed before it runs. Proposed: pick up `[table1]` is `simple`; pick up `[cup1]` is `simple`, with no glue spreading to it; `[table1]` in `[cup1]` is `impossible`, naming the fact the player missed; pick up `[teapot1]` and pouring from it are `incomplete`, naming the glue and prescribing no fix; `tavern` shows no lean to `impossible`. The `teaTable` fixture's description and rubric assume freeing is the only way past the glue, and need correcting before grading. If it regresses, remove groups of changes, guided by the replies.
5. [ ] **Hand back:** record the result on the scene projection plan's Slice 6 row, then delete this plan and its drafts.

## Verification

- Slices 1 and 2: the user's read. No commands.
- Slice 3, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`.
- Slice 4: the batch itself, at most 12 calls per invoke.
