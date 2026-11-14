//
// The non-rule cell (AGENT.nonRuleCell.planning.md, steps 2 and 3; a Prototype of the oracle loop plan's Slice 4.5): whether a plan can
// go ahead for reasons no rule names, such as stuffing a table into a teacup. It sees the whole scene with no Rules section, the player's
// request, and the plan's steps in order, each with its role and the consequence lines it causes, if any. It walks every step (draft 3's
// non-branching walk) and ends with one fenced JSON block holding a finding per step: `works`, `blocked` (quoting the step or line to
// blame) or `needs detail` of the action or of its consequences, each with what it establishes. Code matches each quote, so the piece
// never gives a number, applies the first-non-works rule, and grades by a canonical answer string.
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { caseActions, fixtureScene, namedHandles } from '../imaginationPieces/imaginationScene'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type OraclePiece, type PieceCell } from '../pieceProbe/oraclePiece'
import { replyJsonObject, type PieceGrade } from '../pieceProbe/pieceAnswer'

/**
 * A step's role (the step layout): `intended`, what the player's request states; `method`, a step the system supplies to carry it out.
 * Code routes a failure by the blamed step's role; a consequence line under a step routes toward a mitigation.
 */
export type NonRuleRole = 'intended' | 'method'

/** A step, with the consequence lines it causes (NR-L6), as `consequences` gives them per action. Each line can be quoted. */
export type NonRuleStep = { says: string; role: NonRuleRole; consequences?: readonly string[] }

export type NonRuleCellInputs = {
    fixture: string
    /** The player's request, in its own words: the yardstick for what is intended. */
    request: string
    steps: readonly NonRuleStep[]
}

/** The plan's answers, by the first step whose finding isn't `works`. */
export const NON_RULE_ANSWERS = ['allows', 'blocks', 'needs detail'] as const

/** Each step's findings in the reply's block. */
export const NON_RULE_FINDINGS = ['works', 'blocked', 'needs detail'] as const

/** A quote or a step as code compares them: lowercased, brackets and surrounding quotes and end punctuation dropped, whitespace collapsed. */
export const normalizeStep = (text: string): string => text
    .toLowerCase()
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[\s.,;:!?]+$/, '')
    .trim()

/** Something a reply can quote: a step, labelled by its position (`2`), or a consequence line under one (`2c1`). */
export type Quotable = { label: string; step: number; says: string }

/** The steps alone, or the steps with their consequence lines, in order. */
export const quotables = (steps: readonly NonRuleStep[], withLines: boolean): Quotable[] => steps.flatMap(({ says, consequences = [] }, index) => [
    { label: `${index + 1}`, step: index + 1, says },
    ...(withLines ? consequences.map((line, lineIndex) => ({ label: `${index + 1}c${lineIndex + 1}`, step: index + 1, says: line })) : []),
])

/**
 * What a quote names: the one quotable it matches whole, or else the one it falls inside, on word boundaries (so "tip" isn't inside
 * "tipping"); or why there is none.
 */
export const matchQuote = (quote: string, among: readonly Quotable[]): { quoted: Quotable } | { malformed: string } => {
    const wanted = normalizeStep(quote)
    if (wanted === '') {
        return { malformed: 'an empty quote' }
    }
    const normalized = among.map(({ says }) => normalizeStep(says))
    const found = (matches: (text: string) => boolean): Quotable[] => among.filter((_, index) => matches(normalized[index]))
    const whole = found((text) => text === wanted)
    if (whole.length === 1) {
        return { quoted: whole[0] }
    }
    const inside = found((text) => ` ${text} `.includes(` ${wanted} `))
    if (inside.length === 1) {
        return { quoted: inside[0] }
    }
    return { malformed: inside.length === 0 ? `"${quote}" quotes nothing given` : `"${quote}" quotes ${inside.length} things` }
}

/** Each finding's required fields; an entry carrying another finding's field (required or optional) is malformed. */
const FIELDS: Readonly<Record<typeof NON_RULE_FINDINGS[number], readonly string[]>> = {
    works: ['step', 'finding', 'establishes'],
    blocked: ['step', 'finding', 'reason', 'establishes'],
    'needs detail': ['step', 'finding', 'of', 'missing', 'establishes'],
}

/** Each finding's optional fields (draft 5, NR-L9): `cause` on `blocked`, given only when an earlier step or a line is to blame. */
const OPTIONAL_FIELDS: Readonly<Record<typeof NON_RULE_FINDINGS[number], readonly string[]>> = {
    works: [],
    blocked: ['cause'],
    'needs detail': [],
}

const DETAIL_OF = ['action', 'consequences']

type Finding = { finding: 'works' } | { finding: 'blocked'; cause: string } | { finding: 'needs detail'; of: string }

/** One entry's check, against the step it must quote: its finding, its own fields as non-empty strings and none of the others', its quotes. */
const readEntry = (entry: unknown, position: number, steps: readonly NonRuleStep[]): Finding | { malformed: string } => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return { malformed: 'is not an object' }
    }
    const object = entry as Record<string, unknown>
    const finding = typeof object.finding === 'string' ? object.finding.trim().toLowerCase() : undefined
    if (finding === undefined) {
        return { malformed: 'has no string "finding"' }
    }
    if (!(NON_RULE_FINDINGS as readonly string[]).includes(finding)) {
        return { malformed: `"${finding}" is not one of ${NON_RULE_FINDINGS.join(', ')}` }
    }
    const own = FIELDS[finding as keyof typeof FIELDS]
    const optional = OPTIONAL_FIELDS[finding as keyof typeof OPTIONAL_FIELDS]
    const others = [...new Set([...Object.values(FIELDS), ...Object.values(OPTIONAL_FIELDS)].flat())]
        .filter((field) => !own.includes(field) && !optional.includes(field) && field in object)
    if (others.length > 0) {
        return { malformed: `${finding} has another finding's fields: ${others.join(', ')}` }
    }
    const missing = own.filter((field) => typeof object[field] !== 'string' || (object[field] as string).trim() === '')
    if (missing.length > 0) {
        return { malformed: `${finding} needs non-empty string fields: ${missing.join(', ')}` }
    }
    const step = matchQuote(object.step as string, quotables(steps, false))
    if ('malformed' in step) {
        return { malformed: `step: ${step.malformed}` }
    }
    if (step.quoted.step !== position) {
        return { malformed: `step: quotes step ${step.quoted.step}, not step ${position}` }
    }
    if (finding === 'blocked') {
        // `cause` absent, empty, or quoting nothing given means the blocked step itself (the user, 2026-11-13: read it as the step, and
        // see whether that is coherent). A quote of several things, or of something after the step, is still malformed.
        if (typeof object.cause !== 'string' || object.cause.trim() === '') {
            return { finding, cause: `${position}` }
        }
        const cause = matchQuote(object.cause, quotables(steps, true))
        if ('malformed' in cause) {
            return cause.malformed.endsWith('quotes nothing given') ? { finding, cause: `${position}` } : { malformed: `cause: ${cause.malformed}` }
        }
        return cause.quoted.step > position
            ? { malformed: `cause: quotes ${cause.quoted.label}, after the blocked step` }
            : { finding, cause: cause.quoted.label }
    }
    if (finding === 'needs detail') {
        const of = (object.of as string).trim().toLowerCase()
        return DETAIL_OF.includes(of) ? { finding, of } : { malformed: `"of" is "${of}", not one of ${DETAIL_OF.join(', ')}` }
    }
    return { finding: 'works' }
}

/**
 * NR-4's check as amended for draft 3, as the probe's grade: the block parses and holds `steps`, an entry per step in order, each
 * quoting its own step; each entry passes `readEntry`. Code then applies the first-non-works rule: the canonical answer is `allows`,
 * `blocks <step>/<cause>` (the cause a step, `2`, or a consequence line, `1c1`; the blocked step itself when `cause` is absent or
 * quotes nothing given, as draft 5 makes it optional), or `needs detail of <of> <step>`. Fields no finding
 * has are ignored, so a draft can add a slot read only by hand (draft 4's `for and against`, draft 5's `factors`); the findings after the first non-works
 * are read by hand.
 */
export const gradeNonRuleCell = (reply: string, { inputs: { steps } }: PieceCell<NonRuleCellInputs>): PieceGrade => {
    const parsed = replyJsonObject(reply)
    if ('malformed' in parsed) {
        return parsed
    }
    const entries = parsed.object.steps
    if (!Array.isArray(entries)) {
        return { malformed: 'the JSON block has no "steps" array' }
    }
    if (entries.length !== steps.length) {
        return { malformed: `"steps" has ${entries.length} entries for ${steps.length} steps` }
    }
    const findings: Finding[] = []
    for (const [index, entry] of entries.entries()) {
        const read = readEntry(entry, index + 1, steps)
        if ('malformed' in read) {
            return { malformed: `entry ${index + 1}: ${read.malformed}` }
        }
        findings.push(read)
    }
    const first = findings.findIndex(({ finding }) => finding !== 'works')
    if (first === -1) {
        return { answer: 'allows' }
    }
    const stop = findings[first]
    return stop.finding === 'blocked'
        ? { answer: `blocks ${first + 1}/${stop.cause}` }
        : { answer: `needs detail of ${(stop as { of: string }).of} ${first + 1}` }
}

/**
 * The whole scene with no Rules section (NR-6), the request in its own section, then each step with its role, unnumbered, and its
 * consequence lines indented under it.
 */
export const renderNonRuleCell = async ({ inputs: { fixture, request, steps } }: PieceCell<NonRuleCellInputs>): Promise<string> => {
    if (steps.length === 0) {
        throw new Error('No steps')
    }
    if (request.trim() === '') {
        throw new Error('No request')
    }
    const full = await fixtureScene(fixture)
    const all = quotables(steps, true)
    const unknown = [...new Set([request, ...all.map(({ says }) => says)].flatMap(namedHandles))].filter((handle) => full.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`The cell names ${unknown.join(', ')}, not in ${fixture}'s scene`)
    }
    const normalized = all.map(({ says }) => normalizeStep(says))
    const twice = all.filter((_, index) => normalized.indexOf(normalized[index]) !== index)
    if (twice.length > 0) {
        throw new Error(`Lines a quote can't tell apart: ${twice.map(({ says }) => says).join('; ')}`)
    }
    const { fiction, graph } = judgeSceneSections(full)
    return [
        `Scene: ${heading(full)}`,
        fiction,
        graph,
        'End of scene.',
        `The player's request: ${request}`,
        [
            'The steps, in order:',
            ...steps.flatMap(({ says, role, consequences = [] }) => [`- (${role}) ${says}`, ...consequences.map((line) => `  - (consequence) ${line}`)]),
        ].join('\n'),
    ].join('\n\n')
}

const parseNonRuleCellOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'nonRuleCell takes no options')

const intended = (says: string): NonRuleStep => ({ says, role: 'intended' })
const method = (says: string): NonRuleStep => ({ says, role: 'method' })

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
        inputs: { fixture: 'teaTable', request: pourIntoCup, steps: [{ ...tip, consequences: ['[saucer1] and [cup1] slide off [table1] onto the floor'] }, pours] },
        expected: 'blocks 2/1c1',
        lookFor: 'a reason fit to brief a mitigation: the cup has slid off with the saucer, so it is no longer under the spout',
        source: 'hand-written, the OC-30 chain\'s hop 7',
        note: 'The pour is the step that fails, and the slide, a consequence line under the tip, is to blame.',
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
    maxTokens: 1536,
}

export const registeredNonRuleCell = registerPiece(nonRuleCell)
