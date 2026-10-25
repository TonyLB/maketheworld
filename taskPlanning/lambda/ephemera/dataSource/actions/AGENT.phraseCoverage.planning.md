# Phrase coverage: articles, label spans, `look at`, `put` on the fast path, `drop` into

**Status: Slices 0 and 1 shipped 2026-10-24; Slice 1.5 shipped 2026-10-25; Slice 2 is next, after ladder rung 14 (match tuning).** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is rung 13 of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), and builds on skeleton patterns (rung 12, shipped and retired 2026-10-24). It takes over these bullets under "Shelved: qualifiers and phrase shapes" in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md):
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

Articles were separate, and a correctness question first: nobody had checked whether the LLM route's "the cup" resolved (Slice 1's probe: it did, but only through the lexical rank).

## What exists (read from code, 2026-10-24)

- **Articles** (before Slice 1). Only the fast path peeled a leading article (`peelLeadingArticleWhenTail`, then in `discriminateIntent/`, called from `deterministicChecks.ts`). Identify's exact match (`resolveCatalogSpanToPool.ts`) compared `normalizeExitName(span)`, which trims, lowercases and collapses spaces, and nothing more, against `normalizedShortName`. So a model span "the cup" missed the exact match and fell to the ranked pool. The parse-harness notes in [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) record Nova Micro keeping "the" after `get`.
- **The claim policy** (`maybeDeterministicManipulationIntent`, `deterministicChecks.ts`):
  - It matches `[MEMBERSHIP_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT]` against the text.
  - It keeps the uncut fill when its head is a room label. Otherwise it keeps the fill with the most cuts, longest phrases first.
  - It returns one flat skeleton as `ObjectMembershipIntent`, which `parseCommand.ts` stamps and hands to Plan. `runObjectManipulationParseHarness.ts` also reads that type.
- **The look template** (`plan/matchLookTemplate.ts`): `[look|l|examine|x, objectSpan]`. Bare `look`/`l` is intercepted earlier by `isBareLookCommand`. `look <object>` always takes the LLM route.
- **The containment template** (`plan/matchContainmentTemplate.ts`): `PLACING_VERB_FORMS = { put, place }`. Its subject and target are object phrases, so a qualified destination (`put the cup on the table in the box`) already yields both readings, pinned in `plan/planSkeleton.test.ts`.
- **Drop** is a membership verb (`MEMBERSHIP_VERBS` in `plan/matchMembershipTemplate.ts`). Its tail reads as a qualifier, which the dry run refuses for a held cup.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done. Each slice leaves every other command's observable behavior as it was, except Slice 1.5. It deliberately changes what the player reads in two cases: a take, get or drop of something absent now reads "I couldn't understand that command.", and a look or relation the world refuses now gives the refusal's reason (see its player-copy bullet).

- [X] **Slice 0. Shelf cleanup.**
  - [X] The shelf's "A qualifier on a destination's phrase" is already built (see What exists). Pinned, as observed, by a `planSkeleton.test.ts` case listing both readings of `put cup on table in box`; the bullet is removed.
  - [X] "Naming a position by phrase" (under "Shelved: asking the player") said a three-span `put` finds no template. Corrected: the example is a two-span `put` whose destination holds no qualifier preposition (`of` and `over` are not in the closed set), so Identify gets it as one name.
  - [X] The shelf heading is now "Shelved: qualifiers and phrase shapes". The mentions in the ladder (rows 6 and 12, and the BD-24 row), this plan, and the memory notes are renamed.
  - [X] The five bullets this plan takes over are marked as owned by it, each with its slice and a link.
- [X] **Slice 1. Articles on every span.**
  - [X] Probe first: a `parseCommand` test where the model returns `get | the cup`. Result (2026-10-24): it missed the exact match and resolved only through the lexical rank ("the " absorbed as a mismatch), ending at "… picks up cup" with no Select, even beside a "teacup". Peeled anyway (user: it is cheap and right).
  - [X] PA-1 decided (a), recorded in `actions/AGENT.contract.md` "Grounding". Identify matches a span as given, then peeled (`spanMatchForms`, `enrich/objectManipulation/spanMatchForms.ts`), and the fallback pool ranks the peeled span in both channels, keeping the span as written. The fast path's peel is retired: it passes spans through as typed, and its claim policy's label check reads both forms, so `get the thing` with the label "the thing" is now claimed. Cost: an article span's `stableRefKey` reads `theCupRef` (one characterization snapshot updated); no line a player sees changed.
  - [X] Payoff: `get the cup` on the LLM route (and on the fast path) ends at "… picks up cup", with no Select, beside a teacup: `dataSource/phraseCoveragePayoff.integration.test.ts`, which later slices extend. Unit tests in `resolveCatalogSpanToPool.test.ts` pin the exact match and the peeled embed call.
- [X] **Slice 1.5. Abstain hands the command on.** The producers are meant to be a ladder ordered by cost (BD-19: a command the deterministic vertical can't resolve gets a second attempt, not a terminal Error), but each one's answer is terminal today. A fast-path claim never reaches the LLM route, and once Plan returns any attempt, Acme never sees the command. The outcome that should hand on already exists: the parse result's **Abstain** is "Unparseable / no catalog-backed match (FT-3.2). Distinct from **Error** (policy/legality)" (`baseClasses.ts`). This slice makes the code keep that split, and makes Abstain the hand-off between rungs. It is step 1 of the iteration ladder's [proposal: deterministic first, then an orchestration loop](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25).
  - [X] Compile maps by reason, not by attempt kind. `refusal(kind, …)` in `compileAttemptsFromSkeleton.ts` is retired. Rule recorded in `actions/AGENT.contract.md` "Outcomes climb the ladder".
    - Not understood (nothing grounds; nothing is left after Identify or the entry checks; selection is below the floor) is **Abstain**.
    - Understood but forbidden (the dry run's `illegal`, such as "The box has no cup.") is **Error**, with its reason.
    - Today a take or drop that matches nothing is an Error (`noMatch`), and a look or relation the world refuses is an Abstain. Both flip.
    - Two more flip, by the same reason: nothing in the room or in hand (`noCatalog`) and the unread-span gate (`complexMultiObject`) are now Abstain. When every attempt is refused, an Error refusal wins over an Abstain one. A pending challenge (`defer`) stays an Abstain, so it climbs and ends at the same line.
  - [X] `selectPlanTuple` (`selectPlanCandidate.ts`): when nothing is legal and nothing gave a reason, the verdict is `abstain`, not `error` with `noMatch`. With no candidates at all, likewise.
  - [X] `parseCommand.ts` climbs the ladder (`classifyIntent` split out of `discriminateIntent`). The fast path's zero attempts climbs too.
    - A fast-path Abstain falls through to the LLM route (classify, Parse, templates).
    - On the LLM route, an Abstain from compile goes to Acme, as zero attempts does now. Only the top rung's Abstain reaches the player ("I couldn't understand that command.").
    - The Plan LLM fallback later takes the same slot, above Acme or below it (a decision for that step).
    - Error, Consult and a resolved attempt are answers on any rung, and never climb.
  - [X] The `get` and `take hold` gates stay for now. Removing them would send `get up` through Identify, where "up" may rank close to a "cup". Whether the gates go is a later decision, made against the corpus.
  - [X] Player copy: a take, get or drop of something absent now ends at "I couldn't understand that command." instead of "…no such object in the room". No rung can yet tell "an object reference that matches nothing" from "not an object reference at all" (`get the heck out of here`). The line comes back when a rung can (the Plan LLM fallback). Its `parseErrorMessageForPlayer` cases (`noMatch`, `noCatalog`) stay for that, though no live route produces them now.
  - [X] Payoffs (`phraseCoveragePayoff.integration.test.ts`, stopping at the parse result; `actions/index.test.ts` pins each outcome's line):
    - `take unicorn`, with no unicorn, reaches the LLM route (Bedrock asserted called) and ends at the top rung's Abstain;
    - `take cup from table`, with the cup on the floor, still answers "The table has no cup." on the fast path, with no Bedrock call;
    - a look or relation the world refuses answers with its reason, not "I couldn't understand that command." Probe: none is reachable end to end today. No look carries a step until Slice 2's qualified look, the relational template is not in `PLAN_TEMPLATES`, and spread's `extend` never fails. So this one is a compile test (`compileAttemptsFromSkeleton.relational.test.ts`): a relation already present answers Error "`OBJECT#Broom under OBJECT#Table is already present`". That reason names raw ids, and it would reach a player verbatim once a relation is reachable.
- [ ] **Slice 2. Label spans and `look at`.**
  - [ ] **Waits on ladder rung 14 (match tuning).** With every fill sent to Plan, a fill with an exact match wins clearly (relevance 1.0), but when no fill matches exactly, every reading scores near the floor with thin margins, and selection would ask the player how to cut the command. Rung 14 makes that race abstain. If Slice 2 goes first, its payoffs need embeddings on the catalog entries and a case with no exact fill, with the limitation recorded.
  - [ ] The fast path hands every fill to Plan, each as its own skeleton (PA-2 decided (b)), and Identify, the dry run and selection choose among them. The claim policy's single-fill choice (whole-tail guard, most cuts, longest phrases) is retired. What remains of it is the routing gate (which commands the fast path claims at all), kept by Slice 1.5.
  - [ ] The look template also reads `look at` and `l at`: a second pattern sharing the builder, `[look verbs, at, objectSpan]`, since the model emits `at` as its own token.
  - [ ] Payoffs:
    - `take man in the moon from table` takes it (fast path, no Bedrock);
    - `look at the cup on the table` describes the table's cup (LLM route, model tokens `look` | `at` | `cup` | `on` | `table`).
- [ ] **Slice 3. `put` on the fast path.**
  - [ ] The fast path runs the containment template's own pattern against the text, beside the membership pattern. Every fill from both patterns goes to Plan, as Slice 2 does for the membership pattern.
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
| PA-2 | **How the fast path keeps a label span.** (a) The claim policy prefers a fill whose spans are all room labels, then the most cuts; one skeleton still goes to Plan. (b) The fast path hands every fill to Plan as its own skeleton, and Identify and the dry run choose. **Decided (b)** (user, 2026-10-25). A segmentation is a reading, like an attachment, and the downstream stages already choose among readings with real evidence: Identify's exact match is what "all spans are labels" approximates, and the dry run and selection do the rest. Picking one fill first decided before that evidence existed. The recommendation for (a) rested on present state ("the first multi-skeleton Plan input"). | 2 | Decided (b) |

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
- Slice 1.5: every test whose outcome flips (Error to Abstain, or Abstain to Error) is listed in the Progress row; the payoffs assert where Bedrock is and is not called.
- Slice 2: every `deterministicChecks` test keeps its outcome; both payoffs end at the player's line.
- Slice 3: the payoff asserts no Bedrock call. In dev, `/test parse "put cup on table"` reports the fast path.
- Slice 4: the payoff ends at the line and the cup in the box; the existing drop tests pass unchanged.
- Slice 5: the inbound-link grep is empty.

## Progress

| Slice | State | Files touched |
| --- | --- | --- |
| 0 | Done 2026-10-24 | `plan/planSkeleton.test.ts`; `actions/AGENT.implementation.md`; `AGENT.objectManipulationIterations.planning.md`; this plan |
| 1 | Done 2026-10-24 | `enrich/objectManipulation/{spanMatchForms.ts (moved from discriminateIntent/peelLeadingArticleWhenTail.ts), resolveObjectSpan.ts, resolveCatalogSpanToPool.ts}` (+ tests); `discriminateIntent/deterministicChecks.ts` (+ test); `actionHandlers/runObjectManipulationParseHarness.test.ts`; `parseCommand.test.ts` snapshot; new `phraseCoveragePayoff.integration.test.ts`; `actions/AGENT.{contract,implementation}.md`; `enrich/objectManipulation/AGENT.md`; `AGENT.manipulationFrameAndRelational.planning.md` (link) |
| 1.5 | Done 2026-10-25 | `enrich/objectManipulation/{compileAttemptsFromSkeleton.ts, selectPlanCandidate.ts}`; `parseCommand.ts`; `discriminateIntent/index.ts`; `baseClasses.ts` (doc); tests: new `selectPlanCandidate.test.ts`, `compileAttemptsFromSkeleton.{transfer,describe,relational}.test.ts`, `fallback/{planOnly,joint}Fallback.test.ts`, `parseCommand.test.ts` (+ snapshot), `phraseCoveragePayoff.integration.test.ts`; `actions/AGENT.{contract,implementation}.md`; `enrich/objectManipulation/AGENT.md`; `AGENT.objectManipulationIterations.planning.md`. Flipped tests: transfer "abstains with noCatalog when neither catalog is supplied" and "abstains on a preposition outside the qualifier set" (Error to Abstain); describe "abstains when there is no catalog" (Error to Abstain); both fallback stubs' "select abstains on empty candidates" (`error` to `abstain`); the `parseCommand` characterization row "take broom when the broom touches an exit" (still Abstain, now after climbing: classify and Parse each called once, so the fixture supplies the model's tokens). |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |
| 5 | Not started | --- |
