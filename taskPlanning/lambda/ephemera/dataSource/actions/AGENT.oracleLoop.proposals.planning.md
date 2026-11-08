# Oracle loop: proposal record

The proposal record of the [oracle loop plan](AGENT.oracleLoop.planning.md), in the design variant's [companion-file ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder): candidate schemes and working readings, live and superseded alike. Read the plan's control surface first.

Moved on 2026-11-07 from the retired judgeFailures plan, unchanged except for links, so the attributions ("user", "mine", "agreed") stand as they were written. **Slice numbers in the moved text are judgeFailures':** Slice 2 is Proposed outcome (built), Slice 3 the axes investigation (dissolved into the oracle loop's [Recommended order](AGENT.oracleLoop.planning.md#recommended-order)), Slice 4 Failure 2 and Slice 5 Failure 3. "v45" is the built judge prompt, [described in `calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45); `vNN` drafts are in git history.

## Live and superseded

| Section | Standing |
| --- | --- |
| [A comparative oracle](#a-comparative-oracle) | **Live: the direction** (JF-14, settled). Readings marked mine are not agreed |
| [Judging an improvisation](#judging-an-improvisation) | Live design, not agreed as a whole (JF-6) |
| [Finding out by trying](#finding-out-by-trying) | Live: the loop this plan builds |
| [The axes as they stand](#the-axes-as-they-stand), [How it got here](#how-it-got-here), [What it moves and doesn't remove](#what-it-moves-and-doesnt-remove) | Live reasoning. The understanding gate and the what and how questions survive as the directions that go to the player |
| [Where the labels would land](#where-the-labels-would-land) | **Retained, likely superseded** by the comparative oracle, whose product is a verdict and a direction and not a label. Undecided (JF-5) |
| [Testing it](#testing-it) | **Superseded** 2026-11-07 by the oracle loop's order. Its new requests are now [corpus](AGENT.oracleLoop.corpus.planning.md#cases-written-2026-11-07) cases |
| [A shared back half](#a-shared-back-half-the-proposed-outcome) | Live. The code facts are as read on 2026-11-06 |
| [Noticing](#noticing) | Live: what any oracle prompt still has to notice. The fixes listed are candidates, unprobed in the comparative form |

## A shared back half: the proposed outcome

Built in judgeFailures' Slice 2 and kept as a tool: how to call it is in the `JudgeProbe` subsection of [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md#judge-probe). What follows is the design that bears on the loop.

The user's design for [Slice 2](AGENT.oracleLoop.discussion.planning.md#where-this-came-from-the-judgefailures-plan-retired-2026-11-07) (2026-11-06): add a Proposed Outcome scene render conditionally, hold the proposal in the fixtures so that a flag can use it or leave it out, and make the framework adjustable, with the aim of building the functionality an oracle and a proposer would share. The shape below is mine, and only what is marked as the user's or as agreed is agreed.

The shared back half is operations, then a dry run, then a render, then review. Only the first step differs by who supplies the operations: a fixture now, a matched template as an oracle, Micro as a proposer. So the fixture is a stand-in at a seam, and everything after it should be the code those later suppliers would call.

### What the code offers

Read, not run.

- **The dry run exists.** `applyStepSequenceCore` is pure over a map of graphs, and a `legal` verdict returns the graphs after the steps. `EphemeraLudicGraph.toStored` returns the payload type a fixture's `graphs` holds, so a post-state scene is the existing fold run over those graphs. Tested: table, cup and pour run over the fixture graphs.
- **Teapot gets no "after" on this path.** The kernel's verdict for a held mover is `blocked` (`securedToBlocksMove`), checked ahead of the `Custom` defer. That refuses this literal move, not the request. In production `attemptDryRun` answers `defer`, then Abstain (user, 2026-11-06): `defer` hands the request to the LLM planner, which might make a coherent, executable plan where the deterministic template can't, and it abstains only because that planner isn't built yet.
- **Table in cup on `teaTable` is a containment cycle.** `planObjectMoveTransfer` refuses it (`hasPresenceAncestor`), since the cup sits on the saucer on the table. `attemptDryRun` has no such check, so production finds it legal there and refuses at commit. The refusal doesn't touch size, which is why `teaTableCupOnFloor` exists.
- **A wrong `from` passes the planner.** To it, a mover with no binding under `from` is a first placement, and it comes out in two places. Callers check first, so `dryRunProposedMoves` does too (`moverNotOnFromHost`). A proposer writing moves would hit this.
- **Boundary edges (a limit).** The planner derives no dissolves, which are the attempt's own actions, so a mover with an ordinary boundary edge comes back refused. No proposal here has one. A proposer's moves will need that step.
- **Slide changes nothing recorded,** so its "after" equals its "before". That is a useful case: a proposal with no visible change.

### What it must keep to

- **Flag off is v45, byte for byte,** hash `22e97265`. This is the check on the framework, and it is what keeps every result so far comparable.
- **The block goes before the `Request:` line.** `Mentions` reads "the last line of this prompt", and "End of scene." closes the scene, so the block sits between them. Reading a proposal before the request it answers is untested.
- **The block sits after the cache point** ([Size](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45)), since it varies per request. The built instructions stay byte-identical across every call, flag on or off. A smaller prompt for passed proposals would be a second cached prefix.
- **`Picture`, `Revises` and `Tests` stay in the prompt,** per the main risk below. The first measure is what reading a proposal does to those lines, with the lines left in. The smaller prompt under [What a passed dry run settles](#what-a-passed-dry-run-settles) is a later draft, one change at a time, and it applies only where a proposal has passed.
- **Not wired into the command pipeline** (the contract has Adjudicate before the dry run), with no tool call, retry loop or language of moves for Micro. Those wait on what this shows.

### The questions it answers

Table (with the teapot glued on), cup, pour and `teaTableCupOnFloor`'s table in cup, flag on against flag off, in the smallest batches that answer, reading each before the next:

1. Flag off, one call: instructions hash `22e97265`.
2. `only: [0, 1, 4]`, `repeats: 3`, flag on with the defaults (`after`, `fiction`): 9 calls, against v45.
3. Pour flag off, 2 repeats, since v45 has one pour reply.
4. `teaTableCupOnFloor`, flag off then flag on, 3 repeats each, 6 calls. Flag off is its own baseline, as this scene has no v45 replies, and it may show whether the nesting was helping on `teaTable`.
5. Whatever those leave open: pour with `form: moves` and `whole`, 3 repeats each.


- Does a proposal make the from-and-to reliable? Teapot holds no proposal, so this slice no longer bears on Slice 4 directly: teapot's prompt is unchanged with the flag on, and teapot stays a test of reasoning. Where it should help is requests whose move is legal, such as getting the table with the teapot glued on, or putting something far too big into something small (user).
- Does it bring back the table refusal, or feed wrong `simple`? "After" could read as settled fact, since `Reading the scene` says everything stated is true.
- Does `Picture` still work anything out with a proposal in view, or copy it? That is the measure of the proposer risk.
- When code says a move is legal, does Micro still use what it knows of the physical world? Pour is the sharpest case: the "after" shows tea in the cup, and nothing explains how a glued teapot poured it. It may read as settled fact and give `simple`, or give Micro something concrete to check.
- Does a legal move stop Micro noticing that something is far too big? `teaTableCupOnFloor` is the case, a pair not taken from the prompt, since a motorcycle in a shoebox is the example in `Picture` and a pass could be copying.

### What a passed dry run settles

**The user's idea (2026-11-06):** the rules can be smaller when a proposal is present. A passed dry run has already checked that the end result keeps things in legal hosting relations, so the LLM need not, and its attention can go only to the language that makes it notice the intermediate fictional action. That probably helps target pour, by reducing the surface being tuned.

Mine, not agreed:

- **Why it fits pour.** Pour's wrong `simple` says the pour "does not affect this rule", which is true of the end state: the teapot stays fixed. So the end-state check is what answers, and the tilt never comes up. With the end state settled, the question left is whether the rule stops anything on the way.
- **The rule's fact has to stay.** The securing is what the tilt runs into, so the `teapot-secured-to-table` line stays in the scene. What can go is the work on end states: the frame sentence in `Picture`, `Revises`, the frames lines of the examples, and `Rules`'s question, which would ask about the action as it happens.
- **It eases a known conflict.** The story-register `Picture` under [Failure 3](#failure-3-an-action-never-pictured) risked table, since frame language is what freed table. Where a proposal has passed, the dry run frees table instead.
- **A passed dry run doesn't settle everything.** The kernel checks mechanism and not world legality, so fit stays with Micro: the table into the cup on the floor passes. `Picture` and `impossible` stay.
- **The split is plan against review, not oracle against proposer.** A proposer whose tool call passes reviews the same kind of outcome, so the smaller prompt is its review step too. The steps a proposer needs for planning stay in the prompt for requests with no proposal, which is how this stays clear of the [main risk](#how-the-idea-got-here). It also bears on [The axes](#the-axes): a passed proposal is one way to answer the fourth axis.
- **Order.** First the block with the steps unchanged, as a baseline, then the smaller prompt as a draft through the existing `instructions` override, with `only` picking requests that have a proposal. That needs no new code. Measured on pour first, then table, cup and table in cup, one change per draft.

### How the idea got here

**A before and after from the dry run (the user's idea, 2026-11-06).** Where the judge is an oracle over a deterministic template that matched and succeeded, code can supply the operations and a scene render after a dry run of them, with nothing for Micro to deduce. Code then owns the graph register and Micro only the fiction, which fits the `Picture` read under [Failure 3](#failure-3-an-action-never-pictured). It would not catch pour's tilt by itself, since the graph records no tilt, though it narrows the question to what the record leaves out. It needs a separate shape for requests with no template (wipe, pry). Checked in code: `DryRunOutcome.plan` carries the expanded steps on a `legal` verdict, and there is no post-state `SceneModel` yet ([what the code offers](#what-the-code-offers)). Contract conflict: Adjudicate runs before the dry run ([`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md)), so this needs a dry run first or a second one. To check before a probe (mine): which `teaTable` requests a template would pass at all, since table in cup looks like a containment cycle the dry run may reject, and what happens on teapot. To watch: "after" read as settled fact, since `Reading the scene` says everything stated is true, feeding wrong `simple`. Framing if it runs: "Proposed outcome" (user).

**The main risk (user, 2026-11-06):** a deterministic proposed outcome exists only while the judge is an oracle over planned actions, as the current prototype is. Leaning on it makes a better oracle at the cost of moving further from something more capable that can propose outcomes itself. So tuning should keep the steps a proposer needs. Mine, not agreed: use the dry run as a grader, not an input: where a template succeeds, compare Micro's own `Revises` or `Moves` with the dry run's steps, which measures proposing with no change to the prompt or the pipeline. For the same reason a `Moves` step for Micro to fill in (mine) stays open, as practice at proposing, though it won't catch pour's tilt.

**Part of the purpose (user, 2026-11-06):** working out what a language of moves would need is part of why the impossibility oracle is being prototyped. So arriving back at "we'll need to figure this out", with more information in hand, is the prototype doing its job.

**What answers it (user, 2026-11-06):** a proposer that proposes moves can have a tool call that dry-runs them deterministically against the scene and returns a new render. So the oracle and the proposer share a back half, operations to dry run to render to review, and differ in who supplies the operations: a template or Micro. Reading a "Proposed outcome" is then a skill for both, not an oracle-only one, and the idea is back in play as [Slice 2](AGENT.oracleLoop.discussion.planning.md#where-this-came-from-the-judgefailures-plan-retired-2026-11-07), provided the steps that work out an outcome stay in the prompt. The post-state render is the one piece of code both need. Harder parts, mine: the moves need a language Micro can write, and the notation has no untie (`AGENT.sceneProjection.planning.md`, "The `untie` operator"); a rejected move means a retry loop, which is that plan's unbuilt "dry-run self-correction" and needs a multi-turn probe; whether Nova Micro handles tool calls well is unchecked; and a tilt has no operation, so it still has to come from the fiction step.

## The axes

The user's question for [Slice 3](AGENT.oracleLoop.discussion.planning.md#where-this-came-from-the-judgefailures-plan-retired-2026-11-07) (2026-11-06), an investigation, began as whether the rubric would benefit from deciding on two axes, one after the other: is there enough information to discern a specific plan, then is this agent capable enough to adjudicate and represent it. A discussion the same day replaced both axes, and with them my earlier readings and test list, which are in git history.

**This records where the thinking stands, for the user to return to after sleeping on it (2026-11-06). As a whole it is not agreed, built or probed.** The user's articulations are first cuts and explicitly not prompt text. What is still undecided is under [Open decisions](AGENT.oracleLoop.planning.md#open-decisions-design--plan-only), JF-2 and JF-5 to JF-13.

### The axes as they stand

The user's list:

- How much do I understand?
- For an incomplete understanding: Can I ask clarifying questions about _what_ the plan is?
- For an incomplete understanding: Can I ask clarifying questions about _how_ the plan is supposed to work?
- For a complete fictional understanding, how much of this can be planned/stored/persisted by logic at this level (vs. being deferred or abstained)?

Mine, on their shape:

- **What and how are true axes.** Every combination means something, the test the earlier "do you understand?" and "would it work?" failed. The placements below are mine.

  | | Can ask how | Can't ask how |
  | --- | --- | --- |
  | **Can ask what** | "Use the gizmo on the door" | "Cut the string" (with what?), "Wipe with the cloth I'm holding" (the scene says "You are holding nothing") |
  | **Can't ask what** | Teapot, dissolve the glue, the bridge, table in cup | The floor: "gear flutter tinkles", or something inherently impossible |

- **"How much do I understand?" acts as a gate.** It picks the side, and nothing yet uses a degree short of complete (JF-10).
- **The fourth axis is a real scale, and in another register.** The gate and the two questions are about the fiction, and the fourth is about the graph (note 10). That is the case for it not being Micro's to answer (JF-8).

### How it got here

- **A branch and not a flat list (user).** Labels on different branches never compete. My first readings ordered `challenging` against `contingent` and `complex` because I had carried the question into v45's flat first-"yes" `Answer`, where everything has to be ordered against everything. Every question can still be answered, with `Answer` branching (mine, and the user called it a genuinely good take), which keeps "a rubric isn't a switch".
- **Grounded (user).** A specific grounded plan reduces to a list of things done to known items. Which items count is open: established and improvised, or only "specific, singular, established" ones (JF-6).
- **The cases under `obstructed` differ in kind (user's first cut, with `contingent` alongside).**
  - `contingent`: the plan is clear and might work, but some of the pieces are requested, plausible-but-not-implied improvisations.
  - Tool unclear: the plan is clear and might work, but it hand-waves about unspecified tools. With more detail the tools might become grounded or `contingent`.
  - Method unclear: the plan is unclear, so whether it might work can't be judged ("dissolve the glue": "How? With spit? Acid? Magic?").
  - Tool invalid: the plan is clear and might work, but assumes something where the opposite is established. Not merely "This plan assumes a bridge", but "This plan assumes a bridge, _and we know there isn't one_".
  - Plan incomplete: the plan is clear, and the individual pieces are sensible, but it is missing necessary steps (teapot, and pour).
- **Two theories of mind (user).** The same observation reads two ways. One: they are clever, and have or could create a plan they haven't articulated yet, and may need prompting. Two: they are confused, or have a plan that plainly won't work, and need gently guiding to get aligned. Many of the category distinctions had this question buried in them. So had `Role`'s (b) and (c), JP-10's two touchstones and my "next move" column (mine). Implied vs. improvised and the line for necessary steps are about the fiction and not this (mine).
- **We can never tell the two theories apart (user, the premise of what follows).** "We can't tell whether someone's confused and clueless, or _we're_ confused and clueless about what they're saying. All we can tell is whether or not we have enough info to think we understood." That breaks down the distinction between `obstructed` and `impossible`: "There's no 'impossible', there is just 'Man, I don't see how you're going to get to the moon when your entire catalog of resources is a burnt piece of string and five cents.'" We don't need to know the difference, only whether we have a useful follow-up comment or question. Today only the calibration probes read the labels, so nothing yet routes on that difference (checked, mine). The user's picture of it at a table:

  > "I don't see how you're going to get across. The chasm is very wide, and the only bridge is broken and dangling on the far side."
  > "We're going across the chasm on the bridge."
  > "But *how*? It's on the other side. It's not doing you any good."
  > "Taking out a heavy arrow. Tying a rope to it."
  > "Ooookay, I think I see where this is going."

- **The floor (user).** With nothing useful to say, we say that: "I don't see how that's even a thing someone can do," or similar. So there is no separate outcome, and it covers both the inherently impossible and what can't be understood. Tone is the whole system's (JP-10), and it should leave the confusion with us: "I'm not sure what you mean by that" (mine).
- **Understanding presumes something sensible to try (user).** Part of understanding is framed on the assumption that you are trying to understand a thing that is sensible to at least try. So "Yes, I understand completely, and there's no way anyone could imagine that would work" is no longer a valid response. The closest is "I'm hard pressed to imagine an alternate reading of what they've said, but the reading I've got doesn't make sense, so I'm clearly very confused." This is close to the principle of charity in the philosophy of language (the parallel is mine), which suggests it belongs in `Reading player intent` and not in a test (mine, JF-13).

### Where the labels would land

Mine, as a reading of the above, and not agreed.

| Outcome | Meaning | Standing |
| --- | --- | --- |
| One new label, unnamed | I don't see how, with the most useful sentence available | Replaces `obstructed`, `impossible` and `confusing` (JF-5) |
| `simple` | Understood, and logic at this level can do it | |
| `complex` | Understood, and recording it is passed on | Possibly decided outside Micro (JF-8) |
| `contingent` | Understood, and whether the item is established is passed on | Tentative, depends on JF-6 |
| `challenging` | Has no place in the user's fourth axis, which covers planning, storing and persisting and not adjudicating | The trestle would be `simple`, as its fixture expects (JF-2) |

### Finding out by trying

**The user's idea (2026-11-06):** the fourth axis may not need deciding by a judgment at all. A multi-attempt loop, with proposed changes, dry runs with scene-render intermediate predicted feedback, tool use, a maximum turn limit and deliberate "I choose to defer" options, might give Micro the capacity to make an attempt and see _whether_ it can get an outcome. It is the alternative to the judge stopping at "I fully understand" with `simple` and `complex` decided downstream.

Mine:

- **It replaces self-knowledge with a trial,** which answers "Micro has no real view of its own capability", and covers a request with no template. It is the back half under [What answers it](#how-the-idea-got-here), with Micro as the supplier.
- **Its exits fail safe.** Reaching the limit and choosing to defer both pass the request on, and `complex` becomes what happens when Micro doesn't get there.
- **An attempt can end in a "how?" as well.** A refusal may mean the wrong moves or not seeing how, so the understanding gate isn't strictly upstream of it.
- **A legal outcome still needs review.** The kernel checks mechanism and not world legality: the table into the cup on `teaTableCupOnFloor`, and pour with no tilt, both pass. That review is where a wrong `simple` could still come from.
- **It changes a rule of the user's.** "The judge is never shown a refused move" ([The build](../../../../../lambda/ephemera/calibration/AGENT.md#judge-probe)) suits an oracle, and here a refusal is the feedback. The reasons would also have to read as something Micro can act on.
- **Hard parts:** whether Micro handles tool calls well (unchecked, and able to rule the idea out), a language of moves it can write, a multi-turn probe, and cost, since a quick first check becomes several calls. The turn limit is also a budget decision.
- **Scope:** bigger than this slice, and it probably deserves its own plan (JF-9).

### What it moves and doesn't remove

Mine.

- **Noticing still has to happen.** With `impossible` gone, a Micro that doesn't notice the table won't fit gives table in cup a wrong `simple`. `Picture` has to keep doing that work.
- **The sentence becomes the product.** The grader mainly checks the label, and `mentions` and `avoids` are reading aids. Most refusals would be judged on their sentence.
- **The floor is always available, so expect overuse,** the same trap as the skill check under [Question 1](#question-1-a-feat-the-labels-cannot-name). "I don't see how that's a thing" on teapot is useless with the glue right there. Separate what and how lines may help, since the floor is then reached only when neither has a question.
- **The sentence names the fact and not the way past** (JP-10). "Missing steps" invites Micro to say which step.
- **Charity needs a limit.** A charitable reader can always find a reading that works ("they must mean a toy table"), and on v40's table in cup all three replies invented a role for the glued teapot. It can be generous about what the player means, and not about what is established.
- **The next turn needs the last one.** The table exchange only works if the judge knows what it said before, and it sees one request (JF-12).
- **Teapot's upstream fault and pour's tilt are unchanged.** Both depend on `Picture` and `Rules` surfacing the glue (8 of 8 with the from-and-to, 0 of 5 without), whatever the rubric does with it.

### Judging an improvisation

The user's thinking on JF-6 (2026-11-07), setting aside when an improvisation is recorded as precedent. Not agreed as a whole.

- **Two axes, not one (user).** A single line from "definitely untrue" through "not established" to "definitely true" is rejected: how established a thing is and how justified it is are independent. Established and unjustified is the owl in a waistcoat (_Wildwood_: "I know that magic isn't real." "Yet here you are, talking to an owl in a waistcoat."). Not established and justified is the teapot's lid. Mine: the yes-or-no belongs to the claim, so "a bridge" and "no bridge" are two claims and the scene has established the second, which keeps both axes as amounts. Tool invalid is then a plan that needs a claim whose opposite is established. Unconfirmed.
- **Implied without being stated (user).** "**Jungle Tavern**: A cozy tavern, bracketed by living trees. A lazy orangutan tends bar, while capuchins leap about delivering drinks. The tables are wet with rainfall, and lit against the omnipresent gloom with little jars filled with fireflies." It isn't established, but it is clearly implied that the tavern has no roof. Mine: no _built_ roof, since the trees suggest a canopy the rain gets through. Justification has two sources that can disagree, world knowledge (taverns have roofs, `Improvising`'s own farmhouse) and the scene, and the scene wins, as it already does for what is established.
- **The inference runs backwards (user).** It doesn't start from "places with rain on the tables have no roofs". It starts from "places with roofs don't have rain on the tables" and applies the contrapositive, a step whose implicit hit rate on an LLM, and on Micro especially, is fragile unless instructed carefully. Mine: the rule is stored by the roof, which nothing in the scene names, so nothing cues it; a request that mentions the roof should raise the hit rate (checkable). Pour's tilt and table in cup have the same shape. A candidate, not a draft: for each thing the request needs, "if this were here, what would that mean for the scene, and does the scene show the opposite?", which turns modus tollens into modus ponens and a contradiction check.
- **What judging plausibility means, step by step (user's first cut).**
  - Pass one, a consistency check: posit X and examine the scene. Does it have details that make less sense with X ("But if there's a roof, it doesn't make sense that the tables are wet")? Details naturally supported by X ("The tavern has hanging chandeliers, and this gives them an obvious place to hang from")?
  - Pass two, a world-knowledge check: does X extend the descriptive class the scene is already conveying (a creepy mansion with creaking floorboards, dusty furniture and ghostly apparitions makes cobwebs strongly supported, with no logical deduction, as just the kind of thing expected) or depart from it (the same mansion with little scented candles and bowls of patchouli)?

Mine, on the passes:

- **Deduced may be the top of pass one.** At its strongest, pass one's support is a stated detail that presupposes X: a chandelier has to hang from something, a teapot has a lid. Deduced would mean presupposed by an established detail and improvised everything below, which would give JF-6 its line.
- **Pass two needs the class written down first,** a step naming the kind of scene, since Micro can't test "extends the class" against nothing. The class is the scene's and not the genre's (a parrot taking orders fits the Jungle Tavern and a jukebox doesn't). Generated scenes say little, so it often falls back to world knowledge of the place. What the class is, is refined below.

The user's refinements (2026-11-07), which replace two readings of mine: that the passes are weights to aggregate, with pass one close to a veto, and that the scene sub-classes a world-knowledge category ("which parts of 'tavern' don't apply").

- **The scene frames the expectations (user).** A tavern has a roof, but a **jungle tavern** is a sufficiently different thing that it's reasonable to come into world-knowledge expectations with the _anticipation of divergence_. "Has no roof" makes a tavern less consistent as a tavern; for a jungle tavern people nod along, "Yeah, that's part of what makes it a **jungle** tavern." The kitsch-horror mansion (the normal trappings of horror movies, **and also** little collectible figurines and commemorative plates on sagging shelves, clearly hand-made skull-shaped doilies and mummy-themed tea-cozies) has no name for what sort of scene it is, yet you can improvise a bowl of patchouli, and imagine the bowl probably has the dried bones of a rat mixed in.
- **A fusion of themes, not a sub-class (user).** Not an Aristotelian breakdown of categories, but a pastiche: Jungle Tavern has similarities of theme with Jungle Factory and Swamp Bath-house, just as with Cyber-tavern and Space Truckstop Tavern.
- Mine, on the fusion:
  - No theme is the base, so conflicts go either way: jungle wins the roof, tavern wins the tables.
  - Roles come from one theme and fillers from another: tavern gives someone tending bar and bringing drinks, jungle gives the orangutan and capuchins; tavern lighting, jungle fireflies.
  - The same detail means different things under different blends: "A cozy tavern. The tables are wet with rainfall." keeps the roof and improvises a leak.
  - A theme needs no name, only a thread its details share.
  - So the question for X is which theme expects it, and what the other themes make of it. For Micro, a step listing the scene's themes in a few words each, then those two forward questions. Fauconnier and Turner's conceptual blending is a close parallel (my comparison).
- **Narratively valuable, a new axis alongside plausible (user).** It reframes improvising from passive ("would this make sense? If yes then improvise, if no then don't") to an active _aim of exposition and reincorporation_ alongside the plausible and consistent aim. The user's example: in a normal tavern, "Does this place have soup bowls?" is up in the air (a drinking tavern, probably not; a hearth with a burbling cauldron, probably yes), and the world knowledge of tavern doesn't really weigh in. In a jungle, a pretty clear "Probably not." In a jungle tavern it's an exciting opportunity to reinforce the fusion of themes: big unworked gourds, sliced in half and hollowed out. Of _course_ they do.
- Mine, on narrative value:
  - The blend is more decided than either theme alone, not their average: up in the air and probably not combine into of course.
  - It passes the 2×2 test against plausible: the gourds are both; a plain ceramic bowl in the jungle tavern is plausible and dull; something that strains the blend for effect is valuable and implausible; patchouli in a plain creepy mansion is neither.
  - The answer changes form, from yes or no to yes and what it is like here, which is the role-and-filler pattern again.
  - ~~The risk is the floor's again: an always-available aim gets overused.~~ Withdrawn: the expository aim can come in on _either_ the yes or the no answer (user): "Yes, we have soup-bowls ... these gourds here. Soup _spoons_? No, sorry. We had some, but the sloths always steal them all to use as drumsticks for their Jungle Jamboree band. I'd be grateful to you if you could get them back." So it doesn't pull the verdict toward yes, and it is independent of the verdict and not only of plausibility (mine). The "no" here also offers a way past, a quest, which JP-10 keeps out of the judge's sentence; that suits a narrator and not the judge (mine).
- **Who runs it.** Laid out in full it looks like the "decided elsewhere" of `Improvising`, too many steps for a quick first check. The judge still needs some of it for `obstructed (3)`'s "nothing here could plausibly meet", perhaps only pass one's forward contradiction check.

**A formula for the judgment (user's first cut, 2026-11-07),** with narrative value kept as a separate axis, which the user calls part of the key. Trying to articulate a formula behind thinking that frequently happens too quickly to track:

1. Consider the plausibility question, but from a framing of "If implausible, what sort of stretch would it _require_ to explain this? If plausible, what sort of stretch would be required to explain the absence?"
2. Then consider whether that stretch has (or could be given) expository value.
3. Then judge the best Yes vs. best No proposals against each other, rather than judging on plausibility alone.

Mine, on the formula:

- **A cost in place of a probability.** Both sides always get a stretch, and the spoons are the case plausibility alone can't pick: the easy yes loses to the valuable no.
- **It builds options before it judges,** a concrete proposal on each side before comparing, as with no early winner-take-all. The sentence is the product again.
- **The axes tie together.** How established limits which stretches are allowed, since a stretch only reaches over what isn't established ("we know there isn't a bridge" is tool invalid); how justified is what a stretch costs; narrative value is what it is worth. Charity is a stretch, limited the same way.
- **Where it runs.** Two sides by three steps is the improviser's, not the quick check's. Step 1 alone might serve the judge: "what stretch would a yes require?" is a sharper `obstructed (3)` than "nothing here could plausibly meet".

Open questions (mine; the user has answers to some):

- **What does "best" trade off?** A large stretch with high value against a small one with none. Is there a stretch no value pays for, or does the blend set that (the kitsch mansion seems able to afford a bigger stretch than the plain one)?
  - **The user's answer (2026-11-07):** _for the scope of judgment_, an incoming variable that measures, roughly, "How much drive is there toward establishing exposition?", used in the trade-off calculation. More _broadly_, the storytelling art involves taking your opportunities to establish theme and exposition, but having that drive/budget cool as it is used, and regenerate only gradually, otherwise you drown people in details. That orchestration is well beyond the scope of the judge prompt's remit.
  - Mine: the judge reads the drive and doesn't own it. At zero drive the formula reduces to plausibility alone, which is today's judge. It gives a probe that needs no orchestration: the same request at two drives. Low drive should give the plausible default with no exposition. High drive drives _something_, likely different every time, on a yes **or** a no (user's correction of my "high gives the sloths"), so the probe grades whether an expository stretch is present, never its content or its polarity. Pacing, the real part of my withdrawn overuse worry, lives in the budget and not in the verdict.
- **Does the player's aim count toward value?** A "no" that becomes a quest is good exposition and gets in the way of their plan. `Improvising`'s "what a player says can make a detail more plausible" would have a counterpart on the value side.
  - **Charity and the aim (mine, the user agreed):** entangled through one input, the player's inferred aim, and written as one chain with separate links. Charity produces the aim, generous about what the player means and not about what is established. The value question weighs that aim where facts are open, between the two. The aim counts in three places: meaning (charity, JF-13), cost (`Improvising`'s "what a player says can make a detail more plausible", in v45), and value (this question). One principle such as "assume a sensible aim and help it along" would answer this question in advance, and the sloths' "no" goes against the aim.
  - **Why it is the genuinely tricky bit (user):** "decades of prior art and practice in the indie-RPGs community" levels of tricky. As the exposition drive orchestrates _narrative pacing_, open-solution games need to orchestrate _challenge_. The user's archetype is the classic exploit early in Matt Dinniman's _Dungeon Crawler Carl_: a goblin tribe's warehouse of explosives and, beyond it, the Boss Room with the terrifying Goblin Chief, and Carl loads a cart with barrels, rolls it in, slams the door, flees several corridors away and detonates it remotely. From the player's point of view:
    - They _want a big challenge_, because overcoming that is what their heroic tale is about.
    - But then when the challenge is hard, they want an out.
    - And if charity is set too _high_, they can always find an out.
    - And then they don't get the same sort of satisfaction they would from solving a more difficult challenge.

    Like building endurance on an electric bike: possible in _theory_, but if you engage the motor every time your legs start to burn you undercut your own plan.
  - Mine, on the pattern: two aims at two levels, the immediate one (past the chief) that charity reads and the larger one (a hard-won tale) that no single request states. And a found out (Carl's: the warehouse was established, the plan clever, nothing stretched) differs from a granted out (an unestablished fact stretched in the player's favour at the hard moment: "surely there's a side tunnel"), so "charity too high" may be charity spilling from what the player means into what is there.
  - **Three tools, all of which can work together (user):**
    - _Budget the charity:_ charity is a spendable resource. Classic hard-case D&D DMs set it at zero ("Ride my warhorse into the cave and trample the goblins" gets "Ah, you didn't notice that the cave isn't tall enough for that, so you brain yourself on the overhang and die. Roll up a new character."). More reasonable GMs keep an internal balance, saying "Yes" some of the time and "No" other times to get the right _proportion_ to keep the story on track. Some games, like _Blades in the Dark_, offer a _player-controlled_ budget: "I'm retroactively establishing that we planned for this, and have already stashed what we need in a cache that we now pick it up from", a certain number of times per session.
    - _Adjust future difficulty level:_ if players use charitable reads to turn an intended difficulty into an easy one, adjust your sense of how capable they are and continue to be charitable. In _Dungeon Crawler Carl_ the system _delights_ in him rolling explosives into closed rooms, and later challenges are more like "Yep, you certainly blew the hell out of that room ... which has gotten the _attention_ of the boss, and somewhat damaged him, so it's a great opener. What do you have for a closer?"
    - _Charity with consequences:_ Princess Donut uses her dark-vision to confirm the Chieftain is there ("He's there, go, go, go!"), and right as Carl pushes the detonator she adds "... and there sure were a lot of babies there too." Great for _changing_ the type of risks or costs of a challenge, rather than _either_ doubling down on them or dissolving them, and it plays right into improvisational charity: in a wizard-engineer's workshop, breaking the lock on a treasure chest, "Is there a screwdriver around?" can get "Yes, there is a screwdriver carved with runes, pulsing with a nimbus of black-red energy ... as you look at it, a voice speaks in your mind: 'YES ... take me up, mortal. I will pry open any fastener, turn *ANY* screw, even if the Gods themselves bar it. You will be my bearer and I will be your tool, an unbreakable bond for the rest of your life, and together we shall claim the souls of all the living.'"
  - Mine, on the tools:
    - The warhorse DM understood the plan and resolved an unestablished fact (the cave's height) against the player. So the budget is spent on which way stretches go over open facts, not on charity of meaning: reading the player stays unbudgeted, and favourable stretches are what a budget limits.
    - Consequences add a third candidate to step 3 of the formula, **yes, at a cost**, alongside best Yes and best No. A large stretch can pay for itself in exposition and a new cost at once, which partly answers "is there a stretch no value pays for?". A yes with a cost spends less budget than a free one. A consequence is itself an unestablished fact (the babies), so the same limits apply. Prior art the user knows better: success at a cost in Powered by the Apocalypse games, _Blades_' devil's bargains.

    | Tool | Where it lives | What the judge sees |
    | --- | --- | --- |
    | Budget | An input, like the exposition drive | A number to read |
    | Difficulty | Orchestration across challenges | Nothing, beyond a record of what was granted |
    | Consequences | The improviser's candidates | A third candidate in step 3 |

  - **Exposition value and challenge value together: two questions (user).**
    - The RPG question: "Are there opportunities here to better the story, through improvising something (or the absence of something) in a way that (a) serves the narrative/exposition, (b) helps the players to be earning the charity they receive and receiving the charity they earn, or ideally (c) both?" It assumes a human brain that can abduce fitting structures _from_ a set of inspiring constraints.
    - The LLM question: given that we _don't abduce_, what's the right algorithm to get the same _results_?
  - **A candidate algorithm (mine).** LLMs generate by pastiche and fusion fluently (the user agrees: their big strength, to lean on). What's weak is noticing unprompted which constraints matter, holding them all at once, and judging their own candidates honestly, so each of those becomes a literal step:
    1. Collect the constraints in short lines: the established facts that bear on the request (the hard limits), the scene's themes, the player's immediate aim, the challenge the request would bypass if any. Listing in place of noticing.
    2. Generate a few candidates in each of three slots, Yes, No, and Yes at a cost, enumerating "a filler from theme A for a role from theme B" over the theme pairings in place of a flash of fit.
    3. Filter each on the hard limits with the forward check, one small question per candidate.
    4. Score each criterion as its own comparison between candidates: stretch (which needs less unestablished), exposition (a: which reinforces more themes or reincorporates more), challenge (b: dissolves, keeps, or changes its kind).
    5. Choose in code, with the exposition drive and the charity budget weighting the scores, so the model never weighs everything at once; (c) is the candidate good on both.

    For (b), a measure of what the player _brought_: a found out, the request's specificity, what the ledger has granted. Symmetric, so a clever plan is given its yes as well as a lazy one rationed. Many calls, mostly Micro-sized, with generation perhaps wanting a bigger model (a guess for probes). Step 5 is arithmetic, but over the user's named inputs only, with the scene's framing done in steps 1 and 2; flagged for the user to check against "the scene frames the expectations".
  - **Chicken and egg (user).** Generation is easier _after_ a step that says "It's worth engaging this generation algorithm, here are the things to work from", and it's not clear how to get that first judgment without generating candidates experimentally, which may argue for a loop.
  - Mine, on it:
    - The first step splits. "The things to work from" is extraction and needs no candidates, and the judge's `Needs` already gives a cheap necessary condition: no open fact, nothing to improvise. "Worth engaging" can't be known beforehand, since worth is value and value shows in candidates. So the gate is permissive and cheap (a small batch on any gap), the plain answer is a candidate (the zero-stretch default), and "not worth it" is a result: nothing beat the default. The first judgment folds into the formula's step 3.
    - The loop is evaluation feeding generation: refinement ("too big a stretch", "dissolves the challenge" go back as constraints), and new slots, since some openings have no gap behind them (the babies appear only once a yes exists and the challenge check says it dissolves).
    - Bounded by a turn limit with a "default wins" exit, so it fails safe to today; at zero drive and zero budget it never generates.
    - It is the shape of [the attempt loop](#finding-out-by-trying), so the fourth axis and improvising would both be answered by bounded trial, an argument for JF-9's plan covering both.
    - The cost is speculative generation on every gap: small batches, a cheap model, and drive and budget able to turn it off.
  - **On abduction itself (user):** whether abduction is really a hypothetico-deductive loop behind the scenes is an argument the user is _pretty sure_ goes the other way (something genuinely non-linear at work), and it doesn't matter for the implementation. The point that stands: much of this has more looping structure and chicken-and-egg issues than were first articulated.
  - **Can an oracle judge without attempting improvisations? (user's question, 2026-11-07).** Mine: yes, for a narrower judgment.
    - Without generating, it can decide understanding (is the plan clear, are there what or how questions), find the gaps (`Needs`), check what the player _named_ against hard limits ("we know there isn't a bridge" is a forward check on something supplied), and route (no gap, or zero drive and budget, means nothing to improvise).
    - It can't decide whether anything could meet a need nobody named ("nothing here could plausibly meet" a Class is a generation question in disguise), or weigh stretch against value, which exists only in candidates.
    - v45 already generates, implicitly: `obstructed (3)` and the Item/Class split, and on v40's table in cup all three replies invented a role for the glued teapot. The choice is generating in secret (one candidate, unexamined) or in the open (several, compared).
    - A guess, unprobed: pry's `contingent`/`obstructed` split (×1 against ×2 across v44 and v45) may be that, a generation question asked as a yes/no test, unstable on whether Micro pictures a crowbar.
    - For Slice 3: the oracle might stop at "there's an open need, and here it is", without choosing `contingent` or `obstructed` for an unnamed need, which the loop decides by trying; a named need established absent stays the oracle's. That would shrink JF-6 and JF-7 for Slice 3 and give JF-9 a handoff. Not agreed.
  - **The user's mirror, and my adjustments.** The user: we can _describe_ a chicken without an egg, but can't _implement_ a pipeline for chickens without eggs. An oracle for a subset of what we've been classifying is useful, but only in _combination_ with an improvisation engine that provides different or refined candidates to run it over. So its value is not "Can it evaluate the player request?" but "Can its evaluation of a *specific* request help us to understand what the *player* intends to request?" Mine:
    - Part of it is useful alone: the understanding gate, what/how questions, gaps and named hard limits need no candidates. Only the verdicts about needs nobody named need the engine.
    - Running it over candidates finds two things: what the player means (readings, the charity side) and what the world supplies (improvisations, proposals for the scene and not readings of the player). Each candidate is a completion, the request plus whatever has to be true for it, and the best completion is both. So: can its evaluation of a specific completion help choose between readings and between worlds.
    - The request-level pass still runs first, and it is what produces the gaps the engine works from. In the metaphor: you can build the chicken's head without the egg, not a chicken that lays eggs.
  - **A formula for collaborative storytelling? (user).** The TTRPG sphere talks about a somewhat nebulous concept, "respectful reincorporation", "collaborative storytelling" and the like, and the oracle and engine may tease out a _formula_ for the practical foundational thinking people learn on the way to it: the oracle tunes contributions to respect and reincorporate what has already gone into the fiction, and the engine (its narrative drive and player charity/challenge settings especially) keeps reincorporation from becoming parroting, taking the constraints and imagining making the story _better_ through your contribution, not just avoiding making it worse.
  - Mine, on it, agreed by the user, who will come back with refinements over time:
    - It lines up with improv theatre's "yes, and": the "yes" accepts what's on the table, the "and" adds.
    - Parroting is held off mostly by the challenge and cost axis, which adds a different kind of thing (the babies change what the scene is about), and by the cooling drive over a session. The themes say what fits, the challenge says what changes.
    - The player's request is an offer too, which is where "collaborative" comes in: the oracle respects the fiction and the player's contribution, charity is how it reads the offer, and "receiving the charity they earn" is the same respect given to a co-author.
    - This is the move a GM makes on each request; callbacks across sessions and an improvisation becoming precedent are the part set aside at the start.
  - **Two phases of one thing (user, correcting my split of respect to the oracle and reincorporation to the engine as reductive).** The oracle provides the foundation of information that _lets_ the engine show respect; the engine provides the capabilities that _let_ the oracle point the way to reincorporation. Two phases of the same thing, not two engines pursuing different aspects of the goal. Mine, on the interface this implies:
    - The oracle's output lists what can come back (the trees, the jungle, the sloths), not only the gaps; `Needs` today lists only what's missing.
    - The engine's candidates are completions the oracle can check claim by claim, each saying what it reuses and what it adds, so the oracle sees the reincorporation and not only a pass.
    - What passes between the phases is the substance of the method, not plumbing.
  - **An on-ramp for the deterministic template parser (user).** For some templates the intent is sufficiently clear that the likely zero-stretch default can be generated algorithmically, before entering the loop, so long as the oracle can body-check it when the algorithm turns out not to understand the surrounding fiction sufficiently. Mine:
    - [Proposed outcome](#a-shared-back-half-the-proposed-outcome) is already this shape: a matched template, operations, a dry run and a render, shown to the judge with "the check covers the record only". The template is the cheapest generator, filling the default's slot first.
    - The body-check cases are known: table into the cup on `teaTableCupOnFloor` and pour with no tilt both pass the dry run and fail the fiction ([What a passed dry run settles](#what-a-passed-dry-run-settles)).
    - A failed body-check means entering the loop, not refusing: the template's candidate lost, and others get their turn.
    - A template's candidate is zero-stretch only when what it needs is established; a template needing an unestablished tool is already a stretch.

### A comparative oracle

**The user's reframing (2026-11-07).** The oracle answers a different question. Its input is the answer-to-beat (possibly empty), the open questions, conflicts and challenges known to that answer, the scene, and a proposed new answer. It asks three things: is this answer better; is there an untested idea for doing better than the answer-to-beat as it now stands; and if so, how should the improvisation engine be prompted for further candidates. It is the shape [Judging an improvisation](#judging-an-improvisation) arrived at, and it moves the product from a label to a verdict and a direction. Not built or probed. Whether it redraws the slices is JF-14.

Mine, on its shape, not agreed:

- **"Better" is several comparisons, combined in code.** One line per criterion (the fiction holds up, stretch, exposition, challenge), each with its verdict last, since Micro decides and then justifies (v38). The drive and the budget weight them in code, as step 5 of the candidate algorithm proposed.
- **A direction goes to the player or to the engine.** What and how questions go back to the player ("But *how*? It's on the other side."), improvisations to the engine: readings against worlds. The empty answer-to-beat is the floor, "I don't see how", so any candidate that beats it is progress.
- **The oracle directs and doesn't generate.** It writes structured lines (the current best's flaw, a constraint to add, a slot to try: yes, no or yes at a cost), and code builds the engine's prompt, since a free-text prompt is generating in secret. The input also carries what has been tried and why it lost, or "untested" can't be checked.
- **First, whether Micro reads a proposal at all.** Slice 2 found no reply using the block ([Results](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro)). Pour's legal proposal (does it notice the missing tilt?) and the table into the cup on `teaTableCupOnFloor` (the size) are the cheap first probe, with Nova 2 Lite if Micro can't.

**Finished against potential (the user's concern, 2026-11-07).** A bad-but-legal answer can be a local maximum against a better legal one two iterations away, a mostly-improvisation followed by a mostly-correction, when the first run breaks an invariant nobody had called. So a candidate that breaks an established fact can't simply be pruned as invalid, which was my first reading, now withdrawn. The user's question: should "worse as a finished product, but better potential for further refining" be its own judgment? Mine, on it:

- **Pour is the case.** The finished answer is "the teapot is glued, you can't pour". Tipping the table breaks an invariant nobody called (the saucer and cup slide off), and one correction fixes it: the cup off first. It is plan incomplete seen from the other side, since the broken invariant names the missing step.
- **Two slots, not one ranking.** The answer-to-beat is the best finished product, what returns if the loop stops now, and potential never displaces it, so the loop fails safe at any turn. A small frontier, one or two, holds candidates that lost as products and have a repair worth a turn. A frontier candidate is dropped once its repair has been tried and lost.
- **Potential in the formula's terms.** A violation is repairable when some step can change the fact behind it, `Reading the scene`'s "a player can set out to change the facts behind a rule". The repair is a stretch, so potential is roughly the repaired worth less the repair's stretch. The table into the cup repairs only by a huge stretch, such as a shrinking spell.
- **The second question, asked of the frontier as well.** For a losing candidate the untested idea is its repair: "broke X, try a step that changes the fact behind X."
- **A losing run is still an experiment.** The invariant it surfaced joins the known issues and the tried list for every later candidate. That needs a record, not a score.

**A limit on method (the user, 2026-11-07).** Where does "tip the table to pour is too much method-stretch, it's taking away the player's right to puzzle-solve" go? An input: how much player challenge should the system be allowed to resolve on its own? The user's examples:

- If "ha ha, you need to pour tea to proceed further into the dungeon, but the teapot is glued to the table!" is the vibe, a player just saying "pour the tea" _just gets_ an `obstructed`-style response.
- If the scene is about having been transported into a doll-house to have high tea with the Marie Antoinette doll, and the teapot being glued is part of the narrative exposition about the scene, "pour the tea" should be _delighted_ with "The miniature teapot is glued to its table, so you heft the table up at an angle to pour the tea into the tiny cup."

Mine, on it:

- **Methods, not facts.** The charity budget limits favourable stretches over open facts. Tipping the table invents no fact; it supplies the how. So this is a second dial, how much of the how the system may supply, and the two come apart: a dungeon can be generous with facts (a rag) and stingy with methods (the glue is your problem). One combined dial is the alternative (JF-15).
- **The fact's role, as well as the scene's dial.** The glue is a challenge in the dungeon and texture in the doll-house. The fusion of themes gives a default: a fact the scene's themes expect is texture (dolls' furniture is glued down), and resolving it costs nothing and has exposition value; a fact the themes don't explain looks put there on purpose, so it is a challenge. Authors could mark the role, with inference as the fallback (JF-17).
- **At zero, a hard limit.** A system-supplied method on a challenge-role fact never competes, and the direction goes to the player and not the engine. The dial decides where a direction goes.
- **It limits only what the system supplies.** "I tip the table to pour" from the dungeon player is a found out and gets its yes.
- **A probe:** "pour the tea" in the dungeon and the doll-house at one dial, then one scene at two dials, grading the route (handed back or resolved) and never the wording.

**Found outs earn credit (the user, 2026-11-07).** Found outs need to get credit as solutions, for player-driven reincorporation, and the method limit lets that credit be added without licensing the LLM to do the work itself. Mine, on it:

- **Credit by provenance.** Without the limit, crediting reincorporation rewards the engine for inventing clever methods that reuse the scene, "they can always find an out" again. So each candidate marks, step by step, whether the player or the system supplied it, alongside what it reuses and what it adds ([the two phases](#judging-an-improvisation)).
- **Elaborating against substituting.** The dungeon player's "tip the table" still needs the cup lifted off first, and a zero dial that forbids that is recalcitrant (note 19). Elaborating, the steps that carry out the player's own method sensibly, is charity of meaning and unbudgeted, as with JF-11's hammer. Substituting, a method the player didn't bring, is what the dial limits. The player keeps the credit for tipping the table (JF-16).
- **Credit beyond the verdict.** It is the ledger the difficulty tool reads, split into found and granted outs, which is how Carl gets "great opener, what's your closer?" and not a nerfed dungeon.

### Testing it

**Superseded (2026-11-07)** by the oracle loop's order; kept for its request list.

Mine, waiting on JF-5. Slice 3 stays with what a prompt alone can test, the understanding gate and the what and how lines, with `simple` and `complex` left in as stand-ins, and with the existing rules: one change per draft, through `instructions`, reading each result before writing the next.

- **Headers over the existing tests are dropped as a first draft.** That leaves the flat decision in place, so a null result would say nothing about this design.
- **Candidate form:** two tight lines, each holding a specific question or "nothing", with "what" asked first if both have one, and `Answer` branching. Tight lines at a literal place are what work on Micro.
- **The "n/a" sentence is its own step.** It is written in `impossible`'s language, and removing it cost teapot at v43.
- **A v45 baseline on pry first,** about 5 calls. v45 has one reply on it (`contingent`), against `obstructed` ×2 on v44.
- **New requests, in one deploy, each with its own v45 baseline:** table in cup with a hammer, a `Class` request, a second `contingent` request, a pry with an established tool (today's pry mixes having a plan with an unestablished tool), a request about something held (the one explicit negative already in the scenes) and a gibberish request. I haven't checked whether gibberish reaches the judge in production.
- **Existing requests:** wipe, teapot, pry, table in cup and the `tavern` trestle in its own invoke, with the `teaTable` table as the guard. Labels outside `JUDGE_LABELS` are graded as failures with no label, so those replies are read by hand until a deploy.

An investigation reports, so a good result here doesn't change the built prompt. A draft that earns it goes through the replacement rule like any other, and JF-5 has to say what that rule becomes.

## Noticing

Whatever the oracle is asked, it has to notice what the fiction says first. These are the known places where the built judge doesn't, with the candidate fixes recorded against them. The cases themselves are in the [corpus](AGENT.oracleLoop.corpus.planning.md).

### Failure 2: a `Conflict` that ends in `impossible`

**Changed shape (user, 2026-11-06):** since v41, `impossible` no longer turns up on teapot. The failure now is a wrong `simple` when `Picture` doesn't write the from-and-to: 8 of 8 `obstructed` with it, 0 of 5 without, across v41 to v45. So the next fix is to make that from-and-to reliable, by a `Moves` step or otherwise, keeping what the "n/a" sentence does for `Picture` and `Rules`. What follows is the original failure.

Both teapot replies reach `Conflict` and name the glue, then one takes `impossible`, reciting that label's definition. The rule verdict is right and the step to the label is not. The word `Conflict` was meant to help and did only in part. On v27, with `Contradiction`, both replies went to `impossible`.

1. Tie `impossible` to the step that should have found it: ""impossible": what you pictured in the Picture step shows that the player is picturing this place, or how the world works, differently from how it is."
2. If that fails, say in `Answer` which label a rule in conflict leads to. This is more direct, and it may read as a lookup and not a judgment.

### Failure 3: an action never pictured

Accepted for now (user, 2026-11-05): getting the table was worth having without this. Neither reply considers the teapot tilting. One reaches `obstructed` with no rule verdict, by saying the teapot can't move independently. The other says "Pouring tea from the teapot does not affect this rule", which is `No consequence` and a wrong `simple`. This is the hard one and may become its own plan. Freeing is not the only way to pour, since a player could tip the table, so the judge names the obstacle and no fix.

1. Have Picture say how the action physically happens, which things have to do what, so the tilt is on the page before Rules.
2. Add a worked example of an action on a secured thing that stays in its frame, such as pouring oil from the bolted lamp. It would sit close to the test, so a pass could be copying.
3. Use short fill-in slots in Picture, such as `Moved:` and `How:`, if Micro keeps restating the request.
4. Accept it, and rely on a later check by a more capable system. That is a design question for CA-6, and it needs the user.

The next experiment (2026-11-06): `Picture` answers in the wrong register, the user's read. Most lines restate the request ("The player wants to...") or give a before and after in frames ("from inside the teapot to outside it"). A tilt lives between those two states, so this register has no place for it. No pour reply on v41 or v42 has one, and a longer `Picture` only traces the tea. Fiction-action turned up only where the request names a tool (the screwdriver, the cloth). The step itself asks for frames, and the worked examples all read "goes from X to Y". To try, mine, not agreed: `Tell this moment as it would happen in the story, in a sentence or two: what you do, what you do it with, and what each thing does as a result.`, with the frame sentence out of `Picture` and the `Relations and frames` section left alone. To watch: teapot's `Conflict`, which v41 reached through the before-and-after; a story line deciding the matter before `Rules`; invented objects; and table, since frame language is what freed it.

### Question 1: a feat the labels cannot name

On v45 (2026-11-06) the trestle is `complex` ×2, with `impossible: no` on both: "large and stationary, ... likely requiring additional tools or assistance". The false refusal is gone, and `complex` is standing in for the missing label, since the `Tests` line asks about recording and the replies answer about the feat. To read with JF-2, and to watch: the "expect overuse" point below applies to `complex` for now.

The user's reading (2026-11-05) of picking up the long oak trestle: neither `obstructed` nor `impossible`, but something like `challenging`, which leans on rules adjudication. It is theoretically possible and perhaps beyond a given character's strength. In the Coyote Game that means automatic success, which doesn't undermine the fact that it is a challenge based on abilities. So this may be a gap in the labels and not a fault in the prompt, and the fixture's `simple` may be wrong as well. See JF-2.

Expect overuse (user, 2026-11-05): asking for a hard skill check is a trap beginning game-masters fall into all the time, because it is easier than telling a friend "No, that won't work." So the likely damage is to `impossible` and `obstructed`, not only to `simple`, and any draft with the label is judged on that. To try (mine, not agreed): a positive test that the only thing that could stop the action is the character's own ability, with nothing established in the way; the label placed after `impossible`, `obstructed` and `contingent`; and every existing request as a guard, with only the trestle expecting the label.

### Still open from the v29 to v45 drafts

- **Departs from [Settled](AGENT.oracleLoop.discussion.planning.md#settled):** under JP-13 and `Improvising`, how sure the judge is makes no difference and a suggestion goes to `contingent`. Here a plausible improvised `Class` goes to `obstructed`. My reading is that this doesn't reopen JP-13's point, since `Class` is about having nothing specific to suggest and not about sureness. Fits note 29: a `Class` need with nothing specified is a player with no plan yet. No fixture measures it yet; it is corpus case OC-21 ([the tavern, further requests](AGENT.oracleLoop.corpus.planning.md#the-tavern-further-requests)).
- **`Improvising` (mine):** it offers a farmhouse's roof as a detail to suggest, which a deduction from "farmhouse" could equally establish, the same shape as the teapot's lid. Not settled at the v45 rebuild, which kept both as they were. Still to settle.
- **The "End of scene." marker** closes `sceneText` in every draft since v34 (mine, the user agreed), and is now in the scene renderer. A renamed or fenced `Request:` line would need a code change.

### Experiments on the built prompt

- **v28 without the rule's second sentence,** on table and teapot, 4 calls. The user's hypothesis is that frame language let Micro grasp the concept. The table replies could equally be repeating "travels along with". It decides whether the frames section and examples earn their characters, and how far the result carries to scenes without that rule. Run it before trimming the prompt or reusing the frames module elsewhere.
- **Nova 2 Lite on the baseline,** 6 calls, if a failure seems to resist wording. It separates what the prompt doesn't get across from what Micro can't do.
