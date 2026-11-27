//
// Triage's corpus (AGENT.triage.planning.md, "The corpus"), as data: each command in its scene, how its step should be grounded, the branch
// right given what triage is shown, and the branch after the guard. A row with no branch is open between two, so it is tallied and not
// graded. The rows and what each looks for were reviewed by the user, who alone revises them (2026-11-25).
//
import type { ImproviseEntry } from '../oracleLoop/actionPlan'
import type { TriageKind } from './triage'

/** A step as it should be grounded, with what it improvises. An improvised thing's handle is an example: its name is free. */
export type CorpusGrounding = { says: string; improvise?: readonly ImproviseEntry[] }

export type CorpusRow = {
    fixture: string
    command: string
    /** The groundings accepted, one unless part of it is open. */
    grounded: readonly [CorpusGrounding, ...CorpusGrounding[]]
    /**
     * The branch given what triage is shown, and the one after the guard; and, where it differs from the first, the branch a call asked for
     * the branch alone gives (`alone`, `triageBranch.ts`), since a "Defer" that an improvised thing, an ambiguous reference or a securing
     * makes is the guard's, on a split's grounding (mine, approved by the user, 2026-11-26).
     */
    branch?: { shown: TriageKind; after: TriageKind; alone?: TriageKind }
    /** The oracle loop's corpus case it is after. */
    from: string
    lookFor: string
}

const same = (kind: TriageKind): CorpusRow['branch'] => ({ shown: kind, after: kind })

/**
 * A "Defer" that is the guard's: an act that could happen, as the player means it, but for what the scene lacks, which thing is meant, or
 * what a securing forbids (the user, 2026-11-26: the branch reads a securing only for what it lets things do).
 */
const guardsDefer: CorpusRow['branch'] = { shown: 'Defer', after: 'Defer', alone: 'Yes' }

/** The rows, by id. */
export const triageCorpus: Readonly<Record<string, CorpusRow>> = {
    'T-1': { fixture: 'teaTable', command: 'pick up the cup', grounded: [{ says: 'pick up [cup1]' }], branch: same('Yes'), from: 'OC-2',
        lookFor: 'A plain carry. Nothing improvised, a hand included; where the cup is isn\'t part of the act' },
    'T-2': { fixture: 'teaTable', command: 'pick up the table', grounded: [{ says: 'pick up [table1]' }], branch: same('Yes'), from: 'OC-1',
        lookFor: 'The glue carries [teapot1] with [table1], and doesn\'t stop the lift' },
    'T-3': { fixture: 'teaTable', command: 'slide the saucer across the table', grounded: [{ says: 'slide [saucer1] across [table1]' }], branch: same('Yes'), from: 'OC-4',
        lookFor: 'Nothing secured is moved against its securing. Nothing improvised' },
    'T-4': { fixture: 'teaTable', command: 'put the cup on the table', grounded: [{ says: 'put [cup1] on [table1]' }], branch: same('Yes'), from: 'a near miss of T-5',
        lookFor: 'Not read as putting the table in the cup' },
    'T-5': { fixture: 'teaTable', command: 'put the table in the cup', grounded: [{ says: 'put [table1] in [cup1]' }], branch: same('No'), from: 'OC-3',
        lookFor: 'The reason is the size, not that the cup is on the table, and not the glue' },
    'T-6': { fixture: 'teaTableCupOnFloor', command: 'put the table in the cup', grounded: [{ says: 'put [table1] in [cup1]' }], branch: same('No'), from: 'OC-11',
        lookFor: 'The reason is the size' },
    'T-7': { fixture: 'teaTableCupOnFloor', command: 'hammer the table into the cup', grounded: [{ says: 'hammer [table1] into [cup1]' }], branch: same('No'), from: 'OC-18',
        lookFor: 'The reason is the size, not that there is no hammer' },
    'T-8': { fixture: 'tavern', command: 'put the table in the cup', grounded: [{ says: 'put [table1] in [cup1]' }], branch: same('No'), from: 'the one "No" outside the parlour',
        lookFor: 'The reason is the size of the long trestle' },
    'T-9': { fixture: 'teaTable', command: 'pick up the teapot', grounded: [{ says: 'pick up [teapot1]' }], branch: guardsDefer, from: 'OC-5',
        lookFor: 'Its "No" is the judge\'s. On a "No", whether the glue was taken as permanent' },
    'T-10': { fixture: 'teaTable', command: 'pour tea into the cup', grounded: [{ says: 'pour [tea2] from [teapot1] into [cup1]' }, { says: 'pour [tea1 | tea2] into [cup1]' }], branch: guardsDefer, from: 'OC-6',
        lookFor: 'Whether the source, which the player doesn\'t name, is in `says`: without it the guard misses the pour. "Tea" fits both teas by the words alone, so both may be named (the user, 2026-11-25)' },
    'T-11': { fixture: 'teaTable', command: 'pour tea from the teapot', grounded: [{ says: 'pour [tea2] from [teapot1]' }], branch: guardsDefer, from: 'OC-6',
        lookFor: 'Which tea is named; on a "No", whether the glue was taken as permanent' },
    'T-12': { fixture: 'teaTableChained', command: 'pick up the table', grounded: [{ says: 'pick up [table1]' }], branch: guardsDefer, from: 'OC-20',
        lookFor: 'Whether "can be moved as usual" pulled it to a "Yes"; on a "No", whether the chain was taken as permanent' },
    'T-13': { fixture: 'teaTable', command: 'pry the teapot off the table with a screwdriver',
        grounded: [{ says: 'pry [teapot1] off [table1] with [screwdriver1]', improvise: [{ handle: 'screwdriver1', gloss: 'a screwdriver' }] }], branch: guardsDefer, from: 'OC-8',
        lookFor: 'One improvised thing, its gloss a screwdriver. On a "No", whether the glue was taken as permanent' },
    'T-14': { fixture: 'teaTable', command: 'wipe the table with a cloth',
        grounded: [{ says: 'wipe [table1] with [cloth1]', improvise: [{ handle: 'cloth1', gloss: 'a cloth' }] }], branch: guardsDefer, from: 'OC-7, OC-15',
        lookFor: 'One improvised thing, its gloss a cloth. Whether it may be had is a price, which isn\'t triage\'s' },
    'T-15': { fixture: 'teaTable', command: 'wipe the table with the cloth I\'m holding', grounded: [{ says: 'wipe [table1] with the cloth I\'m holding' }], from: 'OC-17',
        lookFor: 'Open, "Defer" or "No": the scene states that the player holds nothing. No cloth improvised against it' },
    'T-16': { fixture: 'teaTable', command: 'tip the table', grounded: [{ says: 'tip [table1]' }], branch: same('Defer'), from: 'a plain act whose effects spread',
        lookFor: 'Triage\'s own "Defer": what is on the table slides' },
    'T-17': { fixture: 'tavern', command: 'pick up the cup', grounded: [{ says: 'pick up [cup1]' }], branch: same('Yes'), from: 'OC-10',
        lookFor: 'A plain carry. Nothing improvised, a hand included' },
    'T-18': { fixture: 'tavern', command: 'pick up the candle', grounded: [{ says: 'pick up [candle1]' }], branch: same('Yes'), from: 'OC-10',
        lookFor: 'A plain carry. Nothing improvised, a hand included' },
    'T-19': { fixture: 'tavern', command: 'put the hammer on the table', grounded: [{ says: 'put [hammer1] on [table1]' }], branch: same('Yes'), from: 'OC-10',
        lookFor: 'The hammer is held already' },
    'T-20': { fixture: 'tavern', command: 'pick up the table', grounded: [{ says: 'pick up [table1]' }], branch: same('Defer'), from: 'OC-9',
        lookFor: 'Triage\'s own "Defer": a feat, not an impossibility' },
    'T-21': { fixture: 'tavern', command: 'light the candle',
        grounded: [{ says: 'light [candle1] from [hearth1]', improvise: [{ handle: 'hearth1', gloss: 'the hearth' }] }, { says: 'light [candle1]' }], from: 'OC-22',
        lookFor: 'Open, "Yes" or "Defer". The hearth is in the room\'s gloss with no handle. Another flame improvised, or [hammer1], is recorded' },
    'T-22': { fixture: 'tavern', command: 'trim the wick of the candle with something sharp',
        grounded: [{ says: 'trim the wick of [candle1] with [blade1]', improvise: [{ handle: 'blade1', gloss: 'something sharp' }] }], branch: guardsDefer, from: 'OC-21',
        lookFor: 'One improvised thing, its gloss something sharp. Not [hammer1]' },
    'T-23': { fixture: 'twoCups', command: 'pick up the china cup', grounded: [{ says: 'pick up [cup2]' }], branch: same('Yes'), from: 'OC-32\'s kind',
        lookFor: 'The gloss settles which cup' },
    'T-24': { fixture: 'twoCups', command: 'pick up the cup', grounded: [{ says: 'pick up [cup1 | cup2]' }], branch: guardsDefer, from: 'OC-32\'s kind',
        lookFor: 'Both cups named, neither chosen and no third improvised (the user, 2026-11-25: it was the cup left in the player\'s words)' },
    'T-25': { fixture: 'teaTable', command: 'pour tea', grounded: [{ says: 'pour [tea2] from [teapot1] into [cup1]' }, { says: 'pour [tea2] from [teapot1]' }, { says: 'pour [tea1 | tea2]' }], branch: guardsDefer, from: 'the user\'s',
        lookFor: 'The source follows from which tea is meant. The destination is open: into [cup1], which holds tea already, or unstated' },
    'T-26': { fixture: 'tavern', command: 'smash the saucer', grounded: [{ says: 'smash [saucer1] with [hammer1]' }], branch: same('Defer'), from: 'the pair of T-27',
        lookFor: 'A tool the command implies, held and suitable: nothing improvised. [cup1] is on the saucer' },
    'T-27': { fixture: 'tavernRope', command: 'cut the rope',
        grounded: [{ says: 'cut [rope1] with [blade1]', improvise: [{ handle: 'blade1', gloss: 'something for cutting rope' }] }], branch: guardsDefer, from: 'the expansion probe\'s, the user\'s example',
        lookFor: 'A tool the command implies, and the one held doesn\'t suit: one thing for cutting improvised, and not [hammer1]' },
    // A material worked where it lies, and its pair, a material moved by its container: the same scene, only the verb differs (the user, 2026-11-27).
    'T-28': { fixture: 'sideboard', command: 'stir the coffee', grounded: [{ says: 'stir [coffee1] with [spoon1]' }], branch: same('Yes'), from: 'the user\'s, the bury of G1\'s examples',
        lookFor: 'The coffee stirred where it lies: [mug1], its place, and [box1], the spoon\'s, aren\'t part of the act. The spoon meets the need, and a fork or a knife could stir too, so the near miss is all three joined, [fork1 | knife1 | spoon1], as though the player\'s words fit them equally well' },
    'T-29': { fixture: 'sideboard', command: 'pour the coffee into the cup', grounded: [{ says: 'pour [coffee1] from [mug1] into [cup1]' }], branch: same('Yes'), from: 'the pair of T-28',
        lookFor: 'The coffee is poured by tipping its container, so [mug1] is named. Nothing is ambiguous, unlike the tea table\'s pours. [cup1] already holds [tea1], as T-25\'s does' },
}
