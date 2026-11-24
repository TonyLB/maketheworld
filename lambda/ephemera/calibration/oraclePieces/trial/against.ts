//
// The case against (AGENT.nonRuleCell.planning.md, step 3, the trial proposal; the triad is the user's, 2026-11-14): the trial family's
// first stage, `against`, a read piece, the first of three small biased calls. Given the non-rule cell's inputs, it gives the question
// whose answer does the most to show the whole plan can't happen as written, the answer that would (QS-2, the user's), the step it turns
// on, and why (AGENT.trialQuestion.planning.md, step 2). A rebuttal and a judgment follow in
// their own calls. It reuses the non-rule cell's render and inputs, so their inputs hashes match; its cells are the trial's
// (`trialCases.ts`), each with its against look-for. There is no answer set: code checks each reply's form, and a reader reads the
// replies against each cell's `lookFor`.
//
import { registerPiece, type PieceView, type ReadPiece, type ReadPieceCell } from '../../pieceProbe/oraclePiece'
import { parseProblems, replyJsonObject, type StageContract } from '../../../llm/stageContract'
import { matchQuote, quotables, renderNonRuleCell, type NonRuleCellInputs, type SecuringShown } from '../nonRuleCell'
import { isSceneRender, SCENE_RENDERS, type SceneRender } from '../../pieceProbe/sceneRenders'
import { TRIAL_RULINGS, trialCases, type TrialArgument, type TrialRuling } from './trialCases'
import { NO_PLAN_VIEW } from '../../oracleLoop/actionPlan'

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * The stage's contract: it reads the non-rule cell's inputs and gives a `TrialArgument`, the step quoted as the reply quoted it. The parse
 * is the form: the block parses, `question` is a non-empty string, `blocking` is `yes` or `no` (trimmed, any case), `step` quotes one of
 * the plan's steps (any of them), and `argument` is a non-empty string. Every problem is listed.
 */
export const againstContract: StageContract<NonRuleCellInputs, TrialArgument> = {
    name: 'trial against',
    parse: (reply, { input: { steps } }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { question, blocking: rawBlocking, step, argument } = parsed.object
        const blocking = typeof rawBlocking === 'string' ? rawBlocking.trim().toLowerCase() : undefined
        const isBlocking = (value: string | undefined): value is TrialRuling => (TRIAL_RULINGS as readonly (string | undefined)[]).includes(value)
        const quote = isNonEmptyString(step) ? matchQuote(step, quotables(steps, false)) : { malformed: 'has no string "step"' }
        const problems = [
            ...(isNonEmptyString(question) ? [] : ['has no non-empty string "question"']),
            ...(isBlocking(blocking) ? [] : [`"blocking" must be one of ${TRIAL_RULINGS.join(', ')}`]),
            ...('malformed' in quote ? [`step: ${quote.malformed}`] : []),
            ...(isNonEmptyString(argument) ? [] : ['has no non-empty string "argument"']),
        ]
        return problems.length > 0 || !isNonEmptyString(question) || !isBlocking(blocking) || !isNonEmptyString(step) || !isNonEmptyString(argument)
            ? { problems }
            : { value: { step, argument, question, blocking } }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkTrialAgainst = (reply: string, cell: ReadPieceCell<NonRuleCellInputs>, rendered = ''): string[] => (
    parseProblems(againstContract.parse(reply, { input: cell.inputs, rendered }))
)

export type TrialAgainstOptions = { securing: SecuringShown; scene?: SceneRender }

/**
 * The case against's view (calibration AGENT.md, "Piece views"): no plan, and the whole scene with its securing as rendered, today's
 * default. The trial's kept setting is `omitted` (the user, 2026-11-14), but the default stays, since flipping it would move the default's
 * inputs hashes: a behaviour change, booked under the oracle loop plan's Piece views item for the trial's next redraft.
 */
export const TRIAL_AGAINST_VIEW: PieceView = { plan: NO_PLAN_VIEW, scene: { shows: 'whole', securing: 'shown', sceneRules: false } }

/**
 * The stage's options, `stage` aside (the harness takes it). `securing`, an arm over the view's: `shown`, or `omitted`, the scene without its securing (the user, 2026-11-14: defensible because the rule cell,
 * a piece of its own, judges the securing; batch 1 argued the glue in 9 of 11). `scene`: the judge render when absent, or `explicit`
 * (AGENT.trialQuestion.planning.md, step 2), which swaps only the scene block.
 */
export const parseTrialAgainstOptions = (value: unknown): TrialAgainstOptions | string => {
    const shape = `options must be { securing?: 'shown' | 'omitted', scene?: ${SCENE_RENDERS.map((render) => `'${render}'`).join(' | ')} }`
    if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        return shape
    }
    const { securing = TRIAL_AGAINST_VIEW.scene.securing, scene, ...rest } = (value ?? {}) as Record<string, unknown>
    if (Object.keys(rest).length > 0 || (securing !== 'shown' && securing !== 'omitted') || (scene !== undefined && !isSceneRender(scene))) {
        return shape
    }
    return scene === undefined ? { securing } : { securing, scene }
}

/** The trial's cells, each with the non-rule cell's inputs, source and note, and what a reader expects the best argument to be. */
export const trialAgainstCells: Record<string, ReadPieceCell<NonRuleCellInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, source, note, lookFor }]) => [id, { inputs, source, ...(note !== undefined ? { note } : {}), lookFor: lookFor.against }]),
)

export const trialAgainst: ReadPiece<NonRuleCellInputs, TrialAgainstOptions> = {
    kind: 'read',
    name: 'trial against',
    view: TRIAL_AGAINST_VIEW,
    cells: trialAgainstCells,
    check: checkTrialAgainst,
    parseOptions: parseTrialAgainstOptions,
    render: (cell, options) => renderNonRuleCell(cell, options),
    maxTokens: 400,
}

export const registeredAgainst = registerPiece(trialAgainst)
