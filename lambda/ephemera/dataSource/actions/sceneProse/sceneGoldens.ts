/**
 * The hand-written renders each fixture must produce, per format (sceneProjection Slice 2). Transcribed from the Slice 0 corpus;
 * `join` and `feature` were written in Slice 2; `blocksD`, `blocksDLabelled`, `sideboard` and `teaTable` in Slice 3. Inline text, not snapshots, so a golden never writes itself.
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
        blocksD: `The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern (see below)
On [table1]:
- [saucer1] Saucer (chipped white china), on [table1]
- [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
- [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
        blocksDLabelled: `The Tavern: A low-beamed common room, smoky from the hearth.
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
        blocksD: `The Dining Room
In the Dining Room:
- [table1] Table, in the Dining Room (see below)
On [table1]:
- [fork1] Fork, on [table1]
- [knife1] Knife, on [table1]
- [plate1] Plate, on [table1]
- [cup1] Cup, on [table1]
You are holding: nothing.`,
        blocksDLabelled: `The Dining Room
Directly in the Dining Room:
- [table1] Table, in the Dining Room (see below)
Directly on [table1]:
- [fork1] Fork, on [table1]
- [knife1] Knife, on [table1]
- [plate1] Plate, on [table1]
- [cup1] Cup, on [table1]
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
        blocksD: `The Tavern: A low-beamed common room, smoky from the hearth.
In the Tavern:
- [table1] Table (a long oak trestle, ring-stained), in the Tavern (see below)
On [table1]:
- [saucer1] Saucer (chipped white china), on [table1]
- [cup1] Cup (a red tin cup, fist-sized, light), on [saucer1]
- [candle1] Candle (a stub of tallow in a pewter dish), on [table1]
- [tray1] Tray (a dented copper tray), on [table1] (see below)
On [tray1]:
- [teapot1] Teapot (brown glaze, still warm), on [tray1]
- [jug1] Jug, on [tray1]
You are holding:
- [hammer1] Hammer (a claw hammer with a taped handle), held by you
Exits: north to the Street.`,
        blocksDLabelled: `The Tavern: A low-beamed common room, smoky from the hearth.
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
        blocksD: `The Study
In the Study:
- [table1] Table, in the Study (see below)
On [table1]:
- [box1] Box, on [table1] (see below)
In [box1]:
- [bag1] Bag, in [box1]
- [coin1] Coin, in [bag1]
You are holding: nothing.`,
        blocksDLabelled: `The Study
Directly in the Study:
- [table1] Table, in the Study (see below)
[table1] and what is on or in it, in layers:
- [box1] Box, on [table1]
- [bag1] Bag, in [box1]
- [coin1] Coin, in [bag1]
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
        blocksD: `The Lab
In the Lab:
- [box1] Box (a plywood crate, lid off), in the Lab (see below)
- [hook1] Hook (an iron hook screwed to the wall), in the Lab, tied to [rope1]
- [rope1] Rope (a coil of thick hemp rope), in the Lab (also in another room), tied to [cup1]
- [end1] End, a section of [rope1]
In [box1]:
- [cup1] Cup (a red tin cup), in [box1]
- [spring1] Spring (a tight steel coil), in [box1], associated with [contraption1]
Concepts here:
- [contraption1] Contraption (a half-built mousetrap mechanism)
You are holding: nothing.
Exits: east to the Hall.`,
        blocksDLabelled: `The Lab
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
        blocksD: `The Kitchen
In the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen (see below)
On [table1]:
- [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
- [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
- [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
        blocksDLabelled: `The Kitchen
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
        blocksD: `The Parlour
In the Parlour:
- [table1] Table, in the Parlour
- [cup1] Cup (a red tin cup), on [table1]
- [cup2] Cup (a chipped china teacup), in the Parlour
You are holding: nothing.`,
        blocksDLabelled: `The Parlour
Directly in the Parlour:
- [table1] Table, in the Parlour (see below)
- [cup2] Cup (a chipped china teacup), in the Parlour
Directly on [table1]:
- [cup1] Cup (a red tin cup), on [table1]
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
        blocksD: `The Dock
In the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
You are holding: nothing.`,
        blocksDLabelled: `The Dock
Directly in the Dock:
- [post1] Post, in the Dock
- [boat1] Boat, in the Dock, tied to [post1], secured
- [crate1] Crate, in the Dock
- [ladder1] Ladder, in the Dock, leaning against [crate1]
- [barrel1] Barrel, in the Dock, secured to [post1]
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
        blocksD: `The Kitchen
In the Kitchen:
- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen (see below), tied to [bag1] and something someone else is holding
On [table1]:
- [lamp1] Lamp (an oil lamp, unlit), on [table1], is near [rope1]
- [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you), tied to [coin1]
You are holding:
- [bag1] Bag (a drawstring leather pouch), held by you
- [coin1] Coin, in [bag1]
- [rope1] Rope, held by you (also on [table1])`,
        blocksDLabelled: `The Kitchen
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
        blocksD: `The Sitting Room
In the Sitting Room:
- [table1] Table, in the Sitting Room
- [cloth1] Cloth, on [table1] (also in the Sitting Room)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
You are holding: nothing.`,
        blocksDLabelled: `The Sitting Room
Directly in the Sitting Room:
- [table1] Table, in the Sitting Room (see below)
- [cloth1] Cloth, in the Sitting Room (also on [table1])
Directly on [table1]:
- [cloth1] Cloth, on [table1] (also in the Sitting Room)
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
        blocksD: `The Shed
In the Shed:
- [object1] (unnamed object), in the Shed
- [key1] Key, in [object1]
- [lantern1] Lantern, in the Shed, hanging from [object1]
You are holding: nothing.`,
        blocksDLabelled: `The Shed
Directly in the Shed:
- [object1] (unnamed object), in the Shed (see below)
- [lantern1] Lantern, in the Shed, hanging from [object1]
Directly in [object1]:
- [key1] Key, in [object1]
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
        blocksD: `The Cellar
In the Cellar: nothing.
You are holding: nothing.`,
        blocksDLabelled: `The Cellar
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
        blocksD: `The Attic
In the Attic:
- [steamer-chest1] Steamer Chest (brass-cornered, labels peeling), in the Attic (see below), associated with [inherited-furniture1] and [boardgames1]
In [steamer-chest1]:
- [backgammon-set1] Backgammon Set (a folding wooden board), in [steamer-chest1]
- [die1] Die, in [backgammon-set1]
- [chess-set1] Chess Set, in [steamer-chest1]
Concepts here:
- [inherited-furniture1] Inherited Furniture (the things Gran left to the family)
- [boardgames1] Boardgames
You are holding:
- [spare-die1] Spare Die (an ivory die, one pip worn away), held by you`,
        blocksDLabelled: `The Attic
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
        blocksD: `The Dining Room
In the Dining Room:
- [table-a1] Table A, in the Dining Room
- [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1]) (see [fruit-bowl1] below)
- [table-b1] Table B, in the Dining Room (see below)
On [table-b1]:
- [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1]) (see [fruit-bowl1] below)
- [napkin1] Napkin, on [tablecloth1]
- [fruit-bowl1] Fruit Bowl, on [tablecloth1] (across [table-a1] and [table-b1])
- [apple1] Apple, in [fruit-bowl1]
You are holding:
- [pear1] Pear, held by you`,
        blocksDLabelled: `The Dining Room
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
        blocksD: `The Chapel: Whitewashed, with plain pews.
Parts of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel
- [candle1] Candle, on [altar1]
In the Chapel:
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
        blocksDLabelled: `The Chapel: Whitewashed, with plain pews.
Parts of the Chapel:
- [altar1] Altar (a slab of grey stone), part of the Chapel (see below)
Directly on [altar1]:
- [candle1] Candle, on [altar1]
Directly in the Chapel:
- [hymnal1] Hymnal (a cloth-bound hymn book), in the Chapel
You are holding: nothing.`,
    },
    sideboard: {
        A: `The Dining Room
Contents of the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard)
  - [candle1] Candle
  - [saucer1] Saucer
    - [cup1] Cup
      - [tea1] Tea
  - [mug1] Mug
    - [coffee1] Coffee
  - [tray1] Tray
    - [teapot1] Teapot
    - [jug1] Jug
  - [box1] Box
    - [fork1] Fork
    - [knife1] Knife
    - [spoon1] Spoon
  - [lamp1] Lamp
You are holding: nothing.`,
        D: `The Dining Room
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
        blocks: `The Dining Room
In the Dining Room: [sideboard1] Sideboard (a long walnut sideboard) (see below).
On [sideboard1]: [candle1] Candle; [saucer1] Saucer, with [cup1] Cup on it, which has [tea1] Tea in it; [mug1] Mug, with [coffee1] Coffee in it; [tray1] Tray (see below); [box1] Box (see below); [lamp1] Lamp.
On [tray1]: [teapot1] Teapot; [jug1] Jug.
In [box1]: [fork1] Fork; [knife1] Knife; [spoon1] Spoon.
You are holding: nothing.`,
        blocksD: `The Dining Room
In the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard), in the Dining Room (see below)
On [sideboard1]:
- [candle1] Candle, on [sideboard1]
- [saucer1] Saucer, on [sideboard1] (see below)
- [mug1] Mug, on [sideboard1]
- [coffee1] Coffee, in [mug1]
- [tray1] Tray, on [sideboard1] (see below)
- [box1] Box, on [sideboard1] (see below)
- [lamp1] Lamp, on [sideboard1]
On [saucer1]:
- [cup1] Cup, on [saucer1]
- [tea1] Tea, in [cup1]
On [tray1]:
- [teapot1] Teapot, on [tray1]
- [jug1] Jug, on [tray1]
In [box1]:
- [fork1] Fork, in [box1]
- [knife1] Knife, in [box1]
- [spoon1] Spoon, in [box1]
You are holding: nothing.`,
        blocksDLabelled: `The Dining Room
Directly in the Dining Room:
- [sideboard1] Sideboard (a long walnut sideboard), in the Dining Room (see below)
Directly on [sideboard1]:
- [candle1] Candle, on [sideboard1]
- [saucer1] Saucer, on [sideboard1] (see below)
- [mug1] Mug, on [sideboard1] (see below)
- [tray1] Tray, on [sideboard1] (see below)
- [box1] Box, on [sideboard1] (see below)
- [lamp1] Lamp, on [sideboard1]
[saucer1] and what is on or in it, in layers:
- [cup1] Cup, on [saucer1]
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
    },
    teaTable: {
        A: `The Parlour
Contents of the Parlour:
- [table1] Table (a small round tea table)
  - [saucer1] Saucer
    - [cup1] Cup
      - [tea1] Tea
  - [teapot1] Teapot, glued to [table1], secured
    - [tea2] Tea
You are holding: nothing.`,
        D: `The Parlour
Contents of the Parlour:
- [table1] Table (a small round tea table), in the Parlour
  - [saucer1] Saucer, on [table1]
    - [cup1] Cup, on [saucer1]
      - [tea1] Tea, in [cup1]
  - [teapot1] Teapot, on [table1], glued to [table1], secured
    - [tea2] Tea, in [teapot1]
You are holding: nothing.`,
        blocks: `The Parlour
In the Parlour: [table1] Table (a small round tea table) (see below).
On [table1]: [saucer1] Saucer, with [cup1] Cup on it, which has [tea1] Tea in it; [teapot1] Teapot, glued to [table1], secured, with [tea2] Tea in it.
You are holding: nothing.`,
        blocksD: `The Parlour
In the Parlour:
- [table1] Table (a small round tea table), in the Parlour (see below)
On [table1]:
- [saucer1] Saucer, on [table1] (see below)
- [teapot1] Teapot, on [table1], glued to [table1], secured
- [tea2] Tea, in [teapot1]
On [saucer1]:
- [cup1] Cup, on [saucer1]
- [tea1] Tea, in [cup1]
You are holding: nothing.`,
        blocksDLabelled: `The Parlour
Directly in the Parlour:
- [table1] Table (a small round tea table), in the Parlour (see below)
Directly on [table1]:
- [saucer1] Saucer, on [table1] (see below)
- [teapot1] Teapot, on [table1] (see below), glued to [table1], secured
[saucer1] and what is on or in it, in layers:
- [cup1] Cup, on [saucer1]
- [tea1] Tea, in [cup1]
Directly in [teapot1]:
- [tea2] Tea, in [teapot1]
You are holding: nothing.`,
    },
}
