//
// The trial's cells (AGENT.nonRuleCell.planning.md, step 3, the trial family, Slice A): one record per cell, shared by the stages. Each
// record holds the non-rule cell's inputs, source and note, a `StageInput` slot per later stage (the argument the rebuttal answers), and
// what a reader looks for in each stage's replies, each written before that stage's first batch. A stage's cells are derived from these.
//
import type { StageInput } from '../../pieceProbe/stageInput'
import { nonRuleCellCells, type NonRuleCellInputs } from '../nonRuleCell'

/**
 * An argument against the plan: the step it turns on, quoted, the argument, and the question it answers. The question is the case
 * against's current contract (rebuttal draft 3's test); the against stage doesn't give it yet, so a lifted argument has none and doesn't fit.
 */
export type TrialArgument = { step: string; argument: string; question?: string }

/** One cell of the trial: the non-rule cell's part, each later stage's input, and a look-for (and, where needed, a note) per stage. */
export type TrialCase = {
    inputs: NonRuleCellInputs
    /** The non-rule cell's source. */
    source: string
    /** The non-rule cell's note. */
    note?: string
    /** The argument, for the rebuttal. */
    against: StageInput<TrialArgument>
    lookFor: { against: string; rebuttal: string }
    /** A note for the reader of one stage's replies, where it differs from the cell's. */
    notes?: { rebuttal?: string }
}

type CellId = keyof typeof nonRuleCellCells

const AGAINST_OMITTED = 'trialAgainst batch 2 (draft 1, the securing omitted), repeat 1'
const ADOPTED = 'an interim golden (the user, 2026-11-15): the lifted argument adopted verbatim, with a hand-written question'

/**
 * The argument from both sources. The golden is the lifted argument adopted verbatim with its question, so rebuttal draft 3's test
 * changed only the question against batch 4. The lifted value has no question, the older contract, so a `lifted` payload refuses it.
 */
const argued = (id: CellId, step: string, argument: string, question: string, source = AGAINST_OMITTED): StageInput<TrialArgument> => ({
    golden: { value: { step, argument, question }, note: ADOPTED },
    lifted: { value: { step, argument }, source: `${source}, cell ${id}` },
})

const TABLE_IN_CUP = 'put [table1] in [cup1]'
const TOO_LARGE = 'The table is too large to fit inside the cup.'
const TOO_LARGE_Q = 'Is [table1] too large to fit inside [cup1]?'
const TOO_HEAVY = 'The table is too large and heavy to be picked up by a single person.'
const TOO_HEAVY_Q = 'Is [table1] too large and heavy to be picked up by a single person?'
const AT_THE_POUR = 'By the time of "[teapot1] pours [tea2] into [cup1]",'
const CUP_REACHABLE_Q = `${AT_THE_POUR} is [cup1] still where [teapot1] can pour into it?`
const SOUND = 'the argument is sound: nothing true refutes it, so read what the rebuttal claims (over-refuting)'

/**
 * Per cell: the argument, then what a reader looks for in each stage. The against look-fors are the argument a reader expects to be the
 * best, written before against batch 1; where the plan has no true blocker, the reader notes which argument is picked and whether it rests
 * on the scene. The rebuttal look-fors are what a good rebuttal does, written before its batches.
 */
const STAGES: Record<CellId, Pick<TrialCase, 'against' | 'lookFor' | 'notes'>> = {
    'OC-11': {
        against: argued('OC-11', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q),
        lookFor: { against: 'the size: [table1] is far too big to go into [cup1]', rebuttal: `${SOUND}; an invented smallness or a "not established" size` },
    },
    'OC-18': {
        against: argued('OC-18', 'hammer [table1] into [cup1]', 'The table is too large and structurally unsuited to fit into the cup.', 'Is [table1] too large and structurally unsuited to fit into [cup1]?'),
        lookFor: { against: 'the size, which no hammering changes', rebuttal: `${SOUND}; hammering offered as changing the size` },
    },
    'OC-3': {
        against: argued('OC-3', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q),
        lookFor: { against: 'the size, not [cup1] being on [table1]', rebuttal: `${SOUND}; an invented smallness or a "not established" size` },
    },
    'OC-1': {
        against: argued('OC-1', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q),
        lookFor: {
            against: 'no true blocker: which argument is picked (the glue expected), and whether it rests on the scene or is invented',
            rebuttal: '"wrong": the scene says [table1] is a small round tea table, so the premise is false (premise, not weight)',
        },
    },
    'OC-2': {
        against: argued('OC-2', 'pick up [cup1]', 'The cup is on a saucer, which is on the table, and the player is not holding anything to lift the cup directly.', 'Does holding nothing keep the player from lifting [cup1] directly?'),
        lookFor: {
            against: 'no true blocker: which argument is picked, and whether it rests on the scene or is invented',
            rebuttal: '"wrong": empty hands are what picking up needs, and a cup on a saucer is within reach',
        },
    },
    'OC-20': {
        against: argued('OC-20', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q),
        lookFor: {
            against: 'no true blocker for this piece (the chain is the rule cell\'s): which argument is picked',
            rebuttal: '"wrong": the scene says [table1] is a small round tea table',
        },
    },
    'OC-6': {
        against: argued('OC-6', 'pour [tea2] from [teapot1] into [cup1]', 'The tea in the teapot cannot be directly poured into the cup without first being transferred to a container that can be poured, such as a cup.', 'Must [tea2] be transferred to another container before it can be poured into [cup1]?'),
        lookFor: {
            against: 'no true blocker for this piece (the glue is the rule cell\'s): which argument is picked',
            rebuttal: '"wrong": a teapot is the container tea is poured from',
        },
    },
    'OC-30/h5': {
        against: argued('OC-30/h5', 'tip [table1]', 'Tipping the table would cause the teapot to fall off and spill its contents.', `${AT_THE_POUR} is [teapot1] still where it can pour into [cup1]?`),
        lookFor: {
            against: 'the tip\'s unstated effect on the loose [saucer1] and [cup1]: [cup1] may no longer be under the spout, turning on step 1 or 2',
            rebuttal: `consequences-dependent (TR-P3): ${SOUND} in the scene shown, where [teapot1] is loose`,
        },
        notes: { rebuttal: 'Read apart from the tallies: the argument is sound only because the scene omits the glue that tilts the teapot with the table.' },
    },
    'OC-30/h7': {
        against: argued('OC-30/h7', 'tip [table1]', 'The first step would cause the cup to fall off the table, making it impossible to pour tea into it.', CUP_REACHABLE_Q),
        lookFor: {
            against: 'the slide line: [cup1] is on the floor, no longer under the spout, turning on the pour',
            rebuttal: `${SOUND}: the consequence line puts [cup1] on the floor`,
        },
    },
    'OC-30/h10': {
        against: argued('OC-30/h10', 'tip [table1]', 'Tipping the table would cause the saucer, cup, and tea to fall off, making it impossible to pour tea from the teapot into the cup.', CUP_REACHABLE_Q),
        lookFor: {
            against: 'no true blocker: [cup1] is held on [saucer1]; which argument is picked',
            rebuttal: 'consequences-dependent (TR-P3, NR-P5): "wrong": step 1 has taken [saucer1], with [cup1] on it, off the table; the loose teapot is not raised',
        },
        notes: { rebuttal: 'Read apart from the tallies: the argument errs on state, and the sound one (the loose teapot) exists only because the scene omits the glue.' },
    },
    'OC-9': {
        against: argued('OC-9', 'pick up [table1]', 'A table is too large and heavy to be picked up by a single person, especially considering the physical constraints of the scene.', TOO_HEAVY_Q, 'trialAgainst batch 1 (draft 1), repeat 1'),
        lookFor: {
            against: 'the trestle\'s weight and size for one person (open, JF-2)',
            rebuttal: 'open (JF-2): a long oak trestle is heavy for one person; read the kind, and whether "not established" (strength, how heavy) is given',
        },
    },
}

/** The trial's cells, in the non-rule cell's order. */
export const trialCases: Record<string, TrialCase> = Object.fromEntries(
    Object.entries(nonRuleCellCells).map(([id, { inputs, source, note }]) => [id, { inputs, source, ...(note !== undefined ? { note } : {}), ...STAGES[id] }]),
)
