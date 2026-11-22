# Piece views: each prompt's view of the shared state

**Status (2026-11-21): step 0, the design pass, done ([The design pass](#the-design-pass); VW-1, VW-2, VW-3 and VW-5 decided, VW-4 handed to the parent; VW-3 corrected the same day, the stance kept); step 1, the build, done; step 2 in progress: the view's amendment for confirmed rules built, the look-fors rewritten, draft 34 (on draft 32) written for batches 60 and 60b.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user at the close of the item standing plan (retired 2026-11-21), whose remaining standing problems were all ones a view removes. An implementation plan: the first prototype is designed and built here, with `playByPlay`'s view its first instance.

## The idea (the user, 2026-11-21)

**Every prompt has a viewpoint, and its inputs are built to respect it.** A view decides two things for a piece:
1. **What gets in:** the kinds of item, and the facts, its task can make use of. What it can't use is filtered out.
2. **How what gets in is worded:** in language aligned with the piece's task.

The action plan carries everything: a proposed rule violation, another agent's unchecked consequence. A piece's render shows only its view, so `playByPlay`, which has no use for a proposed violation in any case, is never shown one.

**The line between filtered and kept (mine, agreed):** filter judgments and other agents' claims, not the facts they rest on. `playByPlay` still needs the chain, with its slack, worded for its task, to write "[table1] pulls against its chain to [wall1]". It doesn't need anyone's verdict on it.

**The reply side mirrors it (mine, agreed):** a reply asks only for what its view supports. **Except for an outlet** (the user, 2026-11-21): a reply may ask for a slot the piece never reads back, when the slot gives the model somewhere for thoughts that would otherwise go into the output it is the authority for. `playByPlay`'s rule stance is one: it doesn't read stances, but writing "pulls against its chain" with a `violation` keeps the chain out of the method. A stray stance is an unchecked claim, which its checker rejects for a call. A thought pushed into `steps` merges confirmed, and nothing checks it. So an outlet slot that is overfilled is not failing; its measure is the output it protects.

## Why (the evidence)

By calibration's [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro):
- **§3, the filler comes from the most authoritative nearby text.** Whatever is shown is a source: `OC-20/proposed`'s input proposal written back as a sub-step (batch 58, one-entry `steps` 3), the concession cell's unchecked "cannot be lifted" read as fact (drafts 21 to 22a), the scene's glue sentence mirrored as a `causes` (draft 32).
- **§1, shown isn't read, and the render is prompt text.** A block that can't help costs attention, and the render's wording moves replies as the ask's does.
- **§2, every slot gets filled.** The rule stance survived three renames (drafts 28 to 30) with its strays flat; a slot that isn't asked for can't be overfilled. That is no case for dropping an outlet ([The idea](#the-idea-the-user-2026-11-21)): the stance stays.

**What the item standing plan left, all removed by a view** (the user, 2026-11-21): `playByPlay` mis-responding to incoming rule violations and provisional consequences. Its other open problems are `playByPlay`'s own tuning, in the [imagination plan](AGENT.imagination.planning.md)'s step 2.

**Views that already exist, ad hoc** (inventoried in step 0, [The inventory](#the-inventory)):
- the non-rule cell's render leaves out the Rules section, "since securing is the rule cell's", and the rebuttal's leaves out the securing itself (calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece));
- `playByPlay`'s `rules: 'conditions'` and `consequences`' carry lines word the same securing for each task;
- the per-piece `scene` option and `JUDGE_RENDER_HOLDOUTS` ([Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders));
- `renderPlanForGenerator`, one plan render for every generator.

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) (the item kinds, standing, the change language, the merge, the generator's render), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) (each piece's inputs and render), [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
3. Read the parent's Slice 4.5 [items](AGENT.oracleLoop.planning.md#recommended-order): the action plan item's checker bookings (revise-mode `consequences`, the rule cell on proposed violations) and the resilience pass, which a view changes.
4. The scene side's earlier work: the [scene projection plan](AGENT.sceneProjection.planning.md)'s SP-10, rendering a scene for an LLM reader.
5. The code, under [`lambda/ephemera/`](../../../../../lambda/ephemera/):
   - [`calibration/oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts): the plan types, the merge (a revision clears the target's items) and `renderPlanForGenerator`;
   - [`calibration/imaginationPieces/playByPlay.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/playByPlay.ts) and [`imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts): the reply, the cells, the scene options;
   - [`calibration/pieceProbe/sceneRenders.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/sceneRenders.ts) and its test, the model for a check that every piece declares its view;
   - [`calibration/oraclePieces/nonRuleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/nonRuleCell.ts): a render that omits the securing.
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md). From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. Both pass before any edit.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The design pass, with the user** (done 2026-11-21) (text only, before any build):
   - [X] **The inventory:** each piece's views as they stand, what each shows and leaves out, and how it words them (done 2026-11-21, [The inventory](#the-inventory)).
   - [X] **What a view declares** (VW-1) and **where it lives in code** (VW-5) (both decided 2026-11-21).
   - [X] **The reply side:** each piece's reply asks only for what its view supports, outlets aside; for `playByPlay`, the stance (VW-3, VW-4).
     - [X] VW-3 (decided 2026-11-21: (a), a proposal names its rule; corrected 2026-11-21: it keeps its stance, an outlet).
     - [X] VW-4: who checks each stance (handed to the parent 2026-11-21, a checker's question).
   - [X] **A revised step's children** (VW-2; decided 2026-11-21: called into question and marked stale).
   - [X] **The authority map's mirror:** a checker's view always shows the claims it rules on (decided 2026-11-21, [The checker's mirror](#the-checkers-mirror)).
1. [X] **The build,** in code with tests and no LLM, each part checked off as it lands (done 2026-11-21, but for the ask's half of the revision rule and the view's amendment for confirmed rules, both step 2's):
   - [X] the view type, and the render built from a view (built 2026-11-21): `PlanView` (`reads`, each kind `all` or `authoritative`) and a pure `viewPlan` in `actionPlan.ts`; a required `view` on the registration (`PieceView`, the plan side only for now), so tsc holds every piece to declaring one, and an optional `merges` beside it for the registry's checks. The judges declare `NO_PLAN_VIEW`; `consequences` declares `WHOLE_PLAN_VIEW` and renders through it, its hashes unchanged;
   - [X] `playByPlay`'s view (built 2026-11-21 as proposed, `PLAY_BY_PLAY_VIEW`; **confirmed by the user, 2026-11-21, with one amendment deferred to step 2:** confirmed rule items whose stance isn't `violation` are read, since a confirmed `causes` or `voids` explains a confirmed consequence, a fact, where a `violation` is a verdict on the method, which the request's `missing` carries when a step comes back for one): the render and the contract's handles read the viewed plan, so a hidden proposal neither shows nor widens the scene. `OC-20/concession` and `OC-20/proposed` now render as `OC-20` does (`bfb8a376`), their proposals hidden: step 2's look-fors for them are rewritten on that. As first written: no rule items, and no unchecked consequences or possibilities, its own included (VW-1, no exemption). Proposed (mine, 2026-11-21, to confirm at the build): `step` and `intent` at `all` (`OC-6/command`'s intent is unchecked and there to be restated), `consequence` and `possibility` `authoritative`, `rule` and `concern` not read. Top-level steps and `alreadyAnswers` always shown. Its reply is unchanged: a consequence names the rules it bears on, each with its stance, an unchecked claim (VW-3, corrected);
   - [X] the revision rule (VW-2), in the merge (built 2026-11-21, its ask's half left to step 2):
     - [X] a revised step's children kept, unchecked, their paths minted afresh when the step's path changes, each marked stale; a `replace` clears the mark (built: `stale?: true` on consequences, rules, possibilities and concerns; a moved child keeps its slug under the new path);
     - [X] the rules it turns around (built; decided at the build, mine: `alreadyAnswers` survive a revision, as now, since they record a question asked, not a lock; a check aimed at an item of a step the same block revises is taken, naming it by its old path, where it was refused): the intent (at most one; the restatement's replaces the old, or the old is kept when it gives none, as now); the one `execution` possibility a step may hold, which a revision no longer frees; the repeat rule (a child given again matches a kept one and is dropped as a repeat; by its kind's authority, it is confirmed and its stale mark cleared, as corrected in VW-2's row); whether `alreadyAnswers` survive a revision;
     - [X] a removal, at least minimal: an authority taking out a child it rejects (today `replace` only swaps an item for one of the same kind) (built: `{"remove": "<path>"}`, taken where `replaces` is, with `replace`'s checks: an unchecked consequence or rule, by its kind's authority; a consequence leaves with its rules, a rule leaves its consequence);
     - [ ] `playByPlay`'s ask stops asking for kept items to be given again: a prompt change, so a draft of its own in step 2 (carried there: draft 34);
   - [X] a test that every registered piece declares a view (built 2026-11-21: `view` is required on the registration, so tsc holds it; `pieceProbe/pieceViews.test.ts` checks each view's kinds and readings over the flattened registry);
   - [X] (built 2026-11-21, `pieceViews.test.ts`: each merging piece's cells, a hidden unchecked item of every kind on the target, each block its options admit merging into the full plan exactly when into the viewed one; a merge built to break it is caught) the invariant that a piece's merge never refuses a block on account of anything its view hides ([A piece can write what it can't see](#a-piece-can-write-what-it-cant-see)), with a test: for each piece's merge refusals, a plan holding only items its view hides draws none;
   - [X] (built 2026-11-21, `pieceViews.test.ts`, over the pieces declaring `merges`; it binds `playByPlay` to intent at `all`, and catches a checker built not to see what it confirms) the checker's mirror ([The checker's mirror](#the-checkers-mirror)), with a test over the registry: each kind a piece's merge can confirm, read from its merge options (`replaces` for the kinds `replace` takes; `restates` for the intent), is one its view reads at `all`, stale items included.
2. [ ] **`playByPlay` on its view:** two batches per draft against the last kept draft, with the look-fors rewritten first. **The base is draft 32** (the user, 2026-11-21), "the prompt to beat": none since draft 24 was marked kept, and 33a and 33b were arms measured against it.
   - [X] **First, the view's amendment for confirmed rules** (decided by the user, 2026-11-21; deferred here so the prompt and rubrics are calibrated to the new inputs; built 2026-11-21): `playByPlay` reads confirmed rule items whose stance is `causes` or `voids`, not `violation`. In code, with tests:
     - [X] a stance filter on the rule kind's reading (built: `RuleReading`, `{ reading, stances }`, which `PlanView` takes on `rule` alone, so tsc holds it there; `PLAY_BY_PLAY_VIEW` reads `rule: { reading: 'authoritative', stances: ['causes', 'voids'] }`; the registry checks catch a filter off the rule kind, an empty one, an unknown stance, and a checker narrowed by stance, which the mirror counts as less than `all`);
     - [X] dormant until a checker writes confirmed rules (the rule cell writes no plan yet), so every inputs hash is unchanged: **a unit test, no cell** (the user, 2026-11-21), a confirmed `causes` rendered and a confirmed `violation` beside it not. What a shown `causes` should and shouldn't move is written down for when one is shown ([34.notes.md](oracleLoopDrafts/playByPlay/34.notes.md#for-a-shown-causes-no-cell-yet)).
   - [X] **The look-fors, rewritten** (2026-11-21; mine, for the user's review). The two rereads kept, their reason restated: the stance is an outlet ([The idea](#the-idea-the-user-2026-11-21)), measured by the method it protects, and a stray stance is an unchecked claim the rule cell rules on. So OC-20's lift and OC-19's pry are graded on the consequence, their tags recorded; OC-1's control is the method (no sub-step dealing with the glue), its `causes` and `violation` tags recorded. The rate of rules named is recorded beside the look-fors, not graded: a jump or a collapse there is read as the view's, its tuning the imagination plan's. `OC-20/concession` and `OC-20/proposed` render exactly as `OC-20` (one inputs hash, `bfb8a376`), so their look-fors are OC-20's and the merge's (the proposal kept, stale when the step is revised); the false "the proposal leaves unless the reply carries it forward" is gone. **Left out of the payloads** (mine): they would only be extra OC-20 samples; they stay registered as merge tests. Their resilience role is noted on the parent's resilience pass.
   - [ ] **Draft 34: kept items not asked for again** (carried from step 1; [34.notes.md](oracleLoopDrafts/playByPlay/34.notes.md), `5168af61`): draft 32's ask with the Task's "give again each of its items you keep", the coat lesson's matching clause, and the coat input's unchecked consequence cut. Six cells × 3, batches 60 and 60b, against 57 and 57b on the same cells.
3. [ ] **The other pieces declared as views,** with no change in behaviour: every inputs hash unchanged. The scene side joins the view here (VW-1's order): first, which options are experiment arms (`scene: 'judge' | 'explicit'` during the migration, kept as payload options) and which are the piece's view (`rules: 'conditions'`, `securing: 'omitted'`, `ruleCell`'s `show` and rule parts, moved into its declaration); then each piece's scene settings consolidated into its view.
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## The design pass

### The inventory

Each registered piece's view as it stands (2026-11-21, mine, read from the code; reviewed by the user).

**The scene side:**

| Piece | Scene shown | The securing, and its wording | Rules |
| --- | --- | --- | --- |
| `ruleCell` | judge render, the sub-scene of the rule's two things | the judge Graph | the one rule: its fact and enforcing rubric only (no voiding rubric, no consequence) |
| `nonRuleCell`, `stepConsiderations`, `trial/against` (default) | the whole scene; judge, or explicit by option | shown; under explicit, `actionRule`'s "cannot be moved apart until they are freed" | no Rules section |
| `trial/against` (`securing: 'omitted'`), `trial/rebuttal`, `trial/verdict`, `trial/ruling` | the whole scene (`ruling` explicit) | removed (`withoutSecuring`) | none |
| `sceneReading` | the whole scene, either render | removed | none |
| `playByPlay` | explicit, the sub-scene of `alsoShown`, the plan's handles and `missing`'s | `rules: 'conditions'`: handle tag, the condition with the relation's words, a carry keeping the slack | handles, through the tags |
| `consequences` | explicit, the sub-scene of the things and the plan's handles | `rules: 'none'`: `actionRule`'s impossibility, or the hosted carry line | none |

**The plan side:**

| Piece | Plan input | Filtered |
| --- | --- | --- |
| `playByPlay` | `renderPlanForGenerator`, the whole plan | No: every kind, every author, rule items with stances, `alreadyAnswers`; only the `(unchecked)` tag marks standing, which didn't keep the registers apart (drafts 21 to 22a) |
| `consequences` | the same render | No; dormant, since its cells hold no rule or unchecked items. It can't name a rule (`rules: 'none'`) but would be shown `Rule (...)` lines |
| `ruleCell` | its own hand-written motion lines, windowed by code at `voidedAt` | Yes: the rule's two ends, the actions the rule is in force for |
| `nonRuleCell` and the trial | their own step shape (role and consequence lines), not the action plan (the bridge state) | n/a |

**Other agents' claims, shown by design:** `trial/rebuttal` sees the argument, `trial/verdict` both sides; judging them is their task. `trial/ruling` sees the case against's question but never its `blocking`: an instance already built of filtering a judgment and keeping what it rests on, the nearest model for `playByPlay`'s view. `playByPlay` sees proposals it has no use for (`OC-20/proposed`, the concession cell), the case this plan exists for.

**The reply side:**

| Piece | Asks for | Fits its view |
| --- | --- | --- |
| `playByPlay` | `says`, `intent`, `steps`, `consequences` with `rules: [{rule, stance}]` | The stance is VW-3's question |
| `consequences` | a `changes` list, `concern` included | `concern` is booked out (the imagination plan's step 3) |
| `ruleCell` | a description, then `blocks` or `allows` | Yes |
| `nonRuleCell` | per step a `finding`, `establishes`, and `reason`/`cause` or `of`/`missing` | Yes |
| the trial's stages | each its stage contract | Yes |

**Where views live today** (VW-5's input): scattered across option types and render functions: `ImaginationOptions`' `rules` and `scene`, `SecuringShown`, `RuleCellOptions`' `show` and `sceneRules`, `TrialAgainstOptions`, and `securing: 'omitted'` hard-coded in the rebuttal and the ruling. The one registry-wide check is `JUDGE_RENDER_HOLDOUTS`.

**What it suggests** (mine; leads for VW-1 and VW-5, not settled):
1. **The scene side has views; the plan side has none.** The scene's axes are which part, how the securing is worded, and which of a rule's parts are shown; the last is a view in all but name ("each piece shows only the part it uses", the user, 2026-11-10). VW-1's new ground is the plan side: which kinds, whose, which standing.
2. **Options and views differ.** Some options are experiment arms (`scene: 'judge' | 'explicit'`, during the migration); some are the piece's own view (`rules: 'conditions'`, `securing: 'omitted'`). A view type might take in the second and leave the arms as options. Step 3's unchanged hashes mean each declared view reproduces today's render, options included.
3. **`consequences` is the mirror's first test.** Revise-mode `consequences` is the authority for `playByPlay`'s unchecked consequences, so its view must show them; additive `consequences` may be better without them (§3). A view may depend on the mode, not only the piece.
4. **The securing has four wordings and an absence.** `nonRuleCell` gets the "cannot be moved apart" impossibility, the wording behind the concession cell's failures; its task is reasons no rule names, so the securing may be outside its view. A question for when it reads the plan.

### A piece can write what it can't see

**The assertion** (the user, 2026-11-21): a prompt can generate plan items it couldn't then see. Under VW-1, with no exemption, every consequence `playByPlay` writes is unchecked, and its view reads consequences only when confirmed, so its own proposals are invisible to it until `consequences` confirms them.

**The assessment** (mine, agreed by the user): it holds, and it is the right result. The concession cell was built as `playByPlay`'s own proposal, and its 3-of-3 bent method is that feedback loop seen: the piece's own unchecked claim read back as fact (§3). What it complicates, none of it badly:
1. **Repeated proposals.** Called again on a step, `playByPlay` may propose again what it can't see. The repeat rule drops a word-for-word repeat from any author; a paraphrase gets through, and the plan holds near-duplicates until the checker confirms one and removes the rest. Deduplicating is the checker's, not the proposer's; it adds to the case for the removal (step 1). The same goes for a child shown without a rule it holds (VW-1's readings per kind): given again, it can't match as a repeat, so a near-duplicate goes in for the checker, like any paraphrase (2026-11-21; not worth a view-aware match).
2. **A refusal whose reason the prompt never showed.** The contract merges into the full plan, so a refusal depending on a hidden item would refuse a block no redraft could fix. None of `playByPlay`'s does today: it adds no possibilities (so the one-`execution` limit can't fire), a repeat is dropped, not refused, its rule handles come from the rendered scene, and "expanded at most once" counts sub-steps, which it sees. A hidden item can hold a slug, so a new path takes `-2`, which is harmless. Held as an invariant, with a test (step 1): **a piece's merge never refuses a block on account of anything its view hides.**
3. **Giving a child again becomes optional.** The ask no longer requires kept items to be given again. A child `playByPlay` gives back is a repeat, and it stays stale: only the child's authority settles the mark (VW-2, corrected 2026-11-21). So nothing turns on what the reviser can see of its children.

No open decision comes of it.

### The checker's mirror

**Decided** (mine, agreed by the user, 2026-11-21): **a piece whose merge can confirm an unchecked item of a kind reads that kind at `all`, stale items included.** Keyed on what a piece can check, not on what it is the authority for: producing a kind and checking it differ.
- **Why not authority:** "every kind it is the authority for, at `all`" would bind additive `consequences` to see `playByPlay`'s unchecked consequences (the §3 risk, [the inventory](#the-inventory)'s lead 3), and make its view depend on its mode.
- **What can confirm today,** read from the merge options: a `replace` (`replaces: true`; no piece takes it yet, and revise-mode `consequences` will, binding it to consequences at `all`); and a restatement confirming an unchecked intent as written (`restates`; `playByPlay` on `OC-6/command`, binding it to intent at `all`, as its proposed view has). So the test bites today.
- **Modes:** additive `consequences` confirms nothing, so it may read consequences confirmed only. Revise mode, once built, is a registration of its own with its own view.
- **Stale:** a checker's view keeps stale items, since re-checking them is the point; a later setting that leaves out stale items can't apply to a kind the piece checks.

## Open decisions (implementation --- plan only)

| ID | Question | Informs | Settled by | Status |
| --- | --- | --- | --- | --- |
| VW-1 | What a view declares: the plan kinds it reads (and whose: all authors, or the piece's own and the authorities'), how each is worded, the scene render options | Step 0, step 1 | The user | **Decided for the prototype** (the user, 2026-11-21): a view declares the plan kinds it reads and, for each, whether it reads `all` its entries (unchecked and confirmed) or only the confirmed (`authoritative`). No exemption for the piece's own items: its own unchecked proposals are filtered like anyone's. **The order** (mine, agreed by the user, 2026-11-21): step 1 builds the plan filter alone; the scene's wording and render options join the view in step 3, which first sorts the options that are experiment arms (they stay payload options) from those that are the piece's view (they move into its declaration); wording per plan kind waits for a piece that needs it, since none does yet |
| VW-2 | What happens to an item a view hides when the piece revises its step. Today a revision clears the target's items and the ask asks for kept ones to be given again; a hidden item can't be. Kept on the step, re-attached by code, or dropped | Step 1 | The user | **Decided** (the user, 2026-11-21, on my proposal), for every child, hidden or not: **a revision calls its step's children into question.** They stay on the revised step, paths minted afresh when its `says` changed; a confirmed child becomes unchecked, an unchecked one stays so; only a child's authority removes one, on checking it. The reviser can't drop a child by leaving it out, since it isn't the child's authority. **And marks them stale**, a flag apart from standing (stale: written against wording since changed), set by the revision, cleared by a `replace`, and cleared when the reply gives a stale child again (its author restating it against the new wording: a supplement, item by item, with no field to fill). **Corrected 2026-11-21 (the user):** cleared only by the child's kind's authority. Its `replace`, its `remove`, or its giving the child again, which is a check as written and so confirms it. A reviser giving a child back leaves the mark: when `playByPlay` restates a step, the step is confirmed, and its consequences stay stale until `consequences` checks them. Items don't record their author, and "its author" would have needed a field whose only reader was this rule. Code's, not rendered to the model (the `(unchecked)` tag didn't keep the registers apart). A view setting that leaves out stale items is booked for the first piece that wants one (revise-mode `consequences`, likely); `playByPlay`'s view never holds one. Why record it now: it can't be recovered later. Settles the gap the user named: a supplement and a change of action were one case, any text difference clearing every item. The step-level supplement-or-change call is not designed |
| VW-3 | `playByPlay`'s stance. (a) a proposal names the rule it bears on, with no stance; (b) it names neither, and code pairs each consequence with the rules on its thing's edges for the authorities to judge (mine, leaned on: §2, §7 one judgment per call, and "ask only for what the model alone can provide") | Step 1 | The user | **Decided: (a), on what set it apart from (b): `playByPlay` names the rule, and code doesn't infer the pairing** (the user, 2026-11-21). **Corrected the same day:** "with no stance" was my clause, bundled into (a), and isn't adopted. The stance is an outlet ([The idea](#the-idea-the-user-2026-11-21)'s exception): it keeps the model's thoughts about rules out of the method, so the reply keeps it, an unchecked claim, and the rule type and tools stay as they are. The "reaches" check below was mine too: not required, and not cheap (a contract's parse is synchronous, a fixture's scene async), so it is booked as a possible follow-up on the parent's action plan item, not built. (b) is too optimistic (the user): code finds candidate rules, not the right one (mine). A consequence touching a rule's ends needn't bear on it (`OC-1`'s ordinary carry names both ends of the glue); one named end is ambiguous even in `teaTableChained`, whose glue and chain both end at [table1]; a rule reached only through hosting ("[cup1] rises" on a chained table) is missed by handles, and following hosts catches nearly every rule; a consequence naming no handle never matches. **A check code could add under (a)** (booked, above): that a named rule is one the consequence reaches (by its handles or their hosts), else a form problem; it would catch an unrelated rule (draft 31's), not `OC-1`'s stray, which is the rule cell's. How often the rule slot strays is tuning (the imagination plan's step 2), not the view's (the user) |
| VW-4 | Who checks each stance (its first wording, restored 2026-11-21 once VW-3 kept the stance; briefly reworded as "who decides the stance, with none written"): `violation` by the rule cell (its `blocks`, 46 of 48 on draft 3); `causes` for a carry from the scene's own securing edge, by code; `voids` (prying the glue loose) unjudged for now, a question for the rule cell, or a piece of its own. Costs calls (one per paired consequence), so pairing only consequences whose thing touches a rule | Step 1 | The user | **Handed to the parent** (the user, 2026-11-21): nothing this plan builds or measures reads a stance, so it is a checker's question, booked on the oracle loop plan's action plan item ("Checking a named rule's stance") |
| VW-5 | Where a view lives: beside each piece's reply contract, in its registration, or in a shared module | Step 1 | Mine, for the user | **Decided** (mine, agreed by the user, 2026-11-21): a `view` field on the piece's registration, beside `render` and `check`, so the test that every piece declares one reads the registry; a pure `viewPlan(plan, view)` in `actionPlan.ts` gives the filtered plan, which `renderPlanForGenerator` renders unchanged, so a view reading every kind at `all` keeps its inputs hash. A piece that reads no plan (the judges, in the bridge state) declares no plan kinds. The contract still merges into the full plan, which is VW-2's question |

## How we work

- The design pass comes first, as text, and the user reviews it before any build.
- Each build part is checked off as it lands, with tests and tsc clean.
- Batches: one change per draft, two batches per draft, the rubric written before the batch with my bounds listed apart. Payloads are named by full path; the user runs them.
- The user commits.

## Verification

From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, both with no output. In step 3, every piece's inputs hashes unchanged.

## Progress

| Step | State |
| --- | --- |
| The design pass | Done 2026-11-21: the inventory; VW-1, VW-2, VW-3 and VW-5 decided; VW-4 handed to the parent; the checker's mirror |
| The build | Done 2026-11-21: the view type and `viewPlan`, every piece's view, `playByPlay`'s (confirmed; its rules amendment to step 2), the revision rule with its stale mark and `remove`, the registry checks. Calibration AGENT.md's revision text corrected in place; the views' rules land at the hand-back |
| `playByPlay` on its view | In progress: the amendment for confirmed rules built (a unit test, no cell); the look-fors rewritten; draft 34 on draft 32 written, batches 60 and 60b to run |
| The other pieces | Not started |
| Hand back | Not started |

## When it finishes

- **The rules** for views go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders).
- **The parent's item** is ticked with what was booked; the checkers' and the resilience pass's bookings updated for what a view changes.
- **A sweep for inbound links and plan-ID markers** (`VW-n`), then this plan is deleted.
