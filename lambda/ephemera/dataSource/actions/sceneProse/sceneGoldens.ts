/**
 * The hand-written renders each fixture must produce, per format (sceneProjection Slice 2). Transcribed from the Slice 0 corpus;
 * `join` and `feature` were written in Slice 2. Inline text, not snapshots, so a golden never writes itself.
 */
import type { SceneFormat } from '.'

export const sceneGoldens: Record<string, Record<SceneFormat, string>> = {
    tavern: {
        A: `The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained)
  - [saucer1] Saucer (chipped white china)
    - [cup1] Cup (a red tin cup, fist-sized, light)
  - [candle1] Candle (a stub of tallow in a pewter dish)
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle)
Exits: north to the Street.`,
        D: `The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern
  - [saucer1] Saucer (chipped white china), on [table1]
    - [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
  - [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
        blocks: `The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern: [table1] Table (a long oak trestle, ring-stained) (see below).
On [table1]: [saucer1] Saucer (chipped white china), with [cup1] Cup (a red tin cup, fist-sized, light) on it; [candle1] Candle (a stub of tallow in a pewter dish).
You are holding: [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.`,
    },
    siblingFan: {
        A: `The Dining Room
Contents of the Dining Room:
- [table1] Table
  - [fork1] Fork
  - [knife1] Knife
  - [plate1] Plate
  - [cup1] Cup
You are holding: nothing.`,
        D: `The Dining Room
Contents of the Dining Room:
- [table1] Table, in the Dining Room
  - [fork1] Fork, on [table1]
  - [knife1] Knife, on [table1]
  - [plate1] Plate, on [table1]
  - [cup1] Cup, on [table1]
You are holding: nothing.`,
        blocks: `The Dining Room
In the Dining Room: [table1] Table (see below).
On [table1]: [fork1] Fork; [knife1] Knife; [plate1] Plate; [cup1] Cup.
You are holding: nothing.`,
    },
    branchInBranch: {
        A: `The Tavern: A low-beamed common room, smoky from the hearth.
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
Exits: north to the Street.`,
        D: `The Tavern: A low-beamed common room, smoky from the hearth.
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
        blocks: `The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern: [table1] Table (a long oak trestle, ring-stained) (see below).
On [table1]: [saucer1] Saucer (chipped white china), with [cup1] Cup (a red tin cup, fist-sized, light) on it; [candle1] Candle (a stub of tallow in a pewter dish); [tray1] Tray (a dented copper tray) (see below).
On [tray1]: [teapot1] Teapot (brown glaze, still warm); [jug1] Jug.
You are holding: [hammer1] Hammer (a claw hammer with a taped handle).
Exits: north to the Street.`,
    },
    deepChain: {
        A: `The Study
Contents of the Study:
- [table1] Table
  - [box1] Box
    - [bag1] Bag
      - [coin1] Coin
You are holding: nothing.`,
        D: `The Study
Contents of the Study:
- [table1] Table, in the Study
  - [box1] Box, on [table1]
    - [bag1] Bag, in [box1]
      - [coin1] Coin, in [bag1]
You are holding: nothing.`,
        blocks: `The Study
In the Study: [table1] Table, with [box1] Box on it, which has [bag1] Bag in it, which has [coin1] Coin in it.
You are holding: nothing.`,
    },
    lab: {
        A: `The Lab
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
Exits: east to the Hall.`,
        D: `The Lab
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
        blocks: `The Lab
In the Lab: [box1] Box (a plywood crate, lid off) (see below); [hook1] Hook (an iron hook screwed to the wall), tied to [rope1]; [rope1] Rope (a coil of thick hemp rope) (also in another room), tied to [cup1], with [end1] End as a section.
In [box1]: [cup1] Cup (a red tin cup); [spring1] Spring (a tight steel coil), associated with [contraption1].
Concepts here: [contraption1] Contraption (a half-built mousetrap mechanism).
You are holding: nothing.
Exits: east to the Hall.`,
    },
    heldInventory: {
        A: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred)
  - [lamp1] Lamp (an oil lamp, unlit), is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch)
  - [coin1] Coin
- [rope1] Rope (also on [table1])`,
        D: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
        blocks: `The Kitchen
In the Kitchen: [table1] Table (scrubbed pine, knife-scarred) (see below).
On [table1]: [lamp1] Lamp (an oil lamp, unlit), is near [rope1]; [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1].
You are holding: [bag1] Bag (a drawstring leather pouch), with [coin1] Coin in it; [rope1] Rope (also on [table1]).`,
    },
    twoCups: {
        A: `The Parlour
Contents of the Parlour:
- [table1] Table
  - [cup1] Cup (a red tin cup)
- [cup2] Cup (a chipped china teacup)
You are holding: nothing.`,
        D: `The Parlour
Contents of the Parlour:
- [table1] Table, in the Parlour
  - [cup1] Cup (a red tin cup), on [table1]
- [cup2] Cup (a chipped china teacup), in the Parlour
You are holding: nothing.`,
        blocks: `The Parlour
In the Parlour: [table1] Table, with [cup1] Cup (a red tin cup) on it; [cup2] Cup (a chipped china teacup).
You are holding: nothing.`,
    },
    dock: {
        A: `The Dock
Contents of the Dock:
- [post1] Post
- [boat1] Boat, tied to [post1], secured
- [crate1] Crate
- [ladder1] Ladder, leaning against [crate1]
- [barrel1] Barrel, secured to [post1]
You are holding: nothing.`,
        D: `The Dock
Contents of the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.`,
        blocks: `The Dock
In the Dock: [post1] Post; [boat1] Boat, tied to [post1], secured; [crate1] Crate; [ladder1] Ladder, leaning against [crate1]; [barrel1] Barrel, secured to [post1].
You are holding: nothing.`,
    },
    openLegs: {
        A: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch)
  - [coin1] Coin
- [rope1] Rope (also on [table1])`,
        D: `The Kitchen
Contents of the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen, tied to [bag1] and something someone else is holding
  - [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
  - [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
        blocks: `The Kitchen
In the Kitchen: [table1] Table (scrubbed pine, knife-scarred) (see below), tied to [bag1] and something someone else is holding.
On [table1]: [lamp1] Lamp (an oil lamp, unlit), is near [rope1]; [rope1] Rope (a coil of thick hemp rope) (also held by you), tied to [coin1].
You are holding: [bag1] Bag (a drawstring leather pouch), with [coin1] Coin in it; [rope1] Rope (also on [table1]).`,
    },
    drapedCloth: {
        A: `The Sitting Room
Contents of the Sitting Room:
- [table1] Table
  - [cloth1] Cloth (also in the Sitting Room)
- [cloth1] Cloth (also on [table1])
You are holding: nothing.`,
        D: `The Sitting Room
Contents of the Sitting Room:
- [table1] Table, in the Sitting Room
  - [cloth1] Cloth, on [table1] (also in the Sitting Room)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
You are holding: nothing.`,
        blocks: `The Sitting Room
In the Sitting Room: [table1] Table, with [cloth1] Cloth (also in the Sitting Room) on it; [cloth1] Cloth (also on [table1]).
You are holding: nothing.`,
    },
    unnamed: {
        A: `The Shed
Contents of the Shed:
- [object1] (unnamed object)
  - [key1] Key
- [lantern1] Lantern, hanging from [object1]
You are holding: nothing.`,
        D: `The Shed
Contents of the Shed:
- [object1] (unnamed object), in the Shed
  - [key1] Key, in [object1]
- [lantern1] Lantern, in the Shed, hanging from [object1]
You are holding: nothing.`,
        blocks: `The Shed
In the Shed: [object1] (unnamed object), with [key1] Key in it; [lantern1] Lantern, hanging from [object1].
You are holding: nothing.`,
    },
    emptyRoom: {
        A: `The Cellar
Contents of the Cellar: nothing.
You are holding: nothing.`,
        D: `The Cellar
Contents of the Cellar: nothing.
You are holding: nothing.`,
        blocks: `The Cellar
In the Cellar: nothing.
You are holding: nothing.`,
    },
    steamerChest: {
        A: `The Attic
Contents of the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), associated with [inherited-furniture1] and [boardgames1]
  - [backgammon-set1] Backgammon Set (a folding wooden board)
    - [die1] Die
  - [chess-set1] Chess Set
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away)`,
        D: `The Attic
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
        blocks: `The Attic
In the Attic: [steamer-chest1] Steamer Chest (brass-cornered, labels peeling) (see below), associated with [inherited-furniture1] and [boardgames1].
In [steamer-chest1]: [backgammon-set1] Backgammon Set (a folding wooden board), with [die1] Die in it; [chess-set1] Chess Set.
Concepts here: [inherited-furniture1] Inherited Furniture (the things Gran left to the family); [boardgames1] Boardgames.
You are holding: [spare-die1] Spare Die (an ivory die, one pip worn away).`,
    },
    join: {
        A: `The Dining Room
Contents of the Dining Room:
- [table-a1] Table A
  - [tablecloth1] Tablecloth (also on [table-b1]) (see [fruit-bowl1] below)
- [table-b1] Table B
  - [tablecloth1] Tablecloth (also on [table-a1]) (see [fruit-bowl1] below)
    - [napkin1] Napkin
  - [fruit-bowl1] Fruit Bowl (across [table-a1] and [table-b1])
    - [apple1] Apple
You are holding:
- [pear1] Pear`,
        D: `The Dining Room
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
        blocks: `The Dining Room
In the Dining Room: [table-a1] Table A, with [tablecloth1] Tablecloth (also on [table-b1]) (see [fruit-bowl1] below) on it; [table-b1] Table B (see below).
On [table-b1]: [tablecloth1] Tablecloth (also on [table-a1]) (see [fruit-bowl1] below), with [napkin1] Napkin on it; [fruit-bowl1] Fruit Bowl (across [table-a1] and [table-b1]), with [apple1] Apple in it.
You are holding: [pear1] Pear.`,
    },
    feature: {
        A: `The Chapel: Whitewashed, with plain pews.
Contents of the Chapel:
- [altar1] Altar (a slab of grey stone)
  - [candle1] Candle
- [hymnal1] Hymnal (a cloth-bound hymn book)
You are holding: nothing.`,
        D: `The Chapel: Whitewashed, with plain pews.
Contents of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel
  - [candle1] Candle, on [altar1]
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
        blocks: `The Chapel: Whitewashed, with plain pews.
Parts of the Chapel: [altar1] Altar (a slab of grey stone), with [candle1] Candle on it.
In the Chapel: [hymnal1] Hymnal (a cloth-bound hymn book).
You are holding: nothing.`,
    },
}
