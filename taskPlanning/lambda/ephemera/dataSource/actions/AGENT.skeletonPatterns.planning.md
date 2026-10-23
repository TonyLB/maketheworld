# Skeleton patterns: one template, matched against text or a skeleton

**Status: Slice 0 done 2026-10-23 (SP-1--SP-8 decided; inventory recorded). Slice 1 is next. Ready since qualified referents (rung 6) shipped and retired 2026-10-23, with its rules in [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md#qualifier) "Qualifier".** An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is rung 12 of the iteration ladder in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md). It takes over the shelf bullet "Templates matched against the command text" under "Shelved: stacked qualifiers and `put`" in [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), and that shelf's "Chained qualifiers on a take".

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
  - **Building the skeleton:** `matchPatternAgainstString` turns the pattern into one anchored regex, so it returns **one** fill at most. Its non-greedy `(.+?)` against `take cup on saucer on table` gives only cup / "saucer on table". `matchPatternAgainstTokens` walks one token per element, so it is flat. `synthesizeSkeletonFromPattern` builds and stamps the skeleton from a string match.
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
| **Fast path:** `maybeDeterministicManipulationIntent` ([`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)) | `take`/`get` and `drop` (regexes); `hold` after `take` (excluded); a leading article (`peelLeadingArticleWhenTail`) | the verb (read again with `split(/\s+/)[0]`), the head span, the links | String regexes. Guards: a whole-tail label; `get` needs a head label. Computes an unread `verbClass`. | Slice 3: the patterns run against the text, plus the claim policy. |
| **Fast-path split:** `splitQualifierTail` | `QUALIFIER_PHRASES`, longest first | the head and a chain of `{preposition, span}` | A whole-word regex, case-insensitive. | Deleted in Slice 3. |
| **Containment:** `matchContainmentTemplate` | `put`/`place` (with their narration forms); `in`/`inside`/`into` → In; `on top of`/`onto`/`on` → On | subject, target | Exactly 4 tokens. The verb must be the whole token. The preposition matches **anywhere in the token, as a whole word** (`matchContainmentPhrase`). | Slice 2. |
| **Spread:** `matchSpreadTemplate` | `spread`/`drape`; `over`/`across` → On, as extra On phrases | subject, target | 4 tokens. The preposition goes through `matchContainmentPhrase`. | Slice 2. |
| **Look:** `matchLookTemplate` | `look`/`l`/`examine`/`x` | object | Exactly 2 tokens; the verb is the whole token. | Slice 2. |
| **Membership:** `matchMembershipTemplate` | `take`/`get` → acquire; `drop` → release | the **first** span, wherever it is | The first token must be a whole word. **No shape check:** an unread span is caught by the gate in `compileAttemptsFromSkeleton`. Returns an unread `verbClass`. | Slice 2. The lenient shape becomes an explicit pattern, and the gate keeps its outcome. |
| **Grouping:** `groupSkeleton` | `GROUPING_VERBS = {take, get}`; `QUALIFIER_PREPOSITIONS` with relation values; the alias `out` → `out of` | the head, the qualifier span | Exactly 4 tokens; the preposition is the whole token. | Deleted in Slice 4. The lexicon moves into the pattern in Slice 2. |
| **Bare-word rows** ([`bareWordTemplates.ts`](../../../../../lambda/ephemera/dataSource/actions/deterministicTemplate/bareWordTemplates.ts)) | `look`/`l`; the help, home and wait phrases; `predict` | none | `matchPatternAgainstString`, against the whole line. | Slice 1 keeps their tests unchanged. |
| **Bare-word regexes in the fast path** (`isBareLookCommand` and its siblings, in `deterministicChecks.ts`) | `look`/`l`, `help`, `home`, `predict` | none | Regexes against the whole line. They duplicate the bare-word rows, as the rows' own comment says. | Out of scope; shelved. |
| **Navigation fast path:** `maybeDeterministicNavigationResult` | `go`, or no verb | the exit text | A regex, then `resolveExitLabelToTargetId` against `roomExits`. | Out of scope; shelved. |
| **Navigation paraphrase** ([`matchNavigationParaphrase.ts`](../../../../../lambda/ephemera/dataSource/actions/plan/matchNavigationParaphrase.ts)) | `head`/`walk`/`move`/`travel`/`enter` | the exit text | A regex, then exit resolution; a miss is an Error. | Out of scope; shelved. |
| **AcmeOrder** ([`matchAcmeOrderFamily.ts`](../../../../../lambda/ephemera/dataSource/actions/plan/matchAcmeOrderFamily.ts)) | `order`/`buy`/`purchase` | every span after the verb (text between spans is ignored) | Skeleton only, variable length; then an LLM call. | Out of scope; shelved. |

**Findings:**

- **Navigation and AcmeOrder have closed shapes.** Navigation is a verb list plus captured text; AcmeOrder is a verb plus one or more spans. What is open is the step after the match: exit resolution needs `ParseCommandInput.roomExits`, and AcmeOrder's builder is an LLM call. They fit once a builder (SP-5) can take the input, and once a repetition element exists for AcmeOrder. They are shelved with the other fold-ins (see [Not in scope](#not-in-scope)).
- **Only the containment and spread prepositions match inside a token today** (`matchContainmentPhrase` reads `into` out of a model's `hurriedly into`). Verbs and the qualifier prepositions must be the whole token. Under SP-4 every fixed word must be the whole token, so Slice 2 retires that leniency.
- **Dead or duplicate pieces to retire with the code that holds them:**
  - two unread `verbClass` values: the fast path's `ObjectMembershipIntent.verbClass` (required in `baseClasses.ts`) and the membership template's;
  - `matchContainmentPreposition`, which only its tests call.
- **The vocabulary carries values in two places.** The qualifier lexicon records a relation per phrase, and containment and spread record In/On per phrase. These are the first cases of SP-1's "an option carries a value".

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done. Each slice leaves every command's observable behavior as it was, except where its own payoff says otherwise.

- [X] **Slice 0. Inventory and decisions.**
  - [X] List every place a command shape is written today, with the words it fixes and what it captures: the fast path's regexes and guards, the four object templates, `groupSkeleton`, the `DeterministicTemplate` rows, and `matchNavigationParaphrase` (expected out of scope; record why). Recorded in [Inventory](#inventory-slice-0-2026-10-23).
  - [X] Settle SP-1 (the pattern language) and SP-4 (how a pattern matches a model skeleton), and record the answers in the decision rows. (All eight rows were decided together, 2026-10-23.)
- [ ] **Slice 1. The matcher returns every fill.**
  - [ ] Replace the regex in `matchPatternAgainstString` with a matcher over words that returns **every** way the pattern fits. A fixed word may anchor anywhere, and multi-word options are matched as phrases.
  - [ ] `matchPatternAgainstTokens` follows SP-4. Text tokens are matched the way `matchContainmentPhrase` matches them today.
  - [ ] `DeterministicTemplateMatch` (or a sibling result, per SP-1) carries a list of fills. The bare-word rows behave as today, and their tests pass unchanged.
- [ ] **Slice 2. The object templates become patterns.**
  - [ ] Containment, spread, look and membership each become a pattern plus a function that builds the attempt from the pattern's captures (SP-5). The hand-written length and token-type checks are deleted.
  - [ ] Each closed word list lives in the pattern. The qualifier lexicon (`QUALIFIER_PREPOSITIONS` and its relation) and the containment phrases keep one home each.
  - [ ] Payoff of its own: a fixed word must be a whole text token (SP-4), so `put coin hurriedly into box`, with `hurriedly into` as one text token, no longer matches containment. The `matchContainmentTemplate` test "a stray word does not reach the line" becomes a no-match test, and `matchContainmentPhrase`'s doc comment goes with the function.
  - [ ] Retire what the inventory found dead: both unread `verbClass` values and `matchContainmentPreposition`. Membership's lenient shape (the first span, anywhere) becomes an explicit pattern, and the unread-span gate keeps its outcome.
  - [ ] `matchPlanTemplates` runs the patterns against each reading. Every existing Plan and compile test passes unchanged.
- [ ] **Slice 3. The fast path is the patterns run against the text.**
  - [ ] `maybeDeterministicManipulationIntent`'s regexes and qualifiedReferents' split (`splitQualifierTail`) are deleted. The fast path matches the object templates' patterns against the command text, keeps the fills its claim policy allows (SP-3, SP-6), and hands the matched skeletons to Plan directly. (`parseCommand.ts` already takes the fast path's skeleton as built, since qualifiedReferents' Slice 3.)
  - [ ] The claim policy is the fast path's only code of its own: the whole-tail-label guard, `get`'s head-label rule, `take hold`, and which templates it claims. The fast path's bare-word and navigation regexes stay; folding them in is shelved (see [Not in scope](#not-in-scope)).
  - [ ] Tests: for each `/test parse` fixture the fast path claims, its skeleton equals Nova Micro's (the recorded rows in `deterministicChecks.test.ts`, "a qualified tail splits into the flat skeleton"; the full two-run table is in git history with the deleted qualifiedReferents corpus). Every `deterministicChecks` test keeps its outcome.
- [ ] **Slice 4. The object phrase is recursive.**
  - [ ] Add a recursive pattern element (SP-7): an object phrase is a span, optionally followed by a closed-set preposition and another object phrase. One match returns every bracketing, as skeletons whose spans carry `qualifier`, which `lowerQualifiers` already reads.
  - [ ] `groupSkeleton` is deleted. Matching the recursive patterns against the flat skeleton (LLM route) or the text (fast path) yields the readings. Where the verb table goes is SP-8.
  - [ ] The unread-span gate drops the one attempt that leaves a span unread, as the other entry checks do, instead of refusing the command.
  - [ ] Payoff: `take cup on saucer on table` takes the right cup (see [Goal](#goal)). `put cup on saucer on table` produces its readings as attempts. Asking between readings with the same objects stays on the shelf.
- [ ] **Slice 5. Payoff and graduation.**
  - [ ] Payoff tests for each Goal bullet, each ending at the player's line and the world after commit.
  - [ ] The `DeterministicTemplate` concepts and module docs are rewritten to the steady state. The shelf bullets this plan took over are removed, and what remains is reshelved.
  - [ ] This file is deleted after a grep for inbound links, and the ladder row is updated.

## Not in scope

- **Choosing between readings with the same objects**, and the depth cap's value beyond what Slice 4 needs: see "Two readings with the same objects" in "Shelved: stacked qualifiers and `put`".
- **A drop's tail as a destination** and **`look at` with a qualifier**: the same shelf. SP-8 decides only whether the verb table survives.
- **Open phrasing.** Fixed words stay closed lists. A command no pattern fits goes to the LLM route, as today.
- **Folding in the other command shapes.** That means the fast path's bare-word and navigation regexes, the Navigation paraphrase matcher, and AcmeOrder. Their shapes are closed (see [Inventory](#inventory-slice-0-2026-10-23)), but their builders need live context (`roomExits`, or AcmeOrder's LLM call), and AcmeOrder needs a repetition element. Shelved with SP-6's follow-up under "Whether the fast path learns `put`" in `actions/AGENT.implementation.md`.
- **A new LLM prompt.** The model's skeleton is matched as it comes.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **SP-1** | **What is the pattern language, and what does a match return?** *Decided (user, 2026-10-23):* extend `PatternElement` and `DeterministicTemplate` rather than building a second type. A `templateText` option can carry a value, such as the relation a preposition records. A match returns a list of fills, each a stamped skeleton with captures by role. The `intent` arm stays for the bare-word rows, and object templates read the fills instead. Still to settle in Slices 1--2: how an option carries its value (the qualifier lexicon's relation is the first case); the user expects small decisions there. | Slices 1--2 | Decided |
| **SP-2** | **How are several fills ordered and deduplicated?** *Decided (user, 2026-10-23):* no order, because Plan pools attempts and the dry run and selection choose. Fills that produce identical skeletons are merged. | Slice 1 | Decided |
| **SP-3** | **How far does a wildcard reach when a fixed word also occurs inside an object's name** ("take man in the moon")? *Decided (user, 2026-10-23):* the matcher returns every fill, so one word can be inside a span in one fill and a fixed token in another: `[take, "man in the moon"]` and `[take, "man", in, "the moon"]` are both fills. The fast path's claim policy keeps the whole-tail fill when the whole tail is a room label (today's guard, now a filter). On the LLM route the model's span boundaries bind (SP-4), so a word inside a model span is never a fixed token. | Slice 3 | Decided |
| **SP-4** | **How does a pattern match a skeleton the model built?** *Decided (user, 2026-10-23):* the model's span boundaries bind. A wildcard covers whole object-span tokens and never splits one, and a fixed word must be a whole text token (case and whitespace aside) (user, 2026-10-23). No deterministic handling of manner words exists, and a closed list cannot cover them, so a text run such as `hurriedly into` matches no template. This retires `matchContainmentPhrase`'s match inside a token, a behavior change owned by Slice 2. The skeleton carries more than the string, so this is the simpler match. Rejected: flattening the skeleton back to a string, which discards what the model segmented. | Slices 1, 4 | Decided |
| **SP-5** | **Where does a template's attempt builder live?** *Decided (user, 2026-10-23):* beside its pattern, as `build(captures, command) → CommandAttempt`, so the template file holds its shape, its words and its narration unit together. | Slice 2 | Decided |
| **SP-6** | **Which templates does the fast path claim?** *Decided (user, 2026-10-23):* take/get/drop, as today, for this iteration. Folding the other templates in becomes a one-line change to the claim list; that follow-up is on the shelf ("Whether the fast path learns `put`" in `actions/AGENT.implementation.md`). | Slice 3 | Decided |
| **SP-7** | **What shape is the recursive object phrase?** *Decided (user, 2026-10-23):* right-nested only, `ObjectPhrase = SPAN (PREP ObjectPhrase)?`. Several qualifiers read as nested: "the cup on the saucer from the shelf" is the cup on (the saucer from the shelf), so `ObjectSpanToken.qualifier` keeps one qualifier. A phrase with two hosts ("the cup between the demon and the fire") is out of scope. The depth cap is set in Slice 4, to what its payoff needs (see Not in scope). | Slice 4 | Decided |
| **SP-8** | **Does `GROUPING_VERBS` survive Slice 4?** *Decided (user, 2026-10-23):* it is retired once the recursive patterns supersede its behavior, which is Slice 4's deletion of `groupSkeleton`. This follows the contract's "a qualifier restricts; an argument places" (the verb does not decide): every verb's skeleton yields its qualifier readings. Consequence, to be pinned in Slice 4: `drop cup in box` gains a qualifier reading, so its refusal comes from the dry run (the dropped cup must be held and in the box) rather than from `multiObject`, and the contract's rule that a drop's tail is not read is rewritten. | Slice 4 | Decided |

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for how this plan is kept.
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md#deterministictemplate) (`DeterministicTemplate`, Plan, attempts) and the `DeterministicTemplate` module and Parse-skeleton pipeline sections of [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md).
3. Read [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md#qualifier) "Qualifier": what a qualifier is, attachment in grouping alone, a drop's tail never read, and what the fast path claims. The leftovers are in `actions/AGENT.implementation.md` "Shelved: stacked qualifiers and `put`".
4. Testing: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) is the authority. If commands conflict, follow it.
5. Baseline, from `lambda/ephemera/`: `npm run test -- --clearCache`, then `npx tsc --noEmit` and `npm run test -- --watchAll=false`, all green before any edit.

## Verification

Per slice, from `lambda/ephemera/`: `npx tsc --noEmit` and `npm run test -- --watchAll=false`, the full suite (`*.integration.test.ts` files sit outside `tsc`).

- Slice 1: matcher tests show several fills for `take cup on saucer on table` against a `[take, span, on, span]` pattern, and a phrase option (`on top of`) is preferred over its prefix only where the text holds it. The `deterministicTemplate/` tests pass unchanged.
- Slice 2: every `plan/` and `compileAttemptsFromSkeleton*` test passes unchanged. A grep finds no length check left in the object templates.
- Slice 3: `deterministicChecks` tests keep their outcomes. The fast path's skeleton equals Nova Micro's for each `/test parse` fixture it claims. A grep finds no take/get/drop regex in `deterministicChecks.ts`. In dev, `/test parse "get cup on table"` reports the fast path.
- Slice 4: matcher tests list the bracketings of a two-qualifier tail. The `take cup on saucer on table` compile test takes the right cup. The gate test shows a failing reading dropped while a working one survives.
- Slice 5: the payoff tests assert on the player's line and the world after commit.

## Progress

| Slice | State | Files touched |
| --- | --- | --- |
| 0 | Done 2026-10-23: SP-1--SP-8 decided; inventory recorded | `AGENT.skeletonPatterns.planning.md`, `actions/AGENT.implementation.md` (shelf) |
| 1 | Not started | --- |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |
| 5 | Not started | --- |
