/**
 * The tavern (corpus scenes 1 and 3): a table holding a saucer with a cup on it and a candle, so the reader has to climb
 * back out of a subtree; the actor holds a hammer. `branchInBranch` adds a tray with a teapot and a jug, a fan inside a fan.
 */
import { binding, characterId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const tavern = roomId('Tavern')
const actor = characterId('Actor')
const table = objectId('Table')
const saucer = objectId('Saucer')
const cup = objectId('Cup')
const candle = objectId('Candle')
const hammer = objectId('Hammer')
const tray = objectId('Tray')
const teapot = objectId('Teapot')
const jug = objectId('Jug')

const names: SceneFixture['names'] = {
    [tavern]: { shortName: 'Tavern', gloss: 'A low-beamed common room, smoky from the hearth.' },
    [table]: { shortName: 'Table', gloss: 'a long oak trestle, ring-stained' },
    [saucer]: { shortName: 'Saucer', gloss: 'chipped white china' },
    [cup]: { shortName: 'Cup', gloss: 'a red tin cup, fist-sized, light' },
    [candle]: { shortName: 'Candle', gloss: 'a stub of tallow in a pewter dish' },
    [hammer]: { shortName: 'Hammer', gloss: 'a claw hammer with a taped handle' },
}

const sharedGraphs = (): SceneFixture['graphs'] => [
    hostGraph(tavern, [member(table, 'In'), binding('Base', [], [[table, 'onFloor']])]),
    hostGraph(saucer, [member(cup, 'On'), binding('onTable', [[table, 'onFloor']], [[cup, 'onSaucer']])]),
    hostGraph(cup, [binding('onSaucer', [[saucer, 'onTable']])]),
    hostGraph(candle, [binding('onTable', [[table, 'onFloor']])]),
    hostGraph(actor, [member(hammer, 'Held'), binding('inRoom', [[tavern, 'Base']], [[hammer, 'held']])]),
    hostGraph(hammer, [binding('held', [[actor, 'inRoom']])]),
]

export const tavernScene: SceneFixture = {
    name: 'tavern',
    description: 'A nested subtree with a sibling after it, a room gloss, held inventory and an exit.',
    roomId: tavern,
    actorId: actor,
    graphs: [
        ...sharedGraphs(),
        hostGraph(table, [
            member(saucer, 'On'), member(candle, 'On'),
            binding('onFloor', [[tavern, 'Base']], [[saucer, 'onTable'], [candle, 'onTable']]),
        ]),
    ],
    names,
    exits: [{ name: 'north', to: 'Street' }],
    questions: [
        { type: 'directContents', subject: 'table1' },
        { type: 'placedOn', subject: 'cup1' },
        { type: 'movesWith', subject: 'table1' },
        { type: 'movesWith', subject: 'saucer1' },
        { type: 'held' },
        { type: 'placedOn', subject: 'candle1', asked: 'What is [candle1] in?' },
    ],
}

export const branchInBranchScene: SceneFixture = {
    name: 'branchInBranch',
    description: 'The tavern with a tray of two things on the table: a branch inside a branch.',
    roomId: tavern,
    actorId: actor,
    graphs: [
        ...sharedGraphs(),
        hostGraph(table, [
            member(saucer, 'On'), member(candle, 'On'), member(tray, 'On'),
            binding('onFloor', [[tavern, 'Base']], [[saucer, 'onTable'], [candle, 'onTable'], [tray, 'onTable']]),
        ]),
        hostGraph(tray, [
            member(teapot, 'On'), member(jug, 'On'),
            binding('onTable', [[table, 'onFloor']], [[teapot, 'onTray'], [jug, 'onTray']]),
        ]),
        hostGraph(teapot, [binding('onTray', [[tray, 'onTable']])]),
        hostGraph(jug, [binding('onTray', [[tray, 'onTable']])]),
    ],
    names: {
        ...names,
        [tray]: { shortName: 'Tray', gloss: 'a dented copper tray' },
        [teapot]: { shortName: 'Teapot', gloss: 'brown glaze, still warm' },
        [jug]: { shortName: 'Jug' },
    },
    exits: [{ name: 'north', to: 'Street' }],
    questions: [
        { type: 'directContents', subject: 'table1' },
        { type: 'directContents', subject: 'tray1' },
        { type: 'placedOn', subject: 'jug1' },
        { type: 'placedOn', subject: 'candle1' },
        { type: 'movesWith', subject: 'tray1' },
    ],
}
