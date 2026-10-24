# Skeleton patterns: one template, matched against text or a skeleton

**Status: Slices 0--4 done 2026-10-24 (all decisions made, the pattern language and builder placement graduated to `actions/AGENT.implementation.md` and the fast path's claim policy to `actions/AGENT.contract.md`; inventory recorded; the matcher returns every fill; the object templates are patterns; the fast path is a pattern matched against the text; the object phrase is recursive and grouping is gone, with the attachment rules in `actions/AGENT.contract.md` "Qualifier"). Slice 5 is next. Ready since qualified referents (rung 6) shipped and retired 2026-10-23, with its rules in [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md#qualifier) "Qualifier".** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is rung 12 of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md). It takes over the shelf bullet "Templates matched against the command text" under "Shelved: stacked qualifiers and `put`" in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), and that shelf's "Chained qualifiers on a take".

## Goal

Write each command template **once**, as a skeleton pattern with wildcards, and match that one pattern two ways:

- **against the command text**, to build a skeleton without a Bedrock call (the fast path);
- **against a skeleton** the model already built (the LLM route).

The match returns **every** way the pattern fits, not just the first. The final step makes the pattern **recursive**: an object phrase can carry a qualifier whose host is itself an object phrase. One match then returns every bracketing, so grouping stops being a separate stage.

**Payoff, stated at the observable output:**

- Every fast-path take, get or drop does what it did at the end of qualifiedReferents, and the fast path no longer has a pattern of its own: deleting the take/get/drop regexes in `deterministicChecks.ts` changes no player-visible line.
- For each `/test parse` fixture the fast path claims ([`objectManipulationParseHarnessFixtures.ts`](../../../../../lambda/ephemera/dataSource/actions/objectManipulationParseHarnessFixtures.ts)), its skeleton equals the one Nova Micro returns.
- `take cup on saucer on table`, with one cup on a saucer on the table and another cup on a saucer on the floor, picks up the first cup without asking. Today it is refused as `multiObject`.

## Why now

qualifiedReferents (rung 6) found the same pattern written in several places:

- **The verbs.** `take`/`get`/`drop` are recognized by the fast path's regexes ([`deterministicChecks.ts:47-48`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)). The fast path computes a `verbClass` that nothing reads, then reads the verb again from the first word to build its skeleton. [`matchMembershipTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchMembershipTemplate.ts) works out take-or-drop again, into a second `verbClass` that nothing reads.
- **The prepositions.** Each template keeps its own closed list: containment (`in`/`inside`/`into`, `on top of`/`onto`/`on`), spread (`over`/`across`), and the qualifier lexicon (`QUALIFIER_PREPOSITIONS`). qualifiedReferents' Slice 3 added a string split for the fast path beside them (`splitQualifierTail`, reading `QUALIFIER_PHRASES`).
- **The shape.** Each template hand-codes its own length and token-type checks, and `groupSkeleton` hand-codes a fourth.

The shelf's stacked phrases ("Every bracketing is a reading") need a recursive object phrase. Building it twice, once over strings and once over skeletons, would double the duplication.

## What exists (read from code, 2026-10-23)

- **One pattern, two matchers, already built (iteration 7) and used only for bare words.** `dataSource/actions/deterministicTemplate/` ([concepts](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#deterministictemplate), [module map](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md)):
  - **The pattern:** `PatternElement` has three kinds. `templateText` is a closed list of words. `objectSpan` is a referent wildcard with a role. `capturedText` is a free-text wildcard.
  - **The two matchers:** `DeterministicTemplate` has `matchString(command)` and `matchTokens(skeleton)`. Both return `DeterministicTemplateMatch`: `noMatch`, `matched { skeleton, intent }` or `defer`.
  - **Building the skeleton:** `matchPatternAgainstString` turned the pattern into one anchored regex, so it returned **one** fill at most: its non-greedy `(.+?)` against `take cup on saucer on table` gave only cup / "saucer on table". Slice 1 replaced it with a word matcher returning every fill. `matchPatternAgainstTokens` walks one token per element, so it is flat. `synthesizeSkeletonFromPattern` builds and stamps the skeleton from a string match.
  - **Who uses it:** only `help`/`home`/`wait` (`matchNonObjectManipulationTemplate`, called in `parseCommand.ts`'s `Command` branch). The relational registry it was built for was deleted (CPG-6, 2026-10-06). Its doc comment already names `get`'s room-label gating as a context-dependent template the interface leaves room for.
  - **What a match returns:** a `ParseCommandResult` intent, and registries are first-match-wins. The object templates instead return a `CommandAttempt`, and `planSkeleton` pools every template's attempts.
- **The object templates are hand-written** ([`plan/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/)):
  - containment: `put`/`place` + span + an in/on phrase + span, exactly 4 tokens;
  - spread: `spread`/`drape` + span + `over`/`across` + span, 4 tokens;
  - look: `look`/`l`/`examine`/`x` + span, 2 tokens;
  - membership: `take`/`get`/`drop`, reading the first span.

  Each one builds its attempt and narration unit from the tokens it matched. `matchContainmentPhrase` matches a closed phrase anywhere in a text token as a whole word, so the model's "hurriedly into" still reads as `into`.
- **Grouping and lowering** (qualifiedReferents Slice 2): `groupSkeleton` returns a list of readings, which is the right signature. Its body is one fixed 4-token shape, gated by the verb table `GROUPING_VERBS = {take, get}`. `lowerQualifiers` already recurses through a qualified qualifier.
- **The fast path** (`maybeDeterministicManipulationIntent`) claims `take`/`drop` always, and `get` when its head is a room label. It excludes `take hold`. Since qualifiedReferents' Slice 3 it splits the tail at each closed-set preposition (`discriminateIntent/splitQualifierTail.ts`), and its whole-tail-label guard protects names such as "man in the moon". It returns `ObjectMembershipIntent { skeleton }`, the flat draft skeleton, which `parseCommand.ts` stamps and hands to Plan.
- **The unread-span gate** in `compileAttemptsFromSkeleton` refuses the **whole command** as `multiObject` when any membership attempt leaves a span unread. With one reading per command that is correct. With several readings, it would let a failing reading sink a working one.

## Inventory (Slice 0, 2026-10-23)

Every place a command shape is written today, read from code.

| Place | Fixed words | Captures | Matches how | Fate |
| --- | --- | --- | --- | --- |
| **Fast path:** `maybeDeterministicManipulationIntent` ([`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)) | `take`/`get` and `drop` (regexes); `hold` after `take` (excluded); a leading article (`peelLeadingArticleWhenTail`) | the verb (read again with `split(/\s+/)[0]`), the head span, the links | String regexes. Guards: a whole-tail label; `get` needs a head label. Computes an unread `verbClass`. | Done (Slice 3): `[membership verbs, objectPhrase]` against the text, plus the claim policy. |
| **Fast-path split:** `splitQualifierTail` | `QUALIFIER_PHRASES`, longest first | the head and a chain of `{preposition, span}` | A whole-word regex, case-insensitive. | Done (Slice 3): deleted, with `QUALIFIER_PHRASES`. |
| **Containment:** `matchContainmentTemplate` | `put`/`place` (with their narration forms); `in`/`inside`/`into` → In; `on top of`/`onto`/`on` → On | subject, target | Exactly 4 tokens. The verb must be the whole token. The preposition matches **anywhere in the token, as a whole word** (`matchContainmentPhrase`). | Done (Slice 2): `containmentTemplate`, a pattern; the phrase must be the whole token. |
| **Spread:** `matchSpreadTemplate` | `spread`/`drape`; `over`/`across` → On, as extra On phrases | subject, target | 4 tokens. The preposition goes through `matchContainmentPhrase`. | Done (Slice 2): `spreadTemplate`, sharing containment's `placingPattern`. |
| **Look:** `matchLookTemplate` | `look`/`l`/`examine`/`x` | object | Exactly 2 tokens; the verb is the whole token. | Done (Slice 2): `lookTemplate` in `plan/`. |
| **Membership:** `matchMembershipTemplate` | `take`/`get` → acquire; `drop` → release | the **first** span, wherever it is | The first token must be a whole word. **No shape check:** an unread span is caught by the gate in `compileAttemptsFromSkeleton`. Returns an unread `verbClass`. | Done (Slice 2): `[verb, span, rest]`; the gate keeps its outcome. |
| **Grouping:** `groupSkeleton` | `GROUPING_VERBS = {take, get}`; `QUALIFIER_PREPOSITIONS` with relation values; the alias `out` → `out of` | the head, the qualifier span | Exactly 4 tokens; the preposition is the whole token. | Slice 2 made it a pattern and moved the lexicon to `plan/qualifierPrepositions.ts` (`QUALIFIER_OPTIONS` holds the `out` alias). Done (Slice 4): deleted; each template's fills against the flat skeleton are the readings. |
| **Bare-word rows** ([`bareWordTemplates.ts`](../../../../../lambda/ephemera/dataSource/actions/deterministicTemplate/bareWordTemplates.ts)) | `look`/`l`; the help, home and wait phrases; `predict` | none | `matchPatternAgainstString`, against the whole line. | Slice 1 keeps their tests unchanged. |
| **Bare-word regexes in the fast path** (`isBareLookCommand` and its siblings, in `deterministicChecks.ts`) | `look`/`l`, `help`, `home`, `predict` | none | Regexes against the whole line. They duplicate the bare-word rows, as the rows' own comment says. | Out of scope; shelved. |
| **Navigation fast path:** `maybeDeterministicNavigationResult` | `go`, or no verb | the exit text | A regex, then `resolveExitLabelToTargetId` against `roomExits`. | Out of scope; shelved. |
| **Navigation paraphrase** ([`matchNavigationParaphrase.ts`](../../../../../lambda/ephemera/dataSource/actions/plan/matchNavigationParaphrase.ts)) | `head`/`walk`/`move`/`travel`/`enter` | the exit text | A regex, then exit resolution; a miss is an Error. | Out of scope; shelved. |
| **AcmeOrder** ([`matchAcmeOrderFamily.ts`](../../../../../lambda/ephemera/dataSource/actions/plan/matchAcmeOrderFamily.ts)) | `order`/`buy`/`purchase` | every span after the verb (text between spans is ignored) | Skeleton only, variable length; then an LLM call. | Out of scope; shelved. |

**Findings:**

- **Navigation and AcmeOrder have closed shapes.** Navigation is a verb list plus captured text; AcmeOrder is a verb plus one or more spans. What is open is the step after the match: exit resolution needs `ParseCommandInput.roomExits`, and AcmeOrder's builder is an LLM call. They fit once a template's `build` can take the input, and once a repetition element exists for AcmeOrder. They are shelved with the other fold-ins (see [Not in scope](#not-in-scope)).
- **Only the containment and spread prepositions match inside a token today** (`matchContainmentPhrase` reads `into` out of a model's `hurriedly into`). Verbs and the qualifier prepositions must be the whole token. Under the whole-token rule every fixed word must be the whole token; Slice 2 retired that leniency.
- **Dead or duplicate pieces to retire with the code that holds them** (retired in Slice 2):
  - two unread `verbClass` values: the fast path's `ObjectMembershipIntent.verbClass` (required in `baseClasses.ts`) and the membership template's;
  - `matchContainmentPreposition`, which only its tests call.
- **The vocabulary carries values in two places.** The qualifier lexicon records a relation per phrase, and containment and spread record In/On per phrase. These were the first cases of "an option carries a value". Slice 2 keys each value by the capture's `option` in the template's own typed lexicon.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done. Each slice leaves every command's observable behavior as it was, except where its own payoff says otherwise.

- [X] **Slice 0. Inventory and decisions.**
  - [X] List every place a command shape is written today, with the words it fixes and what it captures: the fast path's regexes and guards, the four object templates, `groupSkeleton`, the `DeterministicTemplate` rows, and `matchNavigationParaphrase` (expected out of scope; record why). Recorded in [Inventory](#inventory-slice-0-2026-10-23).
  - [X] Settle the pattern language and how a pattern matches a model skeleton, and record the answers in the decision rows. (All eight rows were decided together, 2026-10-23; the pattern language and builder placement shipped in Slice 2 and live in `actions/AGENT.implementation.md`, "`DeterministicTemplate` module".)
- [X] **Slice 1. The matcher returns every fill.**
  - [X] Replace the regex in `matchPatternAgainstString` with a matcher over words that returns **every** way the pattern fits. A fixed word may anchor anywhere, and multi-word options are matched as phrases. A phrase option and its prefix option each give a fill where the text allows, and fills that build the same skeleton are merged.
  - [X] `matchPatternAgainstTokens` follows the whole-token rule: a fixed word equals the whole text token, ignoring case and spacing, so `hurriedly into` is not `into`.
  - [X] A sibling result carries the list of fills: both engines return `PatternFill[]` (`{ skeleton, captures }`). `DeterministicTemplateMatch` is unchanged for the intent rows, which read exactly one fill (several fills are `noMatch`; no bare-word row has a wildcard). The bare-word rows behave as today, and their tests pass unchanged.
- [X] **Slice 2. The object templates become patterns.**
  - [X] Containment, spread, look and membership each become a pattern plus a function that builds the attempt from the pattern's captures (`AttemptTemplate`: `{ name, pattern, build(captures, command) }`, matched by `matchAttemptTemplate`). The hand-written length and token-type checks are deleted.
  - [X] Each closed word list lives in the pattern. The qualifier lexicon (`QUALIFIER_PREPOSITIONS` and its relation) and the containment phrases keep one home each.
  - [X] Payoff of its own: a fixed word must be a whole text token, so `put coin hurriedly into box`, with `hurriedly into` as one text token, no longer matches containment. The `matchContainmentTemplate` test "a stray word does not reach the line" becomes a no-match test, and `matchContainmentPhrase`'s doc comment goes with the function. The spread test's `partly over` was in-token too, and became a no-match test of its own.
  - [X] Retire what the inventory found dead: both unread `verbClass` values and `matchContainmentPreposition`. Membership's lenient shape (the first span, anywhere) becomes an explicit pattern, and the unread-span gate keeps its outcome.
    - The pattern is `[take|get|drop, span, rest]`. `rest` is a new last-only element that takes whatever follows and that no builder reads. The flat reading still needs it in Slice 4.
    - A skeleton with no span after the verb (`[take]`, or a text token before the first span) no longer matches membership, so it plans nothing. No test or producer reached it.
    - `ManipulationVerbClass` went with the intent field.
  - [X] `matchPlanTemplates` runs the patterns against each reading. Every existing Plan and compile test passes unchanged.
    - `groupSkeleton` is a token pattern over the qualifier lexicon. The lexicon now lives in `plan/qualifierPrepositions.ts`, which outlives `groupSkeleton`.
- [X] **Slice 3. The fast path is the patterns run against the text.**
  - [X] `maybeDeterministicManipulationIntent`'s regexes and qualifiedReferents' split (`splitQualifierTail`) are deleted. The fast path matches its pattern against the command text, keeps the fill its claim policy allows, and hands that skeleton to Plan directly. (`parseCommand.ts` already takes the fast path's skeleton as built, since qualifiedReferents' Slice 3.)
    - Chains needed a pattern longer than any fixed arity, so this slice added a flat **`objectPhrase`** element (user, 2026-10-24): a span, then zero or more pairs of a closed-set preposition and a span. Against text it returns every set of cuts as a fill. It is matched against text only for now. The fast path's pattern is `[MEMBERSHIP_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT]`, both from the templates' own lexicons.
    - The fast path hands Plan a skeleton, not attempts, so string captures need no `stableRefKey`s.
  - [X] The claim policy is the fast path's only code of its own: `take hold`, the whole-tail-label guard, then the fill with the most cuts (longest phrases first), then `get`'s head-label rule. Which templates it claims is its verb element. The fast path's bare-word and navigation regexes stay; folding them in is shelved (see [Not in scope](#not-in-scope)).
    - One widening: the fast path shares the qualifier lexicon, so a bare `out` now cuts (`take coin out box`), as grouping already reads the LLM route's bare `out`. `QUALIFIER_PHRASES`, whose longest-first order existed only for the old split, was retired.
  - [X] Tests: for each `/test parse` fixture the fast path claims, its skeleton equals Nova Micro's (the recorded rows in `deterministicChecks.test.ts`, "a qualified tail splits into the flat skeleton"; the full two-run table is in git history with the deleted qualifiedReferents corpus). Every `deterministicChecks` test keeps its outcome. The useful `splitQualifierTail` cases moved there as fast-path cases.
- [X] **Slice 4. The object phrase is recursive.**
  - [X] Make the `objectPhrase` element recursive: an object phrase is a span, optionally followed by a closed-set preposition and another object phrase, right-nested. The token engine learns it and returns every fill; each fill's skeleton is its reading, whose spans carry the `qualifier` that `lowerQualifiers` already reads.
    - Attachment stays in one place, Plan's token match. Against the text the element still emits the flat cuts the fast path hands Plan, so both routes still emit the same flat skeleton. Right-nesting gives one structure per run of links, so the flat capture and the nested reading hold the same information.
    - The element's `prepositions` became a map from option to canonical preposition (`QUALIFIER_OPTIONS`), so a reading's qualifier is canonical (`out` is `out of`).
    - No depth cap: right-nesting keeps readings linear in the number of prepositions (recorded in the shelf's "Every bracketing is a reading").
  - [X] `groupSkeleton` and `GROUPING_VERBS` are deleted. The membership, containment and spread templates take object phrases (`qualifierObjectPhraseElement`), and each template's fills against the flat skeleton are the readings, lowered per fill. Look keeps a plain span (a qualifier on a look stays shelved). Membership keeps `rest`, so a tail outside the qualifier set still makes an attempt the gate drops, and still refuses as `multiObject`.
    - Every verb's skeleton yields its readings: `drop the cup in the box` reads the cup that is in the box, so the dry run refuses it ("The box has no cup." for a held cup, not-carried otherwise) instead of `multiObject`. The contract's "a drop's tail is never read" was rewritten.
  - [X] The unread-span gate drops the one attempt that leaves a span unread, as the other entry checks do, and refuses as `multiObject` only when nothing survives.
    - The same flaw was in `proposeAttemptCandidates`' distinct-objects rule, found in a dev smoke test (user, 2026-10-24): an assignment was kept only if every attempt bound distinct objects, so `put cup on saucer on table on table`'s reading of a table on a table sank the reading that moves the cup. The rule now drops the attempt under that assignment, not the assignment.
  - [X] Payoff: `take cup on saucer on table` takes the right cup (`compileAttemptsFromSkeleton.transfer.test.ts`, with two cup-on-saucer stacks). `put cup on saucer on table` produces its two readings as attempts (`planSkeleton.test.ts`). Asking between readings with the same objects stays on the shelf.
- [ ] **Slice 5. Payoff and graduation.**
  - [ ] Payoff tests for each Goal bullet, each ending at the player's line and the world after commit.
  - [ ] The `DeterministicTemplate` concepts and module docs are rewritten to the steady state. The shelf bullets this plan took over are removed, and what remains is reshelved.
  - [ ] This file is deleted after a grep for inbound links, and the ladder row is updated.

## Not in scope

- **Choosing between readings with the same objects**: see "Two readings with the same objects" in "Shelved: stacked qualifiers and `put`".
- **A drop's tail as a destination** and **`look at` with a qualifier**: the same shelf. Slice 4 retired the verb table, so a drop's tail reads as a qualifier; reading it as a destination is still shelved.
- **Open phrasing.** Fixed words stay closed lists. A command no pattern fits goes to the LLM route, as today.
- **Folding in the other command shapes.** That means the fast path's bare-word and navigation regexes, the Navigation paraphrase matcher, and AcmeOrder. Their shapes are closed (see [Inventory](#inventory-slice-0-2026-10-23)), but their builders need live context (`roomExits`, or AcmeOrder's LLM call), and AcmeOrder needs a repetition element. Shelved with the fast path's other fold-ins under "Whether the fast path learns `put`" in `actions/AGENT.implementation.md`.
- **A new LLM prompt.** The model's skeleton is matched as it comes.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

None open. Every decision this plan made has shipped and is recorded in `actions/AGENT.contract.md` or `actions/AGENT.implementation.md`.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for how this plan is kept.
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#deterministictemplate) (`DeterministicTemplate`, Plan, attempts) and the `DeterministicTemplate` module and Parse-skeleton pipeline sections of [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md).
3. Read [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md#qualifier) "Qualifier": what a qualifier is, attachment in grouping alone, a drop's tail never read, and what the fast path claims. The leftovers are in `actions/AGENT.implementation.md` "Shelved: stacked qualifiers and `put`".
4. Testing: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the authority. If commands conflict, follow it.
5. Baseline, from `lambda/ephemera/`: `npm run test -- --clearCache`, then `npx tsc --noEmit` and `npm run test -- --watchAll=false`, all green before any edit.

## Verification

Per slice, from `lambda/ephemera/`: `npx tsc --noEmit` and `npm run test -- --watchAll=false`, the full suite (`*.integration.test.ts` files sit outside `tsc`).

- Slice 1: matcher tests show several fills for `take cup on saucer on table` against a `[take, span, on, span]` pattern, and the `on top of` fill exists only where the text holds the phrase (the `on` fill, with span "top of table", is returned too). `bareWordTemplates.test.ts` and `index.test.ts` pass unchanged; `patternTemplate.test.ts` moves to the fill list with each existing case keeping its outcome.
- Slice 2: every `plan/` and `compileAttemptsFromSkeleton*` test passes unchanged. A grep finds no length check left in the object templates.
- Slice 3: `deterministicChecks` tests keep their outcomes. The fast path's skeleton equals Nova Micro's for each `/test parse` fixture it claims. A grep finds no take/get/drop regex in `deterministicChecks.ts`. In dev, `/test parse "get cup on table"` reports the fast path.
- Slice 4: matcher tests list the bracketings of a two-qualifier tail. The `take cup on saucer on table` compile test takes the right cup. The gate test shows a failing reading dropped while a working one survives.
- Slice 5: the payoff tests assert on the player's line and the world after commit.

## Progress

| Slice | State | Files touched |
| --- | --- | --- |
| 0 | Done 2026-10-23: every decision row decided; inventory recorded | `AGENT.skeletonPatterns.planning.md`, `actions/AGENT.implementation.md` (shelf) |
| 1 | Done 2026-10-23: the word matcher returns every fill; the token matcher requires whole tokens | `deterministicTemplate/patternTemplate.ts`, `patternTemplate.test.ts`, `deterministicTemplate.ts` (doc comment), `actions/AGENT.implementation.md` (module map) |
| 2 | Done 2026-10-23: the four object templates and `groupSkeleton` are patterns; `rest` and the capture's `option` added; whole-token fixed words; `verbClass` retired | `deterministicTemplate/{deterministicTemplate,patternTemplate}.ts` (+ test), `plan/match{Containment,Spread,Look,Membership}Template.ts` (+ tests), `plan/{planSkeleton,groupSkeleton,lowerQualifiers}.ts`, new `plan/{qualifierPrepositions,templateCaptures,attemptTemplateFixture}.ts`, `baseClasses.ts`, `discriminateIntent/{deterministicChecks,splitQualifierTail}.ts` (+ tests), `commitAttempt.test.ts` (comments), `actions/AGENT.{implementation,concepts}.md`, `enrich/AGENT.md`, `enrich/objectManipulation/AGENT.md`, `positions/AGENT.contract.md`, `llm/AGENT.concepts.md`, `diegeticLogic/AGENT.operators.concepts.md` |
| 3 | Done 2026-10-24: the fast path is `[membership verbs, objectPhrase]` matched against the text plus its claim policy; flat `objectPhrase` element added; `splitQualifierTail` and `QUALIFIER_PHRASES` deleted | `deterministicTemplate/{deterministicTemplate,patternTemplate}.ts` (+ test), `discriminateIntent/deterministicChecks.ts` (+ test), deleted `discriminateIntent/splitQualifierTail.ts` (+ test), `plan/{qualifierPrepositions,matchMembershipTemplate}.ts` (+ qualifier test), `baseClasses.ts`, `parseCommand.ts` (comments), `actions/AGENT.{contract,implementation,concepts}.md` |
| 4 | Done 2026-10-24: `objectPhrase` is recursive and the token engine returns every fill as a reading; `groupSkeleton` and `GROUPING_VERBS` deleted; templates take object phrases; the gate drops the attempt | `deterministicTemplate/{deterministicTemplate,patternTemplate}.ts` (+ test), `plan/{planSkeleton,templateCaptures,matchContainmentTemplate,matchMembershipTemplate,qualifierPrepositions,attemptTemplateFixture}.ts`, `plan/{planSkeleton,matchContainmentTemplate}.test.ts`, deleted `plan/groupSkeleton.ts` (+ test), `compileAttemptsFromSkeleton.ts` (+ `.transfer.test.ts`), `attemptCandidates.ts`, `parseCommand.test.ts`, `parse/parseToken.ts`, `discriminateIntent/deterministicChecks.ts` (+ test, comments), `actions/AGENT.{contract,implementation,concepts}.md`, `enrich/objectManipulation/AGENT.md` |
| 5 | Not started | --- |
