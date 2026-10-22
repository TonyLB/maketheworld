# Position-qualified referents: the Slice 0 corpus

**Companion to [`AGENT.positionReferents.planning.md`](AGENT.positionReferents.planning.md), written 2026-10-21.** It holds Slice 0's worked cases and nothing else. Open rows, the slice order and Progress stay in the plan. The plan's PR rows are decided, so this file checks them case by case rather than proposing answers. Where a case strains a decided row, it says so and the row's owner (the user) decides.

**Disposal:** this file is deleted with the plan. Before deleting it, check whether the C5 baseline (phrase naming, PR-3) and the C2 unreal-take baseline (PR-5) should move into the [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) shelves the plan names.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## How the baseline was taken

Each **Today** cell is either a code citation or a probe. **Probed 2026-10-21** means a throwaway integration test was run and then deleted. It used [`objectSpreadPayoff.integration.test.ts`](../../../../../lambda/ephemera/dataSource/objectSpreadPayoff.integration.test.ts)'s harness: the real `parseCommand` with its Bedrock seams mocked, then the real `commitAttempt` against mocked DynamoDB, with each world built by the same commands a player would type. The probe made two changes to that harness:

- **The catalogs are the production ones.** The room catalog comes from `ludicCacheRoomObjectHandles` over a cold `buildLudicCache` of the actor's room, and the held catalog from `getHeldInventoryCatalogForCharacter`. The checked-in harness passes catalog entries with no `presence`, so its `groundedPresence` is empty, which production's never is. Its three pinned cases (take rug, put plate on cloth, take rope) gave the same results either way.
- **The actor's room is a parameter**, which C3 needs.

**What the probe could not observe:**
- **Who receives narration.** The harness's characters row lists only the actor, so every line went to the actor alone. The witness audience is cited from code: `roomsForReferent` ([`presenceRooms.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceRooms.ts)) walks every `groundedPresence` entry up to its rooms.
- **LLM token streams.** For commands that take the LLM parse route, the probe supplied the token stream the parse prompt would plausibly produce. Those rows say so.

## Two facts every case leans on

**F1: the catalog's `presence` is a flat set, not a list of views.** `bucketsByMember` ([`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts)) lists two kinds of bucket for an object:
- each of the object's **own** bindings;
- each **host** binding whose cover holds one of them.

For example, a rope spread over the table, seen from the room, stamps `[ROOM/Base, Rope/Base, Rope/<new>, Table/Base]` (probed). The set does not say **which own binding sits under which host bucket**. So nothing downstream can tell "the part on the table" from "the part on the floor" without reading the object's own graph. Two more details:
- **A rope across two rooms lists both of its own bindings from either room.** From room B the set is `[NextRoom/Base, Rope/Base, Rope/far-end]`. The fold takes all of a host's bindings, so the end lying in room A is listed too (probed).
- **That one set feeds two readings.** It is stamped as `groundedPresence` and read both as *audience* (narration, `roomsForReferent`) and as *the part I mean* (`toGroundedPresence`, `moverGroundedPresence` and `buildExtendFragment` in [`commitAttempt.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/commitAttempt.ts)). This is the split PR-1 decided.

**F2: only a take of a multi-host object gets through.** `transferPreconditionFailure` ([`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts)) lets a multi-host object through only when the destination is the acting character. Every other transfer refuses as `multiPresent`.

The commit then takes the whole thing:
- it takes the object from every host (`multiHostTake`, `alsoLeaving`);
- it joins the bindings in hand under `Base`, so the cover of every part comes along (`resolvePresenceMoves.ts`'s convergence join);
- it dissolves the `ConnectedTo` edge between the joined bindings.

Separately, `from` grounds to the first container (`anyHost`, [`buildReferentAssignment.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/buildReferentAssignment.ts)).

## C1. One rope, two positions (rope spread over a table)

**World.** One room. A table, a chair and a rope lie on the floor, and the actor stands in the room. After `spread the rope over the table` (the real template), the rope has two bindings:
- `Rope/Base` under `ROOM/Base`;
- `Rope/<new>` under `Table/Base`.

The two are connected by `ConnectedTo`, and the table's graph holds `Rope -On-> Table`.

**Readings:** (a) the part on the floor, (b) the part on the table, (c) both.

| Command | Today | Under PR-1 to PR-5 |
| --- | --- | --- |
| `get rope` | One attempt with no question. The commit lifts both bindings, joins them into one binding under the character, and dissolves the edge. Narration: "picks up rope". The room header loses the rope (probed; pinned for the rug at `objectSpreadPayoff` "take rug"). This is reading (c) whatever the player meant. | **PR-2:** both parts are seen from the actor's room (the table is in the room), so the actor's position does not pick one, and the command asks: "the rope on the floor", "the rope on the table", and "both" if PR-4 offers it (see below). **PR-5:** (a) moves `Rope/Base` into the hand; `Rope/<new>` stays on the table and the edge stays. (b) is the mirror image. **PR-4:** (c) is today's take. |
| `drop rope` (not held) | Refused as `multiPresent` (`Error`, probed). The refusal is about being in several places, not about not holding the rope. | No view of the rope is held, so the refusal should be "not holding". It is not a question. |
| `put rope on chair` | Refused as `multiPresent` (`Abstain`, probed, LLM tokens supplied). Pinned parse-side for the broom (`parseCommand.test.ts` "put the rope on the broom"). | An ask, as for `get`. Then a move of the named part (PR-5's rule: an ordinary move of that binding). "Both" moves the whole, as PR-4 says. |
| `examine rope` | One narrate attempt with no question, carrying the full F1 set as `groundedPresence` (probed). It is a look, so there is no commit. The render was not probed. | No question either: a look of the whole is the sensible default. Not a consumer Slice 4 has to change unless the look names a part (PR-3's follow-on). |
| `look` | `LookRoom` (probed). The room header lists the rope twice, as a room-level object and as the table's content (pinned for the rug at `objectSpreadPayoff` "spread the rug"), per the [shelf](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) "the room header lists a spread Object twice". | Unchanged. |
| `take rope`, then `drop rope` | An ordinary single-host drop (probed). | Same. After a PR-5 take of one part this changes; see C3. |

**Narration.** Today: "Someone picks up rope". The audience is every room on the F1 set's walk. **Wanted:** a part take says which part ("picks up the end of the rope on the table"), and the room still sees the part left behind. **Requirement:** Slice 3's option labels and the narration's ref must render a *view*, not only a name.

## C2. Draped cloth with a plate on it

**World.** One room holding a cloth, a table, a plate and a cup. `drape the cloth over the table` (the real template) gives the cloth two parts:
- `Cloth/Base`, hanging under `ROOM/Base`;
- `Cloth/<new>`, lying under `Table/Base`.

They are connected. Then `put the plate on the cloth` puts the plate under `Cloth/<new>` by the deepest-part rule. This step is probed and also pinned at `objectSpreadPayoff` "a plate put on the cloth".

| Command | Today | Under PR-1 to PR-5 |
| --- | --- | --- |
| `get cloth` | One attempt with no question. The whole cloth goes into the hand, joined under `Cloth/Base`. **The plate comes with it**: the plate's binding moves into the survivor's cover, and `Plate -On-> Cloth` stays in the cloth's graph. The edge is dissolved, and the room header shows only the table and the cup. Narration: "picks up cloth" (probed; no test pins the plate). | **PR-2:** both parts are seen from the room, so the command asks. **PR-5, hanging part:** `Cloth/Base` goes into the hand, the table part stays on the table with the plate, and the edge stays. **Unreal:** the actor holds a hem while the cloth stays spread across the room. **PR-5, table part:** `Cloth/<new>` goes into the hand, and its cover goes with it, so **the plate is in the actor's hand**. **Unreal**, and shelved by PR-5. **PR-4, whole:** today's result, plate included. |
| `put cup on cloth` | The cup lands under `Cloth/<new>`, the table part. That is `destinationBindingForMove`'s deepest-part rule ([`resolvePresenceMoves.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/resolvePresenceMoves.ts)), with the real catalog's `presence` stamped (probed). The room header then lists the room-level cloth entry with contents `[plate, cup]`, and the table's contents as `[cloth]`. So **the header attributes the table part's contents to the cloth as a whole**, a second symptom of the double-listing shelf. | **PR-2:** both parts are seen from the room, so the command asks ("on the cloth on the table" or "on the cloth in the room"), and the deepest-part rule retires (the plan's Slice 4). This is the case the plan's Goal names as its payoff. |
| `examine cloth`, `examine table` | One narrate attempt each, with no question (probed). | Unchanged. |

**PR-5 baseline for the shelf.** The two unreal results are: the table-part take carries the plate into the hand, and the hem take leaves the cloth spread. Today neither is reachable, since a take is always of the whole.

## C3. A rope across two rooms

**World.** The rope's two bindings, connected:
- `Rope/Base` under `ROOM_A/Base`;
- `Rope/far-end` under `ROOM_B/Base`.

This uses the hand-built extend plus move from `objectSpreadPayoff` "rope carried into the next room", because no template produces it. The actor is in room B.

| Command | Today | Under PR-1 to PR-5 |
| --- | --- | --- |
| `get rope` from room B | One attempt with no question. **The whole rope is lifted out of both rooms**, joined in hand, and the edge is dissolved. Both room headers are left empty (probed). The `groundedPresence` was `[NextRoom/Base, Rope/Base, Rope/far-end]`: room A's end is listed even though it is seen only from A (F1). | **PR-2:** only `Rope/far-end` sits under the actor's room, so the command takes it without asking. **PR-5:** the far end goes into the hand, `Rope/Base` stays in room A, and the edge stays. |
| `get rope` from room A | Symmetric (pinned: `objectSpreadPayoff` "take rope"). | The mirror image: room A's end, with no question. |
| `drop rope` while holding one end | Unreachable today, because no take leaves one end held. | After the PR-5 take, the rope has two bindings: one under the character and one under room A. `drop` should drop the held end. The precondition must judge that view, because the rope is multi-host and `transferPreconditionFailure` would refuse it as `multiPresent` today. Whether the held end is in the room catalog depends on the actor's room: the room catalog never walks into character shards. The held catalog (`presencesHolding` on the character) lists it, and that is the view a drop names. |

**Reading (c) in C3.** PR-2 picks one end and PR-3 offers no phrase, so after Slice 4 a single command cannot take the whole rope from either room. The whole rope is still reachable in two takes: take B's end, walk to A, take A's end. Both bindings are then under the character, and today's convergence join (dissolve the edge, then join, in `resolvePresenceMoves.ts`) folds them into one. That last step is [OD-6](../positions/AGENT.connectedTo.planning.md#open-decisions-implementation--plan-only)'s ground, and its lean (contract connected bindings under one parent) gives the same result. This bears on the [take-rule shelf](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md)'s note that "a spread world can always be reset by taking the object". After Slice 4 that holds in C1 and C2 (the question offers "both", if PR-4 adds the option), but not in C3, which takes two commands.

## C4. Control: two cups, one on the floor and one on the table

**World.** Two cups, `Cup` on the floor and `Saucer` renamed "cup" after `put saucer on table`. They are two objects, each with one binding.

| Command | Today |
| --- | --- |
| `take cup` | A Consult with options `"cup"` and `"cup"`, both proposing "take the cup" (probed). Identical labels, as in the [shelf](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) "Option labels for same-named objects". |
| `take the cup on the table` | The deterministic take path does not check labels, so the skeleton is one span, `"cup on the table"`. Identity fuzzy-matches it to **three** options: `"table"`, `"cup"` and `"cup"` (probed). The phrase does not narrow; it widens the question to include the table. |
| `get the cup on the table` | The deterministic `get` needs the tail to be a room label, so the command goes to the LLM parse (tokens supplied: `get [cup] on [table]`). The membership template takes the first span, and compile refuses with `multiObject` ("multi-object manipulation is not implemented yet"; `compileAttemptsFromSkeleton.ts`, probed). |

**What the control shows.** Two same-named objects already reach a question, and they hit the same label gap as one object at two positions. A view label ("the cup on the table") would fix both, so Slice 3's labels should come from the referent's position whether the ambiguity is between objects or between views of one object. "The cup on the table" works nowhere today. `take` and `get` fail differently on the same phrase.

## C5. Naming a position by phrase (the PR-3 baseline)

World: C2 after the drape. Parse only.

| Command | Today |
| --- | --- |
| `get the cloth on the table` | `multiObject` refusal, as in C4 (LLM tokens supplied, probed). |
| `take the cloth on the table` | A Consult between `"cloth"` and `"table"`, the one-span fuzzy match from C4 (probed). |
| `put the plate on the part of the cloth over the table` | `Unimplemented`. With the supplied three-span token stream (`put [plate] on the part of [cloth] over [table]`), no Plan template matches and nothing compiles (probed; the real LLM's tokens may differ). |

**For the follow-on task:** the phrase is a qualifier on neither route. On `take` it becomes part of the span and widens identity; on `get` it becomes a second object span and is refused. The follow-on starts from these two behaviours.

## Requirements read off the corpus

| # | Requirement | Slice | Row it bears on |
| --- | --- | --- | --- |
| R1 | The view field names **the object's own bindings**. Every view in C1 to C3 is a set of the referent's own bindings, never a host bucket, so the host is the referent's `groundedId` and need not be repeated. | 1 | PR-1 (confirms); also the `extendedBindingUuid` question below |
| R2 | Offering views needs **each own binding paired with its parent buckets**. F1's flat set cannot say which binding is on the table, so Slice 2 reads the object's graph, or the handle grows a per-binding entry. | 2 | PR-2 |
| R3 | **PR-2's predicate, made structural:** an own binding is *at the actor's position* when walking its parents reaches the actor's room without passing through another room. When exactly one binding qualifies, the command takes it without asking (C3). When several qualify (C1, C2), it asks. The Goal's payoff (the cloth over the table asks) requires *reaches the actor's room*, not *parented directly by the room's binding*: the second would pick the floor part in C1 and C2 and never ask. For a held object, the held binding is the actor's position (C3 drop). | 2 | PR-2 (sharpens) |
| R4 | Two bindings under the same parent are one reading. No case staged this: the kernel forbids it today (OD-6). | 2 | PR-2 (untested; record, do not build) |
| R5 | **Option labels name a view or a position**, and the same label source serves the two-cups control (C4). "Both" is offered whenever a view question is asked (C1, C2), because otherwise the whole-object take, the reset the take-rule shelf relies on, is unreachable in one command. | 3 | PR-4 (proposes the answer to its open half) |
| R6 | **Preconditions judge the view.** Every case here has a single view to move once one is chosen, so `multiPresent` stops refusing take, drop and put of a named view. Drop names the held view (C3), and a drop with no held view refuses as "not holding" (C1). | 4 | ConnectedTo Slice 4 item 3 |
| R7 | **Destination choice asks** when PR-2 cannot pick one part of a spread destination (C2 `put cup on cloth`), and `destinationBindingForMove`'s deepest-part rule retires. | 4 | PR-2 |
| R8 | **Narration of a part move names the part**, and the audience still reaches every room the object is seen from (C1). | 3--4 | PR-1 (audience stays `groundedPresence`) |
| R9 | Nothing in C1 to C3 needs a phrase. C4 and C5 record today's phrase behaviour as the follow-on's baseline. | --- | PR-3 (confirms) |
| R10 | PR-5's two unreal results are reachable only after Slice 4: a table-part take carries the plate, and a hem take leaves the cloth spread (C2). Both are recorded above as the baseline for the shelf. | 4 | PR-5 (confirms the crude rule is what it says) |

**Shape check.** The corpus raised no open question that blocks a slice: R3 and R5 sharpen decided rows, and R4 is recorded and deferred. The plan stays an implementation plan.

## PR-1's open half: does the view field subsume `extendedBindingUuid`?

**What `extendedBindingUuid` is.** It is a forward reference ([`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md), "A plan step may name a later step's referent before it exists"):
- `matchSpreadTemplate.ts` mints a `presenceUuid` for its extend step at Plan time, before grounding, and stamps it on the moved referent.
- At commit it becomes `moverBinding` ([`commitAttempt.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/commitAttempt.ts)).
- In the dry run (`attemptCandidates.ts`) it marks the move as a spread: the description reads "Spread …", and boundary expansion is skipped.

It exists apart from `groundedPresence` because a `GroundedPresenceBinding` carries the object's id as its host, which is unknown at Plan time.

**What R1 changes.** If the view field names only presence ids of the referent's own object, with the host implied by the referent's `groundedId`, then naming the new binding at Plan time is no longer blocked. The extended binding is a view whose single binding is `PresenceKey(presenceUuid)`. Two things still have to be told apart:
- the dry run must know that binding does not exist yet;
- the commit must not look it up in the live graph.

Both can be read off the attempt itself: an earlier `extend` step whose `presenceUuid` matches. No separate field is needed.

**Decided 2026-10-21 (user): subsume.** The view field is a list of the referent's own binding ids, and a forward-minted binding is a view that an earlier extend in the same attempt produces. `extendedBindingUuid` is deleted in Slice 1.
