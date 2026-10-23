# Qualified referents: the Slice 0 corpus

**Companion to [`AGENT.qualifiedReferents.planning.md`](AGENT.qualifiedReferents.planning.md), started 2026-10-23.** It holds Slice 0's evidence and nothing else. Open rows, the slice order and Progress stay in the plan. So far it records the Parse baseline: what each route makes of the corpus commands. The worked world cases (bindings, readings, the player's line) are not written yet.

**Disposal:** this file is deleted with the plan. Before deleting it, decide whether [`objectManipulationParseHarnessFixtures.ts`](../../../../../lambda/ephemera/dataSource/actions/objectManipulationParseHarnessFixtures.ts) stays as a Parse regression set, and whether the observations under [LLM route](#llm-route-nova-micro-parse) belong in the Parse prompt's tuning notes.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Two routes to a skeleton

A command reaches Plan by one of two routes. Which one it takes is decided before any LLM call.

- **Deterministic fast path** (`maybeDeterministicManipulationIntent`, [`deterministicChecks.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/deterministicChecks.ts)). Read from code, 2026-10-23:
  - `take <tail>` and `drop <tail>` are always claimed.
  - `get <tail>` is claimed only when the whole tail, normalized, equals a room object label.

  In both cases the leading article is peeled, and the **whole tail becomes one object span**. [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) builds the skeleton `text <verb> | span <tail>` and enters Plan. There is no Bedrock call.
- **LLM route.** Everything the fast path does not claim, and that the non-object templates and navigation paraphrases do not resolve, goes through discriminateIntent's classify call and then the Nova Micro Parse ([`buildParsePrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/parse/buildParsePrompt.ts)).

| Command | Route | Skeleton |
| --- | --- | --- |
| `take the cup on the table` | fast path | `text "take" \| span "cup on the table"` |
| `take cup off saucer` | fast path | `text "take" \| span "cup off saucer"` |
| `take coin out of box` | fast path | `text "take" \| span "coin out of box"` |
| `drop the cup in the box` | fast path | `text "drop" \| span "cup in the box"` |
| `get the cup on the table` | LLM (no room object is labelled "cup on the table") | see below |
| `get cup` (a cup in the room) | fast path | `text "get" \| span "cup"` |

**So the same qualifier is folded on one route and split on the other.** On the fast path a qualified take is one span with no BD-20 refusal, and the whole phrase goes to Identify as a name. On the LLM route the same phrase is split, and the take is refused as `multiObject` (see below).

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

## Not yet written

The worked world cases from the plan's Slice 0 bullets (two cups, draped cloth, one bag, cup/saucer/table (a)–(d), the qualifier-or-destination case, and the preposition table). They are pending the plan's repoint to a deterministic first iteration. That repoint changes which route each case is worked against.
