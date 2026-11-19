# Item standing: what an agent proposes, held apart from what an authority has checked

**Status (2026-11-19): opened; step 0's design written and reviewed the same day, IS-1 to IS-8 settled; step 1, the build, done the same day. Next: step 2, the drafts (deploy first).** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user at the hand-back of `playByPlay`'s expand plan (retired 2026-11-19). It is local to `playByPlay`'s open problems for its first iteration.

**Why** (the user, 2026-11-19):
- **The pieces can only speak where they are authoritative, and that limits how far they can collaborate.** `playByPlay`'s imagination finds the chain on OC-20 whether or not saying so is its job. With no channel for it, the observation leaks into the one channel it has authority over, the method: the grip is sited by the chain, 3 of 3 in batch 34 ([read](oracleLoopDrafts/playByPlay/19.notes.md#results-2026-11-19-batch-34); [diagnosis](oracleLoopDrafts/playByPlay/18.notes.md#diagnosis-with-the-user-2026-11-19)). In batch 31 the Problems section held it, and the method stayed ordinary.
- **Tuning to suppress it is the wrong road.** No guard rail would keep an imagination from wandering past the parts of its job it has authority over.
- **The system needs a register for "someone proposed this as a maybe, and the agent that could be authoritative on it has *not yet* checked it."**
- **The trial showed the same need from the reader's side.** An argument against, and a rebuttal, rendered in the scene's register, were read as established. The judge needed hypotheses it could hold more lightly than the established facts. The trial question plan set argued-text weighing aside, not rejected; this is where it returns.

**What this plan contains:** the plan type gains a standing for proposed content and a `violation` item kind; the scene's rules get handles; `playByPlay`'s reply may carry proposals; its cells and drafts are tuned on them.

**Settled by the user (2026-11-19):**
- **The requirement, above.** First iteration local to `playByPlay`'s problems.
- **`consequence` items can be labelled as proposed or unchecked.** **The wording, and how it is rendered, is crucial and will need tuning.**
- **A new item kind, `violation`:** "this violates one of the rules in the scene". It names which rule, and it too can be unchecked. **Refined (2026-11-19):** the kind `rule`, with a `violation` or `consistent` stance (IS-4).
- **The scene's rules get handles,** for reference.
- **`playByPlay` can say "you're asking the wrong agent":** the step is atomic, with a proposed, unchecked consequence ("[table1] moves away from [wall1]") and a further unchecked violation (the chain's rule). This follows from `playByPlay` not being authoritative on consequences either (mine, agreed).

**Settled with it (mine, agreed by the user in discussion):**
- **Code sets the standing, not the model** (the user's principle: the reply gives only what the model alone can provide). Code knows who wrote an item and whether that piece is authoritative for its kind, so a `playByPlay` consequence or violation merges as unchecked. An authority's check replaces the item with a confirmed one (IS-2: there is no `rejected`, and confirming is replacing with the item as written). No piece can raise its own claim, which guards against laundering.
- **A violation nests under the consequence it follows from.** The model can't know the path code will mint, so code mints both paths and records the link. It is checkable as one question: "does this consequence break that rule?" It filters by its shape: OC-1's glue rides along, and "[teapot1] rises with [table1]" breaks nothing.
- **Proposals attach where the motion is:** to the target step when the reply is atomic, and to the sub-step that causes them when it expands.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). An implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md): a Prototype, whose checkers come later.

## Step 0's design (reviewed by the user, 2026-11-19; mine unless marked)

**1. Standing on every item** (IS-1, IS-2):
- **A required field, `standing: 'unchecked' | 'confirmed'`** (mine, agreed), on every planned step, sub-step and item. It is required rather than an optional tag, since every item has one (the user's IS-1). **The cost:** every hand-built plan and test fixture gains the field.
- **Code sets it at the merge,** from the author and a fixed authority map, never from the reply. `MergeOptions` gains `author`, the writing piece.

| Kind | Authority |
| --- | --- |
| a plan's own steps (`planOf`, the candidate's) | the plan's source: confirmed |
| `step` (a sub-step), `intent` | `playByPlay`, the method |
| `consequence`, `possibility` | `consequences` |
| `rule` | the rule cell |
| `concern` | `consequences`, while the kind lasts |

  An item from its kind's authority merges confirmed, and any other merges unchecked.
- **The check, one change form, built and typed, used by no piece yet** (the checkers are out of scope): `{"replace": "<path>", "with": {…}}` replaces an unchecked item with a confirmed one of the same kind.
  - The replacement may be an opposite, a more nuanced agreement, or the item as written.
  - The replacement gets a path minted afresh once the old item is gone. **The identical case is a confirmation:** the same text gives the same slug, and so the same path. It is deterministic, so no separate `confirm` form is needed (the user, 2026-11-19).
  - The old item's children leave with it.
  - It is refused from anything but the kind's authority, on a confirmed item, and across kinds.
  - **The checker's reply may still offer two choices,** "confirm as written" and "replace with", since asking a model to rewrite a claim just to agree invites drift. Code translates a confirm into a `replace` with the original text, as `replyChange` does for `playByPlay`. That reply form is the checkers' plans' to decide.
- **Laundering, by construction:** no piece can write a kind it isn't the authority for as confirmed, since the merge decides.

**2. The rule item** (IS-4):

```ts
| { kind: 'rule'; path: string; standing: Standing; rule: RuleHandle; stance: 'violation' | 'consistent' }
```

- **It nests in the consequence it follows from** (`consequence.rules`). Its path is flat in the step's item scope, as a possibility's branch consequences are: `lift-table1-straight.table-secured-to-wall`.
- **No reason text** for now, as `atomic` has none. Booked if the rule cell wants one.
- **It can't stand alone** (mine, agreed): a rule is kept or broken by what moves, so a rule item hangs on the consequence that says what moves.
- **The rule must be a handle the scene holds.** It is matched against the full scene's `judgeRules`, and unlike an object it can't be improvised.
- **Rendered** `Rule (Violation)` or `Rule (Consistent)` (the user's), under its consequence.

**3. The render** (`renderPlanForGenerator`; IS-1's render wording, three candidates, tuned in the drafts):
- **R1:** `(unchecked)` after the path, as `(atomic)` and `(intended)` are. A confirmed item has no tag and reads as fact. The start (mine, agreed).
- **R2:** `(unchecked, proposed by playByPlay)`, naming the proposer.
- **R3:** each step's unchecked items grouped under a `Proposed, not yet checked:` line.

**4. `playByPlay`'s reply with proposals** (IS-5, settled with the user 2026-11-19):
- **One key, `consequences`, at two scopes, mirroring the plan:** `{"steps": [{"says", "intent"?, "consequences"?}, …], "consequences"?: […]}` and `{"atomic": true, "consequences"?: […]}`.
  - A sub-step's `consequences` attach to that sub-step: what that motion brings about.
  - The record's own `consequences` attach to the target: what the step as a whole brings about, and the only place they can go when the reply is atomic.
  - Each entry is `{"says", "thing"?, "rules"?: [{"rule", "stance"}]}`.
- **Named for the kind, not the standing** (the user's point): a key such as `proposals` would have the model classify what code decides from the authority map. It would invite hedging, method moved into proposals or outcomes into the method, and it would mislabel an authority's own consequences. The unchecked register shows in the render downstream.
- **Placement is the model's to give** (mine): code can't tell which motion causes a consequence, so asking for the nesting keeps to "only what the model provides".
- **Why `playByPlay` may offer them freely** (that what happens beyond the motion is checked by others) is Role or Task wording, tuned in the drafts, not a key (mine).
- **Recorded, not refused:** the same consequence at both scopes.
- **Refused:**
  - a rule outside a consequence;
  - a rule handle the scene doesn't hold;
  - a stance other than `violation` or `consistent`;
  - a consequence with no `says`;
  - `replace` (`playByPlay` is no authority for consequences or rules);
  - keys other than those named.
- **Code supplies the rest,** as now:
  - the verbs, the list and `to`;
  - the paths;
  - the standing: sub-steps and intents confirmed, consequences and rules unchecked.
- **IS-8 (settled by the user, 2026-11-19: `playByPlay` needs the authority to decompose intent):** a sub-step's intent is the method's aim, and so `playByPlay`'s authority, confirmed. What happens beyond the aim, to other things, goes in `consequences`, unchecked. So "[table1] rises off the floor" is an intent, and "[table1] pulls away from [wall1]" is a proposal.

**5. Worked examples.** Each render is the plan after the merge, under R1.

**OC-20** (`teaTableChained`, the `missing` "how [table1] is held and lifted"). The scene line, with `rules: 'handles'`:

> - [table1] Table (a small round tea table) is in the Parlour. [table1] is chained to [wall1] (rule [table-secured-to-wall]). [table1] and [wall1] cannot be moved apart until they are freed. They can still be moved together. …

The reply:

```json
{"steps": [
  {"says": "grip [table1] by its edges", "intent": "[table1] is held firmly"},
  {"says": "lift [table1] straight up", "intent": "[table1] rises off the floor",
   "consequences": [{"says": "[table1] pulls away from [wall1]", "thing": "[table1]",
                     "rules": [{"rule": "[table-secured-to-wall]", "stance": "violation"}]}]}
]}
```

The merged plan:

```text
Step pick-up-table1: pick up [table1]
  - intent pick-up-table1.intent: pick up [table1]
  - step grip-table1-by: grip [table1] by its edges
    - intent grip-table1-by.intent: [table1] is held firmly
  - step lift-table1-straight: lift [table1] straight up
    - intent lift-table1-straight.intent: [table1] rises off the floor
    - consequence lift-table1-straight.table1-pulls-away (unchecked): [table1] pulls away from [wall1]
      - Rule (Violation) lift-table1-straight.table-secured-to-wall (unchecked): [table-secured-to-wall]
```

The grip is ordinary, and the chain is only in the proposals. This is the user's first watch item.

**The wrong-agent cell: booked, not built** (the user, 2026-11-19; Out of scope, below). The atomic reply with `consequences` stays in the form, unit-tested, with no batch cell yet.

**OC-1, the control** (`teaTable`, "how [table1] is held and lifted"). An expansion as in batch 34. If there is a proposal, it is the carry: "[teapot1] rises with [table1]", with `Rule (Consistent)` on `[teapot-secured-to-table]`. **A defect:** `Rule (Violation)` on the glue (batch 15's "hindering" flag, in the new form).

**The concession cell** (new; the user's third watch item). OC-20's plan arrives already holding a wrong proposal on the target, as if from an earlier proposer:

```text
Step pick-up-table1: pick up [table1]
  - intent pick-up-table1.intent: pick up [table1]
  - consequence pick-up-table1.table1-cannot-be (unchecked): [table1] cannot be lifted
    - Rule (Violation) pick-up-table1.table-secured-to-wall (unchecked): [table-secured-to-wall]
```

The `missing` is "how [table1] is held and lifted".
- **At the bar:** the ordinary grip and lift, expanded. The method is `playByPlay`'s authority, and an unchecked claim doesn't settle it.
- **Conceding:** marking the step atomic, or a method bent around "cannot be lifted".
- **The input's proposals stay on the target, untouched,** since `playByPlay` can't replace them.

**OC-1b, OC-6, OC-19:** held to batch 34's reviewed look-fors. Proposals are allowed and recorded, but not graded.

**6. The bar for the drafts** (IS-7; the reviewed look-fors lead, my added bounds listed apart):
- **The authoritative part, per cell:** batch 34's reviewed look-fors, unchanged. The method is graded on its own.
- **OC-20:**
  - reviewed: no unchaining, no wall moved;
  - **graded (the user, 2026-11-19):** the chain out of the grip's placement, in the proposals only. Tuned until it holds, **unless the tuning shows something new about how the failure occurs**, which is then read before tuning on. It was my bound in batches 32 to 34; the user adopted it now there is an outlet.
- **The OC-1 control:** no `Rule (Violation)` on the glue.
- **The concession cell:** the ordinary method, not atomic.
- **Form:** every reply merges.
- **Recorded:**
  - proposals per cell, true or false;
  - proposals that restate the method;
  - the stance chosen;
  - which render candidate is in force.

## Concerns of the shape (named in discussion, 2026-11-19; mine unless marked)

Step 0's design answers each, or names it as booked:
1. **Who is authoritative for what.** "Unchecked" is relative to an agent that could check it. A fixed map from item kind to authority does for this iteration: a consequence goes to `consequences`, a violation to the rule cell. A routing policy beyond that is out of scope.
2. **Laundering.** A proposal must not gain standing by passing through more agents. When `consequences` reads `playByPlay`'s unchecked consequence and restates it as its own, it has quietly become established. Standing travels with the content, and only the authority changes it.
3. **Checking costs calls.** A cheap register for maybes invites many of them, and the flags' sensitivity costs oracle calls, not answers (the imagination plan's IM-4 hold). Which proposals get checked is a consumer's question, recorded here and not decided.
4. **The render is half the mechanism.** The marker works only if every reader's render keeps the registers visibly apart (the trial's lesson). A status that renders like a fact repeats it.
5. **The change rule.** A check is one form, `replace`; confirming is replacing with the item as written. **Replacing is not additive** (IS-2, the user: no audit history in the plan), so the rule widens to "add, set a once-only tag, or replace an unchecked item with a confirmed one" (an opposite, a more nuanced agreement, or the item as written), only by the kind's authority. It is the first slice of revise.
6. **The request and its answer may be the same mechanism.** A request is a judge's statement of need, and an answer is a response from an imagination step, each with a source. The question-and-answer record (the parent's open need, and the atomic tag being global where atomic is relative to the request) may fall out of standing. Named, not built here.

## What to watch for as we execute

The user's (2026-11-19), each with how a batch would show it (mine):

1. **The hoped-for outcome:** `playByPlay` (and probably `consequences`) can deliver more focused responses, where their authoritative results are reliable, whatever the status of their proposed results.
   - *How it shows:* the authoritative part and the proposals are graded apart. The method is held to batch 34's look-fors on its own, so a gain or loss there isn't masked by how good the proposals are. OC-20 is the test: an ordinary grip, with the chain only in the proposals.
2. **The judgment triad's role may shift toward orchestration.** An `against` run *might* have to deduce a possible negative consequence on its own, or it *might* find a proposed consequence already present, and add its endorsement: "Yeah, that *does* look like a problem; that sounds like my best argument." That starts to look like genuine collaboration, if it works.
   - *How it shows:* not in this plan's batches, since the judging pieces don't read the plan yet (out of scope, above). Recorded here so the plan that moves them onto it designs for both paths, and compares `against` with and without a proposal present.
3. **The risk:** steps may over-index on proposals as input, even to the point of conceding without judgment in areas where they have authority.
   - *How it shows:* a cell whose input already holds a proposal that is wrong for the piece's own authority. For `playByPlay`, a plan carrying an unchecked violation ("[table1] can't be lifted; the chain") on a step it is asked to expand. Conceding would read as marking it atomic, or bending the method around the proposal, rather than giving the ordinary method. A candidate for IS-6 (mine).

## Out of scope, named so it isn't lost

- **A resilience pass: wrong answers and guidance from upstream** (booked by the user, 2026-11-19). Its first cell is the "wrong agent" one: OC-20's scene with a request outside the method ("how far [table1] is raised", which fails the `missing` test, as a real requester sometimes will). Its bar: atomic, with an unchecked consequence the chain bounds; an expansion carrying that consequence on its lift is a near-miss (mine). It is the first batch use of the atomic reply with `consequences`.
- **The checkers:** revise-mode `consequences` checking a proposed consequence, and the rule cell ruling on a proposed violation. This plan builds the one check form, `replace`, and no checker runs; each checker's reply form ("confirm as written" or "replace with", translated by code) is its own plan's. Revise is booked on the parent's [action plan item](AGENT.oracleLoop.planning.md#recommended-order).
- **The trial and the other judging pieces reading unchecked items.** They don't read the plan yet (the bridge state, in calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)). When they do, a claim aimed at a path that has since been replaced needs a rule (mine).
- **`consequences` writing violations or proposals.** It follows once the kinds exist.
- **The question-and-answer record** (concern 6), unless step 0's design shows it falls out at no cost.
- **`playByPlay`'s other booked problems** that don't wait on this: OC-6's bare handles, the grain, intents restating their sub-step ([imagination plan](AGENT.imagination.planning.md), step 2).

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan): the item kinds, flat paths and the sub-step exception, the change language, `MergeOptions`, the render, and where `concern` stands. Then `playByPlay`'s paragraph in [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece): its inputs (`missing`), its one-object reply read by `replyChange`, and its cells.
3. Read the parent's Slice 4.5 [action plan item](AGENT.oracleLoop.planning.md#recommended-order) and its booked items: the breakdown positing consequences, revise, `consequences` on sub-steps.
4. Read `playByPlay`'s record: the [imagination plan](AGENT.imagination.planning.md)'s step 2 and its bookings; [18.notes.md's diagnosis](oracleLoopDrafts/playByPlay/18.notes.md#diagnosis-with-the-user-2026-11-19); [batch 34's read](oracleLoopDrafts/playByPlay/19.notes.md#results-2026-11-19-batch-34); and batch 31's Problems section, [16.notes.md](oracleLoopDrafts/playByPlay/16.notes.md#results-2026-11-18-batch-31), where the chain went 3 of 3.
5. Read the trial's argued-text record in the [trial question plan](AGENT.trialQuestion.planning.md): QS-3 (whether the ruling ever sees the argument, set aside, not rejected) and step 1.5's verdict, which took the argued text wholesale.
6. Read the code, under [`lambda/ephemera/`](../../../../../lambda/ephemera/):
   - `calibration/oracleLoop/actionPlan.ts` (`StepItem`, `mergeChanges`, `mergeStepChanges`, `renderPlanForGenerator`, `bracketChanges`);
   - `calibration/imaginationPieces/playByPlay.ts` (`replyChange`, `playByPlayContract`, the cells);
   - `dataSource/actions/sceneProse/renderSceneExplicit.ts` and `sceneRules.ts`, where a securing becomes a carry line and a rule;
   - who else renders the explicit scene: `calibration/oraclePieces/nonRuleCell.ts`, `sceneReading.ts` and the trial (`trial/renderPins.test.ts` pins its renders).
7. Calibration's [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
8. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md). From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. Both pass before any edit.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The design, reviewed before it's built** (text only), with worked examples on the cells ([reviewed](#step-0s-design-reviewed-by-the-user-2026-11-19-mine-unless-marked), 2026-11-19):
   - [X] **Standing** (IS-1, IS-2; values and lifecycle settled by the user): the field, the one check form `replace` (its refusals, the fresh path, the identical case as a confirmation, children leaving), and two or three render wordings to try.
   - [X] **The rule item** (IS-4; the kind `rule` with a `violation` or `consistent` stance, settled): its fields, its path, its render, and whether one can stand without a consequence.
   - [X] **Rule handles** (IS-3): how a rule is minted and shown in the explicit render, and which pieces see them.
   - [X] **`playByPlay`'s reply** (IS-5): proposals beside an expansion or the atomic mark, their placement, the refusals, and what code supplies.
   - [X] **The cells and the bar** (IS-6 settled, IS-7): OC-20, the OC-1 control, the concession cell, and OC-1b, OC-6 and OC-19 held. Reviewed look-fors and my added bounds listed apart.
1. [X] **The build,** in code with tests and no LLM: rule handles in the render; standing (required on every item, set by the merge from author and authority), the `rule` kind and `replace` in the plan type; the `rules` tag in `renderSceneExplicit`, with handles minted from the full scene; `playByPlay`'s reply with `consequences` at two scopes; the render (R1); the six cells. Each part checked off as it lands. Rules in calibration's The action plan and `playByPlay`'s paragraph.
   - [X] **Rule handles in the render** (IS-3): `renderSceneExplicit(scene, { rules: 'handles', full })` tags each securing's fact ` (rule [h])`, the handle found by its edge in `judgeRules(full)`; `ruleTagHandles` reads the tags back; the imagination's `rules` option takes `handles`, with the explicit render only.
   - [X] **Standing** (IS-1, IS-2): required on every step and item, stamped `confirmed` by the builders and by the merge from `author` (required in `MergeOptions`) and the authority map. A possibility's standing covers its branches (mine).
   - [X] **The `rule` item** (IS-4): its own type, held only in `consequence.rules`, so it can't stand alone by construction (mine); its path its handle, unslugged (mine: a slug drops the "to"); `rules` on a consequence change, checked against `MergeOptions.rules`; no rules in a branch.
   - [X] **`replace`** (IS-2): consequence and rule only, the kinds that can be unchecked today, gated by `MergeOptions.replaces`, off by default, so no piece takes it (mine).
   - [X] **`playByPlay`'s reply with `consequences`** (IS-5, IS-8), at both scopes (`replyChanges`). Its rules are checked against the handles the prompt shows (`ruleTagHandles`), not the full scene's list, since the contract's parse is synchronous and a fixture builds asynchronously (mine; each shown handle is minted on the full scene). `read-plans` now renders each cell with the batch's options, so it reads what the prompt showed.
   - [X] **The render, R1:** `(unchecked)` after the path; `Rule (Violation)` and `Rule (Consistent)` under their consequence.
   - [X] **The six cells** (IS-6): the default `rules: 'handles'`, the concession cell (`OC-20/concession`), the look-fors, the hashes re-pinned (`5d7de0bb`, `b40d7083`, `d7e1d475`, `cd2cd21f`, `eec99d53`, `a401a721`).
2. [ ] **The drafts:** the ask taught to propose, from draft 20. Deploy first. The bar is step 0's (IS-7), with batch 34 the comparison for what the drafts already do.
3. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| IS-1 | The standing's values and names, and how they are rendered to a reader | Steps 1 and 2 | The user | **Settled** (the user, 2026-11-19): **two values, `unchecked` and `confirmed`, and every item carries one.** An item is confirmed when its author is the authority for its kind (`playByPlay`'s method, `consequences`' consequences), and unchecked otherwise, until the authority confirms it. Open: how each renders (crucial, tuned in the drafts) |
| IS-2 | The lifecycle: how a check lands | Step 1 | The user | **Settled** (the user, 2026-11-19). **No `rejected`.** The kind's authority **replaces an unchecked item with a confirmed one**: an opposite ("[teapot1] slides off [table1]" replaced by "[teapot1] moves with [table1], glued in place"), a more nuanced agreement ("[table1] moves away from [wall1]" replaced by "[table1] rises until the chain is taut"), or the item as written. **One change form, `replace`:** confirming is replacing with the item as written, which keeps its path, since the same text gives the same slug. A checker's reply may still offer "confirm as written" and "replace with", translated by code. **The plan keeps no audit history:** the replaced item leaves the plan (the user, on my proposal of a link back). **A replaced item's children leave with it** (the user, agreeing my lean): the replacing piece may propose them again as new, unchecked items, with no continuity tracked, since a re-proposal may have different reasons. **What follows (mine, to review):** the change rule becomes "add, set a once-only tag, or replace an unchecked item with a confirmed one"; only the kind's authority may replace, only an unchecked item, and only within its kind; a confirmed item is never replaced. A changed replacement takes a fresh path (a reused path's slug would go false). Replacement is the first slice of revise (booked on the parent); the rest stays booked. **Built 2026-11-19;** its rules in calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) |
| IS-3 | Rule handles: how minted, how shown in the explicit render, and which pieces see them | Step 1 | The user | **Settled.** **Minting** (the user, 2026-11-19): the securing rule type keeps its existing scheme, `judgeRules` in `sceneRules.ts` (stemmed ends joined by `-secured-to-`, `teapot-secured-to-table`; the full handles on a stem collision), which the rule cell already reads rules by, so its checks need no translation. **Minted from the securing edge, never from a render** (agreed 2026-11-19, on my finding): `judgeRule` gives a rule one end, `<end>-secured`, when the other end isn't a thing in the scene rendered (`notShown`, `otherRoom`, `someoneElse`, `inside`), and `subScene` makes `notShown` by dropping things, so the same rule was `table-secured-to-wall` in the full scene and `table-secured` in a sub-scene without [wall1]. A rule's handle comes from its edge's two endpoints in the full scene, the same in every render, and a render that doesn't show the other end still prints the full handle; the single-end form goes for securings between two things. A `someoneElse` or `otherRoom` securing gets a form when a cell needs one (none does) (mine: reused as is; the manner, "glued", would read better but changes the rule cell's and the judge render's pins). **Later rule types are obliged to mint their own scheme** (the user), unique across the scene, since rule handles share a namespace with each other and with things (mine). **Which pieces see them: the caller decides, through the `rules` tag pushed down into the render's arguments** (the user, 2026-11-19: the callers already tag when rules show). Today the tag (`rules: 'none' | 'consequence'`, `imaginationScene.ts`) acts only on the judge render; `renderSceneExplicit` takes no options, and the parser refuses `rules: 'consequence'` with it. **Mine, to review:** `renderSceneExplicit(scene, { rules })`, default `'none'` (today's output, so the trial's pins, the non-rule cell and scene reading are unchanged), and a new value (say `'handles'`) tagging each securing's carry line with its `judgeRules` handle; `playByPlay` opts in; `'consequence'` stays judge-only. **How it reads: inline after the securing sentence, to start** (the user, 2026-11-19, of three candidates; tuned from the batches): "[cage1] is hung from [hook1] (rule [cage-secured-to-hook])." The smallest change to the tuned carry line (mine); the alternatives on record are the rule leading its own sentences, and a separate Rules list after the things. **Built 2026-11-19;** its rules in calibration's [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) |
| IS-4 | The rule item | Step 1 | The user | **Settled** (2026-11-19): **one kind, `rule`, with a stance, `violation` or `consistent`** (mine, agreed by the user), naming the rule by its handle and nested under the consequence it follows from; its opposite is the other stance on the same rule (IS-2). **Rendered** `Rule (Violation): …` and `Rule (Consistent): …` (the user). **It can't stand alone** (mine, agreed 2026-11-19): a rule is kept or broken by what moves, so a rule item hangs on the consequence that says what moves. **Built 2026-11-19;** its rules in calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) |
| IS-5 | `playByPlay`'s reply with proposals | Step 1 | The user | **Settled** (2026-11-19): **one key, `consequences`, at two scopes, mirroring the plan**: on each sub-step entry (that motion's) and on the record itself (the target's), in both `{"steps"}` and `{"atomic": true}` (the user: a single array in both records, and each step having its own by its nature). **Named for the kind, not the standing** (the user: `proposals` would presuppose the judgment code makes from the authority map). Atomic with proposals (the user, earlier). Placement is the model's to give (mine). The refusals are in step 0's design. **Built 2026-11-19;** its rules in calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) |
| IS-6 | The cells | Steps 1 and 2 | The user | **Settled** (2026-11-19): **six cells, 18 calls a batch.** OC-20 (expanded, the chain in unchecked consequences and rules); OC-1, the false-violation control (no `Rule (Violation)` on the glue); **the concession cell** (OC-20's plan arriving with an unchecked "[table1] cannot be lifted" and its `Rule (Violation)`; the ordinary method, not atomic; the user's watch item 3); OC-1b, OC-6, OC-19 held to batch 34's reviewed look-fors, the regression guard for watch item 1 (mine). **The wrong-agent cell is booked** for a resilience pass on wrong upstream answers and guidance (the user: premature here; Out of scope). Every cell renders with `rules: 'handles'`, so every inputs hash changes at the build |
| IS-7 | The bar for step 2 | Step 2 | The user | **Settled** (2026-11-19): the method held to batch 34's reviewed look-fors on every cell; **OC-20's chain out of the grip's placement, in the proposals only, tuned until it holds unless the tuning shows something new about how the failure occurs** (the user, adopting my earlier bound now there is an outlet); the OC-1 control with no `Rule (Violation)` on the glue; the concession cell's ordinary method, not atomic; every reply merging. Not parity with batch 31 |
| IS-8 | Whether `playByPlay`'s sub-step intents are its own authority | Steps 0 and 1 | The user | **Settled** (2026-11-19): **`playByPlay` needs the authority to decompose intent**, so a sub-step's intent is the method's aim, confirmed. What happens beyond the aim, to other things, goes in `consequences`, unchecked. **Built 2026-11-19;** its rules in calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) |

## How we work

- The user runs each batch. I write each payload to the scratchpad and give its full path; results go to a file, read with `jq`.
- One repeat to explore, three to confirm. A rubric before each batch, with the reviewed look-fors and my added bounds listed apart, and the reviewed ones leading the verdict.
- Each change attributed. Each part checked off on its step's item as it lands.
- The drafts continue `playByPlay`'s numbering in [`oracleLoopDrafts/playByPlay/`](oracleLoopDrafts/playByPlay/iterations.md), from 20.

## Verification

- **Each build:** from `lambda/ephemera/`, tests and tsc produce no output. Every pinned render that changes is re-pinned with a reason (the trial's `renderPins.test.ts` among them, if IS-3 shows rule handles there).
- **A batch:** its form check, then every reply against the rubric written before it.
- **Links:** every relative link and anchor in this plan resolves.

## Progress

| Step | State |
| --- | --- |
| The design | **Done** (2026-11-19): reviewed by the user; IS-1 to IS-8 settled |
| The build | **Done** (2026-11-19): standing, the `rule` kind, `replace`, rule handles, `playByPlay`'s `consequences`, R1 and the six cells; tests and tsc clean. Rules in calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) |
| The drafts | Not started |
| Hand back | Not started |

## When it finishes

- **The rules** for standing, the `rule` kind, `replace` and rule handles go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders), and `playByPlay`'s paragraph in [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece).
- **The checkers' plans** (revise-mode `consequences`, the rule cell on proposed violations) get the typed check to build on.
- **The imagination plan** gets `playByPlay` back; the parent's item is ticked with what was booked.
- **A sweep for inbound links and plan-ID markers** (`IS-n`), then this plan is deleted.
