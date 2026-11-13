//
// The non-rule cell (AGENT.nonRuleCell.planning.md, step 2; a Prototype of the oracle loop plan's Slice 4.5): whether a plan can go ahead
// for reasons no rule names, such as stuffing a table into a teacup. It sees the whole scene with no Rules section, the player's request,
// and the plan's steps in order, each with its role. It answers with a verdict or a request, in one fenced JSON block (NR-4):
// `allows`; `blocks`, quoting the step that can't happen and the step to blame; or `needs detail` of the action or of its consequences,
// quoting the step. Code matches each quote to one step, so the piece never gives a number, and grades by a canonical answer string.
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { caseActions, fixtureScene, namedHandles } from '../imaginationPieces/imaginationScene'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type OraclePiece, type PieceCell } from '../pieceProbe/oraclePiece'
import { replyJsonObject, type PieceGrade } from '../pieceProbe/pieceAnswer'

/**
 * A step's role (the step layout): `intended`, what the player's request states; `method`, a step the system supplies to carry it out;
 * `consequence`, what follows from the steps. Code routes a failure by the blamed step's role.
 */
export type NonRuleRole = 'intended' | 'method' | 'consequence'

export type NonRuleStep = { says: string; role: NonRuleRole }

export type NonRuleCellInputs = {
    fixture: string
    /** The player's request, in its own words: the yardstick for what is intended. */
    request: string
    steps: readonly NonRuleStep[]
}

export const NON_RULE_ANSWERS = ['allows', 'blocks', 'needs detail'] as const

/** A quote or a step as code compares them: lowercased, brackets and surrounding quotes and end punctuation dropped, whitespace collapsed. */
export const normalizeStep = (text: string): string => text
    .toLowerCase()
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[\s.,;:!?]+$/, '')
    .trim()

/**
 * The step a quote names, counted from 1: the one step it matches whole, or else the one step it falls inside, on word boundaries (so
 * "tip" isn't inside "tipping"); or why there is none.
 */
export const matchStep = (quote: string, steps: readonly NonRuleStep[]): { position: number } | { malformed: string } => {
    const wanted = normalizeStep(quote)
    if (wanted === '') {
        return { malformed: 'an empty quote' }
    }
    const normalized = steps.map(({ says }) => normalizeStep(says))
    const positions = (matches: (step: string) => boolean): number[] => normalized.flatMap((step, index) => (matches(step) ? [index + 1] : []))
    const whole = positions((step) => step === wanted)
    if (whole.length === 1) {
        return { position: whole[0] }
    }
    const inside = positions((step) => ` ${step} `.includes(` ${wanted} `))
    if (inside.length === 1) {
        return { position: inside[0] }
    }
    return { malformed: inside.length === 0 ? `"${quote}" quotes no step` : `"${quote}" quotes ${inside.length} steps` }
}

/** Each answer's own fields; a reply carrying another answer's field is malformed. */
const FIELDS: Readonly<Record<typeof NON_RULE_ANSWERS[number], readonly string[]>> = {
    allows: [],
    blocks: ['step', 'cause', 'reason'],
    'needs detail': ['of', 'step', 'missing'],
}

const DETAIL_OF = ['action', 'consequences']

/**
 * NR-4's check, as the probe's grade: the block parses; `answer` is one of the three; each answer has its fields as non-empty strings and
 * none of the others'; `of` is `action` or `consequences`; each quote matches one step. The canonical answer is `allows`,
 * `blocks <step>/<cause>`, or `needs detail of <of> <step>`, by position. Fields no answer has are ignored.
 */
export const gradeNonRuleCell = (reply: string, { inputs: { steps } }: PieceCell<NonRuleCellInputs>): PieceGrade => {
    const parsed = replyJsonObject(reply)
    if ('malformed' in parsed) {
        return parsed
    }
    const { object } = parsed
    const answer = typeof object.answer === 'string' ? object.answer.trim().toLowerCase() : undefined
    if (answer === undefined) {
        return { malformed: 'the JSON block has no string "answer"' }
    }
    if (!(NON_RULE_ANSWERS as readonly string[]).includes(answer)) {
        return { malformed: `"${answer}" is not one of ${NON_RULE_ANSWERS.join(', ')}` }
    }
    const own = FIELDS[answer as keyof typeof FIELDS]
    const others = [...new Set(Object.values(FIELDS).flat())].filter((field) => !own.includes(field) && field in object)
    if (others.length > 0) {
        return { malformed: `${answer} has another answer's fields: ${others.join(', ')}` }
    }
    const missing = own.filter((field) => typeof object[field] !== 'string' || (object[field] as string).trim() === '')
    if (missing.length > 0) {
        return { malformed: `${answer} needs non-empty string fields: ${missing.join(', ')}` }
    }
    const at = (field: string) => matchStep(object[field] as string, steps)
    if (answer === 'allows') {
        return { answer }
    }
    const step = at('step')
    if ('malformed' in step) {
        return { malformed: `step: ${step.malformed}` }
    }
    if (answer === 'blocks') {
        const cause = at('cause')
        return 'malformed' in cause ? { malformed: `cause: ${cause.malformed}` } : { answer: `blocks ${step.position}/${cause.position}` }
    }
    const of = (object.of as string).trim().toLowerCase()
    return DETAIL_OF.includes(of) ? { answer: `needs detail of ${of} ${step.position}` } : { malformed: `"of" is "${of}", not one of ${DETAIL_OF.join(', ')}` }
}

/** The whole scene with no Rules section (NR-6), the request in its own section, then each step with its role, unnumbered. */
export const renderNonRuleCell = async ({ inputs: { fixture, request, steps } }: PieceCell<NonRuleCellInputs>): Promise<string> => {
    if (steps.length === 0) {
        throw new Error('No steps')
    }
    if (request.trim() === '') {
        throw new Error('No request')
    }
    const full = await fixtureScene(fixture)
    const unknown = [...new Set([request, ...steps.map(({ says }) => says)].flatMap(namedHandles))].filter((handle) => full.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`The cell names ${unknown.join(', ')}, not in ${fixture}'s scene`)
    }
    const normalized = steps.map(({ says }) => normalizeStep(says))
    const twice = steps.filter((_, index) => normalized.indexOf(normalized[index]) !== index)
    if (twice.length > 0) {
        throw new Error(`Steps a quote can't tell apart: ${twice.map(({ says }) => says).join('; ')}`)
    }
    const { fiction, graph } = judgeSceneSections(full)
    return [
        `Scene: ${heading(full)}`,
        fiction,
        graph,
        'End of scene.',
        `The player's request: ${request}`,
        ['The steps, in order:', ...steps.map(({ says, role }) => `- (${role}) ${says}`)].join('\n'),
    ].join('\n\n')
}

const parseNonRuleCellOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'nonRuleCell takes no options')

const intended = (says: string): NonRuleStep => ({ says, role: 'intended' })
const method = (says: string): NonRuleStep => ({ says, role: 'method' })
const consequence = (says: string): NonRuleStep => ({ says, role: 'consequence' })

/** A case's request and its first candidate's actions, each intended: the single-step cells, where the template's step is the request. */
const caseCell = (id: string): Pick<PieceCell<NonRuleCellInputs>, 'inputs' | 'source'> => ({
    inputs: { fixture: oracleCases[id].scene.fixture, request: oracleCases[id].request, steps: caseActions(id).map(intended) },
    source: `oracleCases ${id}, candidate ${oracleCases[id].candidates[0].id}`,
})

/** The OC-30 chain's amended intent (the sub-plan's question 3, user, 2026-11-13). */
const pourIntoCup = 'I want to pour tea from [teapot1] into [cup1].'
const tip = method('tip [table1]')
const pours = intended('[teapot1] pours [tea2] into [cup1]')
const tableInCup = 'put [table1] in [cup1]'
const theSize = 'the size: a table is far too big to go into a cup'

export const nonRuleCellCells: Record<string, PieceCell<NonRuleCellInputs>> = {
    'OC-11': {
        ...caseCell('OC-11'),
        expected: 'blocks 1/1',
        lookFor: theSize,
        note: 'The size case. Asking for sizes is over-asking: common sense settles them.',
    },
    'OC-18': {
        inputs: { fixture: 'teaTableCupOnFloor', request: 'I want to hammer [table1] into [cup1].', steps: [intended('hammer [table1] into [cup1]')] },
        expected: 'blocks 1/1',
        lookFor: `${theSize}, which no hammering changes`,
        source: 'hand-written',
        note: 'A method that can\'t help. Asking for detail of the hammering is over-asking.',
    },
    'OC-3': {
        inputs: { fixture: 'teaTable', request: 'I want to put [table1] in [cup1].', steps: [intended(tableInCup)] },
        expected: 'blocks 1/1',
        lookFor: `${theSize}, not the cup being on the table`,
        source: 'hand-written',
        note: 'The record\'s reason (the cup on the table) isn\'t the fiction\'s.',
    },
    'OC-1': {
        ...caseCell('OC-1'),
        expected: 'allows',
        lookFor: 'the walk takes the things on the table as travelling with it, and does not treat the glue as a blocker',
        note: 'The glue is the rule cell\'s. Asking about the consequences for the things on the table is over-asking.',
    },
    'OC-2': {
        inputs: { fixture: 'teaTable', request: 'I want to pick up [cup1].', steps: [intended('pick up [cup1]')] },
        expected: 'allows',
        lookFor: 'an ordinary pick-up, nothing in the way',
        source: 'hand-written',
        note: 'A guard.',
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', request: oracleCases['OC-20'].request, steps: [intended('pick up [table1]')] },
        expected: 'allows',
        lookFor: 'the walk does not treat the chain to the wall as a blocker',
        source: 'hand-written',
        note: 'The chain is the rule cell\'s. The harness has no candidate, so the step is written by hand.',
    },
    'OC-6': {
        ...caseCell('OC-6'),
        expected: 'allows',
        lookFor: 'an ordinary pour; the missing tilt and the glue are not raised as blockers',
        note: 'With the rules set aside, a pour from a teapot into a cup is ordinary: the missing tilt is the glue\'s.',
    },
    'OC-30/h5': {
        inputs: { fixture: 'teaTable', request: pourIntoCup, steps: [tip, pours] },
        expected: 'needs detail of consequences 1',
        lookFor: '`missing` asks what tipping the table does to the things on it: the saucer and the cup',
        source: 'hand-written, the OC-30 chain\'s hop 5',
        note: 'A cell where asking is right: whether the cup is still under the spout turns on what the tip does to it, which no step says.',
    },
    'OC-30/h7': {
        inputs: { fixture: 'teaTable', request: pourIntoCup, steps: [tip, consequence('tipping [table1] slides [saucer1] and [cup1] off'), pours] },
        expected: 'blocks 3/2',
        lookFor: 'a reason fit to brief a mitigation: the cup has slid off with the saucer, so it is no longer under the spout',
        source: 'hand-written, the OC-30 chain\'s hop 7',
        note: 'The pour is the step that fails, and the slide is to blame.',
    },
    'OC-30/h10': {
        inputs: { fixture: 'teaTable', request: pourIntoCup, steps: [method('pick up [saucer1]'), tip, pours] },
        expected: 'allows',
        lookFor: 'the saucer, carrying the cup, is held off the table, so the tip leaves nothing loose; asking what the tip does is over-asking',
        source: 'hand-written, the OC-30 chain\'s hop 10',
        note: 'Hop 8\'s repair (user, 2026-11-09).',
    },
    'OC-9': {
        inputs: { fixture: 'tavern', request: 'I want to pick up [table1].', steps: [intended('pick up [table1]')] },
        lookFor: 'what the three outcomes do with a feat: the trestle as heavy and hard to lift, and which answer that is given',
        source: 'hand-written',
        note: 'Open (JF-2): the skill-or-chance outcome is booked for a later iteration, so the cell is tallied, not graded.',
    },
}

export const nonRuleCell: OraclePiece<NonRuleCellInputs, undefined> = {
    name: 'nonRuleCell',
    answers: NON_RULE_ANSWERS,
    cells: nonRuleCellCells,
    parseOptions: parseNonRuleCellOptions,
    render: renderNonRuleCell,
    grade: gradeNonRuleCell,
}

export const registeredNonRuleCell = registerPiece(nonRuleCell)
