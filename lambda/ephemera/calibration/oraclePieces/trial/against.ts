//
// The case against (AGENT.nonRuleCell.planning.md, step 3, the trial proposal; the triad is the user's, 2026-11-14): the trial family's
// first stage, `against`, a read piece, the first of three small biased calls. Given the non-rule cell's inputs, it gives its single best
// argument that the whole plan can't happen as written, and names the step the argument turns on. A rebuttal and a judgment follow in
// their own calls. It reuses the non-rule cell's render and inputs, so their inputs hashes match; its cells are the trial's
// (`trialCases.ts`), each with its against look-for. There is no answer set: code checks each reply's form, and a reader reads the
// replies against each cell's `lookFor`.
//
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../../pieceProbe/oraclePiece'
import { replyJsonObject } from '../../pieceProbe/pieceAnswer'
import { matchQuote, quotables, renderNonRuleCell, type NonRuleCellInputs, type SecuringShown } from '../nonRuleCell'
import { trialCases } from './trialCases'

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
 * The stage's options, `stage` aside (the harness takes it). `securing`: `shown` (the default), or `omitted`, the scene without its securing (the user, 2026-11-14: defensible because the rule cell,
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

/** The trial's cells, each with the non-rule cell's inputs, source and note, and what a reader expects the best argument to be. */
export const trialAgainstCells: Record<string, ReadPieceCell<NonRuleCellInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, source, note, lookFor }]) => [id, { inputs, source, ...(note !== undefined ? { note } : {}), lookFor: lookFor.against }]),
)

export const trialAgainst: ReadPiece<NonRuleCellInputs, TrialAgainstOptions> = {
    kind: 'read',
    name: 'trial against',
    cells: trialAgainstCells,
    check: checkTrialAgainst,
    parseOptions: parseTrialAgainstOptions,
    render: (cell, options) => renderNonRuleCell(cell, options),
    maxTokens: 400,
}

export const registeredAgainst = registerPiece(trialAgainst)
