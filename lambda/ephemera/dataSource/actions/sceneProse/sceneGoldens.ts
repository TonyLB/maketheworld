/**
 * The hand-written render each fixture must produce (sceneProjection Slice 2; format D, chosen in Slice 3 by SP-7), and
 * in `fans` (SP-7 reopened, 2026-11-03). Inline text, not snapshots, so a golden never writes itself.
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
