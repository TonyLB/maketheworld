/**
 * The tea table (added in Slice 3, for questions that reason over the structure instead of reading it back): a table
 * with a saucer and a teapot on it; a cup on the saucer with tea in it; tea in the teapot, which is glued to the table
 * (a tie: Custom "glued to", SecuredTo, and the Justifies between them). The glue says how the securing behaves, so a
 * rubric need not guess what a bare SecuredTo allows: Nova 2 Lite tilted a teapot only "secured to" the table to pour
 * it. Two things are called "Tea", so "pour tea" does not say which. The open questions have no computed answer; each
 * carries a rubric written before any batch, which the user grades every answer against.
 */
import { binding, characterId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const parlour = roomId('Parlour')
const actor = characterId('Actor')
const table = objectId('Table')
const saucer = objectId('Saucer')
const cup = objectId('Cup')
const cupTea = objectId('CupTea')
const teapot = objectId('Teapot')
const potTea = objectId('PotTea')

export const teaTableScene: SceneFixture = {
    name: 'teaTable',
    description: 'A saucer with a cup of tea, and a teapot of tea glued to the table: two teas, one of them in a vessel that cannot be taken or tilted.',
    roomId: parlour,
    actorId: actor,
    graphs: [
        hostGraph(parlour, [member(table, 'In'), binding('Base', [], [[table, 'onFloor']])]),
        hostGraph(table, [
            member(saucer, 'On'), member(teapot, 'On'),
            binding('onFloor', [[parlour, 'Base']], [[saucer, 'onTable'], [teapot, 'onTable']]),
        ], {
            edges: [
                { tag: 'Relational', edgeId: 'e1', from: teapot, to: table, kind: 'Custom', relationLabel: 'glued to' },
                { tag: 'Relational', edgeId: 'e2', from: teapot, to: table, kind: 'SecuredTo' },
                { tag: 'Relational', edgeId: 'e3', from: { edgeId: 'e1' }, to: { edgeId: 'e2' }, kind: 'Justifies' },
            ],
        }),
        hostGraph(saucer, [member(cup, 'On'), binding('onTable', [[table, 'onFloor']], [[cup, 'onSaucer']])]),
        hostGraph(cup, [member(cupTea, 'In'), binding('onSaucer', [[saucer, 'onTable']], [[cupTea, 'inCup']])]),
        hostGraph(cupTea, [binding('inCup', [[cup, 'onSaucer']])]),
        hostGraph(teapot, [member(potTea, 'In'), binding('onTable', [[table, 'onFloor']], [[potTea, 'inTeapot']])]),
        hostGraph(potTea, [binding('inTeapot', [[teapot, 'onTable']])]),
        hostGraph(actor, [binding('inRoom', [[parlour, 'Base']])]),
    ],
    names: {
        [parlour]: { shortName: 'Parlour' },
        [table]: { shortName: 'Table', gloss: 'a small round tea table' },
        [saucer]: { shortName: 'Saucer' },
        [cup]: { shortName: 'Cup' },
        [cupTea]: { shortName: 'Tea' },
        [teapot]: { shortName: 'Teapot' },
        [potTea]: { shortName: 'Tea' },
    },
    questions: [
        {
            type: 'open',
            asked: 'Can you pour tea into [saucer1]? If so, how, and what would change?',
            rubric: 'Takes account that [teapot1] is glued to [table1], so it cannot pour where it stands; names the tea in [cup1] as a tea that can be poured; tells the two teas apart.',
        },
        {
            type: 'open',
            asked: 'What would you have to do to move [teapot1] to the floor?',
            rubric: 'Says [teapot1] must first be unglued from [table1]; says the tea in [teapot1] goes with it.',
        },
        {
            type: 'open',
            asked: 'If I pick up [saucer1], what comes with it, what stays behind, and what would change?',
            rubric: '[cup1] and the tea in it come with [saucer1]; [teapot1], its tea and [table1] stay.',
        },
        { type: 'securedTo', target: 'table1' },
        { type: 'directContents', subject: 'table1' },
        { type: 'howMany', name: 'tea' },
    ],
}
