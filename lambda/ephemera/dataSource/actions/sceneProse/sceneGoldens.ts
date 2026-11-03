/**
 * The hand-written render each fixture must produce (sceneProjection Slice 2; format D, chosen in Slice 3 by SP-7), and
 * in `fans` (SP-7 reopened, 2026-11-03), and `registers` below. Inline text, not snapshots, so a golden never writes itself.
 */
export const sceneGoldens: Record<string, string> = {
    tavern: `The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
    siblingFan: `The Dining Room
Contents of the Dining Room:
- [table1] Table, in the Dining Room
  - [fork1] Fork, on [table1]
  - [knife1] Knife, on [table1]
  - [plate1] Plate, on [table1]
  - [cup1] Cup, on [table1]
You are holding: nothing.`,
    branchInBranch: `The Tavern: A low-beamed common room, smoky from the hearth.
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
Exits: north to the Street.`,
    deepChain: `The Study
Contents of the Study:
- [table1] Table, in the Study
  - [box1] Box, on [table1]
    - [bag1] Bag, in [box1]
      - [coin1] Coin, in [bag1]
You are holding: nothing.`,
    lab: `The Lab
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
Exits: east to the Hall.`,
    heldInventory: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
    twoCups: `The Parlour
Contents of the Parlour:
- [table1] Table, in the Parlour
  - [cup1] Cup (a red tin cup), on [table1]
- [cup2] Cup (a chipped china teacup), in the Parlour
You are holding: nothing.`,
    dock: `The Dock
Contents of the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.`,
    openLegs: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen, tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
    drapedCloth: `The Sitting Room
Contents of the Sitting Room:
- [table1] Table, in the Sitting Room
  - [cloth1] Cloth, on [table1] (also in the Sitting Room)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
You are holding: nothing.`,
    unnamed: `The Shed
Contents of the Shed:
- [object1] (unnamed object), in the Shed
  - [key1] Key, in [object1]
- [lantern1] Lantern, in the Shed, hanging from [object1]
You are holding: nothing.`,
    emptyRoom: `The Cellar
Contents of the Cellar: nothing.
You are holding: nothing.`,
    steamerChest: `The Attic
Contents of the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), in the Attic, associated with [inherited-furniture1] and [boardgames1]
  - [backgammon-set1] Backgammon Set (a folding wooden board), in [steamer-chest1]
    - [die1] Die, in [backgammon-set1]
  - [chess-set1] Chess Set, in [steamer-chest1]
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away), held by you`,
    join: `The Dining Room
Contents of the Dining Room:
- [table-a1] Table A, in the Dining Room
  - [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1]) (see [fruit-bowl1] below)
- [table-b1] Table B, in the Dining Room
  - [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1]) (see [fruit-bowl1] below)
    - [napkin1] Napkin, on [tablecloth1]
  - [fruit-bowl1] Fruit Bowl, on [tablecloth1] (across [table-a1] and [table-b1])
    - [apple1] Apple, in [fruit-bowl1]
You are holding:
- [pear1] Pear, held by you`,
    feature: `The Chapel: Whitewashed, with plain pews.
Contents of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel
  - [candle1] Candle, on [altar1]
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
    sideboard: `The Dining Room
Contents of the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard), in the Dining Room
  - [candle1] Candle, on [sideboard1]
  - [saucer1] Saucer, on [sideboard1]
    - [cup1] Cup, on [saucer1]
      - [tea1] Tea, in [cup1]
  - [mug1] Mug, on [sideboard1]
    - [coffee1] Coffee, in [mug1]
  - [tray1] Tray, on [sideboard1]
    - [teapot1] Teapot, on [tray1]
    - [jug1] Jug, on [tray1]
  - [box1] Box, on [sideboard1]
    - [fork1] Fork, in [box1]
    - [knife1] Knife, in [box1]
    - [spoon1] Spoon, in [box1]
  - [lamp1] Lamp, on [sideboard1]
You are holding: nothing.`,
    teaTable: `The Parlour
Contents of the Parlour:
- [table1] Table (a small round tea table), in the Parlour
  - [saucer1] Saucer, on [table1]
    - [cup1] Cup, on [saucer1]
      - [tea1] Tea, in [cup1]
  - [teapot1] Teapot, on [table1], glued to [table1], secured
    - [tea2] Tea, in [teapot1]
You are holding: nothing.`,
}

/**
 * The `fans` renders: blocksDLabelled's goldens (Slice 3, commit 30ed8e4cc) with each layers block rewritten as a block per
 * link (`deepChain`, `sideboard`, `teaTable`); every other fixture renders as blocksDLabelled did.
 */
export const sceneFanGoldens: Record<string, string> = {
    tavern: `The Tavern: A low-beamed common room, smoky from the hearth.
Directly in the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern (see below)
Directly on [table1]:
- [saucer1] Saucer (chipped white china), on [table1] (see below)
- [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
Directly on [saucer1]:
- [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
    siblingFan: `The Dining Room
Directly in the Dining Room:
- [table1] Table, in the Dining Room (see below)
Directly on [table1]:
- [fork1] Fork, on [table1]
- [knife1] Knife, on [table1]
- [plate1] Plate, on [table1]
- [cup1] Cup, on [table1]
You are holding: nothing.`,
    branchInBranch: `The Tavern: A low-beamed common room, smoky from the hearth.
Directly in the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern (see below)
Directly on [table1]:
- [saucer1] Saucer (chipped white china), on [table1] (see below)
- [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
- [tray1] Tray (a dented copper tray), on [table1] (see below)
Directly on [saucer1]:
- [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
Directly on [tray1]:
- [teapot1] Teapot (brown glaze, still warm), on [tray1]
- [jug1] Jug, on [tray1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
    deepChain: `The Study
Directly in the Study:
- [table1] Table, in the Study (see below)
Directly on [table1]:
- [box1] Box, on [table1] (see below)
Directly in [box1]:
- [bag1] Bag, in [box1] (see below)
Directly in [bag1]:
- [coin1] Coin, in [bag1]
You are holding: nothing.`,
    lab: `The Lab
Directly in the Lab:
- [box1] Box (a plywood crate, lid off), in the Lab (see below)
- [hook1] Hook (an iron hook screwed to the wall), in the Lab, tied to [rope1]
- [rope1] Rope (a coil of thick hemp rope), in the Lab (also in another room) (see below), tied to [cup1]
Directly in [box1]:
- [cup1] Cup (a red tin cup), in [box1]
- [spring1] Spring (a tight steel coil), in [box1], associated with [contraption1]
Sections of [rope1]:
- [end1] End, a section of [rope1]
Concepts here:
- [contraption1] Contraption (a half-built mousetrap mechanism)
You are holding: nothing.
Exits: east to the Hall.`,
    heldInventory: `The Kitchen
Directly in the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen (see below)
Directly on [table1]:
- [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
- [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you (see below)
- [rope1] Rope, held by you (also on [table1])
Directly in [bag1]:
- [coin1] Coin, in [bag1]`,
    twoCups: `The Parlour
Directly in the Parlour:
- [table1] Table, in the Parlour (see below)
- [cup2] Cup (a chipped china teacup), in the Parlour
Directly on [table1]:
- [cup1] Cup (a red tin cup), on [table1]
You are holding: nothing.`,
    dock: `The Dock
Directly in the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.`,
    openLegs: `The Kitchen
Directly in the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen (see below), tied to [bag1] and something someone else is holding
Directly on [table1]:
- [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
- [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you (see below)
- [rope1] Rope, held by you (also on [table1])
Directly in [bag1]:
- [coin1] Coin, in [bag1]`,
    drapedCloth: `The Sitting Room
Directly in the Sitting Room:
- [table1] Table, in the Sitting Room (see below)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
Directly on [table1]:
- [cloth1] Cloth, on [table1] (also in the Sitting Room)
You are holding: nothing.`,
    unnamed: `The Shed
Directly in the Shed:
- [object1] (unnamed object), in the Shed (see below)
- [lantern1] Lantern, in the Shed, hanging from [object1]
Directly in [object1]:
- [key1] Key, in [object1]
You are holding: nothing.`,
    emptyRoom: `The Cellar
In the Cellar: nothing.
You are holding: nothing.`,
    steamerChest: `The Attic
Directly in the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), in the Attic (see below), associated with [inherited-furniture1] and [boardgames1]
Directly in [steamer-chest1]:
- [backgammon-set1] Backgammon Set (a folding wooden board), in [steamer-chest1] (see below)
- [chess-set1] Chess Set, in [steamer-chest1]
Directly in [backgammon-set1]:
- [die1] Die, in [backgammon-set1]
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away), held by you`,
    join: `The Dining Room
Directly in the Dining Room:
- [table-a1] Table A, in the Dining Room (see below)
- [table-b1] Table B, in the Dining Room (see below)
Directly on [table-a1]:
- [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1]) (see [fruit-bowl1] below)
Directly on [table-b1]:
- [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1]) (see [fruit-bowl1] below) (see below)
- [fruit-bowl1] Fruit Bowl, on [tablecloth1] (across [table-a1] and [table-b1]) (see below)
Directly on [tablecloth1]:
- [napkin1] Napkin, on [tablecloth1]
Directly in [fruit-bowl1]:
- [apple1] Apple, in [fruit-bowl1]
You are holding:
- [pear1] Pear, held by you`,
    feature: `The Chapel: Whitewashed, with plain pews.
Parts of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel (see below)
Directly on [altar1]:
- [candle1] Candle, on [altar1]
Directly in the Chapel:
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
    sideboard: `The Dining Room
Directly in the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard), in the Dining Room (see below)
Directly on [sideboard1]:
- [candle1] Candle, on [sideboard1]
- [saucer1] Saucer, on [sideboard1] (see below)
- [mug1] Mug, on [sideboard1] (see below)
- [tray1] Tray, on [sideboard1] (see below)
- [box1] Box, on [sideboard1] (see below)
- [lamp1] Lamp, on [sideboard1]
Directly on [saucer1]:
- [cup1] Cup, on [saucer1] (see below)
Directly in [cup1]:
- [tea1] Tea, in [cup1]
Directly in [mug1]:
- [coffee1] Coffee, in [mug1]
Directly on [tray1]:
- [teapot1] Teapot, on [tray1]
- [jug1] Jug, on [tray1]
Directly in [box1]:
- [fork1] Fork, in [box1]
- [knife1] Knife, in [box1]
- [spoon1] Spoon, in [box1]
You are holding: nothing.`,
    teaTable: `The Parlour
Directly in the Parlour:
- [table1] Table (a small round tea table), in the Parlour (see below)
Directly on [table1]:
- [saucer1] Saucer, on [table1] (see below)
- [teapot1] Teapot, on [table1] (see below), glued to [table1], secured
Directly on [saucer1]:
- [cup1] Cup, on [saucer1] (see below)
Directly in [cup1]:
- [tea1] Tea, in [cup1]
Directly in [teapot1]:
- [tea2] Tea, in [teapot1]
You are holding: nothing.`,
}

/**
 * The `flatD` renders (2026-11-03): D's goldens with every line's leading whitespace stripped. Derived rather than copied,
 * because "D without the indent" is the whole of flatD's spec.
 */
export const sceneFlatDGoldens: Record<string, string> = Object.fromEntries(
    Object.entries(sceneGoldens).map(([name, text]) => [name, text.split('\n').map((line) => line.trimStart()).join('\n')])
)

/**
 * The `registers` renders (SP-10, Slice 5): the place in sentences, then D's list as records. No foreground, no examples.
 * Written out once from the renderer and read through by hand.
 */
export const sceneRegistersGoldens: Record<string, string> = {
    tavern: `The Tavern: A low-beamed common room, smoky from the hearth.
The place:
In the Tavern there is [table1] Table (a long oak trestle, ring-stained).
On [table1] there are [saucer1] Saucer (chipped white china) and [candle1] Candle (a stub of tallow in a pewter dish).
On [saucer1] there is [cup1] Cup (a red tin cup, fist-sized, light).
You are holding [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.
Records:
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you`,
    siblingFan: `The Dining Room
The place:
In the Dining Room there is [table1] Table.
On [table1] there are [fork1] Fork, [knife1] Knife, [plate1] Plate and [cup1] Cup.
You are holding nothing.
Records:
Contents of the Dining Room:
- [table1] Table, in the Dining Room
  - [fork1] Fork, on [table1]
  - [knife1] Knife, on [table1]
  - [plate1] Plate, on [table1]
  - [cup1] Cup, on [table1]
You are holding: nothing.`,
    branchInBranch: `The Tavern: A low-beamed common room, smoky from the hearth.
The place:
In the Tavern there is [table1] Table (a long oak trestle, ring-stained).
On [table1] there are [saucer1] Saucer (chipped white china), [candle1] Candle (a stub of tallow in a pewter dish) and [tray1] Tray (a dented copper tray).
On [saucer1] there is [cup1] Cup (a red tin cup, fist-sized, light).
On [tray1] there are [teapot1] Teapot (brown glaze, still warm) and [jug1] Jug.
You are holding [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.
Records:
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
  - [tray1] Tray (a dented copper tray), on [table1]
    - [teapot1] Teapot (brown glaze, still warm), on [tray1]
    - [jug1] Jug, on [tray1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you`,
    deepChain: `The Study
The place:
In the Study there is [table1] Table.
On [table1] there is [box1] Box.
In [box1] there is [bag1] Bag.
In [bag1] there is [coin1] Coin.
You are holding nothing.
Records:
Contents of the Study:
- [table1] Table, in the Study
  - [box1] Box, on [table1]
    - [bag1] Bag, in [box1]
      - [coin1] Coin, in [bag1]
You are holding: nothing.`,
    lab: `The Lab
The place:
In the Lab there are [box1] Box (a plywood crate, lid off), [hook1] Hook (an iron hook screwed to the wall) and [rope1] Rope (a coil of thick hemp rope) (also in another room).
In [box1] there are [cup1] Cup (a red tin cup) and [spring1] Spring (a tight steel coil).
[spring1] is associated with [contraption1].
[hook1] is tied to [rope1].
[rope1] is tied to [cup1].
[end1] End is a section of [rope1].
You are holding nothing.
Exits: east to the Hall.
Records:
Contents of the Lab:
- [box1] Box (a plywood crate, lid off), in the Lab
  - [cup1] Cup (a red tin cup), in [box1]
  - [spring1] Spring (a tight steel coil), in [box1], associated with [contraption1]
- [hook1] Hook (an iron hook screwed to the wall), in the Lab, tied to [rope1]
- [rope1] Rope (a coil of thick hemp rope), in the Lab (also in another room), tied to [cup1]
  - [end1] End, a section of [rope1]
Concepts here:
- [contraption1] Contraption (a half-built mousetrap mechanism)
You are holding: nothing.`,
    heldInventory: `The Kitchen
The place:
In the Kitchen there is [table1] Table (scrubbed pine, knife-scarred).
On [table1] there are [lamp1] Lamp (an oil lamp, unlit) and [rope1] Rope (a coil of thick hemp rope) (also held by you).
[lamp1] is near [rope1].
[rope1] is tied to [coin1].
You are holding [bag1] Bag (a drawstring leather pouch) and [rope1] Rope (also on [table1]).
In [bag1] there is [coin1] Coin.
Records:
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
    twoCups: `The Parlour
The place:
In the Parlour there are [table1] Table and [cup2] Cup (a chipped china teacup).
On [table1] there is [cup1] Cup (a red tin cup).
You are holding nothing.
Records:
Contents of the Parlour:
- [table1] Table, in the Parlour
  - [cup1] Cup (a red tin cup), on [table1]
- [cup2] Cup (a chipped china teacup), in the Parlour
You are holding: nothing.`,
    dock: `The Dock
The place:
In the Dock there are [post1] Post, [boat1] Boat, [crate1] Crate, [ladder1] Ladder and [barrel1] Barrel.
[boat1] is tied to [post1], secured.
[ladder1] is leaning against [crate1].
[barrel1] is secured to [post1].
You are holding nothing.
Records:
Contents of the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.`,
    openLegs: `The Kitchen
The place:
In the Kitchen there is [table1] Table (scrubbed pine, knife-scarred).
[table1] is tied to [bag1] and something someone else is holding.
On [table1] there are [lamp1] Lamp (an oil lamp, unlit) and [rope1] Rope (a coil of thick hemp rope) (also held by you).
[lamp1] is near [rope1].
[rope1] is tied to [coin1].
You are holding [bag1] Bag (a drawstring leather pouch) and [rope1] Rope (also on [table1]).
In [bag1] there is [coin1] Coin.
Records:
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen, tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
    drapedCloth: `The Sitting Room
The place:
In the Sitting Room there are [table1] Table and [cloth1] Cloth (also on [table1]).
On [table1] there is [cloth1] Cloth (also in the Sitting Room).
You are holding nothing.
Records:
Contents of the Sitting Room:
- [table1] Table, in the Sitting Room
  - [cloth1] Cloth, on [table1] (also in the Sitting Room)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
You are holding: nothing.`,
    unnamed: `The Shed
The place:
In the Shed there are [object1] (unnamed object) and [lantern1] Lantern.
In [object1] there is [key1] Key.
[lantern1] is hanging from [object1].
You are holding nothing.
Records:
Contents of the Shed:
- [object1] (unnamed object), in the Shed
  - [key1] Key, in [object1]
- [lantern1] Lantern, in the Shed, hanging from [object1]
You are holding: nothing.`,
    emptyRoom: `The Cellar
The place:
In the Cellar there is nothing.
You are holding nothing.
Records:
Contents of the Cellar: nothing.
You are holding: nothing.`,
    steamerChest: `The Attic
The place:
In the Attic there is [steamer-chest1] Steamer Chest (brass-cornered, labels peeling).
[steamer-chest1] is associated with [inherited-furniture1] and [boardgames1].
In [steamer-chest1] there are [backgammon-set1] Backgammon Set (a folding wooden board) and [chess-set1] Chess Set.
In [backgammon-set1] there is [die1] Die.
You are holding [spare-die1] Spare Die (an ivory die, one pip worn away).
Records:
Contents of the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), in the Attic, associated with [inherited-furniture1] and [boardgames1]
  - [backgammon-set1] Backgammon Set (a folding wooden board), in [steamer-chest1]
    - [die1] Die, in [backgammon-set1]
  - [chess-set1] Chess Set, in [steamer-chest1]
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away), held by you`,
    join: `The Dining Room
The place:
In the Dining Room there are [table-a1] Table A and [table-b1] Table B.
On [table-a1] there is [tablecloth1] Tablecloth (also on [table-b1]) (see [fruit-bowl1] below).
On [table-b1] there is [tablecloth1] Tablecloth (also on [table-a1]) (see [fruit-bowl1] below).
On [tablecloth1] there is [fruit-bowl1] Fruit Bowl (across [table-a1] and [table-b1]).
On [tablecloth1] there is [napkin1] Napkin.
In [fruit-bowl1] there is [apple1] Apple.
You are holding [pear1] Pear.
Records:
Contents of the Dining Room:
- [table-a1] Table A, in the Dining Room
  - [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1]) (see [fruit-bowl1] below)
- [table-b1] Table B, in the Dining Room
  - [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1]) (see [fruit-bowl1] below)
    - [napkin1] Napkin, on [tablecloth1]
  - [fruit-bowl1] Fruit Bowl, on [tablecloth1] (across [table-a1] and [table-b1])
    - [apple1] Apple, in [fruit-bowl1]
You are holding:
- [pear1] Pear, held by you`,
    feature: `The Chapel: Whitewashed, with plain pews.
The place:
[altar1] Altar (a slab of grey stone) is part of the Chapel.
In the Chapel there is [hymnal1] Hymnal (a cloth-bound hymn book).
On [altar1] there is [candle1] Candle.
You are holding nothing.
Records:
Contents of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel
  - [candle1] Candle, on [altar1]
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
    sideboard: `The Dining Room
The place:
In the Dining Room there is [sideboard1] Sideboard (a long walnut sideboard).
On [sideboard1] there are [candle1] Candle, [saucer1] Saucer, [mug1] Mug, [tray1] Tray, [box1] Box and [lamp1] Lamp.
On [saucer1] there is [cup1] Cup.
In [cup1] there is [tea1] Tea.
In [mug1] there is [coffee1] Coffee.
On [tray1] there are [teapot1] Teapot and [jug1] Jug.
In [box1] there are [fork1] Fork, [knife1] Knife and [spoon1] Spoon.
You are holding nothing.
Records:
Contents of the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard), in the Dining Room
  - [candle1] Candle, on [sideboard1]
  - [saucer1] Saucer, on [sideboard1]
    - [cup1] Cup, on [saucer1]
      - [tea1] Tea, in [cup1]
  - [mug1] Mug, on [sideboard1]
    - [coffee1] Coffee, in [mug1]
  - [tray1] Tray, on [sideboard1]
    - [teapot1] Teapot, on [tray1]
    - [jug1] Jug, on [tray1]
  - [box1] Box, on [sideboard1]
    - [fork1] Fork, in [box1]
    - [knife1] Knife, in [box1]
    - [spoon1] Spoon, in [box1]
  - [lamp1] Lamp, on [sideboard1]
You are holding: nothing.`,
    teaTable: `The Parlour
The place:
In the Parlour there is [table1] Table (a small round tea table).
On [table1] there are [saucer1] Saucer and [teapot1] Teapot.
On [saucer1] there is [cup1] Cup.
In [cup1] there is [tea1] Tea.
[teapot1] is glued to [table1], secured.
In [teapot1] there is [tea2] Tea.
You are holding nothing.
Records:
Contents of the Parlour:
- [table1] Table (a small round tea table), in the Parlour
  - [saucer1] Saucer, on [table1]
    - [cup1] Cup, on [saucer1]
      - [tea1] Tea, in [cup1]
  - [teapot1] Teapot, on [table1], glued to [table1], secured
    - [tea2] Tea, in [teapot1]
You are holding: nothing.`,
}

/**
 * The `affordance` renders' added section: `registers` with this inserted after the heading line. A fixture with no entry
 * has no rule to state and renders exactly as `registers` (the golden test asserts both).
 */
export const sceneAffordanceGoldens: Record<string, string> = {
    tavern: `Rules that apply here:
- Moving [table1] also moves [saucer1], [cup1] and [candle1].
- Moving [saucer1] also moves [cup1].`,
    siblingFan: `Rules that apply here:
- Moving [table1] also moves [fork1], [knife1], [plate1] and [cup1].`,
    branchInBranch: `Rules that apply here:
- Moving [table1] also moves [saucer1], [cup1], [candle1], [tray1], [teapot1] and [jug1].
- Moving [saucer1] also moves [cup1].
- Moving [tray1] also moves [teapot1] and [jug1].`,
    deepChain: `Rules that apply here:
- Moving [table1] also moves [box1], [bag1] and [coin1].
- Moving [box1] also moves [bag1] and [coin1].
- Moving [bag1] also moves [coin1].`,
    lab: `Rules that apply here:
- Moving [box1] also moves [cup1] and [spring1].`,
    heldInventory: `Rules that apply here:
- Moving [bag1] also moves [coin1].`,
    twoCups: `Rules that apply here:
- Moving [table1] also moves [cup1].`,
    dock: `Rules that apply here:
- [boat1] and [post1] cannot be moved while [boat1] is tied to [post1].
- [barrel1] and [post1] cannot be moved while [barrel1] is secured to [post1].`,
    openLegs: `Rules that apply here:
- Moving [bag1] also moves [coin1].`,
    unnamed: `Rules that apply here:
- Moving [object1] also moves [key1].`,
    steamerChest: `Rules that apply here:
- Moving [steamer-chest1] also moves [backgammon-set1], [die1] and [chess-set1].
- Moving [backgammon-set1] also moves [die1].`,
    feature: `Rules that apply here:
- Moving [altar1] also moves [candle1].`,
    sideboard: `Rules that apply here:
- Moving [sideboard1] also moves [candle1], [saucer1], [cup1], [tea1], [mug1], [coffee1], [tray1], [teapot1], [jug1], [box1], [fork1], [knife1], [spoon1] and [lamp1].
- Moving [saucer1] also moves [cup1] and [tea1].
- Moving [cup1] also moves [tea1].
- Moving [mug1] also moves [coffee1].
- Moving [tray1] also moves [teapot1] and [jug1].
- Moving [box1] also moves [fork1], [knife1] and [spoon1].`,
    teaTable: `Rules that apply here:
- [teapot1] and [table1] cannot be moved while [teapot1] is glued to [table1].
- Moving [saucer1] also moves [cup1] and [tea1].
- Moving [cup1] also moves [tea1].`,
}

/**
 * The `examples` renders' added section: `registers` with this appended. A fixture with no entry gets no example and
 * renders exactly as `registers`; the examples come from the fixed rule in `renderSceneRegisters.ts`.
 */
export const sceneExamplesGoldens: Record<string, string> = {
    tavern: `Worked examples, about this scene:
Example: if someone picks up [table1], what happens?
- In the world: [saucer1], [cup1] and [candle1] come with it, and nothing else does.
- In the records: (move [table1] to held). What is under it stays under it, so nothing else changes.`,
    siblingFan: `Worked examples, about this scene:
Example: if someone picks up [table1], what happens?
- In the world: [fork1], [knife1], [plate1] and [cup1] come with it, and nothing else does.
- In the records: (move [table1] to held). What is under it stays under it, so nothing else changes.`,
    branchInBranch: `Worked examples, about this scene:
Example: if someone picks up [table1], what happens?
- In the world: [saucer1], [cup1], [candle1], [tray1], [teapot1] and [jug1] come with it, and nothing else does.
- In the records: (move [table1] to held). What is under it stays under it, so nothing else changes.`,
    deepChain: `Worked examples, about this scene:
Example: if someone picks up [table1], what happens?
- In the world: [box1], [bag1] and [coin1] come with it, and nothing else does.
- In the records: (move [table1] to held). What is under it stays under it, so nothing else changes.`,
    lab: `Worked examples, about this scene:
Example: if someone picks up [box1], what happens?
- In the world: [cup1] and [spring1] come with it, and nothing else does.
- In the records: (move [box1] to held). What is under it stays under it, so nothing else changes.`,
    heldInventory: `Worked examples, about this scene:
Example: if someone picks up [bag1], what happens?
- In the world: [coin1] comes with it, and nothing else does.
- In the records: (move [bag1] to held). What is under it stays under it, so nothing else changes.`,
    twoCups: `Worked examples, about this scene:
Example: if someone picks up [table1], what happens?
- In the world: [cup1] comes with it, and nothing else does.
- In the records: (move [table1] to held). What is under it stays under it, so nothing else changes.`,
    dock: `Worked examples, about this scene:
Example: can [boat1] be moved to the floor?
- In the world: not yet, because it is tied to [post1]; it has to be freed first, and then it can be moved.
- In the records: (untie [boat1] from [post1]), then (move [boat1] to the room).`,
    openLegs: `Worked examples, about this scene:
Example: if someone picks up [bag1], what happens?
- In the world: [coin1] comes with it, and nothing else does.
- In the records: (move [bag1] to held). What is under it stays under it, so nothing else changes.`,
    unnamed: `Worked examples, about this scene:
Example: if someone picks up [object1], what happens?
- In the world: [key1] comes with it, and nothing else does.
- In the records: (move [object1] to held). What is under it stays under it, so nothing else changes.`,
    steamerChest: `Worked examples, about this scene:
Example: if someone picks up [steamer-chest1], what happens?
- In the world: [backgammon-set1], [die1] and [chess-set1] come with it, and nothing else does.
- In the records: (move [steamer-chest1] to held). What is under it stays under it, so nothing else changes.`,
    feature: `Worked examples, about this scene:
Example: if someone picks up [altar1], what happens?
- In the world: [candle1] comes with it, and nothing else does.
- In the records: (move [altar1] to held). What is under it stays under it, so nothing else changes.`,
    sideboard: `Worked examples, about this scene:
Example: if someone picks up [sideboard1], what happens?
- In the world: [candle1], [saucer1], [cup1], [tea1], [mug1], [coffee1], [tray1], [teapot1], [jug1], [box1], [fork1], [knife1], [spoon1] and [lamp1] come with it, and nothing else does.
- In the records: (move [sideboard1] to held). What is under it stays under it, so nothing else changes.`,
    teaTable: `Worked examples, about this scene:
Example: if someone picks up [saucer1], what happens?
- In the world: [cup1] and [tea1] come with it, and nothing else does.
- In the records: (move [saucer1] to held). What is under it stays under it, so nothing else changes.
Example: can [teapot1] be moved to the floor?
- In the world: not yet, because it is glued to [table1]; it has to be freed first, and then it can be moved.
- In the records: (untie [teapot1] from [table1]), then (move [teapot1] to the room).`,
}
