/**
 * Scenes about placement (corpus scenes 10 and 13, plus two added in Slice 1): a cloth draped from a table to the floor
 * (one thing, two bindings), a bowl on the seam of a cloth spread over two tables (one binding, two parents: a join,
 * SP-9), an object on a Feature, and a chest placed on the floor and associated with two Concepts (association is not
 * placement).
 */
import { binding, characterId, conceptId, featureId, hostGraph, member, objectId, presence, roomId, type SceneFixture } from './worldBuilders'

const actor = characterId('Actor')

const sittingRoom = roomId('SittingRoom')
const drapeTable = objectId('Table')
const cloth = objectId('Cloth')

export const drapedClothScene: SceneFixture = {
    name: 'drapedCloth',
    description: 'A cloth with one binding on the table and one on the floor: one thing, two lines.',
    roomId: sittingRoom,
    actorId: actor,
    graphs: [
        hostGraph(sittingRoom, [
            member(drapeTable, 'In'), member(cloth, 'In'),
            binding('Base', [], [[drapeTable, 'onFloor'], [cloth, 'onFloor']]),
        ]),
        hostGraph(drapeTable, [member(cloth, 'On'), binding('onFloor', [[sittingRoom, 'Base']], [[cloth, 'overTable']])]),
        hostGraph(cloth, [
            binding('overTable', [[drapeTable, 'onFloor']]),
            binding('onFloor', [[sittingRoom, 'Base']]),
        ], {
            // What extend writes between a whole's two bindings.
            edges: [{ tag: 'Relational', from: { owner: cloth, port: presence('overTable') }, to: { owner: cloth, port: presence('onFloor') }, kind: 'ConnectedTo' }],
        }),
        hostGraph(actor, [binding('inRoom', [[sittingRoom, 'Base']])]),
    ],
    names: {
        [sittingRoom]: { shortName: 'Sitting Room' },
        [drapeTable]: { shortName: 'Table' },
        [cloth]: { shortName: 'Cloth' },
    },
    questions: [
        { type: 'whereIs', subject: 'cloth1' },
        { type: 'howMany', name: 'Cloth' },
        { type: 'movesWith', subject: 'table1' },
    ],
}

const diningRoom = roomId('DiningRoom')
const tableA = objectId('TableA')
const tableB = objectId('TableB')
const tablecloth = objectId('Tablecloth')
const bowl = objectId('FruitBowl')
const napkin = objectId('Napkin')
const apple = objectId('Apple')
const tess = characterId('Tess')
const pear = objectId('Pear')

/** The PR-25 payoff world (`presenceParentSets.payoff.test.ts`), with Tess standing in the room. */
export const joinScene: SceneFixture = {
    name: 'join',
    description: 'A bowl on the seam of a cloth spread over two tables: one binding under both of the cloth\'s bindings.',
    roomId: diningRoom,
    actorId: tess,
    graphs: [
        hostGraph(diningRoom, [
            member(tableA, 'In'), member(tableB, 'In'),
            binding('Base', [], [[tableA, 'inRoom'], [tableB, 'inRoom']]),
        ]),
        hostGraph(tableA, [member(tablecloth, 'On'), binding('inRoom', [[diningRoom, 'Base']], [[tablecloth, 'overA']])]),
        hostGraph(tableB, [member(tablecloth, 'On'), binding('inRoom', [[diningRoom, 'Base']], [[tablecloth, 'overB']])]),
        hostGraph(tablecloth, [
            member(bowl, 'On'), member(napkin, 'On'),
            binding('overA', [[tableA, 'inRoom']], [[bowl, 'bowl']]),
            binding('overB', [[tableB, 'inRoom']], [[bowl, 'bowl'], [napkin, 'napkin']]),
        ]),
        hostGraph(bowl, [member(apple, 'In'), binding('bowl', [[tablecloth, 'overA'], [tablecloth, 'overB']], [[apple, 'apple']])]),
        hostGraph(napkin, [binding('napkin', [[tablecloth, 'overB']])]),
        hostGraph(apple, [binding('apple', [[bowl, 'bowl']])]),
        hostGraph(tess, [member(pear, 'Held'), binding('inRoom', [[diningRoom, 'Base']], [[pear, 'pear']])]),
        hostGraph(pear, [binding('pear', [[tess, 'inRoom']])]),
    ],
    names: {
        [diningRoom]: { shortName: 'Dining Room' },
        [tableA]: { shortName: 'Table A' },
        [tableB]: { shortName: 'Table B' },
        [tablecloth]: { shortName: 'Tablecloth' },
        [bowl]: { shortName: 'Fruit Bowl' },
        [napkin]: { shortName: 'Napkin' },
        [apple]: { shortName: 'Apple' },
        [pear]: { shortName: 'Pear' },
    },
    questions: [
        { type: 'directContents', subject: 'tablecloth1' },
        { type: 'placedOn', subject: 'fruit-bowl1' },
        { type: 'movesWith', subject: 'fruit-bowl1' },
        { type: 'held' },
    ],
}

const chapel = roomId('Chapel')
const altar = featureId('Altar')
const candle = objectId('Candle')
const hymnal = objectId('Hymnal')

export const featureScene: SceneFixture = {
    name: 'feature',
    description: 'An altar (a Feature, part of the room) with a candle on it, beside a hymnal on the floor.',
    roomId: chapel,
    actorId: actor,
    graphs: [
        hostGraph(chapel, [
            member(altar, 'PartOf'), member(hymnal, 'In'),
            binding('Base', [], [[altar, 'inChapel'], [hymnal, 'inChapel']]),
        ]),
        hostGraph(altar, [member(candle, 'On'), binding('inChapel', [[chapel, 'Base']], [[candle, 'onAltar']])]),
        hostGraph(candle, [binding('onAltar', [[altar, 'inChapel']])]),
        hostGraph(hymnal, [binding('inChapel', [[chapel, 'Base']])]),
        hostGraph(actor, [binding('inRoom', [[chapel, 'Base']])]),
    ],
    names: {
        [chapel]: { shortName: 'Chapel', gloss: 'Whitewashed, with plain pews.' },
        [altar]: { shortName: 'Altar', gloss: 'a slab of grey stone' },
        [candle]: { shortName: 'Candle' },
        [hymnal]: { shortName: 'Hymnal', gloss: 'a cloth-bound hymn book' },
    },
    questions: [
        { type: 'directContents' },
        { type: 'directContents', subject: 'altar1' },
        { type: 'placedOn', subject: 'candle1' },
    ],
}

const attic = roomId('Attic')
const furniture = conceptId('InheritedFurniture')
const boardgames = conceptId('Boardgames')
const chest = objectId('SteamerChest')
const backgammon = objectId('Backgammon')
const chess = objectId('Chess')
const die = objectId('Die')
const tessAttic = characterId('Tess')
const spareDie = objectId('SpareDie')

/** PR-C5's world as corrected 2026-11-02 (`presenceParentSets.concepts.payoff.test.ts`). */
export const steamerChestScene: SceneFixture = {
    name: 'steamerChest',
    description: 'A chest placed on the floor and associated with two Concepts: association is not placement.',
    roomId: attic,
    actorId: tessAttic,
    graphs: [
        hostGraph(attic, [
            member(chest, 'In'), member(furniture, 'Associated'), member(boardgames, 'Associated'),
            binding('Base', [], [[chest, 'onFloor'], [furniture, 'inAttic'], [boardgames, 'inAttic']]),
        ]),
        hostGraph(furniture, [member(chest, 'Associated'), binding('inAttic', [[attic, 'Base']], [[chest, 'asFurniture']])]),
        hostGraph(boardgames, [member(chest, 'Associated'), binding('inAttic', [[attic, 'Base']], [[chest, 'asBoardgames']])]),
        hostGraph(chest, [
            member(backgammon, 'In'), member(chess, 'In'),
            binding('onFloor', [[attic, 'Base']], [[backgammon, 'bg'], [chess, 'chess']]),
            binding('asFurniture', [[furniture, 'inAttic']]),
            binding('asBoardgames', [[boardgames, 'inAttic']]),
        ]),
        hostGraph(backgammon, [member(die, 'In'), binding('bg', [[chest, 'onFloor']], [[die, 'die']])]),
        hostGraph(chess, [binding('chess', [[chest, 'onFloor']])]),
        hostGraph(die, [binding('die', [[backgammon, 'bg']])]),
        hostGraph(tessAttic, [member(spareDie, 'Held'), binding('inAttic', [[attic, 'Base']], [[spareDie, 'spare']])]),
        hostGraph(spareDie, [binding('spare', [[tessAttic, 'inAttic']])]),
    ],
    names: {
        [attic]: { shortName: 'Attic' },
        [furniture]: { shortName: 'Inherited Furniture', gloss: 'the things Gran left to the family' },
        [boardgames]: { shortName: 'Boardgames' },
        [chest]: { shortName: 'Steamer Chest', gloss: 'brass-cornered, labels peeling' },
        [backgammon]: { shortName: 'Backgammon Set', gloss: 'a folding wooden board' },
        [chess]: { shortName: 'Chess Set' },
        [die]: { shortName: 'Die' },
        [spareDie]: { shortName: 'Spare Die', gloss: 'an ivory die, one pip worn away' },
    },
    questions: [
        { type: 'directContents', subject: 'steamer-chest1' },
        { type: 'associatedWith', subject: 'steamer-chest1' },
        { type: 'associatedWith', subject: 'boardgames1' },
        { type: 'movesWith', subject: 'steamer-chest1' },
        { type: 'held' },
    ],
}
