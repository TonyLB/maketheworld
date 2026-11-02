/**
 * Scenes with one shape each and nothing else (corpus scenes 2, 4, 7 and 12): a sibling fan, a deep chain, two things
 * with one short name, and an empty room.
 */
import { binding, characterId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const actor = characterId('Actor')

const diningRoom = roomId('DiningRoom')
const fanTable = objectId('Table')
const [fork, knife, plate, fanCup] = ['Fork', 'Knife', 'Plate', 'Cup'].map(objectId)

export const siblingFanScene: SceneFixture = {
    name: 'siblingFan',
    description: 'A table set with four things: one fan.',
    roomId: diningRoom,
    actorId: actor,
    graphs: [
        hostGraph(diningRoom, [member(fanTable, 'In'), binding('Base', [], [[fanTable, 'onFloor']])]),
        hostGraph(fanTable, [
            ...[fork, knife, plate, fanCup].map((id) => member(id, 'On')),
            binding('onFloor', [[diningRoom, 'Base']], [fork, knife, plate, fanCup].map((id) => [id, 'set'] as const)),
        ]),
        ...[fork, knife, plate, fanCup].map((id) => hostGraph(id, [binding('set', [[fanTable, 'onFloor']])])),
        hostGraph(actor, [binding('inRoom', [[diningRoom, 'Base']])]),
    ],
    names: {
        [diningRoom]: { shortName: 'Dining Room' },
        [fanTable]: { shortName: 'Table' },
        [fork]: { shortName: 'Fork' },
        [knife]: { shortName: 'Knife' },
        [plate]: { shortName: 'Plate' },
        [fanCup]: { shortName: 'Cup' },
    },
    questions: [
        { type: 'directContents', subject: 'table1' },
        { type: 'placedOn', subject: 'knife1' },
        { type: 'movesWith', subject: 'plate1' },
    ],
}

const study = roomId('Study')
const [chainTable, box, bag, coin] = ['Table', 'Box', 'Bag', 'Coin'].map(objectId)

export const deepChainScene: SceneFixture = {
    name: 'deepChain',
    description: 'Four levels with one thing at each: a chain that never branches.',
    roomId: study,
    actorId: actor,
    graphs: [
        hostGraph(study, [member(chainTable, 'In'), binding('Base', [], [[chainTable, 'onFloor']])]),
        hostGraph(chainTable, [member(box, 'On'), binding('onFloor', [[study, 'Base']], [[box, 'onTable']])]),
        hostGraph(box, [member(bag, 'In'), binding('onTable', [[chainTable, 'onFloor']], [[bag, 'inBox']])]),
        hostGraph(bag, [member(coin, 'In'), binding('inBox', [[box, 'onTable']], [[coin, 'inBag']])]),
        hostGraph(coin, [binding('inBag', [[bag, 'inBox']])]),
        hostGraph(actor, [binding('inRoom', [[study, 'Base']])]),
    ],
    names: {
        [study]: { shortName: 'Study' },
        [chainTable]: { shortName: 'Table' },
        [box]: { shortName: 'Box' },
        [bag]: { shortName: 'Bag' },
        [coin]: { shortName: 'Coin' },
    },
    questions: [
        { type: 'placedOn', subject: 'coin1' },
        { type: 'chainOut', subject: 'coin1' },
        { type: 'directContents', subject: 'table1' },
        { type: 'movesWith', subject: 'box1' },
    ],
}

const parlour = roomId('Parlour')
const parlourTable = objectId('Table')
const cupA = objectId('CupA')
const cupB = objectId('CupB')

export const twoCupsScene: SceneFixture = {
    name: 'twoCups',
    description: 'Two things with one short name, numbered where each is placed.',
    roomId: parlour,
    actorId: actor,
    graphs: [
        hostGraph(parlour, [member(parlourTable, 'In'), member(cupB, 'In'), binding('Base', [], [[parlourTable, 'onFloor'], [cupB, 'onFloor']])]),
        hostGraph(parlourTable, [member(cupA, 'On'), binding('onFloor', [[parlour, 'Base']], [[cupA, 'onTable']])]),
        hostGraph(cupA, [binding('onTable', [[parlourTable, 'onFloor']])]),
        hostGraph(cupB, [binding('onFloor', [[parlour, 'Base']])]),
        hostGraph(actor, [binding('inRoom', [[parlour, 'Base']])]),
    ],
    names: {
        [parlour]: { shortName: 'Parlour' },
        [parlourTable]: { shortName: 'Table' },
        [cupA]: { shortName: 'Cup', gloss: 'a red tin cup' },
        [cupB]: { shortName: 'Cup', gloss: 'a chipped china teacup' },
    },
    questions: [
        { type: 'directContents', subject: 'table1' },
        { type: 'whereIs', subject: 'cup2' },
        { type: 'directContents', subject: 'table1', asked: 'Which cup is on the table?' },
        { type: 'whereIs', subject: 'cup2', asked: 'Where is the china teacup?' },
    ],
}

const cellar = roomId('Cellar')

export const emptyRoomScene: SceneFixture = {
    name: 'emptyRoom',
    description: 'An empty room, the actor holding nothing.',
    roomId: cellar,
    actorId: actor,
    graphs: [
        hostGraph(cellar, [binding('Base', [])]),
        hostGraph(actor, [binding('inRoom', [[cellar, 'Base']])]),
    ],
    names: { [cellar]: { shortName: 'Cellar' } },
    questions: [
        { type: 'directContents' },
        { type: 'held' },
    ],
}
