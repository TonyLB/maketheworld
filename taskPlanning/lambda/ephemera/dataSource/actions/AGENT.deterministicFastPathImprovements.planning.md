# Object manipulation: deterministic fast-path improvements (iteration 6)

**Status:** Named, not started, deliberately sequenced after iterations 1-5. Split out 2026-07-19 from the iteration-3 plan (since retired), where this content first came up as part of scoping Step 2b's step 3 (the native relational Plan matcher) --- caught before it shipped as scope creep: closing this gap isn't required for basic relational subject/target/operationKind matching, and building it now would mean designing against a hypothetical example rather than a concrete, currently-blocked command. See [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) for the full iteration ladder.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Extend deterministic Plan-stage template matching beyond flat, whole-command templates to support a location-disambiguating (or otherwise modifying) span attached to a specific object, not just to the command as a whole --- e.g. "table" in "get bag from table," or "the table" in "the bag on the table." This is what real `Assertion` emission needs (BD-14's original gap: `MembershipManipulationFrame` has no field a `containedBy` assertion could be built from). **Not started because nothing currently blocked needs it** --- iteration 3's Step 2b (relational wiring) only needs flat `subject`/`target`/`relationKind`/`operationKind` matching, which has no modifiers to attach. This iteration exists so the design work already done isn't lost, not because it's scheduled.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md).
2. Read the durable Parse/skeleton vocabulary in [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (BD-21 skeleton shape, `stableRefKey`) and the shipped native Plan matcher `plan/matchRelationalTemplate.ts` (see [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md)) --- this iteration is additive to that matcher's design, not a replacement.
3. Read the `Assertion`/`Referent` vocabulary: [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) ("Change vs. Assertion").
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| BD-24 | **Location-disambiguating modifier attachment for deterministic Plan templates --- named 2026-07-19, found while scoping iteration 3's Step 2b relational matcher, then deliberately moved out of it.** Motivating example: "put the candle from the bookshelf into the bag on the table" --- whitelisting whole-command combinations ("put W from X into Y", "put W into Y on Z", "put W from X into Y on Z", ...) grows multiplicatively with each optional modifier; not viable past a couple of cases. **Resolution: structure templates compositionally, not flat.** `ObjectPhrase = OBJECTSPAN (PREP OBJECTSPAN)?`, composed into a fixed top-level frame (e.g. `VERB ObjectPhrase PREP ObjectPhrase`) --- new modifier shapes get added once, not once per template they could combine with. **Real complication: attachment is sometimes genuinely ambiguous, and the matcher can't fully resolve it syntactically.** "get bag from table" (table is an *argument* --- the source location being removed from, Assertion-worthy) and "the bag on the table" (table is a *modifier* --- disambiguating which bag, not a state-change fact) are structurally identical (`OBJECTSPAN PREP OBJECTSPAN`) but mean different things; a positional matcher can't tell these apart from structure alone. **Resolution: keep the matcher purely structural, push semantic interpretation down to primitive-specific construction logic.** The matcher's only job is to attach a trailing `PREP OBJECTSPAN` run to the nearest preceding `OBJECTSPAN`, tagging it with that object's `stableRefKey` --- it does not decide whether the attachment is Assertion-worthy or merely descriptive. Whichever primitive-construction logic consumes the match (verb-specific --- `get`/`take`'s single-object frame has nowhere else for an attached phrase to go, so it's always the source-location Assertion there; `put X into Y on Z`'s attached phrase on `Y` is more plausibly disambiguation) decides what an attachment *means*, since that's inherently verb/primitive-specific, not structural. **Stay closed, not a real grammar:** one level of modifier nesting only (`ObjectPhrase` gets at most one trailing `PREP OBJECTSPAN`, no recursive attachment), closed set of recognized attachment prepositions, same "boolean gate, no partial credit" discipline as every other deterministic Plan path in this codebase (BD-19 (2)) --- a skeleton whose structure falls outside this closed set still defers to plan-only/joint fallback, same as today. **Closes BD-14's Assertion-emission gap as a concrete side effect once built:** the location-disambiguating span BD-14 needed a field for is exactly what `ObjectPhrase`'s attached-modifier role provides. | Iteration 3's Step 2b (this iteration extends its native matcher, doesn't replace it); BD-14 (`AGENT.concepts.md`, "Change vs. Assertion" --- real `Assertion` emission) | **Named, not scoped --- no implementation started, deliberately, pending a concrete driving case** |

## Recommended order

Use `[ ]` for pending and `[X]` for complete.

- [ ] **Do not begin implementation design until a concrete case demands it** --- per BD-14's own "expand as concrete cases demand" discipline (the same principle that kept `Assertion`'s union to one member until a second was actually needed). This row exists to hold that discipline visibly, not as a placeholder for "someone forgot to schedule this."
- [ ] When a concrete case does demand it: extend iteration 3's shipped native Plan matcher (`plan/matchRelationalTemplate.ts`) with the `ObjectPhrase` compositional structure per BD-24, rather than building a parallel matcher.
- [ ] Wire the resulting location-disambiguating role into real `Assertion` emission, closing BD-14's gap for real.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/plan/ \
  dataSource/actions/enrich/objectManipulation/synthesize/
```

## Progress

| Milestone | Status |
| --- | --- |
| BD-24 named; compositional `ObjectPhrase` design worked out; split into its own iteration to avoid anchoring iteration 3's Step 2b on a hypothetical future case | Done (2026-07-19) |
