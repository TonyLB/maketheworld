# Scene reading, draft 1: the explicit render against the guide

For [the trial question plan](../../AGENT.trialQuestion.planning.md#recommended-order)'s step 0. The explicit render and the per-object default are the user's ideas (2026-11-16). The design was reviewed by the user on 2026-11-17, with QS-4, QS-5 and the stance in the Role settled. The drafts' wording and this rubric are mine.

## The two arms

Both arms ask one question of a scene alone, with the securing removed (`withoutSecuring`), as the trial shows it. Nothing differs between the arms except the render and the guide.

| Arm | Draft | Render | Reading the scene |
| --- | --- | --- | --- |
| `sections` (batch 17) | [`reading.1s.txt`](reading.1s.txt) | `renderSceneJudge`: Fiction and Graph | verdict draft 7's, word for word, with the ordinary-default sentence |
| `explicit` (batch 18) | [`reading.1e.txt`](reading.1e.txt) | `renderSceneExplicit`: Fiction and a line per thing | none |

**Held constant:**
- the Fiction;
- the Role, with the stance as a frame: "The scene is the fiction established so far, not a full simulation: what it states is true, what it leaves out is open, and what things are like comes from what you know of the world.";
- the Task: one or two sentences on what the scene establishes, then `{"answer": "yes" | "no"}`;
- the question line, `The question: …`, last;
- the cap of 400.

Because the stance is in both arms, `sections` is not verdict draft 7's prompt, and the probe measures only the translation.

## How it is probed

There are two payloads, each 8 cells x1 on Micro, `{"piece": "sceneReading", "options": {"render": "sections" | "explicit"}}`. A deploy is needed first, since the piece is new code. Each response is saved to a file and read with `jq`. Then x3 on any question where the arms split.

## Rubric (written before the batches)

Each line gives the expected answer, then what a right reply establishes, then the miss the question aims at.

- **R-1** (OC-11's scene, the cup on the floor): *Could [table1] fit inside [cup1]?* **no.** No ordinary table fits in a cup, small round or not. The miss is "small round, so it fits" (TR-P16). In `explicit`, read whether "as an ordinary small round tea table is" is quoted for the size, or "small" for the fit.
- **R-3** (OC-1's scene): *Could one person pick up [table1]?* **yes.** A small round tea table is light enough. The miss is "the scene doesn't give its weight" as a no.
- **R-4** (OC-6's scene): *Is [tea2] in something tea can be poured from?* **yes.** [tea2] is in [teapot1], and a teapot is what tea is poured from. The miss is the guard's invented transfer.
- **R-5** (h7's scene): *If [table1] is tipped steeply, does [cup1] stay where it is?* **no.** The saucer and the cup slide or tip off. The miss is "they move with the table" as a yes. In `explicit`, read whether the "unless the motion slides or tips it off" clause is used, or only "moves with it" (TR-P14's slide, the scene side).
- **R-6** (h7): *If [table1] is carried level across the room, do [saucer1] and [cup1] go with it?* **yes.** The carry.
- **R-7** (h7): *If [saucer1] is picked up, does [cup1] come with it?* **yes.** h10's hinge, for step 1.
- **R-8** (h7): *If [saucer1] is picked up, does [teapot1] come with it?* **no.** The teapot is on the table, not on the saucer. The miss is the carry spread too far (`affordance`'s failure in SP-10). In `explicit`, read whether the repeated "moves with it" lines blur whose contents are whose.
- **R-9** (h7): *If [cup1] is held under [teapot1]'s spout and [teapot1] is tilted, does tea go into [cup1]?* **yes.** An ordinary teapot of tea pours. The miss is "the scene doesn't say it has a spout or can pour" as a no: TR-P20's failure, read through the stance's "what it leaves out is open".

**Beyond the tally, in every reply:**
- **open read as no:** "what it leaves out is open" taken as "unknown, so no", above all on R-9 and R-3. In `explicit` this pulls against the per-object default, so count which line the description leans on;
- **the default as the settling source:** "as an ordinary … is" quoted to settle a point it shouldn't decide (R-1's "small", R-5's tip);
- **the conditional lines read as events:** "when [table1] moves" read as if the table had moved;
- **skimming:** the repeated lines skimmed, with a fact attributed to the wrong thing (R-8);
- **form:** the block present and parsed, the description's length, cut-offs, and text after the block.

## The decision it serves

Which render step 1 is built on:
- **`explicit`**, if it is right wherever `sections` is, and right on at least one question `sections` gets wrong;
- **`sections`**, if `explicit` loses a question `sections` gets right, unless the loss is in wording the next draft can fix. That's the user's call at the checkpoint;
- **both, as a pair in step 1**, if neither arm misses anything. The questions were too easy again, and the ruling's own cells tell the renders apart.

## Results

(Pending batches 17 and 18.)
