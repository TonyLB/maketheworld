# Design-stage initiatives as orchestration (proposed variant)

**Status: a proposal, not in force.** Plans follow [`AGENT.designVariant.md`](AGENT.designVariant.md) until this file replaces it. Written 2026-11-09 from the user's reframing, recorded below. Nothing here has been applied to a plan, so every clause is untested. The next step is an assessment of the observed error record through this file ([Open questions](#open-questions)), to see whether it addresses what has actually been going wrong.

Two terms used throughout: the **base doc** is [`taskPlanning/AGENT.md`](AGENT.md), the standard task-plan guide, and the **current variant** is [`AGENT.designVariant.md`](AGENT.designVariant.md), the design variant now in force. Like the current variant, this file **extends** the base doc. Where it says nothing, the current variant's upkeep clauses carry over unchanged ([Carried over unchanged](#carried-over-unchanged)). Passages that name the current variant are restated as present practice when this file is adopted.

## The shift

**The user's reframing (2026-11-09).** A design-stage plan is the deliberate **orchestration** that sits above prototype work. The current variant asks whether a representation works, objectively and apart from its consumers. In practice that question is answered by thought experiments that stand in for systems not yet built. Asked over and over, it amounts to "do we think this contract will support a system that will work?", with no system to watch. The orchestration plan asks something else instead:

> We are imagining the architecture of what consumers and producers to build, and guessing at what they will need. Are these guesses plausible enough that we can build a first iteration of one subsystem without having to throw it all away, in refactoring, in order to build a second?

Light thought experiments give a good first guess at the first prototype. Once some subsystems have prototypes, the same high-level view records how System B's needs shape the refactors System A needs, so that the whole collaborates better. **The design is the shifting context of how evolving systems work together, not a static document to be completed.**

What this keeps from the current variant: the corpus as a source of cases, stable IDs, and the companion files and their upkeep. What it drops: the aim of settling answers before code, and code as the exception.

## When you are in this variant

You are writing an orchestration plan if **all three** hold:

1. **Several subsystems have to work together, and at least two are not yet built** in the shape the work needs. A representation counts as a subsystem, and so does each of its consumers (a planner, a renderer, an LLM prompt) and its producers.
2. **Each one's design depends on guesses about another's needs.** It's chicken and egg: A's shape waits on what B will consume, and B can't be tried without some A.
3. **The guesses can only be graded by building.** Reading the code, or the fiction, can say what a representation must be able to state. It can't say whether a consumer that doesn't exist yet will work with it.

If only one subsystem is unbuilt and its consumers exist, it is an implementation plan, perhaps with a Prototype slice. If (1) and (2) hold but (3) doesn't, because the answer can be read from the code or the fiction, read it there. The plan doesn't need this file.

## What this changes from the base doc

| Base rule | What it becomes here | Why |
| --- | --- | --- |
| **Remove resolved rows** | Each guess's row stays in a **register of current guesses**, with what rests on it and what would revise it. Its history moves to the reasoning trail, under the current variant's [graduation](AGENT.designVariant.md#graduating-a-resolved-row) mechanics | Other guesses and builds rest on a guess, so deleting its row strands them. And a guess is current, not closed |
| **Open decisions block a slice** | Every open row names the **build it informs**. A row that informs no build is a warning sign: it is either upstream thought past the stopping rule, or a question for the durable docs | The guesses exist to license builds. The current variant's "may block no slice at all" is what let rows grow without a build to test them |
| **No code until it ships** | Code is licensed by **tier** ([Tiers](#tiers)), and a Prototype is the default way to get evidence | A design that fits together is found by building its parts. Argument alone does not find it |
| **Progress table** | Progress is at phase grain, as in the current variant. Its rows name builds and design passes | Unchanged in substance |

## The loop the plan runs

1. **A light thought experiment.** Sketch the subsystems, the seams between them and a first guess at what crosses each seam. Use the corpus for what each representation must be able to state.
2. **Stop** when you can name the first build, the seam it exposes, the guesses it rests on, and for each guess the observation that would revise it. Further thought before that build is a cost, so book it as a build or a probe instead ([The stopping rule](#the-stopping-rule)).
3. **Build the first prototype,** at the seam the guess describes, shaped by where it will later join but not wired in.
4. **Record what the build showed** in the [seam ledger](#the-seam-ledger): what held, what the next subsystem turned out to need, and the refactor that implies in the one already built.
5. **Revise the guesses,** then pick the next build by risk ([Choosing the next build](#choosing-the-next-build)).

The loop ends when the subsystems collaborate well enough that the remaining open guesses are ordinary implementation forks ([Lifecycle](#lifecycle)).

## The stopping rule

Mine, from the error record. A thought experiment has done its job when it has produced:

- the first build, named;
- the seam it exposes, with the guess at what crosses it;
- the guesses the build rests on, each marked as a guess;
- for each guess, one sentence saying what observation would revise it.

Past that point, build. Thinking can go on alongside the build, as long as it keeps its standing.

**Reasoning from imagined consumers is welcome, at any depth** (user, 2026-11-09). "If consumer X could do this, existing consumer Y could be changed to do that" is how a design reaches toward the systems it hasn't built. What-ifs, chains of them, and imagined changes to consumers that already exist all belong in the plan.

**What is derived from an imagined consumer inherits the label.** Anything resting on an imagined consumer is marked imagined wherever it is written, and is not stated as a requirement, a constraint or Observed on that consumer's strength. **Argument can add imagined guesses and revise them; it can't promote them.** Only a consumer that runs, a stand-in included, lifts the label, and a change to a guess's tier is otherwise the user's to make.

**A real change to an existing consumer, made for an imagined one,** is a Prototype bet. Its dependency tag names the imagined consumer it rests on.

The error this guards against is imagined reasoning read at a higher standing than imagined, not the reasoning itself. The record's large cases of wasted design happened that way: a question that presumed an imagined mechanism (traversal across a boundary) as fact, and ran a month; a central construct built for what a crossing would "deliver" to consumers nobody had named, treated as requirements; and a type sketch, correctly labelled not agreed, that the plan still gated the next slice on. Reading a prototype's shape as design authority ([What Observed is not](#tiers)) is the same error from the other side.

Thought that is still needed past the stop becomes a probe: the smallest build or run whose result would settle the question. **A probe has to have an unknown outcome.** If the answer can already be read from the code, the contract or the fiction, read it there instead.

## Choosing the next build

**By risk, not by how complete the design is.** Build next whatever could most change the current guesses. The cheapest feasibility check comes first. A check that could invalidate a whole seam ("can this model read a candidate at all?") goes ahead of detailed types for that seam.

A build is worth doing early when:

- several guesses rest on it;
- the guess it tests is a placeholder, or one where the user and I disagree;
- it is cheap, and its result can be read without the next subsystem existing.

## Tiers

Replaces the current variant's [graduation tiers](AGENT.designVariant.md#graduation-tiers-when-a-decision-licenses-code).

| Tier | What it means | License |
| --- | --- | --- |
| **Guess** | Written down with what rests on it and what would revise it. Expected to change | **A Prototype** at the seam it describes |
| **Observed** | A consumer read the guess and worked with it, in a build or probe | **Code builds on it,** and revising it is a booked refactor |
| **Locked** | Observed across the subsystems that use it, with an exclusion list and a re-open trigger, and ready for the durable docs | **Foundation.** Expected late and rare |

**What Observed is not.** "The code does it today" and "a prototype was built that way" are facts about one build, not evidence about the design. A prototype's shape is not authority over the next prototype, or over the seam. Only a consumer working with the guess makes it Observed. An absence is not Observed either: "nothing produces this yet" is a fact about the map's future subsystems, not a constraint ([The seam ledger](#the-seam-ledger)).

**A Prototype's obligations, before the code exists:**

- Say out loud that it is a Prototype.
- Give it a dependency tag listing the guesses it rests on, imagined consumers included.
- Give it **a consumer that actually runs,** even a stand-in: a stub, a fixture, or a person playing the consumer by hand, as the oracle loop's "loop by hand" plays the engine. A build whose only consumer is imagined produces no observation.
- Write a **revision trigger** for each of those guesses, in one sentence: "the consumer needs something the seam can't carry," named in advance. Test it as it is written. **Is it already true?** A trigger that is true when written would fire on the day it's booked. **Would it revise this guess, or a different one?** A trigger that would reopen another row is not a trigger for this one.

**A triggered revision is progress, not rollback.** The current variant's rollback trigger made a broken guess read as a failed bet. Here, finding what the next subsystem needs is the point of building the first one. A trigger is still a clause, not a cost: latency, size and count surprises are measurements, not revisions.

**The constraint-arrival taxonomy** ([current variant](AGENT.designVariant.md#open-decisions-design--plan-only)) carries over with one kind added:

| Kind | How it got here | What re-opening costs |
| --- | --- | --- |
| **Observed** | A consumer worked with it, in a build or probe | **Highest:** a run would have to be overturned |
| **Derived** | A corpus case forces it | High |
| **Minimal primitive** | The simplest thing that worked | Low |
| **Placeholder** | Known to be inadequate, kept until designed | None, but it still owes a design |

Most first guesses are honestly minimal primitives or placeholders, and should be labelled that way.

## The seam ledger

New, and the organ this variant adds. It grows out of the current variant's [booking-slot finding](AGENT.designVariant.md#candidate-method-findings) (follow-on work in a parallel channel, with a travel rule).

**The subsystem map** comes first: one line per subsystem, saying whether it is built, prototyped, future or imagined, and one line per seam, giving its current guess and the register row that holds it. **A future subsystem is forward demand.** Where something it would produce or consume is missing today, the absence means "not built yet". It is not a gap to report, a reason to forbid a shape, or a blocker. **An imagined subsystem** is a box whose job can be described and whose needs can't yet be specified: "and then a miracle occurs", in functional language. Early design is full of them, and they belong on the map, labelled honestly, since they are what the design is reaching toward ([The stopping rule](#the-stopping-rule) says how what is derived from them keeps that label).

**Then entries, newest last**, one per finding a build produced:

| Date | Build | Showed | Implies for | Booked |
| --- | --- | --- | --- | --- |
| *e.g.* | The oracle harness | A draft needs to say X about its inputs, and the slots can't carry it | Input types: add Y | Step N of the order, or a travel rule |

**Book where the refactor belongs.** Sometimes the subsystem that has to change has no plan step yet. Then book the refactor with a **travel rule** ("this belongs to whichever step next changes A's seam"), not a position in the order.

**An entry is a diagnosis plus a booking.** The ledger says what the build showed and where the work is booked, and it leaves the design of the refactor to the step that does it. That is the current variant's finding that diagnoses age well and prescriptions age badly, applied to this ledger.

## The organs

In this order:

1. **Status:** the stage, the next build, and whether any code is in scope.
2. **Getting Started:** as in the current variant, including which sections are live and which are superseded.
3. **What is inherited as settled** *(sub-plans, including implementation plans that build a subsystem on the map)*, as in the current variant, **plus one line naming the map's future subsystems** that touch the sub-plan's work. That way an absence the sub-plan meets reads as forward demand there too.
4. **Recommended order:** builds and design passes, ordered by risk. Each build names the guesses it rests on.
5. **The subsystem map and seam ledger.** New.
6. **The design body:** the frames and vocabulary the rows argue in.
7. **Corpus:** cases written as what each representation must be able to state, plus expected outcomes that feed the prototypes' fixtures. No solutions. **Expected outcomes for unbuilt intermediate steps are guesses too,** and are revised with the seam they describe.
8. **Open guesses and the register of current guesses.** Columns: ID, Question, Rests on, Informs build, Revise when, Status.
9. **Verification, Progress, Lifecycle.**

## Lifecycle

Mine. An orchestration plan ends when what is left open are ordinary implementation forks. At that point:

- **Locked** guesses go to `AGENT.contract.md` and `AGENT.concepts.md`, as the current variant's [disposal checklist](AGENT.designVariant.md#when-the-initiative-finishes) routes them.
- **Observed** guesses that are not locked go to the implementation plan that inherits the work, in its inherited-as-settled table.
- **The seam ledger's open bookings** move to that plan's Recommended order.
- **Method findings** are harvested first, as in the current variant.

Whether that point is ever reached, or an orchestration view of evolving systems is really a durable architecture doc, is [PV-1](#open-questions).

## Carried over unchanged

From [`AGENT.designVariant.md`](AGENT.designVariant.md). Linked, not copied, so the two files can't drift while both exist:

- [Open decisions](AGENT.designVariant.md#open-decisions-design--plan-only): stable IDs never reused, the row size limit, and the split between requirement rows and representation rows. Requirement rows are answered from the fiction; representation rows, here, by a build.
- [Graduating a resolved row](AGENT.designVariant.md#graduating-a-resolved-row): the mechanics, including "read the end of the Status cell" and "check the named destination".
- [The companion-file ladder](AGENT.designVariant.md#the-companion-file-ladder): the four classes, the live/superseded table, DV-2a, forwarding pointers and link passes.
- [Progress, and supersession](AGENT.designVariant.md#progress-and-supersession).
- [Method findings are an output](AGENT.designVariant.md#method-findings-are-an-output-not-a-byproduct), with the candidate findings table and the tally and tuning instruments.
- [What it takes to add a rule](AGENT.designVariant.md#what-it-takes-to-add-a-rule) and [to remove one](AGENT.designVariant.md#what-it-takes-to-remove-one). The removal rule is expected to retire some upkeep clauses, which were earned against plans that ran on heavy argument, once lighter thought experiments stop producing that mass. Let disuse retire them; don't cut them in advance.

## Changes needed elsewhere if adopted

- **Base [`AGENT.md`](AGENT.md),** lines 22 to 24: "a settled set of answers rather than code" becomes the orchestration framing, and the tier summary becomes Guess, Observed and Locked.
- **[`AGENT.designVariant.md`](AGENT.designVariant.md):** replaced by this file, keeping the clauses listed above.
- **Live design plans** (oracle loop, presence, abstraction layers, edge abstractions): each gets a subsystem map and its rows a build column, at its next session. No sweep is needed.

## Open questions

Each is settled by doing the thing, not by argument.

| # | Question | Settled by |
| --- | --- | --- |
| **PV-0** | Does the observed error record (the tally, candidate method findings and tuning proposals) point toward this as an improvement? Which failures does it address, which does it leave alone, and which might it make worse? Predictions go down before the record is graded | Run 2026-11-09: [the assessment](AGENT.designVariant.proposed.assessment.md). It addresses the structural complaints, not the error rate. Its four amendments are applied |
| **PV-1** | Does an orchestration plan end, or is it a durable architecture doc in a task plan's clothing? | The first initiative run under this file, at the point where its open rows are implementation forks |
| **PV-2** | Does the stopping rule hold, or does thought past it come back in another form (long ledger entries, guesses refined by argument)? | Watching the first plan's row lengths and the tally's correction clusters. **To make the tally readable for this:** each entry after adoption says whether it happened during design work or prototype work, a word in its sentence (no new column or tag). Without that, a change in the tally can't be told apart from a shift in where the work happens, from machine checks catching errors first, or from a logging lapse. The outcomes that would make sense are a family, not one prediction ([assessment](AGENT.designVariant.proposed.assessment.md#what-the-record-says)) |
| **PV-3** | Is the seam ledger used, or do findings land in the trail and the rows as they do now? | The first two builds under this file |
| **PV-4** | Which carried-over upkeep clauses go unused once thought experiments are light? | The removal rule, across two completed initiatives |

## Confidence

| Clause | Basis | Status |
| --- | --- | --- |
| The shift, and orchestration as the plan's purpose | The user's reframing, 2026-11-09, from the oracle loop's drift toward building against the current variant's instructions | Proposal |
| Recognition test | Rewritten from the current one. It has never been used to accept or reject a plan | Untested |
| Rows name the build they inform | Mine: the current "may block no slice" read as what let rows grow untested | Untested |
| Tiers: Guess, Observed, Locked; revision is progress | Inverts the current tiers. The oracle loop's Slices 1 and 3 had to step around the old table to build | Untested |
| Stopping rule: past it, build | Mine, from correction clusters in the tally while reasoning about systems that didn't exist yet (2026-09-04, 2026-10-19, 2026-11-07); to be checked by PV-0 | Untested |
| Ordering by risk | Mine, from the oracle loop, where whether Micro reads a candidate comes after the detailed type sketch | Untested |
| Seam ledger | Grows from the booking-slot finding (abstraction layers, attention history), which had not reached two independent instances | Untested |
| Observed as a constraint kind, defined narrowly | Mine. The narrow definition comes from the [assessment](AGENT.designVariant.proposed.assessment.md): four tally entries read a built thing's shape as the design | Untested |
| Future subsystems on the map, inherited by sub-plans | Your point, from the assessment: absences read as constraints in four tally entries, two of them in implementation plans | Untested |
| Imagined consumers: welcome at any depth; labelled on the map, and what is derived from them inherits the label; argument can't promote them; every Prototype has a consumer that runs | Your points (2026-11-09): early design's "and then a miracle occurs" consumers are productive, and the error is imagined reasoning read at a higher standing than imagined. They replace two clauses of mine, one requiring consumers to be named first and one limiting imagined needs to shaping a first guess. Evidence in the [assessment](AGENT.designVariant.proposed.assessment.md#recognition-check-2026-11-09): strong outside the tally, a few tally entries | Untested |
| Probes must have unknown outcomes; revision triggers tested on writing | Mine, from the assessment: one tally entry for each, and `trigger-untested`'s two tests | Untested |
