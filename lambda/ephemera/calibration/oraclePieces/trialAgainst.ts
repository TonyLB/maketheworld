//
// The case against (AGENT.nonRuleCell.planning.md, step 3, the trial proposal; the triad is the user's, 2026-11-14): a read piece, the
// first of three small biased calls. Given the non-rule cell's inputs, it gives its single best argument that the whole plan can't happen
// as written, and names the step the argument turns on. A rebuttal and a judgment follow in their own calls. It reuses the non-rule
// cell's render and cells, so their inputs hashes match. There is no answer set: code checks each reply's form, and a reader reads the
// replies against each cell's `lookFor`.
//
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { replyJsonObject } from '../pieceProbe/pieceAnswer'
import { matchQuote, nonRuleCellCells, quotables, renderNonRuleCell, type NonRuleCellInputs, type SecuringShown } from './nonRuleCell'

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** The form: the block parses, `step` quotes one of the plan's steps (any of them), and `argument` is a non-empty string. Every problem is listed. */
export const checkTrialAgainst = (reply: string, { inputs: { steps } }: ReadPieceCell<NonRuleCellInputs>): string[] => {
    const parsed = replyJsonObject(reply)
    if ('malformed' in parsed) {
        return [parsed.malformed]
    }
    const { step, argument } = parsed.object
    const quote = isNonEmptyString(step) ? matchQuote(step, quotables(steps, false)) : { malformed: 'has no string "step"' }
    return [
        ...('malformed' in quote ? [`step: ${quote.malformed}`] : []),
        ...(isNonEmptyString(argument) ? [] : ['has no non-empty string "argument"']),
    ]
}

export type TrialAgainstOptions = { securing: SecuringShown }

/**
 * `securing`: `shown` (the default), or `omitted`, the scene without its securing (the user, 2026-11-14: defensible because the rule cell,
 * a piece of its own, judges the securing; batch 1 argued the glue in 9 of 11).
 */
export const parseTrialAgainstOptions = (value: unknown): TrialAgainstOptions | string => {
    if (value === undefined) {
        return { securing: 'shown' }
    }
    const shape = "options must be { securing?: 'shown' | 'omitted' }"
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { securing = 'shown', ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length > 0 || (securing !== 'shown' && securing !== 'omitted') ? shape : { securing }
}

/**
 * The argument a reader expects to be the best, per cell, written before batch 1 (the rubric). Where the plan has no true blocker, the
 * reader notes which argument is picked and whether it rests on the scene. The inputs, sources and notes are the non-rule cell's.
 */
const LOOK_FOR: Record<keyof typeof nonRuleCellCells, string> = {
    'OC-11': 'the size: [table1] is far too big to go into [cup1]',
    'OC-18': 'the size, which no hammering changes',
    'OC-3': 'the size, not [cup1] being on [table1]',
    'OC-1': 'no true blocker: which argument is picked (the glue expected), and whether it rests on the scene or is invented',
    'OC-2': 'no true blocker: which argument is picked, and whether it rests on the scene or is invented',
    'OC-20': 'no true blocker for this piece (the chain is the rule cell\'s): which argument is picked',
    'OC-6': 'no true blocker for this piece (the glue is the rule cell\'s): which argument is picked',
    'OC-30/h5': 'the tip\'s unstated effect on the loose [saucer1] and [cup1]: [cup1] may no longer be under the spout, turning on step 1 or 2',
    'OC-30/h7': 'the slide line: [cup1] is on the floor, no longer under the spout, turning on the pour',
    'OC-30/h10': 'no true blocker: [cup1] is held on [saucer1]; which argument is picked',
    'OC-9': 'the trestle\'s weight and size for one person (open, JF-2)',
}

export const trialAgainstCells: Record<string, ReadPieceCell<NonRuleCellInputs>> = Object.fromEntries(
    Object.entries(nonRuleCellCells).map(([id, { inputs, source, note }]) => [id, { inputs, source, ...(note !== undefined ? { note } : {}), lookFor: LOOK_FOR[id] }]),
)

export const trialAgainst: ReadPiece<NonRuleCellInputs, TrialAgainstOptions> = {
    kind: 'read',
    name: 'trialAgainst',
    cells: trialAgainstCells,
    check: checkTrialAgainst,
    parseOptions: parseTrialAgainstOptions,
    render: (cell, options) => renderNonRuleCell(cell, options),
    maxTokens: 400,
}

export const registeredTrialAgainst = registerPiece(trialAgainst)
