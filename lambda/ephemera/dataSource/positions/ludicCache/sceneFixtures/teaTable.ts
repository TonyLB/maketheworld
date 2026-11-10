/**
 * The tea table (added in Slice 3, for questions that reason over the structure instead of reading it back): a table
 * with a saucer and a teapot on it; a cup on the saucer with tea in it; tea in the teapot, which is glued to the table
 * (a tie: Custom "glued to", SecuredTo, and the Justifies between them). The glue says how the securing behaves, so a
 * rubric need not guess what a bare SecuredTo allows: Nova 2 Lite tilted a teapot only "secured to" the table to pour
 * it. Two things are called "Tea", so "pour tea" does not say which. The open questions have no computed answer; each
 * carries a rubric written before any batch, which the user grades every answer against.
 *
 * `teaTableCupOnFloor` changes one fact: the cup and its tea sit directly in the room, so the table can be proposed into the cup
 * and pass the dry run, where on `teaTable` the cup is on the table and the move is a containment cycle. Only the sizes are wrong.
 *
 * Both are hand-written, in the shape production writes (every first binding `Base`, the binding ahead of the members, no
 * id on the `Justifies` edge), and each has a description for the fixture builder that builds the same graphs.
 */
import type { ProposedMove } from '../../manipulation/proposedMoves'
import { buildScene, type SceneDescription, type ScenePlacement, type SceneRelations } from './buildScene'
import { binding, characterId, featureId, hostGraph, member, objectId, roomId, type SceneFixture } from './worldBuilders'

const parlour = roomId('Parlour')
const actor = characterId('Actor')
const table = objectId('Table')
const saucer = objectId('Saucer')
const cup = objectId('Cup')
const cupTea = objectId('CupTea')
const teapot = objectId('Teapot')
const potTea = objectId('PotTea')

/** The template's proposals, as moves: shared by the judge sets and the oracle harness's cases (`calibration/oracleLoop/`). */
export const teaTableProposals = {
    pickUpTable: [{ moved: table, from: parlour, to: actor }],
    pickUpCup: [{ moved: cup, from: saucer, to: actor }],
    /** The saucer off the table, the cup going with it: OC-13's and OC-30's repair before the table is tipped. */
    pickUpSaucer: [{ moved: saucer, from: table, to: actor }],
    /** Refused (`securedToBlocksMove`), so OC-5 has no candidate. */
    pickUpTeapot: [{ moved: teapot, from: table, to: actor }],
    pour: [{ moved: potTea, from: teapot, to: cup, hostingKind: 'In' }],
    slideSaucer: [],
    tableInCupOnFloor: [{ moved: table, from: parlour, to: cup, hostingKind: 'In' }],
} as const satisfies Record<string, readonly ProposedMove[]>

/** Words that would mean the reply prescribes a way past the glue, where the judge only names the obstacle (a reading aid). */
const prescribedFixes = ['unglue', 'pry', 'scrape', 'solvent', 'screwdriver', 'free', 'remove', 'detach', 'break', 'cut']

const tableGraph = hostGraph(table, [
    binding('Base', [[parlour, 'Base']], [[saucer, 'Base'], [teapot, 'Base']]),
    member(saucer, 'On'), member(teapot, 'On'),
], {
    edges: [
        { tag: 'Relational', edgeId: 'e1', from: teapot, to: table, kind: 'Custom', relationLabel: 'glued to' },
        { tag: 'Relational', edgeId: 'e2', from: teapot, to: table, kind: 'SecuredTo' },
        { tag: 'Relational', from: { edgeId: 'e1' }, to: { edgeId: 'e2' }, kind: 'Justifies' },
    ],
})
const teapotGraphs = [
    hostGraph(teapot, [binding('Base', [[table, 'Base']], [[potTea, 'Base']]), member(potTea, 'In')]),
    hostGraph(potTea, [binding('Base', [[teapot, 'Base']])]),
]
const actorGraph = hostGraph(actor, [binding('Base', [[parlour, 'Base']])])
const names: SceneFixture['names'] = {
    [parlour]: { shortName: 'Parlour' },
    [table]: { shortName: 'Table', gloss: 'a small round tea table' },
    [saucer]: { shortName: 'Saucer' },
    [cup]: { shortName: 'Cup' },
    [cupTea]: { shortName: 'Tea' },
    [teapot]: { shortName: 'Teapot' },
    [potTea]: { shortName: 'Tea' },
}

export const teaTableScene: SceneFixture = {
    name: 'teaTable',
    description: 'A saucer with a cup of tea, and a teapot of tea glued to the table: two teas, one of them in a vessel glued down, which cannot be taken as it stands.',
    roomId: parlour,
    actorId: actor,
    graphs: [
        hostGraph(parlour, [binding('Base', [], [[table, 'Base']]), member(table, 'In')]),
        tableGraph,
        hostGraph(saucer, [binding('Base', [[table, 'Base']], [[cup, 'Base']]), member(cup, 'On')]),
        hostGraph(cup, [binding('Base', [[saucer, 'Base']], [[cupTea, 'Base']]), member(cupTea, 'In')]),
        hostGraph(cupTea, [binding('Base', [[cup, 'Base']])]),
        ...teapotGraphs,
        actorGraph,
    ],
    names,
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
            { request: 'I want to pick up [table1].', expect: 'simple', tolerate: ['complex'], proposal: teaTableProposals.pickUpTable, note: "The table moves, and the glued teapot stays fixed relative to the table's frame. `complex` fails safe, and that division waits for a planner." },
            { request: 'I want to pick up [cup1].', expect: 'simple', avoids: ['glue'], proposal: teaTableProposals.pickUpCup, note: 'No glue spreading to a cup on a saucer on a glued-teapot table.' },
            { request: 'I want to put [table1] in [cup1].', expect: 'impossible', tolerate: ['obstructed'], mentions: ['fit', 'big', 'large', 'small', 'size', 'hold', 'contain'], note: 'The player is picturing a different world: the table is far larger than the cup. The sentence names the fact they missed.' },
            { request: 'I want to pick up [teapot1].', expect: 'obstructed', tolerate: ['contingent'], mentions: ['glue'], avoids: prescribedFixes, note: 'The glue is the obstacle; no plan yet, so up to the player, with no fix prescribed.' },
            { request: 'I want to pour tea from [teapot1].', expect: 'obstructed', tolerate: ['contingent'], mentions: ['glue'], avoids: prescribedFixes, proposal: teaTableProposals.pour, note: 'Same obstacle, reached through another request; freeing is not the only way to pour (tip the table).' },
            { request: 'I want to pry [teapot1] off [table1] with a screwdriver.', expect: 'contingent', tolerate: ['obstructed', 'complex'], note: 'A plan makes the glue the target (Revises, not Obstacle); the screwdriver is the unestablished detail. Graded only as not simple.' },
            { request: 'I want to wipe [table1] with a cloth.', expect: 'contingent', tolerate: ['obstructed', 'complex'], mentions: ['cloth'], note: 'A cloth is plausible and unestablished.' },
            { request: 'I want to slide [saucer1] across [table1].', expect: 'simple', tolerate: ['contingent', 'complex'], proposal: teaTableProposals.slideSaucer, note: 'Border: the cup and its tea come along; the table\'s extent is not established.' },
        ],
    },
}

export const teaTableCupOnFloorScene: SceneFixture = {
    name: 'teaTableCupOnFloor',
    description: 'The tea table with the cup on the floor: the table can be proposed into the cup and pass the dry run, so only the sizes say otherwise.',
    roomId: parlour,
    actorId: actor,
    graphs: [
        hostGraph(parlour, [binding('Base', [], [[cup, 'Base'], [table, 'Base']]), member(cup, 'In'), member(table, 'In')]),
        tableGraph,
        hostGraph(saucer, [binding('Base', [[table, 'Base']])]),
        hostGraph(cup, [binding('Base', [[parlour, 'Base']], [[cupTea, 'Base']]), member(cupTea, 'In')]),
        hostGraph(cupTea, [binding('Base', [[cup, 'Base']])]),
        ...teapotGraphs,
        actorGraph,
    ],
    names,
    questions: [{ type: 'howMany', name: 'tea' }],
    judgeSets: {
        judge: [
            { request: 'I want to put [table1] in [cup1].', expect: 'impossible', tolerate: ['obstructed'], mentions: ['fit', 'big', 'large', 'small', 'size', 'hold', 'contain'], proposal: teaTableProposals.tableInCupOnFloor, note: 'The move is legal in the record, and the table is far larger than the cup. Whether code saying so stops the judge noticing.' },
        ],
    },
}

/** The glue: production's tie triple, in the table's graph. */
const glue: SceneRelations = {
    host: table,
    edges: [
        { edgeId: 'e1', from: teapot, to: table, kind: 'Custom', relationLabel: 'glued to' },
        { edgeId: 'e2', from: teapot, to: table, kind: 'SecuredTo' },
        { from: { edgeId: 'e1' }, to: { edgeId: 'e2' }, kind: 'Justifies' },
    ],
}
const onTheTable: ScenePlacement[] = [
    { thing: saucer, host: table, hostingKind: 'On' },
    { thing: teapot, host: table, hostingKind: 'On' },
]
const teas: ScenePlacement[] = [
    { thing: cupTea, host: cup },
    { thing: potTea, host: teapot },
]

/** `teaTable` as builder choices. */
export const teaTableDescription: SceneDescription = {
    ...teaTableScene,
    placements: [
        { thing: table, host: parlour },
        ...onTheTable,
        { thing: cup, host: saucer, hostingKind: 'On' },
        ...teas,
    ],
    relations: [glue],
}

/** `teaTableCupOnFloor` as builder choices: the cup placed in the room, not on the saucer. */
export const teaTableCupOnFloorDescription: SceneDescription = {
    ...teaTableCupOnFloorScene,
    placements: [
        { thing: cup, host: parlour },
        { thing: table, host: parlour },
        ...onTheTable,
        ...teas,
    ],
    relations: [glue],
}

/**
 * The oracle harness's variants of `teaTable` (oracleLoop Slice 3), built from its description. They carry `teaTable`'s questions and
 * no judge set: their requests are the harness's cases. The dungeon and the doll-house differ only in names, what the glue is for (OC-12,
 * OC-13; the corpus's wording, agreed by the user 2026-11-08); the hammer is a placement dial (OC-19), and the chain a new thing and a
 * second tie, stored in the parlour's graph since both its ends are the parlour's members (OC-20).
 */
const teaTableVariant = ({ name, description }: Pick<SceneFixture, 'name' | 'description'>, changes: Partial<Pick<SceneDescription, 'placements' | 'relations' | 'names'>> = {}): SceneFixture => {
    const { judgeSets: _judgeSets, ...base } = teaTableDescription
    return buildScene({ ...base, name, description, ...changes })
}

export const teaTableDungeonScene: SceneFixture = teaTableVariant({
    name: 'teaTableDungeon',
    description: 'The tea table in a dungeon antechamber, where pouring the tea opens the door: the glue as a challenge (OC-12).',
}, {
    names: { ...names, [parlour]: { shortName: 'Antechamber', gloss: 'A dungeon antechamber, the tea table in the middle of it. Words carved over the sealed door ahead say that it opens for one who pours the tea.' } },
})

export const teaTableDollHouseScene: SceneFixture = teaTableVariant({
    name: 'teaTableDollHouse',
    description: 'The tea table in a doll-house, where dolls\' furniture is glued down: the glue as texture (OC-13).',
}, {
    names: { ...names, [parlour]: { shortName: 'Parlour', gloss: 'You have been transported into a doll-house to have high tea with the Marie Antoinette doll. Dolls\' furniture is glued down, the teapot to its table with the rest.' } },
})

const hammer = objectId('Hammer')

export const teaTableHammerHeldScene: SceneFixture = teaTableVariant({
    name: 'teaTableHammerHeld',
    description: 'The tea table with the player holding a claw hammer: a pry with an established tool (OC-19).',
}, {
    placements: [...teaTableDescription.placements, { thing: hammer, host: actor }],
    names: { ...names, [hammer]: { shortName: 'Hammer', gloss: 'a claw hammer with a taped handle' } },
})

const wall = featureId('Wall')

export const teaTableChainedScene: SceneFixture = teaTableVariant({
    name: 'teaTableChained',
    description: 'The tea table chained to the wall: a securing that crosses frames, with the glued teapot playing no part (OC-20).',
}, {
    placements: [{ thing: wall, host: parlour }, ...teaTableDescription.placements],
    relations: [
        ...(teaTableDescription.relations ?? []),
        {
            host: parlour,
            edges: [
                { edgeId: 'e1', from: table, to: wall, kind: 'Custom', relationLabel: 'chained to' },
                { edgeId: 'e2', from: table, to: wall, kind: 'SecuredTo' },
                { from: { edgeId: 'e1' }, to: { edgeId: 'e2' }, kind: 'Justifies' },
            ],
        },
    ],
    names: { ...names, [wall]: { shortName: 'Wall' } },
})
