# Judge prompt: a consolidated rewrite

**Status (2026-11-05):** in progress. Slice 1 is done: the user has read [v7](judgePromptDrafts/v7.txt) and settled every M row. No code has changed, and no draft has been probed. Slice 2 is done: [v24](judgePromptDrafts/v24.txt) is the agreed text for this iteration (2026-11-05). Slice 3 is next, and starts with JP-8.

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

## The user's notes (2026-11-04 and 2026-11-05)

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
15. Fiction is not a simulation (2026-11-05). A simulation gives positions and derives relations from them. Fiction establishes the relations and leaves positions undefined, because they don't matter. Pulling the rug out establishes nothing about where the rug is; it revises the fact that the crate is on the rug.
16. People reason about fiction with a twist of register (2026-11-05): they briefly imagine a scene framed by what is established, check it against real-world physics, then abstract back to what is established. Sliding a cup across a table is thought about as motion when judging whether it can be done, yet it establishes no new fact: the cup goes from an unspecified spot on the table to an unspecified spot on the table.
17. Reasoning about fiction is lazy, not exhaustive (2026-11-05). Exhaustive reasoning concludes that the teapot comes with the table; lazy reasoning declines to modify the fact that the teapot is on the table. A secret door in a bookshelf does not have to imagine fifty books moving: the books remain as established. "It's a sort of compression." The working question is "If I move this table, which of these established facts need to be reconsidered?" A pyramid of wine-glasses stacked precariously on the table jumps out, and the glued teapot gets to be ignored.
18. `Reading player intent` and the rule's "defaults to moving" are the old voice, and should describe fictional inertia instead (on v8).
19. It is permissible for the LLM to be a little dumb, so long as it is not recalcitrant (2026-11-05). Users understand that they sometimes said too little for a system to parse their intent, but they get rightly frustrated when the system resists a legitimate intent.
20. Be skeptical of negative instructions that modify positive instructions: LLMs don't seem to deal well with that structure, so state the test positively (2026-11-05, on the chasm sentence).
21. Rules state the constraint plainly, as a rule, in a context that has already explained that rules can be dissolved through action (2026-11-05, on JP-1). "Cannot leave ... until freed" was awkward because it embedded the puzzle-solving mindset, that rules are meant to be bent or broken, in the rule itself.
22. `contingent`, `incomplete` and `complex` may be independent gates, of which we recognize only the first to fire (2026-11-05): an attempt to pry the teapot off with a screwdriver could be all three.
23. The one-word judgment is used for deterministic routing, and any more capable LLM that gets deferred to receives the whole output, including `Needs` and `Revises` (2026-11-05). This was the user's condition for the gates direction.
24. `Reading the scene` aligns with established against unestablished, not present against absent (2026-11-05, on v18). The prompt does not affirm that an unstated thing is neither present nor absent, only that it is not established as either. `Fiction` describes what has been established, since what the place "really is" can change through minting. `Graph` "adds no facts of its own but can help disambiguate the language of the fiction section" (the user's wording).
25. The `Fiction` part is tiny, with the details of established against exhaustive added later as clarifications and exceptions. Migrate them earlier, into `Fiction`, so they frame the later sections immediately (2026-11-05, on v19).
26. Don't tie the scene render to player perception (2026-11-05, on v20). "Reasoning is grounded in this established fiction" replaces "This is the story you are reasoning about" (the user's wording).
27. The lazy view does not need calling out against the graph in the prompt: building lazy-change expectations into `Fiction` and then listing the graph is enough to draw the parallels functionally (2026-11-05, closing JP-11).
28. `incomplete` is renamed `obstructed` from v24 (my suggestion, the user agreed, 2026-11-05). Earlier notes and rows keep the old name where they record what was said at the time.

## Drafts: changes that are mine, not from the notes

| # | Change | Why | Status |
| --- | --- | --- | --- |
| M1 | Saucer example replaced with "pull the rug out from under the crate" | Earlier batches showed fixture-domain examples leak into answers, and `teaTable` has this cup and saucer | Accepted |
| M2 | `LADDER` steps 2 and 3 cut; step 1 kept as `Task` steps 1 and 2 | They say how to reach a goal, and step 2 ("freeing or removing") prescribes what note 4 rules out | Cuts accepted; replaced by the `Fiction` framing (notes 15 to 17, 25 and 27) |
| M3 | `MOVING` cut | The judge writes no edits; its crate sentence is covered by `Reading player intent` | Accepted |
| M4 | "what goes with what" and "their layout is not a rule about what moves" cut from `PRECEDENCE` | Both oppose note 4 | Cuts accepted; replaced by the `Fiction` framing (notes 15 to 17, 25 and 27) |
| M5 | "A row indented under another row is a thing on or in that other thing"; "Each rule is about the things it names, and no others" | New wording aimed at the glue spreading. The second overlaps note 8's boundary, since it describes Rules rather than instructing | Accepted |
| M7 | v2: the names `Fiction` and `Graph`, taken from the labels in the user's `SECURED` passage; "the reality you are reasoning about"; "It adds no facts of its own" | Note 10 asked for new terms and alignment; this wording is mine | Accepted |
| M8 | v5: the labels set out as a list | Easier to read | Accepted |
| M9 | v6: `(d) passing it to a more capable system` added to the user's three next steps | `complex` otherwise has no next step (the deferred tier, then Abstain) | Accepted |
| M6 | The rule text kept as it was until v9 (M11) and v17 (M18); `Could I?` kept until v11 (M13) | No note changes them | Accepted |
| M10 | v8: the wording of notes 15 to 17 in `Reading the scene` and `Task` steps 1 to 3, including "Picture only the change", "filling in ordinary details" and the rewrite of old step 2 | The notes give the direction, and this text is mine. The motorcycle stays as the example, moved to step 3 | Accepted for this iteration (v23) |
| M11 | v9: the inertia wording of `Reading player intent` and of the rule's second sentence; "pull the rug" now names only the change to what the crate rests on | Note 18 gives the direction, and this text is mine. The rule's sentence would replace `rulesAction`'s in code at Slice 3 | Accepted for this iteration (v23) |
| M12 | v10: the wording of the `Improvising` section, "neither present nor absent", `Task` step 4, the five label definitions, and `contingent` sharing `Role`'s (d) | JP-9, JP-13, JP-6 and the transitory decision under Settled give the direction, and this text is mine. The roof example moves from a tavern to a farmhouse, and the flexible spout becomes a ladder under a window, because the fixtures have a tavern and a teapot and such examples have leaked into answers (M1) | Accepted for this iteration |
| M13 | v11: `Improvising` says a needed detail is suggested, not established, however sure the judge is (the user's direction, my wording); every needed detail that isn't established is now `contingent`, including ones you would assume anyway, which withdraws "the roof stays `simple`"; `Could I?` cut (the user agreed) and `Question:` renamed `Request:` (mine) | Mechanically, a thing the action needs and the graph lacks has to be minted, however sure anyone is | Accepted for this iteration (v23) |
| M14 | v12: `Improvising` states its test positively, after note 20 (the user offered "Plausible that it would be present but not mentioned"; the sentence is mine). The ladder example and "it does not establish it" are cut, since neither fits a positive form | Note 20 | Accepted for this iteration (v23) |
| M15 | v13: `Task` rewritten as the JP-2 lines, including the wording of each step and the positive form of the take-it-away test in `Needs`. "Each rule's constraint is local to the things it names" and "Everything else stands" are the user's; "Consult only" stays | JP-2 and note 20 | Accepted for this iteration (v23) |
| M16 | v14: "as a fact about this place" replaces "naming the obstacle only" (mine, the user agreed). `n/a` on `Needs` and `Revises` is the user's idea; its condition and wording are mine: facts or how things behave stop the action, so a merely missing thing still reaches `Needs` | Keeps a blocked action distinct from one that changes nothing, and keeps minting away from an established obstacle | Accepted for this iteration (v23) |
| M17 | v16: `Revises (if it happens)`, from the user's `(on success)` in v15; the wording is mine, and the user agreed | The line is hypothetical, so a `contingent` or bare-cell reply can name the facts without claiming they happened, and it stays true whatever decides the outcome (judgment, consideration, chance or rules if added) | Accepted for this iteration (v23) |
| M18 | v17: "A rule holds for as long as the established facts behind it hold, and a player can set out to change those facts" in the `Rules` bullet; "until [teapot1] is freed" cut from the rule; the rule's second sentence kept | Note 21 gives the direction, and this wording is mine; the user agreed. Nothing stated that a rule can fall until now. The second sentence isn't puzzle-mindset wording, and it is the only text in the rule aimed at the table refusal, so it stays until the probe shows whether the inertia framing can carry that alone. In code at Slice 3, all three forms in `actionRule` lose their "until" clause | Accepted for this iteration (v23) |
| M19 | v18: an `Obstacle` line; `n/a` narrowed to the `impossible` case, in place of M16's condition; `Answer` gives the first word that applies; the labels reordered to gate order, with `simple` last, in place of `Role`'s order (note 14). `impossible` and `simple` are not gates: the first comes before them, and the second means every gate is clear | Notes 22 and 23 give the direction, and this text is mine. The obstacle-before-needs order is also mine, and can be argued the other way: a player can't try prying without the screwdriver | Accepted for this iteration (v23) |
| M20 | v19: the exact sentences for the first two points of note 24, replacing "neither present nor absent" (M12) and "as it really is in the story" | Note 24 gives the direction, and this wording is mine; the `Graph` sentence is the user's | Accepted for this iteration (v23) |
| M21 | v20: "This is the story you are reasoning about" replaced "the reality" (mine, the user agreed; replaced in turn by note 26). Moved into `Fiction`, text unchanged: the "fiction, not a simulation" paragraph (the user's example), and "Everything it states is true" and the not-established sentence (my choice), which narrows their scope from the whole scene to `Fiction`. Left in place: "The scene tells you..." and `Improvising` | Note 25 gives the direction. "Graph" adds no facts and rules derive from the graph, so `Fiction` is where those statements apply. An established fact staying true now comes before the rule that depends on it | Accepted for this iteration (v23) |
| M22 | v21: ", as the player perceives it" cut from the opening of `Reading the scene`. It came from the frame's `SCENE_INTRO` | Note 26. A thing the player can't perceive (the scene projection plan's closed-container case) is simply not established, so the open-world wording covers it, and "perceives" sat badly beside "everything it states is true". `SCENE_INTRO` in code stays as it is: the planning frame is the control | Accepted for this iteration (v23) |
| M23 | v22: "It is shown three ways, each a view of the same place" replaces "It has three parts" (mine, the user agreed) | The user's concern (2026-11-05): "parts" invites reading the sections as independent, not as views of one truth. Not probe-tested | Accepted for this iteration (v23) |
| M24 | v23: 'In the scene, "you" is the player' in `Reading the scene` (mine, the user agreed) | Settles JP-3 without changing a render other readers share | Accepted for this iteration (v23) |
| M25 | v24: `obstructed` replaces `incomplete` | `incomplete` sounds like the request is missing something, which is `Consult`'s job, and overlaps with `contingent`. `obstructed` describes the scene, matches the `Obstacle` line, stays true under brute force, and makes no claim about what comes next | Accepted |

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to settle the prompt. When one is settled, it moves into the draft and the row is removed.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| JP-2 | **Reasoning and answer order.** Agreed (user, 2026-11-05): a structured chain of thought with the conclusion at the end, imagining what happens before judging what that establishes. The lines are `Picture`, `Obstacle`, `Needs`, `Revises (if it happens)` and `Answer`, in draft from v13 (M15), with `n/a` from v14 (M16, narrowed by M19), the `Revises` name from v16 (M17) and `Obstacle` from v18 (M19, see JP-15). The user accepted the wording for this iteration at v23. Unproved: the model may recite the structure, or decide first. Slice 3: the probe's scorer reads the label from the last line alone, and has to read `Answer:` and a sentence. | Slice 3 (scorer only) | Open for the scorer only |
| JP-14 | **What a direct attempt on a rule gets (raised by me, 2026-11-05, from JP-1).** "Pry the teapot off the table" or "take the teapot by brute force". The user's expectation (2026-11-05, out of curiosity): perhaps `incomplete`, in a way that needs to be judged rather than handed back to the player, which may be the best outcome. Until adjudication exists, `obstructed` naming the glue is a reasonable placeholder. Withdrawn: my guess that prying is `complex`, since `complex` requires a straightforward action. Mine, not agreed: the obstacle gate has three states (clear; in the way and not addressed; in the way and addressed), and the third goes to adjudication, which depends on the game: in the Coyote Game every challenge is permitted. `obstructed` still says "getting past it is up to the player", which fits the third state poorly. | Slice 4 (only if it grades such a case) | Open |
| JP-8 | **Module boundaries in code.** Which parts become reusable modules, and how `Reading the scene` varies by render format. Mine, a lean only: `Reading the scene`, `Reading player intent` and `Improvising` become modules, and `Task` belongs to the judge. | Slice 3 | Open |

## Settled (user, 2026-11-05)

Recorded here because the rows are gone and these carry reasons or fallbacks. A "was JP-n" label resolves any older reference to that row.

- **Two uses of "you" (was JP-3):** a sentence in `Reading the scene` (M24). The render stays as it is.
- **The user's `SECURED` passage (was JP-5):** it stays out. Its removal was mine, and this is its explicit decision. A code comment in `sceneRules.ts` records that it made things worse, and the rule and the inertia framing now cover its job. It is the first thing to try if the table refusal survives Slice 4.
- **"Text adventure" (was JP-7):** not named. The genre may suggest things are fixed in place, which could feed the table refusal. The text-adventure reading stays a requirement of the behaviour, and `game master` stays.
- **Lazy view and the graph (was JP-11):** no further prompt text (note 27). The framing that replaces the cuts in M2 and M4 is `Fiction`.
- **Transitory against established (was JP-12):** no further text. Only what the action depends on can change the label: `Needs` ("could not work without") and `Revises` ("established facts") leave a detail the action merely produces, such as a slick of moisture, to the narration. The full judgment of what is worth recording is for the future.
- **Rule wording (was JP-1):** the rule states the constraint plainly, and the `Rules` bullet says once that a rule holds as long as the facts behind it and that a player can set out to change them (note 21, M18). To watch in Slice 4: a bare "cannot" may pull "pick up the teapot" towards `impossible`. The rule never says "glued"; the bullet's "facts behind it" is the only join.
- **Open world (was JP-9):** what is unstated is not established as either present or absent. Details get established because they are newly relevant, not because they newly occurred. Plausible improvisation is wanted, and improvisation for convenience is not. Silence can count as evidence: a bridge over a yawning chasm "would have been mentioned if it were there", so it leaves `contingent` for `incomplete`.
- **Improvised details (was JP-13):** the `contingent` label, with sure and unsure suggestions going to the same place. Whether to mint is decided by a more capable engine, which is for CA-6; a new established fact reaching the graph leaves a note there too. Fault tolerance: most border errors recover, through another turn or the engine's second look. A wrong `simple` has no recovery, and a wrong `impossible` recovers only if the player has something to add, so it does not excuse the table refusal.
- **Independent gates (was JP-15):** `Answer` is one word, the first gate that fires, with the obstacle before `Needs`, and code routes on that word alone. `contingent`'s and `incomplete`'s sentences stay for the first probe. `complex` stays a judgment, since `Revises` alone can't decide it. For CA-6: a deferred LLM gets the whole output as a first pass's notes, not as established facts, and its prompt has to say so, or a wrong `Needs` could anchor it.
- **The judgment schema (was JP-6):** five labels for this iteration. Calculating likely consequences nobody referred to, such as a precarious pyramid of wine-glasses on the table, is a known weak point, deferred to a future iteration as its focus (user, 2026-11-05). So Slice 4 does not grade it, and my reading of it as `complex` was not adopted. `TRIAGE_LABELS` in code has three until Slice 3.
- **`obstructed`, and `impossible` (was JP-10, under the name `incomplete`):** the touchstone is respect for player ingenuity (user, from GMing indie RPGs): going from "It's an adamantium door... No man. Didn't you listen?" to "Well, I don't know. Can you? What do you want to try?". It differs from `Consult`, which asks the player to clarify and sets no puzzle. Freeing is not the only way past an obstacle (tipping the table to pour), so the judge names the obstacle and no way past it. The tone of the invitation is the whole system's, not this check's. `impossible` is a mismatch of shared reality, not "stop trying": "I don't think you and I have the same idea of the size of shoeboxes or motorcycles." For CA-6: an `obstructed` entry will at some point go to an LLM that decides how to present the possibilities to the player, and which will sometimes describe it as impossible if the player has no clue a path exists, so the judge need not draw that line. `obstructed` still says "getting past it is up to the player" as a placeholder (JP-14).

## Size

Nova Micro (user, 2026-11-05, not checked here): a 128k token context window, and manual cache points, which must not be set on a chunk under 1k tokens. An instruction block over 1k tokens before the variable scene can be cached once and read from cache afterwards, which is sometimes worth padding the instructions to reach, hopefully profitably.

So the size that matters is the instructions alone, and the pressure has a floor as well as a ceiling. v23's instructions are about 4,800 characters, roughly 1,150 to 1,200 tokens by rule of thumb (mine, not a real count), and the scene and request about 180 more. That margin is thin, and cutting `contingent`'s and `incomplete`'s sentences would use some of it.

For Slice 3 (mine): keep the instructions byte-identical across calls, with the cache point between them and the scene; v23's hold nothing variable. Get the real count from Bedrock before relying on it. Still to check: how long a cached block lives, which decides whether a low-traffic game gets any hits, and the price of cache writes against reads. If padding is ever needed, a worked example of the five lines could earn its place, as `Task`'s structure is an open soft spot, though M1's leak risk applies.

## Progress

| Slice | State |
| --- | --- |
| 1. Reorganize per the user's first notes (v1 to v7) | Done 2026-11-05 |
| 2. Iterate the text | Done 2026-11-05; agreed text is v24 |
| 3. Build the agreed prompt as a frame and format | Not started |
| 4. Probe the aggregate | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`.

1. [X] **Slice 1: reorganize.** Done 2026-11-05: the user has read [v7](judgePromptDrafts/v7.txt), and the M rows are accepted; the replacement for M2 and M4 was settled later (note 27).
2. [X] **Slice 2: iterate.** Done 2026-11-05: [v24](judgePromptDrafts/v24.txt) is the agreed text for this iteration, unproved until Slice 4.
3. [ ] **Slice 3: build.** A judge frame and format reproducing the agreed text exactly, tested against the draft; the planning frame unchanged.
4. [ ] **Slice 4: probe the aggregate on Micro,** with criteria agreed before it runs. Proposed: pick up `[table1]` is `simple`; pick up `[cup1]` is `simple`, with no glue spreading to it; `[table1]` in `[cup1]` is `impossible`, naming the fact the player missed; pick up `[teapot1]` and pouring from it are `obstructed`, naming the glue and prescribing no fix; `tavern` shows no lean to `impossible`. The `teaTable` fixture's description and rubric assume freeing is the only way past the glue, and need correcting before grading. If it regresses, remove groups of changes, guided by the replies. Grade by what an error costs, per JP-13 (mine, 2026-11-05, liked by the user, whose note 19 is the principle): a wrong `simple` is a failure, a repeated false refusal is a failure, and disagreement on the borders among the other labels is tolerated. A `contingent` case and a border case join the criteria.
5. [ ] **Hand back:** record the result on the scene projection plan's Slice 6 row, then delete this plan and its drafts.

## Verification

- Slices 1 and 2: the user's read. No commands.
- Slice 3, from `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`.
- Slice 4: the batch itself, at most 12 calls per invoke.
