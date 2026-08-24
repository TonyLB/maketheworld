# Design-variant performance tally

**Durability: Keep** --- an instrument, not a task plan. **Delete it** if the [firing check](#is-this-instrument-firing) says it is not working.

Instrumentation for [`AGENT.designVariant.md`](AGENT.designVariant.md). Paired with [`AGENT.designVariant.tuning.md`](AGENT.designVariant.tuning.md), which holds the fixes this file motivates.

**This is a tally sheet, not a log. Its output is a rate.** An entry is a tally mark and is *deliberately* not self-explanatory: if it mattered, it recurred and was promoted to a pattern; if it did not, its illegibility six weeks on is the correct outcome, not a defect to fix by writing more. **The moment an entry starts explaining itself it is competing with the plans it exists to measure.**

**Why it exists.** Reconstructing process failures from committed documents is survivorship-filtered --- it can only see errors big enough that someone decided they warranted a plan edit, and misses entirely the ones generated and fixed inside a single commit. Those are the majority, and they are the class this file is for. **Bias toward the small and frequent, not the large and explained.**

## Rules

**Cap: 80 observations.** Adding the 81st **evicts the oldest**. Eviction is silent, needs no justification, and is the mechanism rather than a concession to it --- adding costs dropping, which is the only pressure here that does not depend on restraint.

**The trigger is an event, not a judgement.** Log when the user corrects a claim, or when something already written turns out to be false. **Not** when it merely *feels* like a mistake was made: a sensor running on self-assessment misses exactly what it should catch, since the errors that go unnoticed are the ones that do not get logged.

**Write at the moment of correction**, in one line, and move on. End-of-session passes are where entries acquire narrative.

**Positive observations must be counterfactually interesting.** *"Went fine"* is non-information that evicts signal. Log a good result only when it is attributable to a live tuning proposal (`win`), or when a live pattern predicted trouble and none arrived (`miss`) --- and the second is the most valuable entry type in this file.

**Format:** `YYYY-MM-DD | tag | one sentence`. For `miss` and `win`, name the pattern or proposal it bears on.

## Tags

Closed set. `other` accumulating three lookalikes mints a new tag; nothing else does.

| Tag | Means |
| --- | --- |
| `stale-premise` | A row or bullet asserted a fact about shipped code that was no longer true |
| `vocab-drift` | A verdict was read in a vocabulary later than the one it was written in |
| `framing-inherited` | A step was quantified over the shape of the document that raised it, not the structure the system uses |
| `fork-manufactured` | A question was opened as a choice when a convention or an answer already existed |
| `bulk` | A row or section grew past readability; edits to it hid each other |
| `overbroad-inheritance` | A restriction, blocker, or citation was carried at a coarser grain than its own stated justification supports |
| `miss` | A live pattern predicted a failure that did not occur |
| `win` | A live tuning proposal demonstrably prevented or caught something |
| `other` | None of the above |

## Observations

*Empty. Entries start here, newest at the bottom. This buffer captures live corrections --- it is deliberately **not** seeded from document archaeology, which is the method it exists to replace.*

| Date | Tag | Observation |
| --- | --- | --- |
| 2026-08-22 | `other` | Claimed *Implemented* for a change with no clause in the document it claims to change; the variant's existing **Prototype** tier already covered the case exactly |
| 2026-08-22 | `bulk` | LP6's retired original scope and its later-added PR-4 dependency, read together as one gated obligation, hid a real cross-plan design cycle rather than exposing it |
| 2026-08-22 | `other` | Wrote a comment saying `On` "no longer parses here" while leaving `'On'` in the same type's literal union four places; user caught the self-contradiction, `tsc` then found four more downstream breaks the narrowing produced |
| 2026-08-22 | `stale-premise` | LD-14 (ludic-graph ports) sat at "None yet, owed upstream to PQ-9" while PQ-9's own row records it graduated to a decision the same day LD-14 opened; user recalled the decision correctly, the row never noticed |
| 2026-08-22 | `overbroad-inheritance` | Implemented LP7 (ludic-graph ports) without checking its own section header's "Stage 2 --- gated on P7" line; the gate's stated rationale (port record built blind to its only consumer) is LP6's, not LP7's (a mechanical edge-terminal type widening with no port-record dependency) --- caught while doing LP9 bookkeeping, not before starting the work |
| 2026-08-22 | `other` | Claimed multi-level containment would collapse PR-4's composition/peer discriminator; classification is actually by a closed `kind` enum, not by edge position, so the claim was false and needed two rounds of user correction (a cross-shard-cost conflation, then the core mechanism error) before the plan's falsification bullet was rewritten |
| 2026-08-22 | `vocab-drift` | Read *"the two edges joined by a port need not carry the same **kind**"* (2026-08-06) as a claim about today's `HostRelationalEdgeKind`; that word predates the closed 7-value enum and its separate `relationLabel`, and at today's grain both edges are `Custom` --- built a whole corpus finding falsifying LP6's agreement obligation on the misreading |
| 2026-08-22 | `other` | Repeated premise 12's headline (*"complementary halves, not duplicated ones"*) as a structural guarantee that port/edge disagreement was impossible; **the same cell's own justification refutes it** --- *"a port-address reference names the host and the port inherently"* means `fromHostId` is reconstructible from the exterior side, hence duplicated. User produced the counter-example in one line. **Read the cell, believed the summary over the reasoning under it** |
| 2026-08-22 | `other` | Restated the conditional rule *"where an exterior reference exists it wins on disagreement"* as *"the exterior is the source of truth"*; the stronger form implies the fact must exist exteriorly **everywhere**, which generated a witness requirement, a three-case witness table and a false coupling to PR-C1 residual (ii) --- **two turns spent satisfying a constraint the strengthening invented.** Same session as the premise-12 entry above and arguably the same failure: **a compact phrase read at more strength than its own content carries** |
| 2026-08-23 | `other` | Recommended deferring LD-18's mismatch sweep until a `ports` producer exists, and **cited LP4i as the precedent while it argues the reverse** --- LP4i built its detector *before* the shape change specifically because *"the sweep finds X and nothing else"* is provable exactly once. User reversed the ordering. **Not a `Source-unread` hit:** the bullet had been read in full this session and quoted from correctly elsewhere in the same turn --- it was used backwards, which is a different failure and the reason the pattern's *"read the whole cell"* actuator would not have caught it |
| 2026-08-23 | `other` | Offered interior port fan-out as the **re-open trigger** for a field the same paragraph recommended trimming; **fan-out argues the other way** --- with N interior edges there is no single value for one field to hold, so it makes the field unrepresentable rather than earned. User inverted it in one line. **The enabling error is separate and counted separately** (`overbroad-inheritance`, 6th): *single-use ... no fan-out* was read as bounding a port's **interior edge degree**, where its own text quantifies **crossings** |
| 2026-08-24 | `overbroad-inheritance` | Wrote that presence *earned* its two companion files, as the precedent for not opening a corpus early; its corpus was created the day that plan opened --- the table distinguishing the two rows had been read in full this session and was compressed, not unread |
| 2026-08-24 | `other` | Wrote *the* node-side answer to a question and built a row's dependency order on it without checking whether a second existed; there are two precedents and they answer differently, surfaced by one turn of posing the row's question of nodes |
| 2026-08-24 | `other` | Read *part* as a kind rather than a role and built a priority asymmetry on it, against a locked rule (*whole and part are roles, not kinds*, graduated to `AGENT.concepts.md` with *do not type either word*) that has now failed three times; the inherited-settled row added as actuator is 1-for-2, and the rule's one success in the family came from a corpus case rather than a citation |
| 2026-08-24 | `other` | Posed a proposed corpus case as *what was true on day 15?*, treating an unwritten part scale as an incomplete record of a determinate world --- the simulationist reading the family documents against (*fiction is authored toward coherence*; *the graph holds states, not beliefs*); second lookalike of the entry above, both being a documented frame not fetched before arguing from defaults. |

## Patterns

**Minted at 3 hits.** On minting, the contributing observations are **deleted** from the buffer above --- consolidation is net-negative in lines or it did not happen. **Cap: 12.**

**Every row carries hits and misses.** A pattern written down creates a bias toward noticing it, which is useful for recall and is also how a minimal primitive accumulates post-hoc justification. A pattern at 12 hits / 40 misses is an availability effect. **Decay is by hit rate, not by age:** a pattern whose misses overtake its hits is deleted, not archived.

**Exit is deletion.** A pattern that clears the [admission bar](AGENT.designVariant.md#what-it-takes-to-add-a-rule) and becomes a rule is removed from here, with no copy retained.

| Pattern | Hits | Misses | Since | Provenance |
| --- | --- | --- | --- | --- |
| **`stale-premise`** --- a row states a fact about shipped code and is relied on without re-checking it | 3+ (unnumbered; called *"this plan's most frequent"*) | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`vocab-drift`** --- a verdict is inherited into a later vocabulary and read as if written in it | 4 | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`framing-inherited`** --- a step inherits the shape of the document that raised it, and survives even where the underlying structure differs | 2 --- **below mint threshold**, carried as provisional | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`overbroad-inheritance`** --- a restriction, blocker, or citation is carried at a coarser grain than its own stated justification supports | 6 | 0 | 2026-08-22 | Live-confirmed, presence plan: CD2's CC3/LD-15 gate outlived its own removed precondition; P6 clause 3 (a cache return-contract clause) was cited to forbid reachability computation in an unrelated transfer mechanism; PR-4 inherited "blocked" from PR-7's whole provisional tier rather than the one already-discharged clause it depends on. **4th hit 2026-08-23, and it is the same gate for the third time:** ludic-graph ports' "Stage 2 gated on P7" was released for LP7 (2026-08-22) and then for LP6 (2026-08-23), each time by reading the gate's own stated justification --- which names premises 6 and 7 and nothing else --- rather than the header. **The `Progress` cell that asserted the gate "for real" had itself been written while catching this same pattern one member over**, which is the sharpest evidence yet that the fix is a check at scheduling time, not a better-worded gate. **5th hit 2026-08-23, user-raised, and it stretches the tag from restrictions to *arguments*:** PR-C2 Finding 3's cross-shard argument (*"the interior label is local; the exterior label is not"*) is stated at single-field grain and was carried to **both** payload fields, graduating PR-11 one field wider than its own strongest reason supports --- **the finding names the conflation in the same paragraph** (*"recoverable by traversal is doing unexamined work"*) and then leaves the interior side inside the unexamined word. **6th hit, same turn, same conversation:** *ports are single-use --- no fan-in and no fan-out* read as bounding a port's **interior** edge degree, where the concepts entry says *"one port records one **crossing** between two ludic graphs"* and the proposals gloss sits inside a section costing **ports per boundary** --- both exterior quantities. **Two hits in one session on one tag is the availability risk this file warns about; they are counted anyway, and the tie-break was that each has a distinct falsified sentence** --- **7th hit 2026-08-24, and it is the first with no user in the loop:** a two-row companion table in the presence plan compressed into *"earned its two"*, then cited as precedent against opening a corpus file. **Two cautions on this hit, both against it.** It stretches the tag from restrictions and citations to a **self-authored** summary, which is arguably the mirror of the 2026-08-22 pair (a compact phrase read at more strength than it carries) rather than this pattern; and **a 7-hit / 0-miss row is exactly the availability effect the section header warns about.** Counted on the same tie-break as the 6th --- a distinct falsified sentence --- **but this row is now the file's largest cell, which is its own `bulk` signal: the next hit should mint a tuning proposal instead of another clause here** --- **done 2026-08-24, and it split the pattern in two.** Tested against the standing write-time falsifier proposal, **two of the seven** are cases where the grain was **never stated** and a write-time discipline reaches them; **four are cases where the justifying sentence was already written and adjacent, and was read past** --- unreachable by anything done at write time. **Treat these as two mechanisms sharing a tag, not one pattern at seven**, and do not exit either to a rule until the read-side proposal has been graded |
| **Source-unread** --- a verdict about a cross-reference is formed without reading the referenced text in full: not opened at all, or read truncated | 3 | 0 | 2026-08-22 | Live-confirmed, this session. **Contributors:** the CD2/CC1/P7 chain called non-circular without reading the presence plan's own stated purpose; AB-60's ownership read from a cell truncated before the booking rationale that settles it; C10 never opened while grading the row that cites it as its evidence. **Not retrofitted --- each entry named the mechanism in its own text before this pattern existed** (*"without checking"*, *"the half of the cell I had truncated"*, *"had not been read"*), which is the only reason three entries with three different consequences group cleanly. **No new tag minted:** the three were not all `other` (one was `vocab-drift`, tagged for its consequence rather than its cause), so the [closed tag set](#tags) is unchanged. **The cheap actuator this implies: read the whole cell, not the first 2KB of it.** **`0` misses is absence of counting, not a clean record** |

**On those three seeded rows: `0` misses is the bias, not a clean record.** Nobody was looking for non-occurrence when they were counted, and the counts come from the artifact rather than from live capture. **Treat them as hypotheses to be knocked down, not as an established baseline** --- the first useful thing this file can do is produce a `miss` against one of them.

## Is this instrument firing?

**The check: patterns minted against observations logged.** Zero for a couple of weeks has two causes with opposite fixes --- **nothing genuinely recurs** (delete these two files; the hypothesis was wrong), or **the tags are too fine-grained to reach three** (merge tags). It never means the design work is going well.

**A quiet file is a failed instrument, not a clean bill of health.** The reasoning trails in `taskPlanning/lambda/ephemera/dataSource/positions/` are the worked example: 429 KB written, cited roughly ten times less densely per KB than any sibling companion class, and never a signal to anyone.
