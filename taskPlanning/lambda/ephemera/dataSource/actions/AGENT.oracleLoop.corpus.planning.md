# Oracle loop: evidence corpus

The evidence corpus of the [oracle loop plan](AGENT.oracleLoop.planning.md), in the design variant's [companion-file ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder). Cases are written against today's model, the built judge prompt ([v45](../../../../../lambda/ephemera/calibration/AGENT.md#the-built-judge-prompt-v45)) on Nova Micro, and say which limit they hit. **No solutions here:** candidate fixes live in the [proposal record](AGENT.oracleLoop.proposals.planning.md), and rows argue from these cases.

Case IDs (`OC-n`) are stable and never reused.

## Measured cases

Moved from the judgeFailures plan on 2026-11-07. Fixtures and requests are in [`judgeRequests.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/judgeRequests.ts) and the `teaTable` scene fixtures. "v45" counts are replies on the built prompt, 2026-11-06; "v28" is the earlier baseline, for comparison.

### `teaTable`: a small round tea table, with a saucer and cup on it and a teapot glued to it

| ID | Request | Expected | v28 | v45 | Limit it hits |
| --- | --- | --- | --- | --- | --- |
| OC-1 | Pick up `[table1]` | `simple` (tolerates `complex`) | `simple` ×2 | `simple` ×2, `complex` | None. Was the false refusal v28 fixed; `complex` cites the teapot moving with the table |
| OC-2 | Pick up `[cup1]` | `simple` | `simple` ×2 | `simple` ×3 | None |
| OC-3 | `[table1]` in `[cup1]` | `impossible` | `impossible` ×2 | `impossible` ×3 | None on the label. The dry run refuses this as a containment cycle, since the cup sits on the table, so it never tests fit; see OC-11 |
| OC-4 | Slide `[saucer1]` across `[table1]` | `simple` | `simple` ×2 | `simple` | None. Changes nothing recorded, so a proposal's "after" equals its "before" |
| OC-5 | Pick up `[teapot1]` | `obstructed` | `obstructed`, `impossible` | `obstructed` ×2, `simple` | **Noticing the from-and-to.** Across v41 to v45, `obstructed` 8 of 8 when `Picture` says the teapot would go from the table to being held, 0 of 5 without. Without it, `Rules` gives `No consequence`. The dry run refuses the literal move (`securedToBlocksMove`) |
| OC-6 | Pour from `[teapot1]` | `obstructed` | `obstructed`, `simple` | `simple` | **An action never pictured.** No reply on any draft considers the teapot tilting, and the rule's verdict answers about the end state ("does not affect this rule"). Holds a legal proposal (all the pot's tea into the cup), which the dry run passes |
| OC-7 | Wipe `[table1]` with a cloth | `contingent` | `simple` ×2 | `contingent` ×6 | None on v45. The only case of an otherwise simple action needing an unestablished thing |
| OC-8 | Pry `[teapot1]` off with a screwdriver | `contingent` (tolerates `obstructed`) | `obstructed` ×2 | `contingent` | **A plan aimed at the obstacle.** Note 29 wants `Obstacle: nothing`, `Needs: screwdriver`, `Revises: glued`. v44 gave `obstructed` ×2 by naming the glue as the obstacle. Whether Micro pictures a crowbar may decide it (unprobed) |

### `tavern`: a long oak trestle, no Rules section

| ID | Request | Expected | v28 | v45 | Limit it hits |
| --- | --- | --- | --- | --- | --- |
| OC-9 | Pick up `[table1]` (a long oak trestle) | `simple` (tolerates `complex`) | `impossible`, `simple` | `complex` ×2 | **A feat the labels can't name.** `complex` stands in for "possible, and hard" ([Question 1](AGENT.oracleLoop.proposals.planning.md#question-1-a-feat-the-labels-cannot-name), JF-2) |
| OC-10 | Pick up `[cup1]`, pick up `[candle1]`, put `[hammer1]` on `[table1]` | `simple` | `simple` ×2 each | `simple` ×2 each | None. The hammer case leaves out picking the hammer up, and rightly stays `simple` (JF-11) |

### `teaTableCupOnFloor`: the same parlour with the cup on the floor

| ID | Request | Expected | v45 | Limit it hits |
| --- | --- | --- | --- | --- |
| OC-11 | `[table1]` in `[cup1]` | `impossible` | Not yet run | **A legal move that the fiction refuses.** With the cup off the table, the dry run passes the move, so only world knowledge of size can refuse it. It is the size case OC-3 can't be |

### With a proposed outcome shown

On 2026-11-06, with the proposal block on (`after`/`fiction`), table, cup and pour, 3 repeats: 6 pass, 3 wrong `simple`, all pour's. No reply uses anything only the block says, and `Revises` says "nothing" on all 9 with the changed relation stated just above it. This bears on every case below that shows a candidate.

## Cases to write (Phase 0)

From the discussion of 2026-11-06 and 2026-11-07, and from judgeFailures' Supporting work. Each has to be written against today's model before any row argues from it. Most need a new scene or request, so some need a deploy.

- **Pour, with a candidate history:** the finished answer "the teapot is glued, you can't pour" as the answer-to-beat, and tipping the table as a candidate that breaks an invariant nobody called (the saucer and cup slide off).
- **The dungeon teapot and the doll-house teapot:** "pour the tea" in a scene where the glue is a puzzle ("you need to pour tea to proceed further into the dungeon") and in one where it is texture (high tea with the Marie Antoinette doll).
- **The dungeon teapot, with the player's own method:** "I tip the table to pour", a found out.
- **The Jungle Tavern:** the roof (implied absent, never stated), soup bowls and soup spoons.
- **The chasm and the broken bridge:** "We're going across the chasm on the bridge", then the arrow and rope.
- **The kitsch-horror mansion:** a bowl of patchouli, against the plain creepy mansion.
- **A second `contingent` request,** such as wiping `[saucer1]` with a napkin.
- **A part of an established thing,** such as lifting the teapot's lid: `simple`, tolerating `contingent` and `complex`.
- **A `Class` request,** with nothing specific to suggest, such as cutting string with something.
- **Table in cup with a hammer,** a pry with an established tool, a request about something held (the one explicit negative in the scenes: "You are holding nothing"), and a gibberish request. Whether gibberish reaches the judge in production is unchecked.
- **Something that moves nothing,** such as lighting a candle.
- **A securing that crosses frames,** such as a teapot on a table chained to the wall, where lifting the table really is blocked.
