/**
 * The primer's Lab (corpus scene 5; `positions/AGENT.ludicNetwork.md`, "The running example"): a box with a cup and a
 * spring, the spring also associated with a contraption (a Concept), a hook, and a rope tied to the hook and, across the
 * box's boundary, to the cup. The rope's far end is in the Hall, which the cache does not hold.
 */

import { binding, characterId, conceptId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const lab = roomId('Lab')
const hall = roomId('Hall')
const actor = characterId('Actor')
const box = objectId('Box')
const cup = objectId('Cup')
const spring = objectId('Spring')
const contraption = conceptId('Contraption')
const hook = objectId('Hook')
const rope = objectId('Rope')
const endA = objectId('RopeEndA')
const endB = objectId('RopeEndB')
const crossing = { owner: box, port: 'PORT-8f3a' } as const
const tiedTo = { kind: 'Custom', relationLabel: 'tied to' } as const

export const labScene: SceneFixture = {
    name: 'lab',
    description: 'A composed crossing, a Concept with a member placed elsewhere, and a rope with one end in another room.',
    roomId: lab,
    actorId: actor,
    graphs: [
        hostGraph(lab, [
            member(box, 'In'), member(hook, 'In'), member(rope, 'In'), member(contraption, 'Associated'),
            binding('Base', [], [[box, 'inLab'], [hook, 'inLab'], [rope, 'p1'], [contraption, 'inLab']]),
        ], {
            edges: [
                { tag: 'Relational', from: hook, to: rope, ...tiedTo },
                { tag: 'Relational', from: rope, to: crossing, ...tiedTo },
            ],
        }),
        hostGraph(box, [
            member(cup, 'In'), member(spring, 'In'),
            binding('inLab', [[lab, 'Base']], [[cup, 'inBox'], [spring, 'inBox']]),
        ], {
            edges: [{ tag: 'Relational', from: crossing, to: cup, ...tiedTo }],
            ports: [{ portId: crossing.port, fromHostId: lab, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
        }),
        hostGraph(cup, [binding('inBox', [[box, 'inLab']])]),
        hostGraph(spring, [binding('inBox', [[box, 'inLab']]), binding('assoc', [[contraption, 'inLab']])]),
        hostGraph(contraption, [member(spring, 'Associated'), binding('inLab', [[lab, 'Base']], [[spring, 'assoc']])]),
        hostGraph(hook, [binding('inLab', [[lab, 'Base']])]),
        hostGraph(rope, [
            member(endA, 'SectionOf'), member(endB, 'SectionOf'),
            binding('p1', [[lab, 'Base']], [[endA, 'inP1']]),
            binding('p2', [[hall, 'Base']], [[endB, 'inP2']]),
        ], {
            edges: [{ tag: 'Relational', from: endA, to: endB, kind: 'ConnectedTo' }],
        }),
        hostGraph(endA, [binding('inP1', [[rope, 'p1']])]),
        hostGraph(endB, [binding('inP2', [[rope, 'p2']])]),
        hostGraph(actor, [binding('inRoom', [[lab, 'Base']])]),
    ],
    names: {
        [lab]: { shortName: 'Lab' },
        [box]: { shortName: 'Box', gloss: 'a plywood crate, lid off' },
        [cup]: { shortName: 'Cup', gloss: 'a red tin cup' },
        [spring]: { shortName: 'Spring', gloss: 'a tight steel coil' },
        [contraption]: { shortName: 'Contraption', gloss: 'a half-built mousetrap mechanism' },
        [hook]: { shortName: 'Hook', gloss: 'an iron hook screwed to the wall' },
        [rope]: { shortName: 'Rope', gloss: 'a coil of thick hemp rope' },
        [endA]: { shortName: 'End' },
        [endB]: { shortName: 'End' },
    },
    exits: [{ name: 'east', to: 'Hall' }],
    questions: [
        { type: 'directContents', subject: 'box1' },
        { type: 'relatedTo', subject: 'rope1', label: 'tied to' },
        { type: 'associatedWith', subject: 'contraption1' },
        { type: 'movesWith', subject: 'box1' },
        { type: 'whereIs', subject: 'rope1' },
    ],
}
