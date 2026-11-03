/**
 * The sideboard (added in Slice 3, when grouped formats were candidates against D): one host whose direct members are
 * spread apart by subtrees of every shape. A candle (a leaf); a saucer with a cup with tea in it (a chain two deep); a mug
 * with coffee in it (a chain one deep); a tray with a teapot and a jug (a fan); a box of three pieces of cutlery (a fan); and a lamp last, after all of them. No glosses below the sideboard, so nothing but
 * the structure says where a thing is.
 */
import { binding, characterId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const diningRoom = roomId('DiningRoom')
const actor = characterId('Actor')
const sideboard = objectId('Sideboard')
const candle = objectId('Candle')
const saucer = objectId('Saucer')
const cup = objectId('Cup')
const tea = objectId('Tea')
const mug = objectId('Mug')
const coffee = objectId('Coffee')
const tray = objectId('Tray')
const teapot = objectId('Teapot')
const jug = objectId('Jug')
const box = objectId('Box')
const fork = objectId('Fork')
const knife = objectId('Knife')
const spoon = objectId('Spoon')
const lamp = objectId('Lamp')

const onSideboard = [candle, saucer, mug, tray, box, lamp]

export const sideboardScene: SceneFixture = {
    name: 'sideboard',
    description: 'One host whose members are spread apart by a two-deep chain, a one-deep chain and two fans, with a leaf last.',
    roomId: diningRoom,
    actorId: actor,
    graphs: [
        hostGraph(diningRoom, [member(sideboard, 'In'), binding('Base', [], [[sideboard, 'onFloor']])]),
        hostGraph(sideboard, [
            ...onSideboard.map((id) => member(id, 'On')),
            binding('onFloor', [[diningRoom, 'Base']], onSideboard.map((id) => [id, 'onSideboard'] as const)),
        ]),
        hostGraph(candle, [binding('onSideboard', [[sideboard, 'onFloor']])]),
        hostGraph(saucer, [member(cup, 'On'), binding('onSideboard', [[sideboard, 'onFloor']], [[cup, 'onSaucer']])]),
        hostGraph(cup, [member(tea, 'In'), binding('onSaucer', [[saucer, 'onSideboard']], [[tea, 'inCup']])]),
        hostGraph(tea, [binding('inCup', [[cup, 'onSaucer']])]),
        hostGraph(mug, [member(coffee, 'In'), binding('onSideboard', [[sideboard, 'onFloor']], [[coffee, 'inMug']])]),
        hostGraph(coffee, [binding('inMug', [[mug, 'onSideboard']])]),
        hostGraph(tray, [
            member(teapot, 'On'), member(jug, 'On'),
            binding('onSideboard', [[sideboard, 'onFloor']], [[teapot, 'onTray'], [jug, 'onTray']]),
        ]),
        hostGraph(teapot, [binding('onTray', [[tray, 'onSideboard']])]),
        hostGraph(jug, [binding('onTray', [[tray, 'onSideboard']])]),
        hostGraph(box, [
            member(fork, 'In'), member(knife, 'In'), member(spoon, 'In'),
            binding('onSideboard', [[sideboard, 'onFloor']], [[fork, 'inBox'], [knife, 'inBox'], [spoon, 'inBox']]),
        ]),
        hostGraph(fork, [binding('inBox', [[box, 'onSideboard']])]),
        hostGraph(knife, [binding('inBox', [[box, 'onSideboard']])]),
        hostGraph(spoon, [binding('inBox', [[box, 'onSideboard']])]),
        hostGraph(lamp, [binding('onSideboard', [[sideboard, 'onFloor']])]),
        hostGraph(actor, [binding('inRoom', [[diningRoom, 'Base']])]),
    ],
    names: {
        [diningRoom]: { shortName: 'Dining Room' },
        [sideboard]: { shortName: 'Sideboard', gloss: 'a long walnut sideboard' },
        [candle]: { shortName: 'Candle' },
        [saucer]: { shortName: 'Saucer' },
        [cup]: { shortName: 'Cup' },
        [tea]: { shortName: 'Tea' },
        [mug]: { shortName: 'Mug' },
        [coffee]: { shortName: 'Coffee' },
        [tray]: { shortName: 'Tray' },
        [teapot]: { shortName: 'Teapot' },
        [jug]: { shortName: 'Jug' },
        [box]: { shortName: 'Box' },
        [fork]: { shortName: 'Fork' },
        [knife]: { shortName: 'Knife' },
        [spoon]: { shortName: 'Spoon' },
        [lamp]: { shortName: 'Lamp' },
    },
    questions: [
        { type: 'directContents', subject: 'sideboard1' },
        { type: 'directContents', subject: 'saucer1' },
        { type: 'directContents', subject: 'mug1' },
        { type: 'placedOn', subject: 'tea1' },
        { type: 'placedOn', subject: 'lamp1' },
        { type: 'movesWith', subject: 'saucer1' },
        { type: 'directContents', subject: 'box1' },
    ],
}
