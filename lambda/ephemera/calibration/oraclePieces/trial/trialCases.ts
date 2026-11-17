//
// The trial's cells (AGENT.nonRuleCell.planning.md, step 3, the trial family, Slices A and B): one record per cell, shared by the stages.
// Each record holds the non-rule cell's inputs, source and note, a `StageInput` slot per later stage (the argument the rebuttal answers,
// the rebuttal the verdict weighs), what a reader looks for in each stage's replies, each written before that stage's first batch, and
// the verdict's expected answer. A stage's cells are derived from these.
//
import { stageValueHash, type StageInput } from '../../pieceProbe/stageInput'
import { parseRebuttal, type ParsedRebuttal } from './rebuttalSentence'
import { nonRuleCellCells, type NonRuleCellInputs } from '../nonRuleCell'

/**
 * An argument against the plan: the step it turns on, quoted, the argument, and the question it answers. The question is the case
 * against's current contract (rebuttal draft 3's test); the against stage doesn't give it yet, so a lifted argument has none and doesn't fit.
 */
export type TrialArgument = { step: string; argument: string; question?: string }

/** A rebuttal of an argument: its one sentence, and that sentence parsed by branch (draft 5). */
export type TrialRebuttalReply = { rebuttal: string; parsed: ParsedRebuttal }

/** The verdict's answers: which of the two is right about the argument's question. */
export const TRIAL_VERDICTS = ['argument', 'rebuttal'] as const
export type TrialVerdict = typeof TRIAL_VERDICTS[number]

/** The ruling's answers (AGENT.trialQuestion.planning.md, step 1): the judge's answer to the question itself. */
export const TRIAL_RULINGS = ['yes', 'no'] as const
export type TrialRuling = typeof TRIAL_RULINGS[number]

/** One cell of the trial: the non-rule cell's part, each later stage's input, and a look-for (and, where needed, a note) per stage. */
export type TrialCase = {
    inputs: NonRuleCellInputs
    /** The non-rule cell's source. */
    source: string
    /** The non-rule cell's note. */
    note?: string
    /** The argument, for the rebuttal and the verdict. */
    against: StageInput<TrialArgument>
    /** The rebuttal, for the verdict. A lifted rebuttal records the argument it answered (`consumed`). */
    rebuttal: StageInput<TrialRebuttalReply>
    lookFor: { against: string; rebuttal: string; verdict: string; ruling: string }
    /**
     * The verdict's expected answer, which argued better on the cell's pair: mine, from the trial proposal, h10 revised for verdict draft
     * 2. The ruling's, the answer to the golden question in the scene shown: mine, accepted by the user (QS-1, 2026-11-17). Each absent
     * where open (OC-9).
     */
    expected: { verdict?: TrialVerdict; ruling?: TrialRuling }
    /** A note for the reader of one stage's replies, where it differs from the cell's. */
    notes?: { rebuttal?: string; verdict?: string; ruling?: string }
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
const STAGES: Record<CellId, Pick<TrialCase, 'against' | 'lookFor' | 'expected' | 'notes'>> = {
    'OC-11': {
        against: argued('OC-11', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q),
        lookFor: { against: 'the size: [table1] is far too big to go into [cup1]', rebuttal: `${SOUND}; an invented smallness or a "not established" size`, verdict: 'the argument: the rebuttal\'s "small enough to fit inside the cup" is visibly false; does the description state the size, or echo the rebuttal (anchoring)?', ruling: 'yes: a table is far too big to go into a cup; does the description compare the two sizes, or read "small" as small enough (TR-P16)?' },
        expected: { verdict: 'argument', ruling: 'yes' },
    },
    'OC-18': {
        against: argued('OC-18', 'hammer [table1] into [cup1]', 'The table is too large and structurally unsuited to fit into the cup.', 'Is [table1] too large and structurally unsuited to fit into [cup1]?'),
        lookFor: { against: 'the size, which no hammering changes', rebuttal: `${SOUND}; hammering offered as changing the size`, verdict: 'the argument: "the cup is large enough to accommodate the table" is visibly false; hammering changes nothing', ruling: 'yes: a table is far too big to go into a cup, and hammering changes nothing; does the description compare the two sizes?' },
        expected: { verdict: 'argument', ruling: 'yes' },
    },
    'OC-3': {
        against: argued('OC-3', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q),
        lookFor: { against: 'the size, not [cup1] being on [table1]', rebuttal: `${SOUND}; an invented smallness or a "not established" size`, verdict: 'the argument: "small enough to fit inside the cup" is visibly false; the cup being on the table is beside the point', ruling: 'yes: a table is far too big to go into a cup; the cup being on the table is beside the point' },
        expected: { verdict: 'argument', ruling: 'yes' },
    },
    'OC-1': {
        against: argued('OC-1', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q),
        lookFor: {
            against: 'no true blocker: which argument is picked (the glue expected), and whether it rests on the scene or is invented',
            rebuttal: '"wrong": the scene says [table1] is a small round tea table, so the premise is false (premise, not weight)',
            verdict: 'the rebuttal: "a small round tea table" is light enough for one person; does the description quote it?',
            ruling: 'no: an ordinary small round tea table is light enough for one person to pick up',
        },
        expected: { verdict: 'rebuttal', ruling: 'no' },
    },
    'OC-2': {
        against: argued('OC-2', 'pick up [cup1]', 'The cup is on a saucer, which is on the table, and the player is not holding anything to lift the cup directly.', 'Does holding nothing keep the player from lifting [cup1] directly?'),
        lookFor: {
            against: 'no true blocker: which argument is picked, and whether it rests on the scene or is invented',
            rebuttal: '"wrong": empty hands are what picking up needs, and a cup on a saucer is within reach',
            verdict: 'the rebuttal: empty hands are what picking up needs; it drifts to the saucer first and labels a scene line "the steps say", so read whether the drift sways the judge',
            ruling: 'no: empty hands are what picking up needs, and a cup on a saucer is within reach',
        },
        expected: { verdict: 'rebuttal', ruling: 'no' },
    },
    'OC-20': {
        against: argued('OC-20', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q),
        lookFor: {
            against: 'no true blocker for this piece (the chain is the rule cell\'s): which argument is picked',
            rebuttal: '"wrong": the scene says [table1] is a small round tea table',
            verdict: 'the rebuttal: "a small round tea table" is light enough for one person',
            ruling: 'no: an ordinary small round tea table is light enough for one person; the chain is omitted and is the rule cell\'s',
        },
        expected: { verdict: 'rebuttal', ruling: 'no' },
    },
    'OC-6': {
        against: argued('OC-6', 'pour [tea2] from [teapot1] into [cup1]', 'The tea in the teapot cannot be directly poured into the cup without first being transferred to a container that can be poured, such as a cup.', 'Must [tea2] be transferred to another container before it can be poured into [cup1]?'),
        lookFor: {
            against: 'no true blocker for this piece (the glue is the rule cell\'s): which argument is picked',
            rebuttal: '"wrong": a teapot is the container tea is poured from',
            verdict: 'the rebuttal: [tea2] is in [teapot1], the container tea is poured from',
            ruling: 'no: [tea2] is in [teapot1], the container tea is poured from',
        },
        expected: { verdict: 'rebuttal', ruling: 'no' },
    },
    'OC-30/h5': {
        against: argued('OC-30/h5', 'tip [table1]', 'Tipping the table would cause the teapot to fall off and spill its contents.', `${AT_THE_POUR} is [teapot1] still where it can pour into [cup1]?`),
        lookFor: {
            against: 'the tip\'s unstated effect on the loose [saucer1] and [cup1]: [cup1] may no longer be under the spout, turning on step 1 or 2',
            rebuttal: `consequences-dependent (TR-P3): ${SOUND} in the scene shown, where [teapot1] is loose`,
            verdict: 'the argument, in the scene shown, where [teapot1] is loose; the rebuttal dodges ("not requiring tipping"); read what the description says the tip does',
            ruling: 'no, in the scene shown, where [teapot1] is loose: the tip moves it, or the loose [saucer1] and [cup1], out of line for the pour; read what the description says the tip does',
        },
        expected: { verdict: 'argument', ruling: 'no' },
        notes: {
            rebuttal: 'Read apart from the tallies: the argument is sound only because the scene omits the glue that tilts the teapot with the table.',
            verdict: 'Read apart from the tallies: the expected answer holds only in the scene shown, with the glue omitted (TR-P3).',
            ruling: 'Read apart from the tallies: the expected answer holds only in the scene shown, with the glue omitted (TR-P3).',
        },
    },
    'OC-30/h7': {
        against: argued('OC-30/h7', 'tip [table1]', 'The first step would cause the cup to fall off the table, making it impossible to pour tea into it.', CUP_REACHABLE_Q),
        lookFor: {
            against: 'the slide line: [cup1] is on the floor, no longer under the spout, turning on the pour',
            rebuttal: `${SOUND}: the consequence line puts [cup1] on the floor`,
            verdict: 'the argument: the consequence line puts [cup1] on the floor, and the rebuttal evades it, claiming [cup1] is still on [table1] (TR-P14); does the description quote the slide line?',
            ruling: 'no: the consequence line puts [saucer1] and [cup1] on the floor, off the table; does the description use the slide line?',
        },
        expected: { verdict: 'argument', ruling: 'no' },
    },
    'OC-30/h10': {
        against: argued('OC-30/h10', 'tip [table1]', 'Tipping the table would cause the saucer, cup, and tea to fall off, making it impossible to pour tea from the teapot into the cup.', CUP_REACHABLE_Q),
        lookFor: {
            against: 'no true blocker: [cup1] is held on [saucer1]; which argument is picked',
            rebuttal: 'consequences-dependent (TR-P3, NR-P5): "wrong": step 1 has taken [saucer1], with [cup1] on it, off the table; the loose teapot is not raised',
            verdict: 'the argument, as an exchange (verdict draft 2): the rebuttal argues the tip unnecessary, which answers something other than the claim that [cup1] falls, and never uses step 1, [saucer1] taken off the table',
            ruling: 'yes: step 1 has taken [saucer1], with [cup1] on it, off the table, so the tip doesn\'t move [cup1]; does the description use step 1?',
        },
        expected: { verdict: 'argument', ruling: 'yes' },
        notes: {
            rebuttal: 'Read apart from the tallies: the argument errs on state, and the sound one (the loose teapot) exists only because the scene omits the glue.',
            verdict: 'Read apart from the tallies: the argument is wrong on the state, but the rebuttal never shows it, so as an exchange the argument argued better (re-expected for verdict draft 2; batch 9 was graded against `rebuttal`).',
            ruling: 'Read apart from the tallies: the expected answer follows the state after step 1 (QS-1), and the loose teapot raised by the tip exists only because the scene omits the glue.',
        },
    },
    'OC-9': {
        against: argued('OC-9', 'pick up [table1]', 'A table is too large and heavy to be picked up by a single person, especially considering the physical constraints of the scene.', TOO_HEAVY_Q, 'trialAgainst batch 1 (draft 1), repeat 1'),
        lookFor: {
            against: 'the trestle\'s weight and size for one person (open, JF-2)',
            rebuttal: 'open (JF-2): a long oak trestle is heavy for one person; read the kind, and whether "not established" (strength, how heavy) is given',
            verdict: 'open (JF-2): which it picks, and whether "does not specify any weight restrictions" is taken as a rebuttal of a long oak trestle\'s weight',
            ruling: 'open (JF-2): a long oak trestle is heavy for one person; read whether the description uses the kind of table',
        },
        expected: {},
    },
}

const REBUTTAL_BATCH_8 = 'trialRebuttal batch 8 (draft 5, confirmed), on the golden argument'

/**
 * The rebuttals lifted from batch 8, per cell: the repeat and its sentence. The repeat is the first whose reply passes the current parse
 * (Slice B): repeat 1 everywhere but OC-3, whose repeat 1 lists a fact that doesn't name its handle. No choosing by quality.
 */
const LIFTED_REBUTTALS: Record<CellId, [number, string]> = {
    'OC-11': [1, "But the scene says 'In the Parlour there are [cup1] Cup and [table1] Table (a small round tea table)', indicating that the table is small enough to fit inside the cup."],
    'OC-18': [1, "But the scene says 'In the Parlour there are [cup1] Cup and [table1] Table (a small round tea table)', which implies that the cup is large enough to accommodate the table."],
    'OC-3': [2, "But the scene says 'In the Parlour there is [table1] Table (a small round tea table). On [table1] there are [saucer1] Saucer and [teapot1] Teapot.', which implies that the table is small enough to fit inside the cup."],
    'OC-1': [1, "But the scene says 'In the Parlour there is [table1] Table (a small round tea table)', which implies that [table1] is small enough to be picked up by a single person."],
    'OC-2': [1, "But the steps say 'You are holding nothing,' which does not prevent the player from picking up the cup indirectly by first picking up the saucer and then the cup, as the cup is on the saucer."],
    'OC-20': [1, "But the scene says 'In the Parlour there is [table1] Table (a small round tea table)', which implies it is manageable to pick up by a single person."],
    'OC-6': [1, "But the scene says 'In [teapot1] there is [tea2] Tea', and the steps say '(intended) pour [tea2] from [teapot1] into [cup1]', indicating that the tea can be directly poured from the teapot into the cup."],
    'OC-9': [1, "But the scene says 'In the Tavern there is [table1] Table (a long oak trestle, ring-stained)' which implies that the table is not necessarily too large and heavy to be picked up by a single person, as it does not specify any weight restrictions."],
    'OC-30/h5': [1, "But the scene says 'In the Parlour there is [table1] Table (a small round tea table). On [table1] there are [saucer1] Saucer and [teapot1] Teapot. On [saucer1] there is [cup1] Cup.' which indicates that the teapot is already on the table, not requiring tipping to pour."],
    'OC-30/h7': [1, "But the scene says 'In [cup1] there is [tea1] Tea', meaning [cup1] remains intact and on [saucer1], which is still on [table1], allowing [teapot1] to pour [tea2] into it."],
    'OC-30/h10': [1, "But the scene says 'In the Parlour there is [table1] Table (a small round tea table). On [table1] there are [saucer1] Saucer and [teapot1] Teapot. On [saucer1] there is [cup1] Cup. In [cup1] there is [tea1] Tea. In [teapot1] there is [tea2] Tea.' which establishes that the cup is on the saucer on the table, and tipping the table is not necessary to pour tea."],
}

/**
 * A cell's rebuttal: lifted only, from batch 8, which answered the golden argument, so it records that argument's hash as `consumed`.
 * No golden rebuttals are written yet (Slice B). A sentence that no longer parses counts as missing.
 */
const rebutted = (id: CellId, against: StageInput<TrialArgument>): StageInput<TrialRebuttalReply> => {
    const [repeat, rebuttal] = LIFTED_REBUTTALS[id]
    const parsed = parseRebuttal(rebuttal)
    return 'malformed' in parsed || against.golden === undefined ? {} : {
        lifted: {
            value: { rebuttal, parsed },
            source: `${REBUTTAL_BATCH_8}, repeat ${repeat}, cell ${id}`,
            consumed: { upstream: 'golden', hash: stageValueHash(against.golden.value) },
        },
    }
}

/** The trial's cells, in the non-rule cell's order. */
export const trialCases: Record<string, TrialCase> = Object.fromEntries(
    Object.entries(nonRuleCellCells).map(([id, { inputs, source, note }]) => [id, {
        inputs, source, ...(note !== undefined ? { note } : {}), ...STAGES[id], rebuttal: rebutted(id, STAGES[id].against),
    }]),
)
