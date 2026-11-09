# Assessment of the proposed variant against the error record (PV-0)

**Durability: temporary.** This is the assessment for [PV-0](AGENT.designVariant.proposed.md#open-questions). It is deleted when [`AGENT.designVariant.proposed.md`](AGENT.designVariant.proposed.md) is adopted or dropped. Written 2026-11-09.

**The question:** does the observed error record point toward the proposed variant as an improvement? Which recorded failures would it address, which would it leave alone, and which might it make worse?

**The record:**

- the [performance tally](AGENT.designVariant.performance.md): 95 observations and 7 patterns;
- the current variant's [candidate method findings](AGENT.designVariant.md#candidate-method-findings): 12 rows;
- the [tuning proposals](AGENT.designVariant.tuning.md): TP-1 to TP-9, eight rows.

## Predictions, written before grading

The tally had already been read once earlier in the session, so these are not blind. They were written before the entry-by-entry pass.

1. **Reading failures go unaddressed.** These are `proxy-read`, `source-unread` and `stale-premise`, where a claim was made without opening its source. They are the largest share of the tally, and nothing in the proposal changes how a source is read. Expected: 70% or more of the tally graded *not addressed*.
2. **Corrections made while designing on paper are reduced, not caught.** These are the clusters on 2026-09-04, 2026-10-18 to 10-20 and 2026-11-07. The stopping rule shortens time spent in that mode. It doesn't catch a wrong restatement. Expected: mostly *partly addressed*, and rarely *addressed*.
3. **Present state read as design authority could get worse.** Ranking *Observed* highest, and building from existing prototypes, could make it easier to treat today's code, or a prototype's shape, as the design.
4. **Triggers get more numerous and no better tested.** The proposal asks for a revision trigger per guess, and `trigger-untested` says triggers are already written untested.
5. **Upkeep failures go unaddressed.** Pointers, bulk, graduation and sweeps are carried over unchanged.
6. **The tuning file's structural complaint is addressed.** TP-9's "always one more thing", TP-3's growth in open rows and TP-1's dissolution all point the same way the proposal does. The read-side proposals (TP-4 to TP-8) are untouched.

## Grades

- **A, addressed:** a clause in the proposal would likely have prevented the error, or caught it before you did.
- **P, partly addressed:** the proposal reduces exposure without catching the error, or catches only some cases of it. Most P entries happened while designing on paper: the proposal shortens time spent there, and nothing in it catches the error itself.
- **N, not addressed.**
- **R, risk:** not addressed, and a clause in the proposal could make the error more likely.

The grading is mine, so the P and R grades are the ones to spot-check.

### Tally observations (95)

| Grade | Count | Entries (date, short label) |
| --- | --- | --- |
| **A** | 4 | 09-04: the most hypothetical row was ordered first, and you reversed it to code first (*ordering by risk; the stopping rule*). 10-22: a corpus case was called unbuildable when extend-move-extend at the far end works (*one try in the kernel settles it*). 10-21: "no producer yet" used as grounds to forbid; and 10-01: AP-4, "no pool today" used as a blocker (*the subsystem map labels the missing producer as a future subsystem, which is forward demand, and sub-plans inherit that label*) |
| **P** | 19 | 09-24: a classification by the current verb set (*the map helps only where the future verbs are on it*). 10-30: planning's current diet read as its shape (*the map shows the cache as the planner's future input*). 09-09: a closed checklist still carried 16 KB of superseded briefs. 09-11: H1's clause table still said "untested" five weeks after nothing had built it (*a guess with no build is a warning sign*). 10-12: a blocker of "needs a new kernel op", when the ops existed (*naming the build would have surfaced "ready to build"*). The presence-sets cluster, 10-18 to 10-20 (Base/Unplaced merged; "fixes" that restated the proposal; an endorsement whose disqualifying fact was in my own reply; a reading that drops the remainder; an argument from an illegal state; a framework's restriction treated as a result; one rule split into two; a self-contradiction across two turns; a rule guarding a nonsense op; "join is the only widening step"): 10 entries. The oracle cluster, 11-07 (weights; sub-class; overuse; two engines): 4 entries |
| **R** | 4 | 10-19: today's kernel behaviour read as a rule. 10-23: a probe called for that wasn't needed (*"thought past the stop becomes a probe" invites this*). 11-04: the six-section prototype format treated as the baseline. 11-06: two axes read through v45's flat structure. In all four, a built thing's shape was read as the design, and the map's "prototyped" label is accurate and doesn't prevent it |
| **N** | 68 | 10-12: a non-kernel writer kept because it has no caller (*a defect excused by an absence, not a missing subsystem*). Every `proxy-read` (18) and `source-unread` (4) entry, and four of the six `stale-premise` entries. Most `framing-inherited` and `overbroad-inheritance` entries, where a document's shape or a grain was carried over. Both `fork-manufactured`. Restating your design without testing it against its own principles (10-08 ×2). Local fact read as a global claim (09-17, 09-18). The upkeep entries (09-09 pointers left behind) |

**Not graded:** the corrections on the oracle loop's type sketch, 2026-11-08, of which there were at least six. None were logged, so the record has a gap exactly where the proposal's motivating case happened.

### Patterns (7)

- **N:** `stale-premise`, `vocab-drift`, `framing-inherited`, `overbroad-inheritance`, Source-unread, `proxy-read`. That's six, all reading or inheritance.
- **R:** `trigger-untested`. The proposal multiplies triggers, one per guess, and its "Revise when" column is a falsifier written at the moment the row is written. This pattern exists because such falsifiers are already written wrong.

### Candidate method findings (12)

| Grade | Finding |
| --- | --- |
| **A** | *A phase that schedules grading dissolves when its rows can't be graded.* Rows that must name a build, and recognition test (3), ask that question when a phase is booked, which is where the finding said it belongs |
| **A** | *A Prototype needs a booking slot.* Promoted, as the seam ledger with its travel rule |
| **P** | *A correction is filed by whoever noticed it, not by whoever owns the row.* The ledger's "book where the refactor belongs" applies the fix between subsystems, not between rows |
| **P** | *Trace one case through the code before counting how many rows depend on a question.* Build-first generalises the second instance of this finding. The first instance, restating your mechanism mechanically, is untouched |
| **A / R** | *Present implementation state is not authority over the design.* Split. The absence half (no consumer yet, so no extension) is met by the subsystem map's future labels. The half about a built thing's shape is the risk in prediction 3, met only by the narrow *Observed* |
| **Adopted, not graded** | *Diagnoses age well and prescriptions age badly.* It is now the ledger's entry rule |
| **N** | Locks reach only their readers; a correcting row records the correction on itself; staleness is a bad ordering signal; the end-of-day sweep; verify against the claim, not remembered wording; findings need a disposition pass; a vocabulary fix without the mechanism |

### Tuning proposals (8)

| Grade | Proposal |
| --- | --- |
| **P** | **TP-9**, readiness lists. Its motivating complaint is "always one more thing", open questions that grow, and "every instrument is additive". That is the clearest match in the record: rows that must name a build and the stopping rule are subtractive, which is what TP-9 found missing. Its third finding, a list scoped smaller than the question, is untouched |
| **P** | **TP-3**, capped pools, motivated by 46 open rows against 15 settled. Rows that inform no build give closure pressure without a cap |
| **P** | **TP-1**, dissolution. "Which build does this inform? None: it goes to the durable docs, or it goes" is a dissolution test I can apply without being prompted. TP-1 records that every dissolution so far was yours |
| **Adopted** | **TP-2**, a falsifier per row. It becomes the "Revise when" column, and inherits `trigger-untested`'s risk |
| **N** | **TP-4** to **TP-8**: fetch the sentence, tabulated gradings, granularity, sections for rows, positive foreclosure. All of them are about reading or upkeep |

## What the record says

**Counted, the proposal directly addresses little.** In the tally, 4 of 95 are A and 19 are P, which is 24% touched in any way. Four are R, a risk. The rest, 68 or 72%, are untouched, and those are mostly reading failures. Predictions 1, 4 and 5 held, and prediction 3 held in part (see below). Prediction 2 held in its weaker form: the paper-design clusters are P, not A. The proposal reduces time spent in that mode and catches nothing inside it.

**Weighted by cost, it points the right way.** The failures it reaches are the expensive ones the tuning file was built to fix: open questions that grow (TP-3, TP-9), questions dissolved only when you prompt it (TP-1), and phases whose rows nothing can grade. The 2026-10-18 to 10-20 cluster alone is 13 tally entries in three days. TP-9 records your verdict that the old pattern "feels terrible to work with". Those structural complaints have no other proposal aimed at them. The reading failures already have TP-4 and the `proxy-read` actuators.

**So it is an improvement, and its effect on the error rate is open.** Nothing in the proposal changes how a source is read, so the most frequent failure, a claim made from a proxy for its source, is graded N. But the grading gave the paper-design clusters P for exposure, the same rate per hour over fewer hours, and didn't apply that test to the reading failures. Two things favour it there. Many reading failures happened during design work, which reads across everything. And prototype work catches its own reading errors in `tsc` and tests before they reach you (your point). Two things limit it. Some reading failures happened in implementation work (10-15, 10-27, 10-30). And the source left unread was often the contract or a plan row, which prototype work still reads.

**The range of outcomes that would make sense after adopting it:**

- the tally goes about as before;
- reading failures drop with design time;
- corrections move from you to the compiler and tests;
- some mix of these.

None of them alone is the sign of the proposal working or failing. What would be a sign is the tally going quiet with no way to say which of these, or the logging lapse of 2026-11-08, explains it. [PV-2](AGENT.designVariant.proposed.md#open-questions) asks the tally to record what kind of work each entry happened in, so that can be told apart.

**Present state read as design authority comes in two halves, with different guards.** Nine entries were first graded R, and they split.

- **Absences used as constraints:** no producer yet (10-21), no pool today (10-01), the current diet (10-30), the current verb set (09-24). The proposal already guards these, which the first grading missed. The subsystem map labels an unbuilt subsystem as future, so an absence reads as forward demand rather than as a gap or a blocker (your point). The labels need to reach sub-plans, through the inherited-as-settled table, because 10-21 and 10-01 happened in implementation plans. With that, the first two are A and the other two P.
- **A built thing's shape read as the design:** today's kernel behaviour (10-19), the six-section prototype format (11-04), v45's flat structure (11-06), and an unneeded probe (10-23). The map's "prototyped" label is accurate and doesn't prevent these. A variant that makes prototypes the default, and ranks *Observed* highest, makes them easier unless *Observed* is defined narrowly.

10-12, a defect kept because it has no caller, is neither half, and is regraded N.

## Amendments, applied to the proposal

1. **Define *Observed* narrowly.** A consumer read the guess and worked. "The code does it today" is not Observed, and neither is "a prototype was built that way". A prototype's shape is evidence about that prototype, not authority over the next one. *From the four remaining R entries.*
2. **A probe has to have an unknown outcome.** Thought past the stop becomes a probe only when the answer can't already be read from the code or the fiction. *From 10-23.*
3. **Test each revision trigger on writing it.** Ask whether it is already true, and whether it would revise this guess or a different one. These are `trigger-untested`'s two tests, moved into the clause that would otherwise multiply untested triggers.
4. **Sub-plans inherit the map's future subsystems,** as a line in their inherited-as-settled table, so that an absence a sub-plan meets reads as forward demand. *Your point, from 10-21 and 10-01.*

## Limits

- **The grader is the proposal's author,** and the P and R calls are judgments. The A count is small enough to check by hand.
- **The tally covers what was corrected,** not what went right, and it has no `miss` entries. It can show where the proposal reaches. It can't show that the current variant's machinery prevented anything.
- **Its newest gap is its most relevant one:** the 2026-11-08 type-sketch corrections were never logged.

## Recognition check (2026-11-09)

Does the proposal's [recognition test](AGENT.designVariant.proposed.md#when-you-are-in-this-variant) ever say no? It was run against the three other live design plans, from each plan's Status and its "why this plan exists" sections. The three conditions are: (1) several subsystems, at least two unbuilt; (2) each one's design rests on guesses about another's needs; (3) only building can grade those guesses.

| Plan | At opening | Today |
| --- | --- | --- |
| **Presence** | **Yes.** Presence semantics and the `ludicCache` reducer were both unbuilt, and the plan opened to avoid "writing the reducer first", which "would decide presence by implication". That is (2) in the plan's own words. Its PH0 and PH1 dissolved because their rows could only be settled by building or scoping, which is (3). What moved it forward was implementation plans hung off it: ludicCacheReducer, presenceNodes, monotoneCovers and parentSets | **Nearly no.** Most rows are settled and shipped, and PH4's test is now whether a live plan cites the cells. Close to the end of an orchestration plan's life ([Lifecycle](AGENT.designVariant.proposed.md#lifecycle)) |
| **Abstraction layers** | **Yes.** The ludic graph's levels, plus consumers named in its purpose: reasoning ("for an LLM in particular"), display and manipulation, most unbuilt. Its Status describes the conflict directly: "the phases are still a design pass; the parallel channels have built and shipped real code" | **Yes**, as the parent over the other plans. The channels are where its work happened |
| **Edge abstractions** | **Yes only once the consumers are named.** It opened as pure representation ("what does a boundary crossing have to deliver, and what structure carries it?"), with no consumer of a delivery named. Condition (1) can't be checked until someone says what the consumers are | **No.** Its central construct was superseded "from shipped structure rather than from a corpus case", and the reassessment "licenses nothing new". Its remaining answers can be read from shipped code, so (3) fails, and the test's own exit applies: read it there. Its one re-open trigger fired on a consumer, and that work shipped through SecuredTo |

**What the check shows:**

- **The test says no, but only on time.** Every plan passes at opening. Two of the three fail or nearly fail today, which is the test acting as an end-of-life check. It is not evidence that the test discriminates between kinds of work at the start. An implementation plan as a negative control (for example, the oracle loop's Slice 1 fixture builder: one subsystem whose consumers exist) fails (1), as it should, but that case is easy.
- **It has no branch for representation design with no named consumers.** Edge abstractions is the case. The test assumes the subsystems are known; a plan that designs a representation for unnamed consumers can neither pass nor fail it. Requiring consumers to be named first was rejected: it invites "and then a miracle occurs" names that pass the check, and it stalls early design, where imagined consumers are what the design is reaching toward (your point). **Applied instead:** reasoning from imagined consumers is welcome at any depth. What is derived from it inherits the imagined label. Argument can't promote it, and only a consumer that runs, even a stub, a fixture or a person playing it by hand, lifts the label. The error is imagined reasoning read at a higher standing than imagined (your refinement). This puts both halves of the remaining risk under one cause: an imagined consumer's needs read as requirements, and a prototype's shape read as design authority, are both something read at a standing it doesn't have.
- **The evidence for that correction.** The clearest cases are outside the tally:
  - the back-sweep's malformed question about traversal, which ran a month with seven members and was dissolved by tracing one case through the code;
  - edge abstractions' central construct, built for what a crossing would deliver to consumers nobody named;
  - presence's PH0 and PH1, whose rows nothing could grade until something was built;
  - the unlogged 2026-11-08 type sketch.

  In the tally, a few entries fit cleanly: the 11-07 cluster, 10-30's imagined freshness mechanism, and 10-17's "context-free producers". The 10-19 to 10-20 cluster fits only in part. The tally doesn't tag imagined reasoning read at a higher standing as a cause of its own, so there is no rate.
- **Edge abstractions is due for disposal under either variant.** Its own reassessment says it licenses nothing new. That's a separate action, outside this assessment.
