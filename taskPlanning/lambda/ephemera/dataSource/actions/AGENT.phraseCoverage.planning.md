# Phrase coverage: articles, label spans, `look at`, `put` on the fast path, `drop` into

**Status: Drafted 2026-10-24, not started. Slice 0 is next.** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is rung 13 of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), and builds on skeleton patterns (rung 12, shipped and retired 2026-10-24). It takes over these bullets under "Shelved: stacked qualifiers and `put`" in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md):
- "Articles on the LLM route";
- "A longer tail around a label that holds a preposition";
- "`look at` with a qualifier";
- "Whether the fast path learns `put`" (only `put`/`place`; the other fold-ins stay shelved);
- "A drop's tail as a destination".

## Goal

Four phrasings a player will type, which today either miss or cost a Bedrock call, are read correctly. One mechanism serves all four: the pattern matcher that rung 12 built, which already returns every fill.

**Payoff, stated at the observable output** (each a line the player sees and the world after commit):

- `get the cup` on the LLM route, where Nova Micro keeps "the" on the span, takes the cup by exact name, with no embedding rank and no question.
- `take man in the moon from table`, with a "man in the moon" on the table, takes it. Today the span is cut at "in", and the command refuses.
- `look at the cup on the table` describes the cup on the table. Today `look` | `at` from the model match no template.
- `put cup on saucer on table` reaches Plan with no Bedrock call, and still commits the reading the world allows (as in `qualifiedTakePayoff.integration.test.ts`).
- `drop the cup in the box`, with the cup held, puts the cup in the box. Today it refuses ("The box has no cup.").

## Why now

Rung 12 made each template a pattern that returns every way it fits. Each item here is a place where a fill is thrown away too early, or a word list is one entry short:

- The fast path's claim policy keeps one fill, the one with the most cuts, unless the **whole** tail is a room label. A label inside a longer tail is cut.
- The look template's verbs are single words, and the whole-token rule means the model's `look` | `at` matches nothing.
- The fast path's pattern holds only the membership verbs, so `put` always pays for two Bedrock calls.
- The containment template's verbs are `put`/`place`, so a drop's tail can only be read as a qualifier.

Articles are separate, and are a correctness question first: nobody has checked whether the LLM route's "the cup" resolves.

## What exists (read from code, 2026-10-24)

- **Articles.** Only the fast path peels a leading article (`peelLeadingArticleWhenTail`, `discriminateIntent/peelLeadingArticleWhenTail.ts`, called from `deterministicChecks.ts`). Identify's exact match (`resolveCatalogSpanToPool.ts`) compares `normalizeExitName(span)`, which trims, lowercases and collapses spaces, and nothing more, against `normalizedShortName`. So a model span "the cup" misses the exact match and falls to the embedding rank. The parse-harness notes in [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) record Nova Micro keeping "the" after `get`.
- **The claim policy** (`maybeDeterministicManipulationIntent`, `deterministicChecks.ts`):
  - It matches `[MEMBERSHIP_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT]` against the text.
  - It keeps the uncut fill when its head is a room label. Otherwise it keeps the fill with the most cuts, longest phrases first.
  - It returns one flat skeleton as `ObjectMembershipIntent`, which `parseCommand.ts` stamps and hands to Plan. `runObjectManipulationParseHarness.ts` also reads that type.
- **The look template** (`plan/matchLookTemplate.ts`): `[look|l|examine|x, objectSpan]`. Bare `look`/`l` is intercepted earlier by `isBareLookCommand`. `look <object>` always takes the LLM route.
- **The containment template** (`plan/matchContainmentTemplate.ts`): `PLACING_VERB_FORMS = { put, place }`. Its subject and target are object phrases, so a qualified destination (`put the cup on the table in the box`) already yields both readings; no test pins it.
- **Drop** is a membership verb (`MEMBERSHIP_VERBS` in `plan/matchMembershipTemplate.ts`). Its tail reads as a qualifier, which the dry run refuses for a held cup.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done. Each slice leaves every other command's observable behavior as it was.

- [ ] **Slice 0. Shelf cleanup.**
  - [ ] The shelf's "A qualifier on a destination's phrase" is already built (see What exists). Pin it with a `planSkeleton.test.ts` case listing both readings of `put the cup on the table in the box`, and remove the bullet.
  - [ ] "Naming a position by phrase" (under "Shelved: asking the player") says a three-span `put` finds no template. Correct it: the example fails because `over` is not a qualifier preposition.
  - [ ] Rename the shelf heading to what it now holds (proposed: "Shelved: qualifiers and phrase shapes"). Fix the mentions in the ladder (rows 6 and 12, and the BD-24 row).
  - [ ] Mark the bullets this plan takes over as owned by it, with a link.
- [ ] **Slice 1. Articles on every span.**
  - [ ] Probe first: a `parseCommand` test where the model returns `get | the cup`. Record whether Identify resolves it exactly, by the embedding rank, or not at all.
  - [ ] If it does not resolve exactly: peel articles in one place that serves both routes (see PA-1), and retire the fast path's own peel if that place covers it.
  - [ ] Payoff: `get the cup` on the LLM route ends at "… picks up cup", with no Select.
- [ ] **Slice 2. Label spans and `look at`.**
  - [ ] The claim policy prefers a fill whose spans are all room labels, wherever the label sits in the tail (see PA-2), and otherwise keeps the most cuts. The whole-tail guard becomes a case of this rule.
  - [ ] The look template also reads `look at` and `l at`: a second pattern sharing the builder, `[look verbs, at, objectSpan]`, since the model emits `at` as its own token.
  - [ ] Payoffs:
    - `take man in the moon from table` takes it (fast path, no Bedrock);
    - `look at the cup on the table` describes the table's cup (LLM route, model tokens `look` | `at` | `cup` | `on` | `table`).
- [ ] **Slice 3. `put` on the fast path.**
  - [ ] The fast path runs the containment template's own pattern against the text, beside the membership pattern. The claim policy from Slice 2 picks one fill across both, and the flat skeleton goes to Plan as now.
  - [ ] The fast path's result type stops being membership-only (rename `ObjectMembershipIntent` and its readers: `parseCommand.ts`, `runObjectManipulationParseHarness.ts`, `intentClassification.ts`'s doc comment).
  - [ ] Payoff: `put cup on saucer on table`, with the cup in the room and the saucer on the table, commits "… puts cup on saucer" with no Bedrock call. `/test parse` reports the fast path.
- [ ] **Slice 4. `drop` into.**
  - [ ] `drop` joins the containment template's verbs (narration "drops"). `drop the cup in the box` then yields a membership attempt (qualifier reading) and a containment attempt (destination reading). The dry run removes the qualifier reading (a drop needs a held cup, and a held cup is in no box), so only the destination reading reaches selection, and the player is never asked to choose between attempts (no question form for that exists yet; see "Asking between attempts" under "Shelved: asking the player").
  - [ ] Payoff: `drop the cup in the box`, cup held, ends at "… drops cup in box" with the cup in the box. A plain `drop cup` is unchanged.
- [ ] **Slice 5. Graduation.**
  - [ ] Rules into `actions/AGENT.contract.md` ("Qualifier" and the fast path's claim policy) and the module map; the taken-over shelf bullets removed; this file deleted after a grep for inbound links; ladder row 13 updated.

## Not in scope

- **The other fold-ins**: the fast path's bare-word and navigation regexes, Navigation paraphrase, AcmeOrder, and `look` on the fast path. They stay under "Whether the fast path learns `put`".
- **A phrase with two hosts**, **judging the relation**, and **manner words** stay shelved (user, 2026-10-24).
- **Asking between attempts** ("Shelved: asking the player"): an attempt-choice question for readings that bind the same objects, and option labels that show each reading. These are question-side; this plan only changes what is read. Slice 4's pair never reaches either, since the dry run removes one.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| PA-1 | **Where articles are peeled.** (a) In Identify's exact match: try the span as given, then with its leading article peeled, so a label that starts with an article ("The Thing") still matches whole. (b) When the skeleton is stamped, on both routes. Recommendation: (a). It keeps one home, never loses a label, and lets the fast path's peel retire. Decided only if Slice 1's probe shows a gap. | 1 | Open |
| PA-2 | **How the fast path keeps a label span.** (a) The claim policy prefers a fill whose spans are all room labels, then the most cuts; one skeleton still goes to Plan. (b) The fast path hands every fill to Plan as its own skeleton, and Identify and the dry run choose. Recommendation: (a). Labels are the room's ground truth, it changes only the fast path, and the LLM route also emits one skeleton. (b) would be the first multi-skeleton Plan input. | 2 | Open |

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for how this plan is kept.
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#deterministictemplate) (`DeterministicTemplate`, reading) and the "`DeterministicTemplate` module" section of [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md).
3. Read [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md#qualifier) "Qualifier": attachment, the unread-span gate, and the fast path's claim policy.
4. The end-to-end harness to copy is [`qualifiedTakePayoff.integration.test.ts`](../../../../../lambda/ephemera/dataSource/qualifiedTakePayoff.integration.test.ts) (parse, then a real commit, asserting the line and the graphs).
5. Testing: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the authority. If commands conflict, follow it.
6. Baseline, from `lambda/ephemera/`: `npm run test -- --clearCache`, then `npx tsc --noEmit` and `npm run test -- --watchAll=false`, all green before any edit.

## Verification

Per slice, from `lambda/ephemera/`: `npx tsc --noEmit` and `npm run test -- --watchAll=false`, the full suite (`*.integration.test.ts` files sit outside `tsc`).

- Slice 0: the new `planSkeleton.test.ts` case lists both readings; a grep for the old shelf heading finds nothing.
- Slice 1: the probe's result recorded here; the payoff ends at the player's line.
- Slice 2: every `deterministicChecks` test keeps its outcome; both payoffs end at the player's line.
- Slice 3: the payoff asserts no Bedrock call. In dev, `/test parse "put cup on table"` reports the fast path.
- Slice 4: the payoff ends at the line and the cup in the box; the existing drop tests pass unchanged.
- Slice 5: the inbound-link grep is empty.

## Progress

| Slice | State | Files touched |
| --- | --- | --- |
| 0 | Not started | --- |
| 1 | Not started | --- |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |
| 5 | Not started | --- |
