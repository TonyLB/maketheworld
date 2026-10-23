# Qualified referents: the Slice 0 corpus

**Companion to [`AGENT.qualifiedReferents.planning.md`](AGENT.qualifiedReferents.planning.md), started 2026-10-23.** It holds Slice 0's evidence and nothing else. Open rows, the slice order and Progress stay in the plan. It records the Parse baseline (what each route makes of the corpus commands), the facts the design leans on, the worked cases, and proposals for QR-4 and QR-6.

**Disposal:** this file is deleted with the plan. Before deleting it, decide whether [`objectManipulationParseHarnessFixtures.ts`](../../../../../lambda/ephemera/dataSource/actions/objectManipulationParseHarnessFixtures.ts) stays as a Parse regression set, and whether the observations under [LLM route](#llm-route-nova-micro-parse) belong in the Parse prompt's tuning notes.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Two routes to a skeleton

A command reaches Plan by one of two routes. Which one it takes is decided before any LLM call.

- **Deterministic fast path** (`maybeDeterministicManipulationIntent`, [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)). Read from code, 2026-10-23:
  - `take <tail>` and `drop <tail>` are always claimed.
  - `get <tail>` was claimed only when the whole tail, normalized, equals a room object label.

  In both cases the leading article was peeled, and the **whole tail became one object span**. [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) built the skeleton `text <verb> | span <tail>` and entered Plan. There is no Bedrock call.

  **After Slice 3** the fast path splits the tail at each closed-set preposition, unless the whole tail is a room label, and peels the article from each piece; a `get` is claimed when its head piece is a label. It hands `parseCommand.ts` the flat skeleton, which matches Nova Micro's except for O2's articles. The table below is the pre-Slice-3 baseline.
- **LLM route.** Everything the fast path does not claim, and that the non-object templates and navigation paraphrases do not resolve, goes through discriminateIntent's classify call and then the Nova Micro Parse ([`buildParsePrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/parse/buildParsePrompt.ts)).

| Command | Route | Skeleton |
| --- | --- | --- |
| `take the cup on the table` | fast path | `text "take" \| span "cup on the table"` |
| `take cup off saucer` | fast path | `text "take" \| span "cup off saucer"` |
| `take coin out of box` | fast path | `text "take" \| span "coin out of box"` |
| `drop the cup in the box` | fast path | `text "drop" \| span "cup in the box"` |
| `get the cup on the table` | LLM (no room object is labelled "cup on the table") | see below |
| `get cup` (a cup in the room) | fast path | `text "get" \| span "cup"` |

**So, before Slice 3, the same qualifier was folded on one route and split on the other.** On the fast path a qualified take is one span with no BD-20 refusal, and the whole phrase goes to Identify as a name. On the LLM route the same phrase is split, and the take is refused as `multiObject` (see below).

## LLM route: Nova Micro Parse

**How it was taken.** `/test parse` ([`runObjectManipulationParseHarness.ts`](../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runObjectManipulationParseHarness.ts)) was run twice on the dev stack, 2026-10-23, over all 18 fixtures. The harness calls `runParseStage` directly, so it shows what Parse emits **when a command reaches Parse**. For the `take` rows (8, 9) production never does: those take the fast path. The harness reads no world, so "Today, downstream" is cited from code.

| # | Command | Run 1 | Run 2 | Template | Today, downstream |
| --- | --- | --- | --- | --- | --- |
| 1 | get the cup on the table | `get` \| **the cup** \| `on` \| **table** | same | membership | BD-20 refuses: two object spans (`compileAttemptsFromSkeleton`, `multiObject`) |
| 2 | get the cup from the table | `get` \| **the cup** \| `from` \| **the table** | same | membership | BD-20 refuses |
| 3 | look at the cup on the table | `look` \| `at` \| **cup** \| `on` \| **table** | same | none | No object route: `matchLookTemplate` wants exactly two tokens |
| 4 | get the cloth on the table | `get` \| **the cloth** \| `on` \| **the table** | same | membership | BD-20 refuses |
| 5 | get the cloth from the table | `get` \| **the cloth** \| `from` \| **the table** | same | membership | BD-20 refuses |
| 6 | get bag from table | `get` \| **bag** \| `from` \| **table** | same | membership | BD-20 refuses |
| 7 | put cup on saucer on table | `put` \| **cup** \| `on` \| **saucer** \| `on` \| **table** | same | none | No object route (the templates are fixed-length) |
| 8 | take cup off saucer | `take` \| **cup** \| `off` \| **saucer** | same | membership | Not reached in production (fast path) |
| 9 | take coin out of box | `take` \| **coin** \| `out` \| **box** | `take` \| **coin** \| `out of` \| **box** | membership | Not reached in production (fast path) |
| 10 | put the cup on the table in the box | `put` \| **cup** \| `on` \| **table** \| `in` \| **box** | same | none | No object route |
| 11 | put the cup on the table | `put` \| **cup** \| `on` \| **table** | same | containment (`On`) | Ordinary move onto the table |
| 12 | put the cup onto the table | `put` \| **cup** \| `onto` \| **table** | same | containment (`On`) | Ordinary move |
| 13 | put the coin into the box | `put` \| **coin** \| `into` \| **box** | same | containment (`In`) | Ordinary move |
| 14 | get the coin in the box | `get` \| **the coin** \| `in` \| **the box** | same | membership | BD-20 refuses |
| 15 | get the cup off the table | `get` \| **the cup** \| `off` \| **the table** | `get` \| **cup** \| `off` \| **table** | membership | BD-20 refuses |
| 16 | get the coin out of the box | `get` \| **the coin** \| `out` \| **the box** | `get` \| **the coin** \| `out of` \| **the box** | membership | BD-20 refuses |
| 17 | get the cup under the table | `get` \| **the cup** \| `under` \| **the table** | same | membership | BD-20 refuses |
| 18 | put the cup under the table | `put` \| **cup** \| `under` \| **table** | same | none | No object route (`under` is not a containment preposition) |

(**Bold** is an object span; `code` is a text token.)

**Observations.**

- **O1. Nova Micro always splits.** In every command, on both runs, a phrase naming another object is its own span, chained phrases included (rows 7, 10). The prompt's keep-every-modifier rule did not fold a single qualifier. This answers QR-3 for the LLM route.
- **O2. Articles survive after `get`.** The prompt says to strip leading articles. After `put` they are always stripped. After `get` the subject usually keeps "the", and the qualifier sometimes does (rows 1 vs 2; row 15 varies between runs). Nothing in `enrich/objectManipulation` peels articles downstream. Whether Identify tolerates "the cup" was not checked here.
- **O3. `out of` is unstable.** Run 1 emitted `out` and dropped "of" (rows 9, 16). That breaks the prompt's do-not-skip rule. Run 2 emitted `out of`. A closed preposition set has to accept both.
- **O4. `look at` is two text tokens.** `look` \| `at` gives the look template three-plus tokens, so even an unqualified `look at the cup` may miss it (not run; worth a fixture).
- **O5. The membership template already claims every qualified take.** It ignores the tail, and BD-20 then refuses the attempt. So on the LLM route the qualifier is the only thing standing between today's refusal and a working take.

## Facts the cases lean on

Read from code, 2026-10-23.

- **F1. Placement names a thing's direct host, and nothing above it.** Each catalog handle's `placement` ([`objectViews.ts`](../../../../../lambda/ephemera/dataSource/actions/objectViews.ts), built by `placementsByMember` in [`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts)) is a list of runs, one per owner:
  - A thing in a host's graph with no binding of its own is listed under **the bindings whose cover holds it**. A pebble in a box reads `[{ host: Box, bindings: [Box/b] }]`. The room's root binding lists the box but not the pebble, so the pebble's placement does not name the room (`catalogHandles.test.ts`).
  - A thing loose in the room reads `[{ host: ROOM, bindings: [...] }]`, or `[{ host: ROOM, bindings: [] }]` when no binding lists it.
  - A spread thing also has **its own run**. Each of its own bindings carries `under` (the parent bindings it sits beneath) and `rooms`. `readingsOf` groups these bindings into readings, and `placementHostsOfView` returns a view's parents.

  So "sits on/in H" can be read from placement as "H is the host of a run that holds it", or, for a spread thing, "H is a parent of one of its own bindings". It is **direct**: a cup on a saucer on the table does not sit on the table.
- **F2. Placement has no relation kind.** `under` is the parent binding, not spatial "under", and neither field says `On` or `In`. The room cache does hold the relation: `EphemeraLudicCacheData.edges` are relational edges of kind `On`, `In`, `PartOf`, `ConnectedTo` or `Custom` ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)). But the handle exposes no edges by design: P6 clause 3, "a hit returns a handle, never a subgraph". This is why option labels always say "on" (the "Option labels for same-named objects" shelf bullet).
- **F3. Identify resolves exactly the spans the attempts reference.** `runIdentityStageOverReferenceKeys` takes `attemptSpanKeys(attempts)`, which walks each action's referents through `objectSpansIn` ([`commandAttempt/referent.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/referent.ts)). Today that walk reaches an `objectSpan` and the target of a `currentHost`. A qualifying span that no referent reaches is never identified.
- **F4. Candidates are joint assignments and views, judged one by one in a dry run.** `proposeAttemptCandidates` ([`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts)) enumerates every assignment of candidate objects to span keys and keeps those where an action's distinct keys bind distinct objects. An object seen in several positions becomes one candidate per reading at the actor's position (plus the whole). Each candidate then gets `attemptDryRun`. That grounds each action's step in order and checks its preconditions against an environment holding every candidate's host graphs (with their `On`/`In` edges), its ancestry, and view hosts from placement. `selectPlanTuple` resolves to the one legal survivor, asks among several, or reports the highest-confidence illegal candidate's reason. **A qualifier is an assertion judged in this dry run** (corrected 2026-10-23; an earlier draft made it a filter in the pool). It removes the candidates it rules out, so it disambiguates through the loop every command already uses, and its failure reason is the refusal line.
- **F5. The assertion is built but unjudged.** `ContainedByAssertion` (`containedBy(subject, object)`, `negate`) is in `PlanStep`. `stepReferents`, `stampCandidateReferents` (including a view, by key) and `groundAssertion` handle it. `proposeAttemptCandidates`' describer and `attemptDryRun` throw on it; the executor has no lowering; `commitAttempt` skips any non-`change` step. `extend` is the precedent: judged in the dry run and not seeded to the executor.

## Worked cases

Each case gives the world, the skeleton each route builds today, today's result, the readings, and the result wanted. "LLM route" skeletons are from the [table above](#llm-route-nova-micro-parse). "Fast path, Slice 3" skeletons follow QR-3. Lines are today's take narration unless stated.

### W1. Two cups

**World.** A room with a table and two cups. Cup A is loose in the room: `[{ host: ROOM, bindings: [] }]`. Cup B is on the table: `[{ host: Table, bindings: [Table/Base] }]`, and the table's graph holds `CupB -On-> Table`. Both cups' short name is "cup".

| Command | Route today | Today | Wanted |
| --- | --- | --- | --- |
| `get the cup on the table` | LLM (the tail "cup on the table" is no label) | Membership matches and ignores the tail; BD-20 refuses `multiObject` | Fast path (head "cup" is a label): `get` \| **cup** \| `on` \| **table**. Identify gives cup → {A, B} and table → {Table}. The attempt is [`containedBy(cup, table)`, take cup]. The dry run finds the assertion violated for A and satisfied for B, so B is the one legal survivor: no question, and B is taken. |
| `get the cup from the table` | LLM | Same refusal | Same as above: `from` restricts to the host, like `on`. |
| `take the cup on the table` | Fast path, folded: `take` \| **cup on the table** | One span goes to Identify. By the shelf's baseline (probed 2026-10-21 for the cloth), the phrase widens identity to the cups and the table and asks | Fast path split; same as `get`. |
| `get cup` (control) | Fast path | Two candidates, so the command asks; the labels are placement-named ("the cup in the room" / "the cup on the table") | Unchanged. |
| `get the cup on the table`, with **both** cups on the table | --- | --- | Both survive, so it asks. Both name labels and placement-named labels collide ("cup", "the cup on the table"); `disambiguationLabels` falls back from names to placeNames and no further. This is not new with qualifiers (two cups on one table collide today), so Slice 2 pins whatever the existing code does and does not fix it. |

### W2. Draped cloth

**World.** A room with a table and a cloth, after `drape the cloth over the table`. The cloth has two own bindings, connected: `Cloth/Base` under `ROOM/Base`, and `Cloth/new` under `Table/Base`. Its readings (`readingsOf`) are the hanging part and the table part. No plate: the plate case is the shelf's "Takes of a part that read as unreal".

| Command | Route today | Today | Wanted |
| --- | --- | --- | --- |
| `get the cloth on the table` | LLM | BD-20 refuses `multiObject` | Fast path split. Identify: cloth → {Cloth}, table → {Table}. The candidates are the hanging part, the table part and the whole. The assertion (QR-4: the view must sit wholly under the table) is violated for the hanging part and the whole, and satisfied for the table part, the one legal survivor, with no question. The take moves `Cloth/new` (PR-5's part take). |
| `get the cloth from the table` | LLM | Same refusal | Same as above. |
| `get cloth` (control) | Fast path | Both parts are at the actor's position, so it asks (positionReferents PR-2) | Unchanged. |

### W3. One bag, on the floor

**World.** A room with a table and a bag loose in the room.

| Command | Route today | Today | Wanted |
| --- | --- | --- | --- |
| `get bag from table` | LLM | BD-20 refuses `multiObject` | Fast path split. Identify: bag → {Bag}, table → {Table}. The assertion is violated for the only candidate, so the command is refused with the assertion's reason: QR-6's "The table has no bag." |
| `get bag from talbe`, with no table in the room | --- | --- | Fast path split. If Identify finds no match for "talbe", that is today's no-match outcome for an unknown span, unchanged. |

### W4. Source tails

| Command | World | Wanted |
| --- | --- | --- |
| `take cup off saucer` | Cup in the saucer's graph (`Cup -On-> Saucer`) | Fast path split at `off`. The saucer is the cup's direct host, so the cup is kept. |
| `take coin out of box` | Coin in the box's graph (`Coin -In-> Box`) | Fast path split at `out of`, matched as one phrase ahead of shorter ones. On the LLM route, `out` alone (corpus O3) must count as `out of`. |
| `take bagg from talbe` | Bag on the table | Fast path split at `from`; Identify matches "bagg" and "talbe" as it does any misspelled span. |
| `get bagg from talbe` | Bag on the table | The head "bagg" is not a label, so the fast path doesn't claim it. The LLM route splits it (fixture 6), and the result is the same, with Bedrock calls. |
| `take cup from table`, cup on a saucer on the table | Cup under the saucer, the saucer under the table | F1: not a direct host, so QR-6's refusal. A player may expect a match; see QR-4's "direct or transitive". |

### W5. Tails that stay refused

Amended 2026-10-23 (user, QR-3/QR-7): the fast path splits these like any tail, so both routes give the same skeleton and the same refusal.

| Command | Fast path after Slice 3 | LLM route today and after |
| --- | --- | --- |
| `drop the cup in the box` | Split `drop` \| **cup** \| `in` \| **box**; grouping leaves it flat and the unread-span gate refuses `multiObject` (QR-7) | BD-20 refuses `multiObject`, still after Slice 2 (QR-7) |
| `take cup on saucer on table` | Split into three spans (chains split, like O1); grouping leaves it flat and the gate refuses `multiObject` | Membership with a three-span tail: still `multiObject` |
| `take off the hat` | The tail starts with a preposition, so the head is empty. **An empty head is no split point**: folded `take` \| **off the hat**, as today | --- |

### W6. Names that hold a preposition

| Command | World | Fast path after Slice 3 |
| --- | --- | --- |
| `get the man in the moon` | A room label "man in the moon" | The whole-tail guard keeps it whole: `get` \| **man in the moon** (today's behavior). |
| `take the man in the moon` | Same | Same: the guard applies to `take` too. |
| `get onion on table` | "onion", "table" | Prepositions match at word boundaries only: "on" inside "onion" is no split point. Splits at the separate word `on`. |
| `get up`, `get out of here` | No such labels | Not claimed: "up" is no label, and "out of here" has an empty head. Unchanged. |
| `take the box of matches` | Label "box of matches" | `of` is not in the set, so there's no split (the whole-tail guard would keep it anyway). |

### W7. The restricting prepositions

The lexicon sets the assertion's recorded `relation` (QR-4). For this plan, any direct host satisfies the assertion whatever its relation. A stricter judgment would check the `On`/`In` edge in the column below.

| Phrase | In the split set? | Restricts to | Recorded relation | Note |
| --- | --- | --- | --- | --- |
| `on`, `on top of` | yes | direct host | `On` edge | Also a destination word for `put` (QR-1); not relevant to a take |
| `in`, `inside` | yes | direct host | `In` edge | Same |
| `from` | yes | direct host | (none) | Source only |
| `off` | yes | direct host | `On` edge | Source only |
| `out of` (LLM `out`) | yes | direct host | `In` edge | Matched before `on`/`in`/`out` |
| `onto`, `into` | no | --- | --- | Motion words: a take has no destination, so the tail stays as today |
| `under`, `beneath`, `behind`, `next to`, `by`, `near`, `at` | no | --- | --- | Spatial language the bindings do not hold (Not in scope); the tail stays as today |
| `of`, `with` | no | --- | --- | Part of a name or a description ("box of matches", "cup with a chip") |

## Requirements (proposals for the user to decide)

Both rows below were decided 2026-10-23; the plan's rows hold the decisions.

- **QR-4 (decided 2026-10-23 by the user, reworked after the user's correction): a qualifier is an assertion.** The first draft nested `qualifier?: { phrase, target }` on the `objectSpan` referent and filtered the pool. The user flagged that as painting into a corner, and pointed out an assertion's primary value: the sandbox dry run removes candidates and disambiguates. The commit-time check is secondary.
  - **Shape.** An action whose step is `containedBy(subject, qualifyingSpan)`, `negate: false`, placed before the take in the same attempt and covered by no narration unit. The qualifying span is that action's referent, so Identify resolves it (F3) and the distinct-objects rule applies, with no change to referents or attempts. Which span a qualifier belongs to is carried in the skeleton (`ObjectSpanToken.qualifier`) and lowered to the assertion at compile; that grouping step returns a list of readings, so the next iteration can add the "modifies the verb" reading without reshaping anything (plan QR-8). A qualified qualifier is a second assertion; several qualifiers are several assertions.
  - **Relation recorded, judged leniently for now.** `ContainedByAssertion` gains optional `relation: 'On' | 'In'`, set from the lexicon (W7). For this plan any direct host satisfies it. The dry run holds the host graphs (F4), so checking the edge later needs no handle widening (F2's handle boundary is never crossed). The open part is what a hosting with no `On`/`In` edge means.
  - **Views.** Satisfied only when every binding of the subject's view sits directly under the object. So the cloth's table part passes "on the table", and the hanging part and the whole fail (W2).
  - **Direct, not transitive, for now** (W4's cup on a saucer is refused). The environment already holds each candidate's ancestry, so transitive is a change to the judgment only.
  - **Order and reason.** The assertion action precedes the take, so a candidate that fails it reports the assertion's reason, the QR-6 line.
  - **Commit-time check shelved.** `commitAttempt` skips the assertion; lowering it into the kernel is for compound commands, where a later action needs the world as an earlier one left it.
  - **The closed set.** `on`, `on top of`, `in`, `inside`, `from`, `off`, `out of` (and LLM `out`). The fast path matches multi-word phrases first, at word boundaries only, and never at the head of a tail (W5, W6). Every other preposition leaves the tail as today. On the LLM route, a membership tail outside the set stays `multiObject`.
- **QR-6.** **Decided 2026-10-23 (user):** refuse, naming the host and the subject, without claiming a relation (the line can't know whether the bag would be on or in the table): "The table has no bag." This applies when the subject and the qualifier each resolve, but every candidate fails the assertion in the dry run. If the qualifier's own span finds no match, that is today's no-match outcome (W3). A qualifier is never dropped to rescue a take.
