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

/** Words that would mean the reply prescribes a way past the glue, where the judge only names the obstacle (a reading aid). */
const prescribedFixes = ['unglue', 'pry', 'scrape', 'solvent', 'screwdriver', 'free', 'remove', 'detach', 'break', 'cut']

export const teaTableScene: SceneFixture = {
    name: 'teaTable',
    description: 'A saucer with a cup of tea, and a teapot of tea glued to the table: two teas, one of them in a vessel glued down, which cannot be taken as it stands.',
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
            rubric: 'Takes account that [teapot1] is glued to [table1], so it is not simply lifted or tilted; names the tea in [cup1] as a tea that can be poured; tells the two teas apart; does not claim freeing [teapot1] is the only way to get its tea out.',
        },
        {
            type: 'open',
            asked: 'What would you have to do to move [teapot1] to the floor?',
            rubric: 'Names the glue holding [teapot1] to [table1] as what stands in the way; says the tea in [teapot1] goes with it; does not claim that freeing [teapot1] is the only way past the glue.',
        },
        {
            type: 'open',
            asked: 'If I pick up [saucer1], what comes with it, what stays behind, and what would change?',
            rubric: '[cup1] and the tea in it come with [saucer1]; [teapot1], its tea and [table1] stay.',
        },
        {
            type: 'open',
            asked: 'If I pick up [cup1], what comes with it, what stays behind, and what would change?',
            rubric: '[tea1] comes with [cup1]; [saucer1], [teapot1], its tea and [table1] stay.',
        },
        {
            type: 'open',
            asked: 'Can you pour [tea1] out onto the floor? If so, how, and what would change?',
            rubric: '[tea1] leaves [cup1] and ends up on the floor; [cup1] stays on [saucer1]; the tea in [teapot1] is untouched.',
        },
        { type: 'securedTo', target: 'table1' },
        { type: 'directContents', subject: 'table1' },
        { type: 'howMany', name: 'tea' },
    ],
    judgeSets: {
        judge: [
            { request: 'I want to pick up [table1].', expect: 'simple', note: "The table moves, and the glued teapot stays fixed relative to the table's frame." },
            { request: 'I want to pick up [cup1].', expect: 'simple', avoids: ['glue'], note: 'No glue spreading to a cup on a saucer on a glued-teapot table.' },
            { request: 'I want to put [table1] in [cup1].', expect: 'impossible', tolerate: ['obstructed'], mentions: ['fit', 'big', 'large', 'small', 'size', 'hold', 'contain'], note: 'The player is picturing a different world: the table is far larger than the cup. The sentence names the fact they missed.' },
            { request: 'I want to pick up [teapot1].', expect: 'obstructed', tolerate: ['contingent'], mentions: ['glue'], avoids: prescribedFixes, note: 'The glue is the obstacle; no plan yet, so up to the player, with no fix prescribed.' },
            { request: 'I want to pour tea from [teapot1].', expect: 'obstructed', tolerate: ['contingent'], mentions: ['glue'], avoids: prescribedFixes, note: 'Same obstacle, reached through another request; freeing is not the only way to pour (tip the table).' },
            { request: 'I want to pry [teapot1] off [table1] with a screwdriver.', expect: 'contingent', tolerate: ['obstructed', 'complex'], note: 'A plan makes the glue the target (Revises, not Obstacle); the screwdriver is the unestablished detail. Graded only as not simple.' },
            { request: 'I want to wipe [table1] with a cloth.', expect: 'contingent', tolerate: ['obstructed', 'complex'], mentions: ['cloth'], note: 'A cloth is plausible and unestablished.' },
            { request: 'I want to slide [saucer1] across [table1].', expect: 'simple', tolerate: ['contingent', 'complex'], note: 'Border: the cup and its tea come along; the table\'s extent is not established.' },
        ],
    },
}
