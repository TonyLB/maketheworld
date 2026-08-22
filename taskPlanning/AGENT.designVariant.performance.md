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
| 2026-08-22 | `other` | Asserted the CD2/CC1/P7/Presence chain wasn't circular without checking that `AGENT.presence.planning.md`'s own stated purpose (unblocking P7) closed the loop |
| 2026-08-22 | `other` | Wrote a comment saying `On` "no longer parses here" while leaving `'On'` in the same type's literal union four places; user caught the self-contradiction, `tsc` then found four more downstream breaks the narrowing produced |
| 2026-08-22 | `stale-premise` | LD-14 (ludic-graph ports) sat at "None yet, owed upstream to PQ-9" while PQ-9's own row records it graduated to a decision the same day LD-14 opened; user recalled the decision correctly, the row never noticed |
| 2026-08-22 | `overbroad-inheritance` | Implemented LP7 (ludic-graph ports) without checking its own section header's "Stage 2 --- gated on P7" line; the gate's stated rationale (port record built blind to its only consumer) is LP6's, not LP7's (a mechanical edge-terminal type widening with no port-record dependency) --- caught while doing LP9 bookkeeping, not before starting the work |

## Patterns

**Minted at 3 hits.** On minting, the contributing observations are **deleted** from the buffer above --- consolidation is net-negative in lines or it did not happen. **Cap: 12.**

**Every row carries hits and misses.** A pattern written down creates a bias toward noticing it, which is useful for recall and is also how a minimal primitive accumulates post-hoc justification. A pattern at 12 hits / 40 misses is an availability effect. **Decay is by hit rate, not by age:** a pattern whose misses overtake its hits is deleted, not archived.

**Exit is deletion.** A pattern that clears the [admission bar](AGENT.designVariant.md#what-it-takes-to-add-a-rule) and becomes a rule is removed from here, with no copy retained.

| Pattern | Hits | Misses | Since | Provenance |
| --- | --- | --- | --- | --- |
| **`stale-premise`** --- a row states a fact about shipped code and is relied on without re-checking it | 3+ (unnumbered; called *"this plan's most frequent"*) | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`vocab-drift`** --- a verdict is inherited into a later vocabulary and read as if written in it | 4 | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`framing-inherited`** --- a step inherits the shape of the document that raised it, and survives even where the underlying structure differs | 2 --- **below mint threshold**, carried as provisional | 0 | 2026-08-20 | Archaeology, ludic-graph ports plan. **Not live-confirmed** |
| **`overbroad-inheritance`** --- a restriction, blocker, or citation is carried at a coarser grain than its own stated justification supports | 3 | 0 | 2026-08-22 | Live-confirmed, presence plan: CD2's CC3/LD-15 gate outlived its own removed precondition; P6 clause 3 (a cache return-contract clause) was cited to forbid reachability computation in an unrelated transfer mechanism; PR-4 inherited "blocked" from PR-7's whole provisional tier rather than the one already-discharged clause it depends on |

**On those three seeded rows: `0` misses is the bias, not a clean record.** Nobody was looking for non-occurrence when they were counted, and the counts come from the artifact rather than from live capture. **Treat them as hypotheses to be knocked down, not as an established baseline** --- the first useful thing this file can do is produce a `miss` against one of them.

## Is this instrument firing?

**The check: patterns minted against observations logged.** Zero for a couple of weeks has two causes with opposite fixes --- **nothing genuinely recurs** (delete these two files; the hypothesis was wrong), or **the tags are too fine-grained to reach three** (merge tags). It never means the design work is going well.

**A quiet file is a failed instrument, not a clean bill of health.** The reasoning trails in `taskPlanning/lambda/ephemera/dataSource/positions/` are the worked example: 429 KB written, cited roughly ten times less densely per KB than any sibling companion class, and never a signal to anyone.
