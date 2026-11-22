//
// Step considerations (AGENT.nonRuleCell.planning.md, step 3, the considerations proposal; the user's, 2026-11-13): a read piece. Given
// the non-rule cell's inputs, it lists for each step what someone judging whether it can happen as written should be considering, in
// free text, and gives no finding. Judging the assembled list is a later pass, so the finding's categories can't pull the list toward a
// verdict (drafts 4 and 5, NR-P9). It reuses the non-rule cell's render and cells, so their inputs hashes match. There is no answer set:
// code checks each reply's form, and a reader reads the replies against each cell's `lookFor`.
//
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { replyJsonObject } from '../../llm/stageContract'
import { matchQuote, NON_RULE_CELL_VIEW, nonRuleCellCells, quotables, renderNonRuleCell, type NonRuleCellInputs } from './nonRuleCell'

const isNonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

/**
 * The form: the block parses and holds `steps`, an entry per step in order, each quoting its own step and with `considering` a non-empty
 * list of non-empty strings. Every problem is listed, not only the first. Fields beyond these are ignored.
 */
export const checkStepConsiderations = (reply: string, { inputs: { steps } }: ReadPieceCell<NonRuleCellInputs>): string[] => {
    const parsed = replyJsonObject(reply)
    if ('malformed' in parsed) {
        return [parsed.malformed]
    }
    const entries = parsed.object.steps
    if (!Array.isArray(entries)) {
        return ['the JSON block has no "steps" array']
    }
    return [
        ...(entries.length === steps.length ? [] : [`"steps" has ${entries.length} entries for ${steps.length} steps`]),
        ...entries.flatMap((entry, index): string[] => {
            const label = `entry ${index + 1}`
            if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
                return [`${label} is not an object`]
            }
            const { step, considering } = entry as Record<string, unknown>
            const quote = isNonEmptyString(step) ? matchQuote(step as string, quotables(steps, false)) : { malformed: 'has no string "step"' }
            return [
                ...('malformed' in quote
                    ? [`${label}: step: ${quote.malformed}`]
                    : quote.quoted.step === index + 1 ? [] : [`${label}: step: quotes step ${quote.quoted.step}, not step ${index + 1}`]),
                ...(Array.isArray(considering) && considering.length > 0 && considering.every(isNonEmptyString)
                    ? []
                    : [`${label}: "considering" is not a non-empty list of non-empty strings`]),
            ]
        }),
    ]
}

const parseStepConsiderationsOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'stepConsiderations takes no options')

/**
 * What a good set considers, per cell, written before batch 1 (the rubric). The inputs, sources and notes are the non-rule cell's.
 * "Should" items are what a reader expects to find; the player's ability is invented everywhere but OC-9.
 */
const LOOK_FOR: Record<keyof typeof nonRuleCellCells, string> = {
    'OC-11': 'the size of [table1] against [cup1]; where [cup1] is (on the floor)',
    'OC-18': 'the size of [table1] against [cup1], which hammering doesn\'t change; where [cup1] is (on the floor)',
    'OC-3': 'the size of [table1] against [cup1]; [cup1] sits on [saucer1] on [table1] itself',
    'OC-1': 'what is on [table1] ([teapot1] glued to it, [saucer1] and [cup1] resting on it) and that they come up with it; that [table1] is small',
    'OC-2': '[cup1] rests on [saucer1] on [table1], within reach; the player\'s hands are empty',
    'OC-20': 'the chain from [table1] to [wall1]; what is on [table1]',
    'OC-6': '[teapot1] holds [tea2]; [teapot1] is glued to [table1]; where [cup1] is relative to [teapot1] (on [saucer1] on the same table)',
    'OC-30/h5': 'the tip: [saucer1] and [cup1] resting loose on [table1], and [teapot1] glued to it; the pour: where [cup1] is after the tip, and [teapot1] tilted with the table',
    'OC-30/h7': 'the tip: its line, [saucer1] and [cup1] sliding off; the pour: [cup1] on the floor, no longer under [teapot1]\'s spout',
    'OC-30/h10': 'the pick-up: [cup1] on [saucer1], carried with it; the tip: [table1] with only [teapot1] on it; the pour: [cup1] held, within reach of the spout',
    'OC-9': 'the trestle [table1]\'s size and weight against one person; here the player\'s strength is fairly considered',
}

export const stepConsiderationsCells: Record<string, ReadPieceCell<NonRuleCellInputs>> = Object.fromEntries(
    Object.entries(nonRuleCellCells).map(([id, { inputs, source, note }]) => [id, { inputs, source, ...(note !== undefined ? { note } : {}), lookFor: LOOK_FOR[id] }]),
)

export const stepConsiderations: ReadPiece<NonRuleCellInputs, undefined> = {
    kind: 'read',
    name: 'stepConsiderations',
    view: NON_RULE_CELL_VIEW,
    cells: stepConsiderationsCells,
    check: checkStepConsiderations,
    parseOptions: parseStepConsiderationsOptions,
    render: (cell) => renderNonRuleCell(cell, { securing: NON_RULE_CELL_VIEW.scene.securing }),
    maxTokens: 1024,
}

export const registeredStepConsiderations = registerPiece(stepConsiderations)
