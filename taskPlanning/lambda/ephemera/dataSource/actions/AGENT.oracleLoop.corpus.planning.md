# Oracle loop: evidence corpus

The evidence corpus of the [oracle loop plan](AGENT.oracleLoop.planning.md), in the design variant's [companion-file ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder). **No solutions here:** candidate fixes live in the [proposal record](AGENT.oracleLoop.proposals.planning.md), and rows argue from these cases.

Case IDs (`OC-n`) are stable and never reused.

## How a case is written

Rewritten 2026-11-07 by function, under [JF-18](AGENT.oracleLoop.planning.md#settled-register): the cases carry across from the single judge, and its measurements don't. The user's proposal was to classify the measured cases as oracle or improvisation cases and rewrite them; one file with a part per function, and the loop cases, are mine and agreed.

- **A case is one scene and one request** (or, for a loop case, a sequence of them), written once, then one or more parts:
  - **Oracle:** the inputs (the answer-to-beat, known issues, one or more candidates, and who supplied each step), and what is expected: the verdict on each candidate, and whether a direction goes to the player, to the engine, or nowhere.
  - **Engine:** the inputs (the request, and the direction or constraints the oracle would pass), and a rubric written before any run: what a good candidate must reuse, must avoid, and how much it may stretch. Engine output is open-ended, so it is graded against the rubric by reading, as the scene reasoning probe's open questions are.
  - **Loop:** what has to pass between the two phases over turns. These have their own [section](#loop-cases).
- **Candidates here are written by hand,** standing in for the engine, except where a fixture holds a template `proposal`, which is the template's candidate. Bad candidates are written on purpose.
- **Expected outcomes are not labels,** since JF-5 is open. They are mine unless marked as the user's. Under the pilot (2026-11-09) the oracle and the engine are imagined, so an expected outcome for an intermediate step (a round's verdict, the frontier, a direction and where it goes) is a guess about how an imagined loop behaves. A draft that disagrees with one may be revising the guess, not failing the case. What the case tests is the end result, what the player should end up with: a draft that gets it wrong fails. Where that end result is mine it is still a guess, and only the user revises it, never a draft's disagreement. The engine rubrics are mine except where marked, and the user agreed their grading, OC-26 to OC-29's included (2026-11-08).
- **On v45:** one line per case, the limit today's single judge hits, with its replies where it was run. The v28 replies and the draft-by-draft record are in git history ([where this came from](AGENT.oracleLoop.discussion.planning.md#where-this-came-from-the-judgefailures-plan-retired-2026-11-07)). For a case not yet run the limit is a prediction, and says so.
- **Probe:** the `JudgeProbe` asks only requests held in a fixture's `judgeSets`; `sceneText` can replace the scene but can't add a request. "Request in fixture" means a draft can ask it now, with a hand-written `sceneText` where the scene differs. "Needs a fixture request" means it waits for the [oracle harness](AGENT.oracleLoop.planning.md#recommended-order). **Neither covers the oracle's inputs:** a fixture holds the request, v45's label expectation and, for five requests, a template `proposal` as moves. The answer-to-beat, known issues, what has been tried, hand-written candidates and who supplied each step go into each draft's `sceneText` by hand until the harness gives them a fixture shape, and the probe's label grade means nothing for an oracle draft, which is graded by reading.

## Index

| ID | Scene | Request | Oracle | Engine | Loop | Probe |
| --- | --- | --- | --- | --- | --- | --- |
| OC-1 | `teaTable` | Pick up `[table1]` | ✓ | | | In fixture |
| OC-2 | `teaTable` | Pick up `[cup1]` | ✓ | | | In fixture |
| OC-3 | `teaTable` | `[table1]` in `[cup1]` | ✓ | | | In fixture |
| OC-4 | `teaTable` | Slide `[saucer1]` across `[table1]` | ✓ | | | In fixture |
| OC-5 | `teaTable` | Pick up `[teapot1]` | ✓ | ✓ | | In fixture |
| OC-6 | `teaTable` | Pour from `[teapot1]` | ✓ | ✓ | OC-30 | In fixture |
| OC-7 | `teaTable` | Wipe `[table1]` with a cloth | ✓ | ✓ | | In fixture |
| OC-8 | `teaTable` | Pry `[teapot1]` off with a screwdriver | ✓ | ✓ | | In fixture |
| OC-9 | `tavern` | Pick up `[table1]`, the trestle | ✓ | | | In fixture |
| OC-10 | `tavern` | Pick up `[cup1]`, `[candle1]`; put `[hammer1]` on `[table1]` | ✓ | | | In fixture |
| OC-11 | `teaTableCupOnFloor` | `[table1]` in `[cup1]` | ✓ | | | In fixture |
| OC-12 | Dungeon | Pour from `[teapot1]` | ✓ | | | In fixture, own `sceneText` |
| OC-13 | Doll-house | Pour from `[teapot1]` | ✓ | ✓ | | In fixture, own `sceneText` |
| OC-14 | Dungeon | Tip `[table1]` to pour | ✓ | ✓ | | Needs a fixture request |
| OC-15 | `teaTable` | Wipe `[saucer1]` with a napkin | ✓ | ✓ | | Needs a fixture request |
| OC-16 | `teaTable` | Lift `[teapot1]`'s lid | ✓ | | | Needs a fixture request |
| OC-17 | `teaTable` | Wipe with the cloth I'm holding | ✓ | | | Needs a fixture request |
| OC-18 | `teaTableCupOnFloor` | Hammer `[table1]` into `[cup1]` | ✓ | | | Needs a fixture request |
| OC-19 | `teaTable`, a hammer held | Pry `[teapot1]` off with `[hammer1]` | ✓ | | | Needs a fixture request and scene |
| OC-20 | `teaTable`, table chained | Pick up `[table1]` | ✓ | | | In fixture, own `sceneText` |
| OC-21 | `tavern` | Trim `[candle1]`'s wick with something sharp | ✓ | ✓ | | Needs a fixture request |
| OC-22 | `tavern` | Light `[candle1]` | ✓ | ✓ | | Needs a fixture request |
| OC-23 | `tavern` | Gibberish | ✓ | | | Needs a fixture request |
| OC-24 | Jungle Tavern | Climb onto the roof | ✓ | ✓ | | Needs a fixture request and scene |
| OC-25 | Jungle Tavern | Sit out of the rain | ✓ | ✓ | | Needs a fixture request and scene |
| OC-26 | Jungle Tavern | Soup bowls | ✓ | ✓ | | Needs a fixture request and scene |
| OC-27 | Jungle Tavern | Soup spoons | | ✓ | | Needs a fixture request and scene |
| OC-28 | Kitsch-horror mansion | Mask the musty smell | ✓ | ✓ | | Needs a fixture request and scene |
| OC-29 | Plain creepy mansion | Mask the musty smell | ✓ | ✓ | | Needs a fixture request and scene |
| OC-30 | `teaTable` | Pour, with a candidate history | ✓ | ✓ | ✓ | In fixture, history in `sceneText` |
| OC-31 | Chasm | Across on the bridge, then the arrow and rope | ✓ | | ✓ | Needs fixture requests and scene |
| OC-32 | `teaTable`, a red cup and a blue cup | Pick up the cup | ✓ | | | Needs a fixture request and scene |

## Bearing on every oracle case

On 2026-11-06 the v45 judge was shown a template's candidate as a proposal block (`after`/`fiction`), for table, cup and pour, 3 repeats: 6 pass, 3 wrong `simple`, all pour's. No reply used anything only the block said, and `Revises` said "nothing" on all 9 with the changed relation stated just above it. An oracle case is mostly about reading a candidate, so this is the first thing any oracle draft has to overcome. Oracle draft 1 did, on 2026-11-09: on Micro and Lite, every pour reply used the candidate's cup, which the request never names. Neither model used the after-state ([results](oracleLoopDrafts/1.notes.md#results-2026-11-09-first-batch)).

## Cases from the v45 measurements

Moved from the judgeFailures plan on 2026-11-07 and rewritten by function the same day. Fixtures and requests are in [`judgeRequests.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/judgeRequests.ts), [`teaTable.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/teaTable.ts) and [`tavern.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/tavern.ts). "v45" replies are on the built prompt, 2026-11-06.

### `teaTable`: a small round tea table, with a saucer and cup on it and a teapot glued to it

The player holds nothing ("You are holding nothing"). Two things are called "Tea": the cup's and the pot's.

**OC-1. `I want to pick up [table1].`**
- Oracle: the answer-to-beat is empty. The candidate is the template's: the table goes from the parlour to held by you, and the saucer, cup, teapot and both teas travel along with it, all system-supplied and needing nothing unestablished. Expected: the candidate beats the floor, with no direction. The known risk is reading the glue as blocking the table, the false refusal of v28's predecessors.
- On v45: none. `simple` ×2, `complex` ×1, the `complex` citing the teapot moving with the table.

**OC-2. `I want to pick up [cup1].`**
- Oracle, a guard: the template's candidate, the cup from the saucer to held by you, its tea along with it. Expected: it beats the floor, and the glue doesn't come up.
- On v45: none. `simple` ×3.

**OC-3. `I want to put [table1] in [cup1].`**
- Oracle: no template candidate, since the dry run refuses the move as a containment cycle (the cup sits on the saucer on the table). So the answer-to-beat stays empty with nothing to judge. Expected: the floor, with the size as its sentence, and no direction to the engine, since the only repair is a huge stretch such as a shrinking spell. The record's reason (the cycle) isn't the fiction's (the size), so a sentence about the cup being on the table misses.
- On v45: none on the label. `impossible` ×3, but the dry run never tests fit here; OC-11 is the size case.

**OC-4. `I want to slide [saucer1] across [table1].`**
- Oracle, a guard: the template's candidate changes nothing recorded (an empty `proposal`), and the cup and its tea come along. Expected: it beats the floor; a candidate with no visible change isn't a defect. The table's extent isn't established, which is texture.
- On v45: none. `simple` ×1.

**OC-5. `I want to pick up [teapot1].`**
- Oracle: the template's literal move is refused (`securedToBlocksMove`), so there is no candidate and the answer-to-beat is empty. Expected: the glue named as the fact in the way, with no fix prescribed. Whether a direction also goes to the engine depends on the method dial (JF-15, JF-17); this scene sets no role for the glue, and OC-12 and OC-13 pin the two ends.
- Engine, if directed: candidates that free the teapot or lift it some other way, such as lifting the whole table so that the teapot is held with it, all supply a method the player didn't bring. Rubric: each marks every step as system-supplied, says whether the glue is kept or broken, and says what happens to the saucer and cup.
- On v45: noticing the from-and-to. Across v41 to v45, `obstructed` 8 of 8 when `Picture` says the teapot would go from the table to being held, 0 of 5 without; without it, `Rules` gives `No consequence`. v45 `obstructed` ×2, `simple` ×1.

**OC-6. `I want to pour tea from [teapot1].`**
- Oracle: the template's candidate is legal: all the pot's tea into the cup, which the dry run passes, with nothing about how a glued teapot tips. Expected: it loses on the fiction, with the missing tilt as its known issue. Where the direction goes is the method dial's, as in OC-5. OC-30 is this case over several turns.
- Engine, given that issue: rubric: a candidate that pours says how the teapot tips; one that tips the table accounts for everything on the table, the saucer and the cup; freeing the glue isn't the only route.
- On v45: an action never pictured. No reply on any draft considers the teapot tilting, and the rule's verdict answers about the end state ("does not affect this rule"). v45 `simple` ×1, wrong; with the proposal block shown, wrong `simple` ×3.

**OC-7. `I want to wipe [table1] with a cloth.`**
- Oracle: the candidate is the player's method with a cloth that isn't established, a small stretch in a parlour; the player named the cloth (JF-7). Expected: it beats the floor, with the cloth as its one stretch.
- Engine: improvise the cloth. Rubric: something plausible at a tea table (a napkin, a tea towel), changing no established fact; the glued teapot stays where it is and gets wiped around.
- On v45: none. `contingent` ×6; v28 gave a wrong `simple` ×2.

**OC-8. `I want to pry [teapot1] off [table1] with a screwdriver.`**
- Oracle: the candidate is the player's method aimed at the glue, with an unestablished screwdriver. Expected: the method is credited to the player, the glue is what it changes rather than what stands in the way, and the screwdriver is the stretch. Whether prying works is a skill question, not the oracle's (JP-14).
- Engine: improvise the tool. Rubric: the player's method is elaborated, never replaced; a substitute tool that pries (a butter knife) is a stretch like the screwdriver, and is marked as one.
- On v45: a plan aimed at the obstacle. Note 29 wants `Obstacle: nothing`, `Needs: screwdriver`, `Revises: glued`. v45 `contingent` ×1; v44 `obstructed` ×2, naming the glue as the obstacle. Whether Micro pictures a crowbar may decide it (unprobed).

### `tavern`: a long oak trestle, no Rules section

A low-beamed common room, smoky from the hearth. The player holds a claw hammer.

**OC-9. `I want to pick up [table1].`** (a long oak trestle)
- Oracle: the candidate is zero-stretch over facts and a hard feat. Expected: open (JF-2).
- On v45: a feat the labels can't name. `complex` ×2, standing in for "possible, and hard" ([Question 1](AGENT.oracleLoop.proposals.planning.md#question-1-a-feat-the-labels-cannot-name)).

**OC-10. `I want to pick up [cup1].`, `I want to pick up [candle1].`, `I want to put [hammer1] on [table1].`**
- Oracle, guards: zero-stretch candidates that should win with no fuss.
- On v45: none. `simple` ×2 each.
- **A premise to check:** the fixture has the hammer already held, so the hammer request leaves nothing out. JF-11's example says it "leaves out picking it up", which this fixture doesn't bear out (flagged 2026-11-07). Fix, confirmed by the user 2026-11-08: the [fixture builder](AGENT.oracleLoop.planning.md#recommended-order)'s first dial puts the hammer held or on the floor, so JF-11's example cites the floor variant, `tavernHammerOnFloor`, and this case keeps the held one (2026-11-08; on the floor, not on the table as first written, the user's call the same day).

### `teaTableCupOnFloor`: the same parlour with the cup on the floor

**OC-11. `I want to put [table1] in [cup1].`**
- Oracle: the template's candidate is legal, since with the cup off the table the dry run passes it. Expected: it loses on the size, the body-check of a legal template candidate, with no direction to the engine (as OC-3).
- On v45: a legal move that the fiction refuses. Not yet run.

## Cases written 2026-11-07

From the discussions of 2026-11-06 and 2026-11-07, and judgeFailures' Supporting work. Scene wording is mine unless marked; where a case needs a scene, this is its fiction, and the `sceneText` render is written with the draft that first asks it.

### The parlour, as a puzzle and as texture

Both scenes keep `teaTable`'s handles and arrangement, glued teapot included, so they can reuse its requests. They differ only in what the glue is for (user, 2026-11-07). The wording of both scenes, and of the mansions', is agreed by the user (2026-11-08).

**OC-12. Dungeon: `I want to pour tea from [teapot1].`**
- Scene (the user's vibe, my wording): a dungeon antechamber, the tea table in the middle of it. Words carved over the sealed door ahead say that it opens for one who pours the tea. The teapot is glued to the table.
- Oracle: the candidate is a system-supplied method, tipping the table to pour. Expected (user): "just gets" an obstructed-style reply. The system's method doesn't compete, and the direction goes to the player.
- On v45 (predicted): no input for the glue's role or a method dial, so this and OC-13 get the same judgment.

**OC-13. Doll-house: `I want to pour tea from [teapot1].`**
- Scene (the user's, my wording): you have been transported into a doll-house to have high tea with the Marie Antoinette doll. Dolls' furniture is glued down, the teapot to its table with the rest.
- Oracle: the candidate is the same system-supplied method. Expected (user): a delighted yes: "The miniature teapot is glued to its table, so you heft the table up at an angle to pour the tea into the tiny cup."
- Engine: rubric: the candidate supplies the tilt through the table, and accounts for the cup, which is on the saucer on the table it tips; it is lifted off first or held. The same invariant as OC-30.
- On v45 (predicted): as OC-12.

**OC-14. Dungeon: `I want to tip [table1] to pour tea from [teapot1].`**
- Oracle: the candidate is the player's own method over established facts, a found out, elaborated by the system with lifting the cup off first. Expected: yes, credited to the player, with the elaboration not counted against the method dial (JF-16).
- Engine: elaborate only. Rubric: the steps added carry out tipping the table (the cup and saucer), and none replaces it.
- On v45 (predicted): no notion of who supplied a step; likely read as a plan aimed at the obstacle, as OC-8.

### The parlour, further requests

**OC-15. `I want to wipe [saucer1] with a napkin.`** A second request naming an unestablished tool, after OC-7.
- Oracle: the candidate improvises the napkin, a stretch close to nothing at a tea table. Expected: yes, with the napkin as its one stretch (JF-7).
- Engine: rubric: the napkin, or something like it, changing nothing established; the cup on the saucer is lifted or wiped around.
- On v45 (predicted): `contingent`, as wipe.

**OC-16. `I want to lift the lid of [teapot1].`** A part of an established thing.
- Oracle: the candidate needs a lid, which the teapot presupposes, and nothing else. The glue binds the teapot to the table and not the lid to the teapot. Expected: yes, with no stretch. A presupposed part counts as established, by the test "would this, if absent, justify a specific call-out?" (user, 2026-11-08; JF-6).
- On v45 (predicted): the fixture's expectation was `simple`, tolerating `contingent` and `complex`; whether the glue spreads to the lid is the risk.

**OC-17. `I want to wipe [table1] with the cloth I'm holding.`** A request about something held, in the one scene that states its negative.
- Oracle: the candidate needs a held cloth, and the scene establishes the opposite ("You are holding nothing"). Expected: the direction goes to the player, naming the fact. Charity can read the player as meaning a cloth to pick up, but can't establish one in their hands (JF-13).
- On v45 (predicted): tool invalid has no test of its own; `contingent` or a wrong `simple`.

**OC-18. `teaTableCupOnFloor`: `I want to hammer [table1] into [cup1].`** A method that can't help.
- Oracle: the player brings a method, and an unestablished hammer, and neither touches the size. Expected: the floor, with the size as its sentence, and no how-question, since the player already said how (JF-5).
- On v45 (predicted): `impossible` or `obstructed`, with the hammer's absence as a distraction from the size.

**OC-19. `teaTable` with a claw hammer held: `I want to pry [teapot1] off [table1] with [hammer1].`** A pry with an established tool.
- Scene: `teaTable`, with the player holding `tavern`'s claw hammer.
- Oracle: the candidate is the player's method over established facts, a found out, with no stretch. Expected: yes, credited to the player, with the glue as what it changes. Whether the pry works is a skill question (JP-14).
- On v45 (predicted): as OC-8, without the unestablished tool.

**OC-20. `teaTable` with the table chained to the wall: `I want to pick up [table1].`** A securing that crosses frames.
- Scene: `teaTable`, with the table chained to the wall. Its `Rules` line is the not-shown form, `[table1] stays fixed relative to what [table1] is secured to.`, written by hand into `sceneText`.
- Oracle: the template's move is refused, so there is no candidate. Expected: the chain named as the fact in the way; the glued teapot plays no part.
- On v45 (predicted): the not-shown rule wording is unprobed ([known behaviour](../../../../../lambda/ephemera/calibration/AGENT.md#known-behaviour-of-the-built-judge)); OC-1's freed table may carry over as a wrong `simple`.

**OC-32. `teaTable` with two cups: `I want to pick up the cup.`** Two readings, neither ahead. Added 2026-11-08 from the user's example, for [JF-19](AGENT.oracleLoop.planning.md#settled-register).
- Scene: `teaTable`, with the cup on the saucer red and a second cup, blue, on the table.
- Oracle: two candidates, the template's take of each cup, both legal and zero-stretch. Expected (user): a question to the player with the two as options, "Do you mean the red cup or the blue cup?". It is the one kind of question that differs from plain text.
- On v45 (predicted): one request, one label, and no way to offer a choice; production's Consult asks between same-named objects before any judge.

### The tavern, further requests

**OC-21. `I want to trim the wick of [candle1] with something sharp.`** A `Class` request: the need is described by what it does, with nothing specific named.
- Oracle: with no candidate, the need is open and nobody named what meets it. Expected: the need named as a class; whether anything here meets it is the engine's, since "nothing here could plausibly meet" is a generation question (JF-7, JF-8; the split agreed by the user, 2026-11-08). The held hammer isn't sharp.
- Engine: rubric: candidates for what meets it (a knife left on a tavern table, the bar's), each a stretch and marked as one; the hammer doesn't count.
- On v45 (predicted): `obstructed (3)`, on whether Micro pictures a knife.

**OC-22. `I want to light [candle1].`** Something that moves nothing.
- Oracle: the candidate needs a flame, and the room's gloss establishes a hearth ("smoky from the hearth"). Expected: yes, with no stretch; nothing moves. The hearth is established, since what the description states is present (user, 2026-11-08).
- Engine: rubric: the flame comes from what is established (the hearth) before anything improvised.
- On v45 (predicted): `Picture` can force a move ([known behaviour](../../../../../lambda/ephemera/calibration/AGENT.md#known-behaviour-of-the-built-judge)).

**OC-23. `I want to gear flutter tinkles.`** Gibberish.
- Oracle: no reading. Expected: the floor, with the confusion left with us, such as "I'm not sure what you mean by that" (JF-5). Whether gibberish reaches this check in production is unchecked.
- On v45 (predicted): `confusing`, or an `impossible` with a sentence invented for it.

### The Jungle Tavern

Scene (the user's): "A cozy tavern, bracketed by living trees. A lazy orangutan tends bar, while capuchins leap about delivering drinks. The tables are wet with rainfall, and lit against the omnipresent gloom with little jars filled with fireflies."

**OC-24. `I want to climb onto the roof.`** The roof named.
- Oracle: two candidates: a built roof (it contradicts the wet tables, a stretch to explain them) and no built roof, with the trees' canopy over the tavern. Expected: no built roof; the tables are the evidence, through the forward check "if there were a roof, the tables wouldn't be wet".
- Engine: rubric: the wet tables bear on the roof; a candidate that offers the canopy or its branches to climb reuses the scene's jungle theme.
- On v45 (predicted): the inference runs backwards, from the wet tables to no roof; naming the roof in the request should cue it.

**OC-25. `I want to sit at a table out of the rain.`** The roof bears on the request and isn't named.
- Oracle and engine: as OC-24, with nothing in the request to cue the roof.
- On v45 (predicted): lower than OC-24; the pair measures the cue (mine, checkable).

**OC-26. `Does this place have soup bowls?`** A question, as the user put it.
- Oracle: candidates: yes, plain ceramic bowls; yes, big unworked gourds, sliced in half and hollowed out; no. Expected (user): "Of _course_ they do", the gourds, at a high exposition drive; at zero drive, the plain default with no exposition.
- Engine: rubric: at high drive, an expository stretch is present that fuses the two themes (a tavern's role, a jungle's filler); graded on its presence, never its content.
- On v45: it takes `I want to` requests, not questions, and has no drive input.

**OC-27. `Do you have soup spoons?`** The expository no.
- Engine: expected (user): an expository stretch can come on a no as well as a yes: "Soup _spoons_? No, sorry. We had some, but the sloths always steal them all to use as drumsticks for their Jungle Jamboree band." Rubric: at high drive an expository stretch is present, on either polarity; graded never on content or polarity (user's correction).
- On v45: as OC-26.

### The mansions

The same request in two scenes. Scenes are the user's descriptions, my wording, agreed (2026-11-08).

**OC-28. Kitsch-horror mansion: `I want to find something to mask the musty smell.`**
- Scene: a mansion with the normal trappings of horror movies (creaking floorboards, dusty furniture, ghostly apparitions), and also little collectible figurines and commemorative plates on sagging shelves, hand-made skull-shaped doilies and mummy-themed tea-cozies.
- Oracle: candidate: a bowl of patchouli, probably with the dried bones of a rat mixed in (user). Expected: a plausible extension of the scene's fused themes.
- Engine: rubric: the candidate fuses the themes (kitsch with horror); a plain air freshener misses both.
- On v45: no step names the scene's themes; `Improvising`'s plausibility is world knowledge of the place.

**OC-29. Plain creepy mansion: `I want to find something to mask the musty smell.`**
- Scene: the same mansion without the kitsch.
- Oracle: candidate: the same bowl of patchouli. Expected: a departure from the scene's theme, a larger stretch than in OC-28.
- Engine: rubric: anything the scene's theme expects (dried flowers gone to dust, a stale sachet), or nothing.
- On v45: as OC-28.

## Loop cases

What passes between the oracle and the engine over turns, which no single call shows.

**OC-30. `teaTable`: `I want to pour tea from [teapot1].`, with a candidate history.**
- Turn 1: the answer-to-beat is empty. Candidate A, the finished answer: "The teapot is glued to the table, so you can't pour from it." Expected: A beats the floor and becomes the answer-to-beat.
- Turn 2: candidate B, tipping the table, breaks an invariant nobody called: the saucer and cup slide off. Expected: B loses as a product and A stays; B goes to the frontier with its repair, the cup lifted off first; the broken invariant joins A's known issues and the tried list.
- Turn 3: candidate C, B repaired. Expected: whether C beats A is the method dial's, which this scene doesn't set (OC-12, OC-13).
- What it pins: potential never displaces the answer-to-beat, a losing run still records what it found, and a frontier candidate is dropped once its repair has been tried and lost.
- On v45: no slot for an answer-to-beat, known issues, what has been tried, or a candidate; and the [proposal block finding](#bearing-on-every-oracle-case).

**OC-31. The chasm and the broken bridge.**
- Scene (the user's): "The chasm is very wide, and the only bridge is broken and dangling on the far side."
- Turn 1: `We're going across the chasm on the bridge.` Expected (user): a how-question to the player, naming the fact: "But *how*? It's on the other side. It's not doing you any good."
- Turn 2: `Taking out a heavy arrow. Tying a rope to it.` Expected (user): "Ooookay, I think I see where this is going." The candidate is the player's method, and what isn't established (the arrow, the rope, a bow) is its stretch.
- What it pins: the second turn means nothing without the first (JF-12), and the how-question has to be one the player can answer.
- On v45: one request at a time, with no memory of the last.
