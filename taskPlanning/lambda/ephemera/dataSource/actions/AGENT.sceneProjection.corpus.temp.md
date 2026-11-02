# Scene projection: Slice 0 worked scenes (temporary)

**Temporary.** This is the worked-scene corpus for Slice 0 of [`AGENT.sceneProjection.planning.md`](AGENT.sceneProjection.planning.md). It will be deleted in Slice 2, once the golden tests pin the same renders and the scene fixtures hold the same question sets. If anything here is worth keeping, move it into the plan's rows first.

Each scene has five parts:
- a cache setup;
- its expected render in each candidate format: A (indented tree), D (indented tree with a parent clause) and Blocks;
- a typed question set with expected answers (SP-8);
- a check against the physical-forest invariant;
- notes.

Expected answers are written from the setup, not from the renders.

**Since Slice 1 the setups and question sets live in code**, in [`positions/ludicCache/sceneFixtures/`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/sceneFixtures/index.ts), with each question's answer computed from the scene model. That code is the authority for setups and questions; this file still holds the hand-written renders until Slice 2's golden tests pin them. Two fixtures were added there with no renders here yet: `join` (SP-9) and `feature` (SP-4 as amended).

## Conventions

Every format shares these. Only the way nesting is shown differs between them.

### Handles (SP-1)

- **Spelling:**
  1. Take the reasoning `shortName` and lowercase it.
  2. Drop apostrophes.
  3. Replace each run of anything other than a letter or digit with one hyphen.
  4. Trim leading and trailing hyphens.
  5. Append a counter. It is always added, even to a lone thing (`[cup1]`). If the slug ends in a digit, put a hyphen before the counter (`Room 101` → `[room-101-1]`).
  - Examples: `Steamer Chest` → `[steamer-chest1]`; `Old Man's Hat` → `[old-mans-hat1]`.
- **A node with no `shortName`:**
  - Its slug comes from its tag, lowercased (`[object1]`).
  - Its name is written `(unnamed object)`.
- **Numbering:**
  - Counters number things that share a slug.
  - The order is a depth-first pre-order walk of the scene model, with siblings in cache cover order.
  - The walk goes in section order: room contents, then Concepts, then held inventory.
  - A thing is numbered where it is *placed*, not where it is first *mentioned*. A relation can name `[bag1]` before the bag's own line.
  - A spread object (several bindings) has one handle across all its lines.
  - This order doesn't depend on format: Blocks moves lines around but uses the scene model's numbering.

### The parts held constant

The parts appear in this order, and a part with nothing in it is left out:

1. **Heading:** `The Tavern` or, when the room has a gloss, `The Tavern: <gloss>`. The room has no handle (see [Questions](AGENT.sceneProjection.planning.md#questions-this-iteration-should-surface), "Handles for the room and the actor").
2. **Room contents:**
   - A and D: `Contents of the Tavern:` followed by a list.
   - Blocks: `In the Tavern:` followed by an inline list.
   - An empty room reads `Contents of the Tavern: nothing.` in A and D, and `In the Tavern: nothing.` in Blocks.
3. **Concepts:** `Concepts here:`. One line per Concept with its handle and name. Concepts are never placed, and their members point to them.
4. **Held inventory:** `You are holding:`. Empty reads `You are holding: nothing.`
5. **Exits** (SP-4; only where the scene has them): `Exits: east to the Hall.`

### Glosses

- **The room's gloss** goes in the heading (above).
- **A thing's gloss** goes in parentheses straight after its name, in every format: `[cup1] Cup (a red tin cup, fist-sized, light)`. Glosses are lowercase noun phrases that often contain commas, so they can't follow a comma the way relations do; the parentheses fence them off from the line's own commas (and from Blocks' `;`).
- **A Concept's gloss** goes the same way, on its line under `Concepts here:`.
- **Once per thing:** a spread object shows its gloss on its first line only (pre-order), and its other lines show the name alone.
- **No gloss, no parentheses.** Several things in the scenes are left unglossed on purpose (the jug, the rope's end, the coin, the Boardgames Concept), and scenes 2, 4, 8, 10, 11 and 12 carry none, so both cases are rendered.
- **Every gloss present is shown.** Trimming is a scope decision for a consumer, not the scene's. CA-1's "glosses for the referents only" was the judge's prompt-size trim and is superseded by Slice 5.

### One thing's line

Each part's place in the line:

| Part | A | D | Blocks |
|---|---|---|---|
| Handle and name | `[h] Name` | `[h] Name` | `[h] Name` |
| Gloss | `(<gloss>)` | `(<gloss>)` | `(<gloss>)` |
| Spread note | `(also …)` | `(also …)` | `(also …)` |
| Promotion mark | — | — | `(see below)` |
| Parent clause | — | `, <placement words>` | — |
| Relations | `, <phrase>` | `, <phrase>` | `, <phrase>` |
| Chain phrase | — | — | `, with X on it` |

- **In D**, the spread note comes after the parent clause: `[rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you)`. In A and Blocks it follows the name directly.
- **In Blocks**, siblings are separated by `;` and the list ends with `.`, so the commas inside an item never leave its subject unclear.

### Hosting-kind words

| Hosting kind | D's parent clause | Blocks' first chain link | Blocks' later chain links | Blocks block header |
|---|---|---|---|---|
| `On` | `on [x]` | `with X on it` | `which has X on it` | `On [x]:` |
| `In` | `in [x]` | `with X in it` | `which has X in it` | `In [x]:` |
| `Held` | `held by you` | — (the held section) | — | `You are holding:` |
| `PartOf` | `part of [x]` | `with X as a part` | `which has X as a part` | `Parts of [x]:` |
| `SectionOf` | `a section of [x]` | `with X as a section` | `which has X as a section` | `Sections of [x]:` |
| a room member | `in the Tavern` | — | — | `In the Tavern:` |

A chain of more than one link reads right-branching: `[table1] Table, with [box1] Box on it, which has [bag1] Bag in it, which has [coin1] Coin in it.` Each "which" attaches to the noun just before it.

### Relation phrases (SP-3)

A relation is read as English about its subject. It is printed on the subject's line only, never repeated on the object's line. When one subject has several relations with the same phrase, the objects are joined with "and": `tied to [bag1] and something someone else is holding`. A spread subject's relations go on its first line in walk order, as its gloss does, and its other lines carry none (scene 6).

| Edge | Phrase |
|---|---|
| A tie: `Custom(L)` with `Justifies` → `SecuredTo` | `L [x], secured` (`tied to [post1], secured`) |
| A bare `Custom(L)` | `L [x]`, with the label as given (`leaning against [crate1]`) |
| A bare `SecuredTo` (its `Custom` dissolved) | `secured to [x]` |
| An open leg, by the owner of its far end | an object in the cache: `L something inside [x]`; a character other than the actor: `L something someone else is holding`; a room: `L something in another room` |
| `ConnectedTo` inside one whole | no phrase; the spread note carries it |
| `Associated` (a member of a Concept) | `associated with [x]` |

### Spread objects (SP-2)

An object with several **physical** bindings gets one line per binding, each under that binding's parent. Each line carries a spread note naming where its *other* bindings are:

| Where the other binding is | Spread note |
|---|---|
| Under an object | `(also on [x])`, using that binding's hosting-kind words |
| Held by the actor | `(also held by you)` |
| Under this room | `(also in the Tavern)` |
| Under another room | `(also in another room)` |

A binding whose parent is not rendered (another room) gets no line of its own; only the note mentions it.

**Association is not placement.** Only a physical binding places a thing, so an `Associated` binding never gives its member a placement line. Associations are still scene content: Concepts exist to inform reasoning, and the scene shows them. The object catalog's rule (a Concept is a leaf, since the catalog serves player commands) does not bind the scene. See scene 13.

---

## 1. The tavern

**Setup**

```text
ROOM#Tavern "Tavern" (gloss: "A low-beamed common room, smoky from the hearth.")
  binding Base (hostless); cover: Table.onFloor
OBJECT#Table "Table" (gloss: "a long oak trestle, ring-stained")            member of Tavern, In
  binding onFloor <- Tavern.Base; cover: Saucer.onTable, Candle.onTable
OBJECT#Saucer "Saucer" (gloss: "chipped white china")          member of Table, On
  binding onTable <- Table.onFloor; cover: Cup.onSaucer
OBJECT#Cup "Cup" (gloss: "a red tin cup, fist-sized, light")                member of Saucer, On
  binding onSaucer <- Saucer.onTable
OBJECT#Candle "Candle" (gloss: "a stub of tallow in a pewter dish")          member of Table, On
  binding onTable <- Table.onFloor
CHARACTER#Actor (the actor)
  binding inRoom <- Tavern.Base; cover: Hammer.held
OBJECT#Hammer "Hammer" (gloss: "a claw hammer with a taped handle")          member of Actor, Held
  binding held <- Actor.inRoom
exits: north to the Street
```

**A**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained)
  - [saucer1] Saucer (chipped white china)
    - [cup1] Cup (a red tin cup, fist-sized, light)
  - [candle1] Candle (a stub of tallow in a pewter dish)
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle)
Exits: north to the Street.
```

**D**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.
```

**Blocks**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern: [table1] Table (a long oak trestle, ring-stained) (see below).
On [table1]: [saucer1] Saucer (chipped white china), with [cup1] Cup (a red tin cup, fist-sized, light) on it; [candle1] Candle (a stub of tallow in a pewter dish).
You are holding: [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything on X | What is on [table1]? | [saucer1], [candle1]. Not [cup1], which is on [saucer1]. |
| what is X on | What is [cup1] on? | [saucer1] |
| what moves if X is taken | If [table1] is taken, what moves with it? | [saucer1], [cup1], [candle1] |
| what moves if X is taken | If [saucer1] is taken, what moves with it? | [cup1] |
| what is held | What are you holding? | [hammer1] |
| gloss vs structure | What is [candle1] in? | nothing: it is on [table1]. The pewter dish is part of its description, not a thing in the scene. |

**Forest check:** each binding has one parent, so each has one physical parent host. The invariant holds. Nothing new to pin.

---

## 2. A sibling fan

**Setup**

```text
ROOM#DiningRoom "Dining Room"
  binding Base (hostless); cover: Table.onFloor
OBJECT#Table "Table"            member of Dining Room, In
  binding onFloor <- DiningRoom.Base; cover: Fork.set, Knife.set, Plate.set, Cup.set
OBJECT#Fork "Fork", OBJECT#Knife "Knife", OBJECT#Plate "Plate", OBJECT#Cup "Cup"
                                each a member of Table, On; binding set <- Table.onFloor
CHARACTER#Actor (the actor)     binding inRoom <- DiningRoom.Base; empty cover
```

**A**

```text
The Dining Room
Contents of the Dining Room:
- [table1] Table
  - [fork1] Fork
  - [knife1] Knife
  - [plate1] Plate
  - [cup1] Cup
You are holding: nothing.
```

**D**

```text
The Dining Room
Contents of the Dining Room:
- [table1] Table, in the Dining Room
  - [fork1] Fork, on [table1]
  - [knife1] Knife, on [table1]
  - [plate1] Plate, on [table1]
  - [cup1] Cup, on [table1]
You are holding: nothing.
```

**Blocks**

```text
The Dining Room
In the Dining Room: [table1] Table (see below).
On [table1]: [fork1] Fork; [knife1] Knife; [plate1] Plate; [cup1] Cup.
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything on X | What is on [table1]? | [fork1], [knife1], [plate1], [cup1] |
| what is X on | What is [knife1] on? | [table1] |
| what moves if X is taken | If [plate1] is taken, what moves with it? | nothing |

**Forest check:** single parents throughout. The invariant holds.

---

## 3. A branch inside a branch

**Setup:** the tavern (scene 1, glosses included) plus one more thing on the table, a tray holding a teapot and a jug. The jug has no gloss.

```text
OBJECT#Table                    cover: Saucer.onTable, Candle.onTable, Tray.onTable
OBJECT#Tray "Tray" (gloss: "a dented copper tray")              member of Table, On
  binding onTable <- Table.onFloor; cover: Teapot.onTray, Jug.onTray
OBJECT#Teapot "Teapot" (gloss: "brown glaze, still warm"), OBJECT#Jug "Jug"
                                each a member of Tray, On; binding onTray <- Tray.onTable
```

**A**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained)
  - [saucer1] Saucer (chipped white china)
    - [cup1] Cup (a red tin cup, fist-sized, light)
  - [candle1] Candle (a stub of tallow in a pewter dish)
  - [tray1] Tray (a dented copper tray)
    - [teapot1] Teapot (brown glaze, still warm)
    - [jug1] Jug
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle)
Exits: north to the Street.
```

**D**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
  - [tray1] Tray (a dented copper tray), on [table1]
    - [teapot1] Teapot (brown glaze, still warm), on [tray1]
    - [jug1] Jug, on [tray1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.
```

**Blocks**

```text
The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern: [table1] Table (a long oak trestle, ring-stained) (see below).
On [table1]: [saucer1] Saucer (chipped white china), with [cup1] Cup (a red tin cup, fist-sized, light) on it; [candle1] Candle (a stub of tallow in a pewter dish); [tray1] Tray (a dented copper tray) (see below).
On [tray1]: [teapot1] Teapot (brown glaze, still warm); [jug1] Jug.
You are holding: [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything on X | What is on [table1]? | [saucer1], [candle1], [tray1] |
| list everything on X | What is on [tray1]? | [teapot1], [jug1] |
| what is X on | What is [jug1] on? | [tray1] |
| what is X on | What is [candle1] on? | [table1] (in A, the line after the tray's subtree climbs back out) |
| what moves if X is taken | If [tray1] is taken, what moves with it? | [teapot1], [jug1] |

**Forest check:** single parents throughout. The invariant holds.

---

## 4. A deep chain

**Setup**

```text
ROOM#Study "Study"
  binding Base (hostless); cover: Table.onFloor
OBJECT#Table "Table"   member of Study, In;  binding onFloor <- Study.Base;    cover: Box.onTable
OBJECT#Box "Box"       member of Table, On;  binding onTable <- Table.onFloor; cover: Bag.inBox
OBJECT#Bag "Bag"       member of Box, In;    binding inBox <- Box.onTable;     cover: Coin.inBag
OBJECT#Coin "Coin"     member of Bag, In;    binding inBag <- Bag.inBox
CHARACTER#Actor (the actor)  binding inRoom <- Study.Base; empty cover
```

**A**

```text
The Study
Contents of the Study:
- [table1] Table
  - [box1] Box
    - [bag1] Bag
      - [coin1] Coin
You are holding: nothing.
```

**D**

```text
The Study
Contents of the Study:
- [table1] Table, in the Study
  - [box1] Box, on [table1]
    - [bag1] Bag, in [box1]
      - [coin1] Coin, in [bag1]
You are holding: nothing.
```

**Blocks** (the scene never branches, so it's one inline chain with no blocks)

```text
The Study
In the Study: [table1] Table, with [box1] Box on it, which has [bag1] Bag in it, which has [coin1] Coin in it.
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| what is X in | What is [coin1] in? | [bag1] |
| where is X (full chain) | Where is [coin1], all the way out to the room? | in [bag1], in [box1], on [table1], in the Study |
| list everything on X | What is on [table1]? | [box1] |
| what moves if X is taken | If [box1] is taken, what moves with it? | [bag1], [coin1] |

**Forest check:** single parents. The invariant holds.

---

## 5. The primer's Lab

**Setup:** the running example of [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md#the-running-example). The primer's `TiedTo` is written here as `Custom("tied to")`. The ties are bare `Custom` edges; scene 8 has the secured kind.

```text
ROOM#Lab "Lab"
  members: Box (In), Hook (In), Rope (In), CONCEPT#Contraption (Associated)
  binding Base (hostless); cover: Box.inLab, Hook.inLab, Rope.p1, Contraption.inLab
  edge: Hook -Custom "tied to"-> Rope
  edge (leg 1 of the crossing): Rope -Custom "tied to"-> {owner: Box, port: PORT-8f3a}
OBJECT#Box "Box" (gloss: "a plywood crate, lid off")
  members: Cup (In), Spring (In)
  binding inLab <- Lab.Base; cover: Cup.inBox, Spring.inBox
  port PORT-8f3a (fromHostId Lab, Custom, "tied to")
  edge (leg 2): {owner: Box, port: PORT-8f3a} -Custom "tied to"-> Cup
OBJECT#Cup "Cup" (gloss: "a red tin cup")        binding inBox <- Box.inLab
OBJECT#Spring "Spring" (gloss: "a tight steel coil")  binding inBox <- Box.inLab
                        binding assoc <- Contraption.inLab
CONCEPT#Contraption "Contraption" (gloss: "a half-built mousetrap mechanism")
  members: Spring (Associated)
  binding inLab <- Lab.Base; cover: Spring.assoc
OBJECT#Hook "Hook" (gloss: "an iron hook screwed to the wall")      binding inLab <- Lab.Base
OBJECT#Rope "Rope" (gloss: "a coil of thick hemp rope")
  members: RopeEndA (SectionOf), RopeEndB (SectionOf)
  binding p1 <- Lab.Base;  cover: RopeEndA.inP1
  binding p2 <- Hall.Base; cover: RopeEndB.inP2   (ROOM#Hall is not in the cache)
  edge: RopeEndA -ConnectedTo- RopeEndB
OBJECT#RopeEndA "End"   binding inP1 <- Rope.p1
OBJECT#RopeEndB "End"   binding inP2 <- Rope.p2
CHARACTER#Actor (the actor)  binding inRoom <- Lab.Base; empty cover
exits: east to the Hall
```

In the cache, the crossing composes into one edge, `Rope -Custom "tied to"-> Cup`.

**A**

```text
The Lab
Contents of the Lab:
- [box1] Box (a plywood crate, lid off)
  - [cup1] Cup (a red tin cup)
  - [spring1] Spring (a tight steel coil), associated with [contraption1]
- [hook1] Hook (an iron hook screwed to the wall), tied to [rope1]
- [rope1] Rope (a coil of thick hemp rope) (also in another room), tied to [cup1]
  - [end1] End
Concepts here:
- [contraption1] Contraption (a half-built mousetrap mechanism)
You are holding: nothing.
Exits: east to the Hall.
```

**D**

```text
The Lab
Contents of the Lab:
- [box1] Box (a plywood crate, lid off), in the Lab
  - [cup1] Cup (a red tin cup), in [box1]
  - [spring1] Spring (a tight steel coil), in [box1], associated with [contraption1]
- [hook1] Hook (an iron hook screwed to the wall), in the Lab, tied to [rope1]
- [rope1] Rope (a coil of thick hemp rope), in the Lab (also in another room), tied to [cup1]
  - [end1] End, a section of [rope1]
Concepts here:
- [contraption1] Contraption (a half-built mousetrap mechanism)
You are holding: nothing.
Exits: east to the Hall.
```

**Blocks**

```text
The Lab
In the Lab: [box1] Box (a plywood crate, lid off) (see below); [hook1] Hook (an iron hook screwed to the wall), tied to [rope1]; [rope1] Rope (a coil of thick hemp rope) (also in another room), tied to [cup1], with [end1] End as a section.
In [box1]: [cup1] Cup (a red tin cup); [spring1] Spring (a tight steel coil), associated with [contraption1].
Concepts here: [contraption1] Contraption (a half-built mousetrap mechanism).
You are holding: nothing.
Exits: east to the Hall.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything in X | What is in [box1]? | [cup1], [spring1] |
| what is X tied to | What is [rope1] tied to? | [cup1]. Also, [hook1] is tied to it. |
| what is associated with X | What is associated with [contraption1]? | [spring1] |
| what moves if X is taken | If [box1] is taken, what moves with it? | [cup1], [spring1]. The tie from [rope1] to [cup1] is affected. |
| where is X | Where is [rope1]? | partly in the Lab and partly in another room |

**Forest check:**
- The spring's binding `inBox` has the physical host Box.
- Its binding `assoc` has a Concept parent only, so it has no physical host.
- The rope's two bindings are each under one room.

The invariant holds. Pinned already: "the primer's spring", modelled with a Concept.

**Notes**
- The far end, `RopeEndB`, is in the cache under binding `p2`, whose parent (the Hall) is not rendered. It gets no line, and only the rope's spread note mentions it. Is that enough for a reader asking "what is the far end of [rope1] tied to"?
- The spring's `assoc` binding renders no line of its own (see "Association is not placement" under Spread objects). It shows up only as the association phrase.

---

## 6. Held inventory and a half-held rope

**Setup:** `actorCacheGraphs` in [`actorCacheTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCacheTestFixtures.ts), with two changes:
- shortNames are added;
- hosting kinds are made explicit.

The fixture's `rope -[tied to]-> bag.PORT-held -> coin` crossing is part of the scene. It was a `ConnectedTo` between two separate wholes, which the contract forbids, until the fixture was corrected to a `Custom` "tied to" (2026-11-02).

```text
ROOM#Kitchen "Kitchen"
  binding Base (hostless); cover: Table.tableInRoom
OBJECT#Table "Table" (gloss: "scrubbed pine, knife-scarred")   member of Kitchen, In
  binding tableInRoom <- Kitchen.Base; cover: Lamp.lampOnTable, Rope.ropeAtTable
  edge: Lamp -Custom "is near"-> Rope
OBJECT#Lamp "Lamp" (gloss: "an oil lamp, unlit")     member of Table, On; binding lampOnTable <- Table.tableInRoom
OBJECT#Rope "Rope" (gloss: "a coil of thick hemp rope")     member of Table, On; member of Actor, Held
  binding ropeAtTable <- Table.tableInRoom
  binding ropeHeld <- Actor.actorInRoom
CHARACTER#Actor (the actor)
  binding actorInRoom <- Kitchen.Base; cover: Bag.bagHeld, Rope.ropeHeld
  edge: Rope -Custom "tied to"-> {owner: Bag, port: PORT-held}
OBJECT#Bag "Bag" (gloss: "a drawstring leather pouch")       member of Actor, Held; binding bagHeld <- Actor.actorInRoom; cover: Coin.coinInBag
  port PORT-held (fromHostId Actor, Custom, "tied to")
  edge: {owner: Bag, port: PORT-held} -Custom "tied to"-> Coin
OBJECT#Coin "Coin"     member of Bag, In; binding coinInBag <- Bag.bagHeld
```

In the cache, `Rope -tied to-> Coin` is composed.

**A**

```text
The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred)
  - [lamp1] Lamp (an oil lamp, unlit), is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch)
  - [coin1] Coin
- [rope1] Rope (also on [table1])
```

**D**

```text
The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])
```

**Blocks**

```text
The Kitchen
In the Kitchen: [table1] Table (scrubbed pine, knife-scarred) (see below).
On [table1]: [lamp1] Lamp (an oil lamp, unlit), is near [rope1]; [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1].
You are holding: [bag1] Bag (a drawstring leather pouch), with [coin1] Coin in it; [rope1] Rope (also on [table1]).
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| what is held | What are you holding? | [bag1] (with [coin1] in it), and one end of [rope1] |
| where is X | Where is [rope1]? | partly on [table1] and partly held by you |
| what is X in | What is [coin1] in? | [bag1] |
| what is X tied to | What is [rope1] tied to? | [coin1] |
| what is tied to X | What is tied to [coin1]? | [rope1] |
| what moves if X is taken | If [table1] is taken, what moves with it? | [lamp1]; [rope1] is also held by you, so only its end on the table goes along |

**Forest check:** each rope binding has one physical parent host (Table; Actor). The invariant holds. The shape is already pinned by "the plank on two sawhorses".

**Notes**
- The rope is spread, so its relation `tied to [coin1]` goes on its first line in walk order (the table line), as its gloss does; its held line carries none (user, 2026-11-02).
- `catalogScope` is `room` for the half-held rope. The scene doesn't show it, and the spread note carries the same fact.
- `is near` is printed as given (`Lamp, is near [rope1]`). A label that reads as a verb phrase sits awkwardly after the comma. If it needs fixing, that's for SP-3's wording, not the format.

---

## 7. Two things with one short name

**Setup**

```text
ROOM#Parlour "Parlour"
  binding Base (hostless); cover: Table.onFloor, CupB.onFloor
OBJECT#Table "Table"   member of Parlour, In; binding onFloor <- Parlour.Base; cover: CupA.onTable
OBJECT#CupA "Cup" (gloss: "a red tin cup")      member of Table, On;   binding onTable <- Table.onFloor
OBJECT#CupB "Cup" (gloss: "a chipped china teacup")      member of Parlour, In; binding onFloor <- Parlour.Base
CHARACTER#Actor (the actor)  binding inRoom <- Parlour.Base; empty cover
```

The numbering is pre-order: the table, then the cup on it, then the room's cup. So the table's cup is `[cup1]`.

**A**

```text
The Parlour
Contents of the Parlour:
- [table1] Table
  - [cup1] Cup (a red tin cup)
- [cup2] Cup (a chipped china teacup)
You are holding: nothing.
```

**D**

```text
The Parlour
Contents of the Parlour:
- [table1] Table, in the Parlour
  - [cup1] Cup (a red tin cup), on [table1]
- [cup2] Cup (a chipped china teacup), in the Parlour
You are holding: nothing.
```

**Blocks**

```text
The Parlour
In the Parlour: [table1] Table, with [cup1] Cup (a red tin cup) on it; [cup2] Cup (a chipped china teacup).
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything on X | What is on [table1]? | [cup1] |
| what is X on | Where is [cup2]? | in the Parlour, not on anything |
| disambiguation | Which cup is on the table? | [cup1] |
| disambiguation by gloss | Where is the china teacup? | [cup2], in the Parlour |

**Forest check:** single parents. The invariant holds.

---

## 8. A tie, a bare `Custom` edge and a bare `SecuredTo`

**Setup** (edge ids shown so the `Justifies` terminals are concrete)

```text
ROOM#Dock "Dock"
  members: Post, Boat, Crate, Ladder, Barrel (each In)
  binding Base (hostless); cover: each member's inDock binding
  edge e1: Boat -Custom "tied to"-> Post
  edge e2: Boat -SecuredTo-> Post
  edge e3: {edgeId: e1} -Justifies-> {edgeId: e2}
  edge e4: Ladder -Custom "leaning against"-> Crate
  edge e5: Barrel -SecuredTo-> Post                 (its Custom support was dissolved)
OBJECT#Post "Post", OBJECT#Boat "Boat", OBJECT#Crate "Crate", OBJECT#Ladder "Ladder", OBJECT#Barrel "Barrel"
                       each: binding inDock <- Dock.Base
CHARACTER#Actor (the actor)  binding inRoom <- Dock.Base; empty cover
```

**A**

```text
The Dock
Contents of the Dock:
- [post1] Post
- [boat1] Boat, tied to [post1], secured
- [crate1] Crate
- [ladder1] Ladder, leaning against [crate1]
- [barrel1] Barrel, secured to [post1]
You are holding: nothing.
```

**D**

```text
The Dock
Contents of the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.
```

**Blocks**

```text
The Dock
In the Dock: [post1] Post; [boat1] Boat, tied to [post1], secured; [crate1] Crate; [ladder1] Ladder, leaning against [crate1]; [barrel1] Barrel, secured to [post1].
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| what is tied to X | What is tied to [post1]? | [boat1]. [barrel1] is secured to it, but the manner isn't stated. |
| what is secured to X | What is secured to [post1]? | [boat1], [barrel1] |
| what is X leaning against | What is [ladder1] leaning against? | [crate1] |
| what moves if X is taken | If [crate1] is taken, what is affected? | nothing moves with it; [ladder1]'s lean on it is severed |
| what blocks taking X | Can [post1] be taken as things stand? | no: [boat1] and [barrel1] are secured to it |

**Forest check:** single parents. The invariant holds.

**Notes**
- `Justifies` gets no phrase of its own. It is what turns "tied to [post1]" plus "secured to [post1]" into the single phrase "tied to [post1], secured".
- A secured `Custom` whose label isn't "tied to" (say "lashed to") reads `lashed to [post1], secured`.

---

## 9. Open legs

**Setup:** `actorCrossingGraphs` in [`actorCacheTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCacheTestFixtures.ts), with the same two changes as scene 6 (the rope stays tied to the coin).
- The table is tied across the actor's boundary to the bag. That crossing composes in the cache.
- The table is also tied across another character's boundary to that character's leash. The other character's shard is never expanded, so the leg stays open and ends at `{owner: CHARACTER#Other, port: PORT-leash}`.

```text
ROOM#Kitchen "Kitchen"
  members: Table (In), CHARACTER#Actor, CHARACTER#Other   (participants: nodes for the legs to land on)
  binding Base (hostless); cover: Table.tableInRoom, Actor.actorInRoom, Other.otherInRoom
  edge: Table -Custom "tied to"-> {owner: Actor, port: PORT-tether}
  edge: Table -Custom "tied to"-> {owner: Other, port: PORT-leash}
CHARACTER#Actor (the actor)
  ... as in scene 6, plus:
  port PORT-tether (fromHostId Kitchen, Custom, "tied to")
  edge: {owner: Actor, port: PORT-tether} -Custom "tied to"-> Bag
CHARACTER#Other (a bystander; its shard isn't folded)
  ... the leash and the inner leg, which are not in the cache
(the Table, Lamp, Rope, Bag and Coin as in scene 6, glosses included)
```

In the cache, `Table -tied to-> Bag` is composed, and `Table -tied to-> {owner: Other, port: PORT-leash}` stays an open leg.

**A**

```text
The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch)
  - [coin1] Coin
- [rope1] Rope (also on [table1])
```

**D**

```text
The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen, tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])
```

**Blocks**

```text
The Kitchen
In the Kitchen: [table1] Table (scrubbed pine, knife-scarred) (see below), tied to [bag1] and something someone else is holding.
On [table1]: [lamp1] Lamp (an oil lamp, unlit), is near [rope1]; [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1].
You are holding: [bag1] Bag (a drawstring leather pouch), with [coin1] Coin in it; [rope1] Rope (also on [table1]).
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| what is X tied to | What is [table1] tied to? | [bag1], and something someone else is holding (not named in the scene) |
| what is tied to X | What is tied to [bag1]? | [table1] |
| what moves if X is taken | If [table1] is taken, what is affected? | [lamp1] moves with it, and so does the end of [rope1] on the table; the ties to [bag1] and to the other character's thing are severed |

**Forest check:** as in scene 6. Participants add room-graph nodes but no bindings under objects. The invariant holds.

**Notes**
- The other character isn't rendered (SP-4: bystanders are out). The open leg is the only place it shows. Whether to name a bystander's thing once bystanders come in is part of the "Bystanders and features" question.
- With today's exhaustive fold, an open leg whose owner is an object in the cache can't happen: the object's shard is folded and the leg composes. `something inside [x]` is pinned for when attention-scoped caching makes it possible.

---

## 10. A draped cloth

**Setup**

```text
ROOM#SittingRoom "Sitting Room"
  binding Base (hostless); cover: Table.onFloor, Cloth.onFloor
OBJECT#Table "Table"   member of Sitting Room, In
  binding onFloor <- SittingRoom.Base; cover: Cloth.overTable
OBJECT#Cloth "Cloth"   member of Table, On; member of Sitting Room, In
  binding overTable <- Table.onFloor
  binding onFloor <- SittingRoom.Base
  edge: {owner: Cloth, port: overTable} -ConnectedTo- {owner: Cloth, port: onFloor}   (written by extend)
CHARACTER#Actor (the actor)  binding inRoom <- SittingRoom.Base; empty cover
```

**A**

```text
The Sitting Room
Contents of the Sitting Room:
- [table1] Table
  - [cloth1] Cloth (also in the Sitting Room)
- [cloth1] Cloth (also on [table1])
You are holding: nothing.
```

**D**

```text
The Sitting Room
Contents of the Sitting Room:
- [table1] Table, in the Sitting Room
  - [cloth1] Cloth, on [table1] (also in the Sitting Room)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
You are holding: nothing.
```

**Blocks**

```text
The Sitting Room
In the Sitting Room: [table1] Table, with [cloth1] Cloth (also in the Sitting Room) on it; [cloth1] Cloth (also on [table1]).
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| where is X | Where is [cloth1]? | partly on [table1] and partly in the Sitting Room: one cloth, draped |
| how many | How many cloths are there? | one |
| what moves if X is taken | If [table1] is taken, what is affected? | the part of [cloth1] on it; the rest of the cloth is in the room |

**Forest check:** each cloth binding has one parent host (Table; Sitting Room). The invariant holds. Already pinned by "the plank on two sawhorses".

**Notes**
- The `ConnectedTo` between the cloth's bindings gets no phrase. The spread note carries it, as SP-3 decided.
- Untested here: a thing joined under *both* of the cloth's bindings (the forest test's candle). SP-2 says a join renders once under its host, but a spread host has several lines. Which line does the join go under? Decided as SP-9 in the plan: described once, after its last parent line, with a reference at each parent line.

---

## 11. A node with no `shortName`

**Setup**

```text
ROOM#Shed "Shed"
  members: OBJECT#Thing (In, no shortName), Lantern (In)
  binding Base (hostless); cover: Thing.inShed, Lantern.inShed
  edge: Lantern -Custom "hanging from"-> Thing
OBJECT#Thing (no shortName)  binding inShed <- Shed.Base; cover: Key.inThing
OBJECT#Key "Key"             member of Thing, In; binding inThing <- Thing.inShed
OBJECT#Lantern "Lantern"     binding inShed <- Shed.Base
CHARACTER#Actor (the actor)  binding inRoom <- Shed.Base; empty cover
```

**A**

```text
The Shed
Contents of the Shed:
- [object1] (unnamed object)
  - [key1] Key
- [lantern1] Lantern, hanging from [object1]
You are holding: nothing.
```

**D**

```text
The Shed
Contents of the Shed:
- [object1] (unnamed object), in the Shed
  - [key1] Key, in [object1]
- [lantern1] Lantern, in the Shed, hanging from [object1]
You are holding: nothing.
```

**Blocks**

```text
The Shed
In the Shed: [object1] (unnamed object), with [key1] Key in it; [lantern1] Lantern, hanging from [object1].
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| what is X in | What is [key1] in? | [object1] (an unnamed object) |
| what is X hanging from | What is [lantern1] hanging from? | [object1] |
| what moves if X is taken | If [object1] is taken, what is affected? | [key1] moves with it; [lantern1]'s hanging is severed |

**Forest check:** single parents. The invariant holds.

**Notes**
- The catalog leaves unnamed nodes out, but the scene keeps every unnamed node. The question is whether an unnamed *leaf*, one that isn't a container or a relation end, should be left out.

---

## 12. An empty room

**Setup**

```text
ROOM#Cellar "Cellar"   binding Base (hostless); empty cover
CHARACTER#Actor (the actor)  binding inRoom <- Cellar.Base; empty cover
```

**A** and **D**

```text
The Cellar
Contents of the Cellar: nothing.
You are holding: nothing.
```

**Blocks**

```text
The Cellar
In the Cellar: nothing.
You are holding: nothing.
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything in X | What is in the Cellar? | nothing |
| what is held | What are you holding? | nothing |

**Forest check:** trivially holds.

---

## 13. The steamer chest: association is not placement

**The rule this scene pins (user, 2026-11-02).** Only physical placement puts a thing in a room. An association says a Concept is relevant here; it never places its members. Placement lines come only from physical covers walked from the room and the actor. Associations are reasoning content, which is what Concepts are for, so the scene shows them: a Concept is rendered under `Concepts here:`, and a placed member's line carries the association phrase. The scene is **not** aligned with the object catalog, whose rule that a Concept is a leaf serves player commands (user, 2026-11-02: aligning the reasoning engine's exposure with the player command's is a mistake).

**Setup:** PR-C5's world as corrected (user, 2026-11-02: as first written, with the chest in the attic only through its associations, it was a modelling error), matching [`presenceParentSets.concepts.payoff.test.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/presenceParentSets.concepts.payoff.test.ts). The chest has a physical binding on the attic floor and an empty `Associated` binding under each Concept. The backgammon set and the chess set sit under the physical binding. Tess is the actor.

```text
ROOM#Attic "Attic"
  members: SteamerChest (In), CONCEPT#InheritedFurniture (Associated), CONCEPT#Boardgames (Associated)
  binding Base (hostless); cover: SteamerChest.onFloor, InheritedFurniture.inAttic, Boardgames.inAttic
CONCEPT#InheritedFurniture "Inherited Furniture" (gloss: "the things Gran left to the family")
  members: SteamerChest (Associated)
  binding inAttic <- Attic.Base; cover: SteamerChest.asFurniture
CONCEPT#Boardgames "Boardgames"
  members: SteamerChest (Associated)
  binding inAttic <- Attic.Base; cover: SteamerChest.asBoardgames
OBJECT#SteamerChest "Steamer Chest" (gloss: "brass-cornered, labels peeling")
  members: Backgammon (In), Chess (In)
  binding onFloor <- Attic.Base; cover: Backgammon.bg, Chess.chess
  binding asFurniture <- InheritedFurniture.inAttic; empty cover
  binding asBoardgames <- Boardgames.inAttic; empty cover
OBJECT#Backgammon "Backgammon Set" (gloss: "a folding wooden board")
  members: Die (In)
  binding bg <- SteamerChest.onFloor; cover: Die.die
OBJECT#Chess "Chess Set"     binding chess <- SteamerChest.onFloor
OBJECT#Die "Die"             binding die <- Backgammon.bg
CHARACTER#Tess (the actor)
  binding inAttic <- Attic.Base; cover: SpareDie.spare
OBJECT#SpareDie "Spare Die" (gloss: "an ivory die, one pip worn away")  member of Tess, Held; binding spare <- Tess.inAttic
```

**A**

```text
The Attic
Contents of the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), associated with [inherited-furniture1] and [boardgames1]
  - [backgammon-set1] Backgammon Set (a folding wooden board)
    - [die1] Die
  - [chess-set1] Chess Set
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away)
```

**D**

```text
The Attic
Contents of the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), in the Attic, associated with [inherited-furniture1] and [boardgames1]
  - [backgammon-set1] Backgammon Set (a folding wooden board), in [steamer-chest1]
    - [die1] Die, in [backgammon-set1]
  - [chess-set1] Chess Set, in [steamer-chest1]
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away), held by you
```

**Blocks**

```text
The Attic
In the Attic: [steamer-chest1] Steamer Chest (brass-cornered, labels peeling) (see below), associated with [inherited-furniture1] and [boardgames1].
In [steamer-chest1]: [backgammon-set1] Backgammon Set (a folding wooden board), with [die1] Die in it; [chess-set1] Chess Set.
Concepts here: [inherited-furniture1] Inherited Furniture (the things Gran left to the family); [boardgames1] Boardgames.
You are holding: [spare-die1] Spare Die (an ivory die, one pip worn away).
```

**Questions**

| Type | Question | Expected |
|---|---|---|
| list everything in X | What is in [steamer-chest1]? | [backgammon-set1], [chess-set1] |
| what is associated with X | What is [steamer-chest1] associated with? | [inherited-furniture1], [boardgames1] |
| what is associated with X | What is associated with [boardgames1]? | [steamer-chest1] |
| what moves if X is taken | If [steamer-chest1] is taken, what moves with it? | [backgammon-set1], [die1], [chess-set1]. Its associations don't move anything, and the Concepts stay. |
| what is held | What are you holding? | [spare-die1] |

**Forest check:**
- The chest's `onFloor` binding has the physical host Attic.
- Its association bindings have Concept parents only, so they have no physical host.
- Everything else has a single parent.

The invariant holds. This is the shape already pinned by "the primer's spring", modelled with a Concept.
