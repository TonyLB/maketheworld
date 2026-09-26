# Slice 0 worked examples (temporary --- delete once slice 1 pins these as test fixtures)

Six commands from [iteration 2's step-0 corpus](AGENT.objectManipulationIterations.planning.md#step-0-corpus-started-2026-09-24), hand-written against CA-1's six-section format. Referent glosses use the settled register from the reasoning-gloss plan (comma-spliced noun-phrase fragments, plain physical facts, no flavour language; graduated to `lambda/ephemera/dataSource/actions/AGENT.concepts.md`'s `CommandAttempt` section, 2026-09-26) --- confirmed shipped, `EphemeraLudicCacheNode.gloss?: string` (`positions/ludicCache/types.ts:50`).

Each example shows the six sections in order: (1) words, (2) referents, (3) state, (4) room context, (5) actions, (6) result. Section 3 is always empty (no state axis exists yet) but the heading is always present, per CA-1.

---

## Row 2 --- `get gigantic boulder`

**Setup:** boulder in room, no relational edges on it.

1. Player's words: `get gigantic boulder`
2. Referents:
   - `boulderRef` -> `OBJECT#Boulder1`, "a gigantic boulder", gloss: "granite, easily as tall as a person, half-sunk in the dirt"
3. State: (none)
4. Room context: `ROOM#Quarry` --- nodes: "a gigantic boulder", "a rusted pickaxe". Edges: none.
5. Actions:
   - desired result: `boulderRef` -> `actingCharacter`'s current host (acquire)
   - challenges: **none detected**. No boundary edge touches the transfer, so the fast path finds nothing to adjudicate. The gloss's weight fact is present in section 2 for a future detector, but nothing in today's structured attempt reads it --- this is the "invisible until built" case CA-6 names.
6. Result (before): `pending`
6. Result (after, today's stub *and* Coyote preparation): `succeeded: the boulder is in the character's possession.` Manner ("painstakingly") is narration's business, not this section's --- it has no home in the structured attempt at all today.

**What this confirms:** an undetected world-knowledge challenge costs narration its manner only, exactly as the plan's Why section predicts. The format doesn't need a new field for this row; it needs nothing done to it at all.

---

## Row 5 --- `put motorcycle on shoebox`

**Setup:** both in room, no relational edges.

1. Player's words: `put motorcycle on shoebox`
2. Referents:
   - `motorcycleRef` -> `OBJECT#Motorcycle1`, "a motorcycle", gloss: "steel and rubber, about seven feet long, several hundred pounds"
   - `shoeboxRef` -> `OBJECT#Shoebox1`, "a shoebox", gloss: "cardboard, about a foot long, empty"
3. State: (none)
4. Room context: `ROOM#Storeroom` --- nodes: "a motorcycle", "a shoebox", "a workbench". Edges: none.
5. Actions:
   - desired result: establish `On(motorcycleRef, shoeboxRef)`
   - challenges: **none detected today** --- no size or weight check exists anywhere in the graph, so the fast path finds this as trivial as row 2.
6. Result (before): `pending`
6. Result (after, **today's actual code**): `succeeded: the motorcycle is on the shoebox.` --- this is the bug CA-6 exists to fix, made concrete: nothing today refuses it.
6. Result (after, **target once CA-6 ships a detector**): `impossible: putting the motorcycle on the shoebox is impossible --- a motorcycle far outweighs an empty shoebox.`

**What this confirms:** section 2's gloss already carries exactly the two facts (`several hundred pounds` vs. `empty`, `cardboard`) a world-knowledge detector would need to distinguish this row from row 2. The prose format needs no new section for CA-6 --- only new code that reads section 2 and writes an `impossible` verdict into section 6. This is the strongest evidence slice 0 produces that CA-1's leaning is sufficient as recorded.

---

## Row 3 --- `place fork to the left of plate`

**Setup:** both in room, no relational edges.

1. Player's words: `place fork to the left of plate`
2. Referents:
   - `forkRef` -> `OBJECT#Fork1`, "a fork" (no gloss --- nothing about it matters here)
   - `plateRef` -> `OBJECT#Plate1`, "a plate" (no gloss)
3. State: (none)
4. Room context: `ROOM#Kitchen` --- nodes: "a fork", "a plate", "a table". Edges: none.
5. Actions:
   - desired result: establish `Custom(forkRef, plateRef, relationLabel: "to the left of")`
   - challenges: **none** --- this is a fresh establish, not a boundary edge being displaced by a move. Nothing defers.
6. Result (before): `pending`
6. Result (after): `succeeded: the fork is to the left of the plate.`

**What this confirms:** an opaque `Custom` label needs no challenge wording at all when nothing defers on it --- "is there a challenge?" is answered before wording ever comes up. This row is the control case against row 6.

---

## Row 6 --- `get rope` (rope lashed to a post)

**Setup:** `OBJECT#Rope1` has a `Custom` edge to `OBJECT#Post1`, `relationLabel: "is lashed to"` (real fixture string, `healLudicGraphPortMismatch.test.ts`).

1. Player's words: `get rope`
2. Referents:
   - `ropeRef` -> `OBJECT#Rope1`, "a coil of rope" (no gloss needed)
3. State: (none)
4. Room context: `ROOM#Dock` --- nodes: "a coil of rope", "a wooden post". Edges: "a coil of rope" is lashed to "a wooden post".
5. Actions (expansion adds the second, per [Target shape](AGENT.commandAttemptPhase.planning.md#target-shape)):
   - action 1 --- desired result: dissolve `Custom(ropeRef, postRef, "is lashed to")`. Challenge: **"the rope is lashed to the post; that lashing must be undone."** Wording is read directly off `relationLabel` (`boundaryEdgeOutcomes` attaches the full edge to its `defer` outcome, `interactionUnderTransfer.ts:160-164`) --- no synthesis needed.
   - action 2 --- desired result: `ropeRef` -> `actingCharacter`'s current host (acquire). Challenge: none --- this action has no boundary edge of its own once action 1 clears.
6. Result (before): `pending`
6. Result (after, Coyote preparation --- every challenge met): `succeeded: the rope is untied and taken.`

**What this confirms:** the `Custom` half of CA-1's open wording question is answered --- `relationLabel` phrases directly, with no code needed to synthesize a sentence. The `Under` half stays open: none of these six rows produces an `Under`-defer case, so there's no evidence here either way for the "X is under Y; Y would have to move" synthesis the plan's Target shape speculates about. Recorded as still open, not assumed.

---

## Row 8 --- `throw crumpled paper at waste-basket`

**Setup:** both in room, no relational edges.

1. Player's words: `throw crumpled paper at waste-basket`
2. Referents:
   - `paperRef` -> `OBJECT#Paper1`, "a crumpled ball of paper" (no gloss)
   - `basketRef` -> `OBJECT#Basket1`, "a waste-basket" (no gloss)
3. State: (none)
4. Room context: `ROOM#Office` --- nodes: "a crumpled ball of paper", "a waste-basket", "a desk". Edges: none.
5. Actions:
   - desired result: `paperRef` ends up inside `basketRef` (containment --- excluded from v1's `establishRelation`, so this desired result has no primitive to compile to yet; today's code has no template verb for `throw` at all and falls through unimplemented).
   - challenges: none detected (nothing to dissolve).
6. Result (before): `pending`
6. Result (after, once mapped): `succeeded: the paper is in the waste-basket.`

**What this confirms:** the plan's own motivating contrast. This row's *intended outcome* (section 5's desired result) is identical to `put paper in basket`'s; its *manner* ("thrown," "crumpled") lives only in section 1's verbatim words and nowhere else in the structure --- exactly the resemblance-without-collapse the Why section argues for. No new section is needed to carry manner; it was never meant to be structured.

---

## Row 9 --- `smell the flower`

**Setup:** flower in room.

The attempt path is never entered. `smell` is a read-only perception command, not an object-manipulation family member, so no `CommandAttempt` is built at all --- there are no six sections to write for this row. This is the fixture that pins the *boundary* of the attempt path, not a fifth format variant.

---

## Summary: what slice 0 settles

- **CA-1's leaning is confirmed as recorded**, with the "still open" wording bullet narrowed rather than closed: `Custom` challenges phrase directly off `relationLabel` (rows 3, 6); `Under` challenges have no example forcing an answer here and stay open.
- **CA-2's before/after convention is confirmed**: a single delimited result section, `pending` before adjudication, `succeeded: <outcome>` / `impossible: <reason>` after --- both readable directly off the six worked examples above with no format change needed.
- **Row 5 is the one row that exposes a live discrepancy** between today's code (silently succeeds) and the genre rule (must reject) --- this is CA-6's job, not this slice's, but the worked example is the concrete evidence that the gloss field already carries what a detector would need.
