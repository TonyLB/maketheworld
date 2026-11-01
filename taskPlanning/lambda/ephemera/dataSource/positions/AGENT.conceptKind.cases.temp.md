# Concept kind: worked cases (temporary)

Worked cases for [the Concept kind plan](AGENT.conceptKind.planning.md)'s Slice 0. **Delete this file when the slices' tests pin the cases**, after the plan's graduation sweep for inbound links.

## AK-1: the kind is not "whole"

**The lock being tested.** [Whole and part are roles, not kinds](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06): any rule that gives parts and wholes different behaviour is not a rule, because one object is both, at different levels, at once. EP-2a was closed partly on this ground: a tag meaning *this Object is an abstraction* looked like such a rule.

**The test.** The new kind passes if every rule it carries is keyed on what a component *is* (physical or conceptual, AK-5), and no rule is keyed on whether it is the whole or the part in a given hosting edge. It fails, and the plan stops, if any case makes something a Concept *because* it is an assembly of other things.

**The structural check, before the cases.** AK-4's pairing rule decides the hosting kind from the **unordered pair** of the two sides' kinds: Concept with Concept is `PartOf` or `SectionOf`; physical with Concept is `Associated` *with either side hosting*; physical with physical is a physical kind. Swapping host and member never changes the answer. So the rule cannot give a whole and a part different behaviour, which is exactly the property the lock asks for. "Never placed" (AK-4's consequence) and "present where a member is" (AK-3) attach to every Concept, whether it hosts or is hosted.

### C11: the Rube Goldberg machine

[C11](AGENT.abstractionLayers.corpus.planning.md#c11-the-rube-goldberg-machine): `RubeGoldbergMachine` with parts `Platform`, `String`, `Monkey`, `IroningBoard`, `AlarmClock`; the string crosses `ROOM#A` and `ROOM#B` and has parts of its own, down to spans.

- **Every component in the chain is physical.** The machine, the string, the span and the sub-spans can all be pointed at, carried in principle, and broken. None is conceptual, so by AK-5 none is a Concept. The chain stays Objects under `PartOf`, exactly as C11 records it, with every interior term both a part and a whole.
- **The machine spanning two rooms does not make it abstract.** It has a binding in each room, each binding's parents on one host, so it satisfies AK-2's physical-forest invariant as an Object. Multi-presence is several bindings, not a binding with several hosts.
- **Position-relativity (contraption from `ROOM#A`, furniture from `ROOM#B`) stays a presentation question**, as the plan's prior-record bullet already says. It is not a reason to mint a Concept, and the kind is not used to answer it.
- **The machine's purpose** (startle, ride, fall, alarm) *could* be authored as a Concept associated with the pieces. That would be a second component, conceptual by kind, alongside the physical machine; it would not replace the machine, so it is not the kind meaning "whole".

**Verdict: passes.** The kind is not used anywhere in C11, and the case's four-level whole/part chain is untouched.

### A nested Concept

The Moonbase Control System hosts a Life Support Subsystem (`PartOf`), which hosts an Air Recycling module (`PartOf`); the module is `Associated` with a physical scrubber in the hydroponics bay.

- **The subsystem is a part of the system and a whole of the module, at once**, under the same Concept-to-Concept kinds that Objects use with each other. Whole and part are roles inside the kind, as they are among Objects.
- **The system and the module carry the same rules**: never placed, present where a member is. Neither gains or loses a rule by being the outer or the inner one.

**Verdict: passes.**

**An observation for Slice 3, not part of AK-1.** By AK-3 the hydroponics bay gets a presence binding for "the Concept its scrubber is associated with". With nesting, which Concept's binding sits in the room's row: the module's, or the outermost system's, carrying the subsystem and module beneath it, as a physical whole's room binding carries its parts? The analogy with physical wholes suggests the outermost. This is a rule for the alignment step (AK-10, Slice 3's pure alignment rule), and the case belongs with Slice 3's tests.

## AK-1 result

Both cases pass. The kind marks physical against conceptual and never whole against part, and EP-2a's re-open trigger is met by AK-5's named need. The Slice 0 inventory applies the same test to each existing Object it lists: an Object becomes a Concept only if it is conceptual by kind, never because it is an assembly.

## Inventory

Swept 2026-11-01: every `OBJECT#` id in `lambda/` and `packages/` (about 240 distinct, tests and production), the repo's `.wml` files, the corpus cases the plan names, and Coyote's staged content. **Production code special-cases no Object that might be a Concept**, by id or by name. Hosting kinds are not set in any code fixture below; they are bare nodes, bindings or container lists.

| Where | Id(s) | Role today | Verdict | Why | Re-expression cost (Slice 6) |
| --- | --- | --- | --- | --- | --- |
| [PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice) (corpus only) | `OBJECT#InheritedFurniture`, `OBJECT#Boardgames` | Two parents of the chest in the attic, each seeing different contents | **Concept** | A collection and a category: conceptual by kind | New fixture (below) |
| [`presenceParentSets.payoff.test.ts:41-61`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/presenceParentSets.payoff.test.ts) | `OBJECT#SteamerChest`, `Backgammon`, `Chess`, `Die`, `SpareDie` | **The test leaves out both Concepts:** the chest's bindings `chestA`/`chestB` are parented directly on `ROOM#Attic`, and it runs beats 2 and 3 only | Stay Objects | Physical things | None to the test itself, which stays as the physical-only case. Re-expressing PR-C5 means a **new** fixture that inserts the two Concepts between the attic and the chest, the chest's bindings `Associated` under them (AK-4(b)). Beat 1's per-association covers wait on the association-covers question (AK-3) |
| [`findShardBoundary.test.ts:103-110`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/findShardBoundary.test.ts) | `OBJECT#PlaceSetting` | Second container of the cup, beside `OBJECT#Table`, both in the room | **Stays an Object (user, 2026-11-01)**; the fixture's direct cup-on-table membership is the slip | The cup is `PartOf` the place setting and on the table **transitively**, through the place setting's binding on the table. See [the cup in the place setting](#the-cup-in-the-place-setting) | The fixture as drawn is a state AK-2 says does not occur. The test's point (walking through a multiply-contained intermediate) survives only if the second container is an association, so Slice 6 re-expresses it that way rather than dropping the case |
| [`resolvePresenceMoves.test.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/resolvePresenceMoves.test.ts) M7 | `OBJECT#Backgammon`, `OBJECT#Die` | The set has bindings in `ROOM#Bridge` and `ROOM#Galley`; the die has one binding under both | Stay Objects | Physical. The die's parents are both on one host, so AK-2 holds | None |
| mtw-wml `ludicGraph.test.ts:210`; `expandBoundaryChallenges.test.ts:343`; the name-grounding fixtures (`phraseCoveragePayoff.integration.test.ts` and siblings) | `OBJECT#contraption`, `OBJECT#Breadboard`, `OBJECT#ManInTheMoon`, `OBJECT#PigInABlanket`, and the rest | Physical wholes, parts, placeholders | Stay Objects | Physical | None |
| The primer's running example ([`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md#the-running-example)) | `OBJECT#Contraption` | Whole with the box's spring `PartOf` it, while the spring is `In` the box | **Either, by the author's choice (user, 2026-11-01)**: a Concept with the spring directly in the box, or an Object in the box with the spring under its binding there | The example as drawn (the spring a direct member of two physical hosts) is neither, and breaks AK-2. See [the primer's spring](#the-primers-spring-two-valid-modellings) | The primer's section 3 is redrawn on one of the two modellings, keeping "the contraption is an abstraction" (true of both, in the role sense) and saying which kind it is |
| [C4](AGENT.abstractionLayers.corpus.planning.md#c4-the-place-setting-at-the-faerie-court); EP-2's configurations ([edgeAbstractions proposals](AGENT.edgeAbstractions.proposals.planning.md#the-ep-2-proposal)) | `PlaceSetting`, `DiningUtensils`, `UtensilLayout`, `HeirloomSilver` | Groupings of plate, fork, knife and cup on a table, differing in where nodes and edges are hosted | `PlaceSetting`, `DiningUtensils`: **stay Objects**, physical wholes on the table with their members placed transitively through them, as in [the cup in the place setting](#the-cup-in-the-place-setting). `HeirloomSilver` and the edge-only `UtensilLayout`: left to the "Edge abstractions" question | A gathering of physical pieces that sits on the table is a physical whole there | Corpus only; no code |
| [C10](AGENT.abstractionLayers.corpus.planning.md#c10-the-moonbase-computer-system) | `MoonbaseComputer`; `DesignLibrary`; `Terminal1`, `Terminal2`, `DoorCtl3`, `Drone2` | The system with parts scattered across rooms; the library in no room | **System and library: Concept.** Terminals, door control, drone: stay Objects | The system and a body of information are conceptual (AK-5); the hardware is physical | Corpus only; worked [below](#ak-4-and-ak-5-the-moonbase-computer-and-its-design-library) |
| [C11](AGENT.abstractionLayers.corpus.planning.md#c11-the-rube-goldberg-machine) | `RubeGoldbergMachine` and its chain | Four-level physical whole/part chain | Stay Objects | [Graded above](#c11-the-rube-goldberg-machine) | None |
| [C12](AGENT.abstractionLayers.corpus.planning.md#c12-the-moonbase-power-system-and-the-cut-cable) | `PowerSystem` (generator, trunk cable, branches) | A causal network of physically connected parts | Stays an Object | Physically continuous, like a rope: the cable joins the pieces. The door "attached to" it is a peer relation, not membership | Corpus only |
| [C15](AGENT.abstractionLayers.corpus.planning.md#c15-the-microphone-the-wire-and-the-speaker-two-rooms-away) | The recognised intercom | A whole minted in play over spliced physical parts | Stays an Object if minted | Physical splices. Minting in play is out of this iteration (recognition and minting) | None |
| Coyote | Staged ACME objects (`coyoteRoomObjectSnapshot.ts`, `coyoteEngineTestFixtures.ts`, `spawnImprovisationObjectsBatch.ts`) | Improvised physical items | **Not affected** | Every staged object is a physical item; intake refuses conceptual orders (`actions/baseClasses.ts:68-70`, `Not a thing` / `Not tangible`). Coyote's groupings (trope `members`, phase-plan `virtualEntities`, the `setting` key) live in plan JSON, not the graph | None |
| Authored WML | `lambda/assets/tests/*.wml`, `packages/mtw-wml/ts/dungeon.wml` | --- | Not affected | None of the three files has an `<Object>` | None |

**A wording site for Slice 1:** the `HOSTING_KINDS` doc comment ([`ephemeraMeta.ts:476-481`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) describes composition as "the host read as an abstraction". That is the role sense, and it stays right once `Associated` exists (an earlier draft of this note called it wrong; superseded by the rename to `Concept`, user 2026-11-01). Slice 1 extends it: under `Associated` the Concept side is the abstraction, whichever side hosts.

## AK-2: the physical-forest invariant over the cases

**The rule being checked** ([AK-2](AGENT.conceptKind.planning.md#open-decisions-implementation--plan-only)): drop every Concept node; then each remaining binding's parents all belong to one host. A binding may have several parents on one host (a join, a shared set).

### The rope end on a table

The rope lies across a table, one end hanging off. The rope's binding into the table sits under the table's binding; the end is a `SectionOf` part of the rope, read through the rope's binding, and has no binding into the table of its own. **One parent host. Passes.**

### The plank on two sawhorses

A spread plank: two bindings, one under each sawhorse's binding, each with one parent. **Passes.** Multi-presence is several bindings, each with its own one host, never one binding with parents on two hosts, which is the same point [C11's machine](#c11-the-rube-goldberg-machine) makes across rooms.

### PR-C5 re-expressed

`CONCEPT#InheritedFurniture` and `CONCEPT#Boardgames` each hold a binding in the attic (AK-3). The chest's two bindings sit under them, `Associated`: `chestA` under Inherited Furniture's, `chestB` under Boardgames'. The Backgammon set's one binding has parents `{chestA, chestB}`.

- **The set's binding:** both parents are bindings of the chest, one host. Passes, with or without dropping the Concepts.
- **The chest's bindings:** each parent is a Concept's binding, so after the drop they have no physical parent. That is not a violation (the invariant constrains parents that remain), but it is a finding: **the chest has no physical placement in the attic.** It is there only through its associations, which is what the corpus case says ("it is in the attic only through them").
- **For the scene plan:** the physical forest of the attic is empty of the chest, so SP-2's renderer reaches the chest only as an associate of the two collections. Either that is right (the fiction never placed the chest on the floor), or the case wants a physical binding too. Handed to the scene plan as a question, not a gate here.

**Passes.**

### The cup in the place setting

[`findShardBoundary.test.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/findShardBoundary.test.ts)'s fixture: the cup is a member of the table and of the place setting, both in the room. **As drawn, the cup has physical parents on two hosts, so it fails.** It is the one shipped fixture that breaks the invariant.

**The modelling (user, 2026-11-01):** the place setting is an Object, `On` the table; the cup is `PartOf` the place setting, and is on the table **transitively**: the cup's binding sits under the place setting's binding, which sits under the table's. **One parent host at each level. Passes.** The direct cup-on-table membership was the slip, not the place setting's kind.

### The primer's spring: two valid modellings

The primer's [running example](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md#3-multi-hosting-containment-is-a-dag) has `OBJECT#Spring` `In` the box and `PartOf` the contraption, both Objects in the Lab: **two direct physical parent hosts, so it fails as drawn.** Two modellings pass (user, 2026-11-01), and choosing between them is the author's call, not a rule:

- **The contraption is a Concept**, and the spring is directly `In` the box. The spring's membership in the contraption is `Associated` and drops out of the physical view.
- **The contraption is an Object** in the box, and the spring is in the box **transitively**: its binding sits under the contraption's binding in the box, as the cup's does under the place setting's.

### What the two cases share

A thing that looks like it has two physical hosts is placed in one of them **through** the other, or one of the hosts is a Concept. Neither case needs the invariant changed or a host reclassified by rule. Which modelling to use is an authoring decision, made on what the fiction says (is the mechanism a physical thing sitting in the box, or a concept its parts take part in?).

### A join under a multi-binding host

A host with two bindings in one room (a draped cloth); a child's two bindings converge and join into one with both cloth bindings as parents. **One parent host. Passes**, as AK-2 decided. The scene renders it once, under the cloth.

## AK-4 and AK-5: the moonbase computer and its design library

`CONCEPT#MoonbaseControlSystem` hosts:

- `OBJECT#Terminal1` (Docking Ring) and `OBJECT#Terminal2` (also Docking Ring), `OBJECT#Terminal3` (the mess): `Associated` (AK-4(b));
- `CONCEPT#DesignLibrary`: `PartOf` (AK-4(a)), a body of information, and so a Concept by AK-5;
- the Life Support Subsystem chain of [the nested case](#a-nested-concept): `PartOf`.

**Room bindings (AK-3).** The Docking Ring holds one binding of the system, and both terminals' `Associated` bindings sit under it: two members, one shared system binding, which is Slice 3's alignment test. The mess holds a second system binding with Terminal3 under it.

**The library.** It has no room binding, which is correct by AK-5: it is relevant wherever the system is, and is nowhere physically. **Totality:** the coverage invariant (positions contract, [Presence nodes](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path)) needs every node of the system's graph covered by some binding of the system. The library is covered by the system's `PRESENCE#Base`, which is hostless (the system's room bindings are not Base; the system was never placed, only associated). That is the shipped rule ("a thing present nowhere ... holds a hostless Base"; Base "takes every context-free add"), so **no new rule is needed.** It matches the [C10 annotation](AGENT.abstractionLayers.corpus.planning.md#annotation-2026-10-11-an-intangible-member-the-database-library)'s remainder reading, with Base in the place of the retired remainder.

**Pairing checks.** Terminal to system: physical with Concept, `Associated`. Library and subsystems to system: Concept with Concept, `PartOf`. The system to a room: Concept with physical, `Associated`. No Concept is `In`, `On` or `Held`. **Passes.**

**Not received:** the scene plan's worked scenes (its Slice 0 has not started). They are owed to this file as further AK-2 cases when written.
