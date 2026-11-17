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

### Batches 17 and 18 (2026-11-17), 8 cells x1 each

Instructions `e71d174d` (`sections`, 1032 chars) and `5217a996` (`explicit`, 515 chars). No reply was malformed.

| Cell | Expected | `sections` (b17) | `explicit` (b18) |
| --- | --- | --- | --- |
| R-1 | no | no: "generally understood … typically larger than a cup" | no: "an ordinary cup … typical sizes" |
| R-3 | yes | **no:** "does not provide any information about the weight or size" | yes: no weight given, "but … an ordinary small round tea table" |
| R-4 | yes | yes | yes |
| R-5 | no | no, **from absence:** "no information … about the stability" | no: "could potentially fall off unless they are secured" |
| R-6 | yes | yes, from common sense | yes, quoting the carry line |
| R-7 | yes | yes | yes, quoting the carry line |
| R-8 | no | no: "separate objects" | no: the teapot is on [table1] |
| R-9 | yes | **no:** "no indication of any physical mechanism" | yes |
| **Total** | | **6 of 8** | **8 of 8** |

**Read against the rubric:**
- **Open read as no, in `sections`:** three replies settle from absence (R-3, R-5 and R-9), and all three answer no. R-5's no is right, but by the same move that loses R-3 and R-9. The user's reading after the batches agrees: "not established" is taken as "impossible", even for common-sense extensions. Verdict draft 7's ordinary-default sentence is in this arm's Reading the scene, and it was read past a fourth time (after b12, b13 and b15). The stance in the Role ("what it leaves out is open") did not stop it either.
- **Open read as no, in `explicit`:** none. R-3 states the absence and then overrides it from the per-object default line. That is the line working as meant.
- **The default line as the settling source:** it settles R-1 and R-3, rightly on both. Nowhere does it settle a point it shouldn't.
- **The conditional lines read as events:** none. R-6 and R-7 quote the carry line as a rule, and R-5 uses its "unless" clause.
- **Skimming:** R-8's first clause garbles the direction ("[saucer1] … moves with whatever is on it"), but its deciding clause is right. R-9's right answer comes with thin reasoning: it never says the cup is under the spout. A right answer with weak support, read at x3.
- **Form:** every block parsed. Descriptions were one or two sentences, with no cut-offs.

**The user's reading (2026-11-17):**
- **The hedging is warranted, not a fault.** The questions come with no context for how much certainty or improvisation is allowed, so Micro is careful because it doesn't know the rubric its answer has to meet. That suits this test, which asks whether Micro handles fundamental questions across cases. R-5's "could potentially fall off" in `explicit` is not a concern.
- **R-5's absence-based hit in `sections` makes the gap 5 against 8 in substance**, which doesn't change the conclusion. A lucky hit in `explicit` would have, so that is the direction that would warrant testing.

**By the decision rule:** `explicit` is right wherever `sections` is, and right on two questions `sections` misses (R-3 and R-9). That points to the explicit render, pending the confirm at x3 on the split, R-3 and R-9 (batches 19 and 20).

### The confirm: batches 19 and 20 (2026-11-17), R-3 and R-9 x3 each

Instructions as in batches 17 and 18, and the inputs hashes match. No reply was malformed.

| Cell | `sections` (b19) | `explicit` (b20) | With b17/b18: `sections` | `explicit` |
| --- | --- | --- | --- | --- |
| R-3 (yes) | yes, no, yes | yes, yes, yes | 2 of 4 | 4 of 4 |
| R-9 (yes) | no, no, no | yes, yes, yes | 0 of 4 | 4 of 4 |

**`sections`:**
- **R-9:** all three settle from absence ("no indication of any mechanism or physical connection"), as in b17. A teapot pouring is never brought in from common sense.
- **R-3 is split:**
  - r2 settles from absence and answers no;
  - r1 also settles from absence, but turned the other way: "no constraints are mentioned … reasonable to assume" one person could lift it;
  - r3 uses the ordinary: "Given ordinary circumstances". This is the first sign of the guide's ordinary-default sentence being used, once in 4.

**`explicit`:** the answers are right 6 of 6, but the descriptions are weaker than the answers:
- **R-3:**
  - r1 and r2 rest on the default line ("an ordinary small round tea table");
  - r3's description gives no support at all and answers yes anyway;
  - all three call the table "stationary", which no line says. Perhaps it is drawn from the conditional "When [table1] moves" (mine, a guess). It is harmless here.
- **R-9:**
  - r1 and r2 say the tea "would flow out unless obstructed". In r2 the obstruction is "a cup placed under its spout", which would catch the tea, not obstruct it. The "unless …" shape may be borrowed from the carry lines (mine, a guess);
  - r3 says the distance and angle aren't given, and answers yes anyway.

  So R-9 is right 4 of 4, with a description that supports the answer in none of them.

**The decision rule, confirmed:** `explicit` is right wherever `sections` is, and right where `sections` misses (R-3 2 of 4 against 4 of 4, R-9 0 of 4 against 4 of 4). That points to the explicit render for step 1. **To carry into step 1:** the descriptions can be weaker than the answers (R-9). The ruling is graded on the answer alone, so a right answer with no support counts as right. Its rubric should read the descriptions for this.

## The checkpoint (2026-11-17)

**The explicit render, for step 1** (the user). The user called the results strong, and encouraging for strength downstream. **The user's reading:** taking away the "you are interpreting a data structure" framing unlocked Micro's ability to apply common sense. A guide that decodes a format, beside a render that needs decoding, sets the task as reading a structure. Then what the structure doesn't encode reads as absent, and absent reads as no. The same ordinary-default rule settled R-3 and R-9 every time once it was a line about each thing, though as a sentence in the guide it was read past.
