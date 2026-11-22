//
// The ruling (AGENT.trialQuestion.planning.md, step 1; the framing the user's, 2026-11-16, the probe mine): a trial stage, `ruling`, an
// answered piece. The judge answers the case against's question alone, with nothing argued in view: no argument, no rebuttal. It sees the
// non-rule cell's scene in the explicit render, with the securing omitted, the player's request, the plan's steps, then the question, and
// answers `yes` or `no`. It never sees which answer the argument says blocks: that is argued material. Code reads the answer through the
// argument's `blocking` into the plan's outcome, `blocks` or `allows`, and grades that against the cell's expected outcome (step 2), so a
// question the case against wrote, of either polarity, is graded the same way as a golden one. On the golden questions the outcome is
// right exactly when the answer is QS-1's. A lifted argument recorded before step 2 has no question, so `lifted` is refused as missing.
//
import { parseProblems, replyJsonObject, type StageContract } from '../../../llm/stageContract'
import { registerPiece, type OraclePiece, type PieceCell } from '../../pieceProbe/oraclePiece'
import type { PieceGrade } from '../../pieceProbe/pieceAnswer'
import { parseUpstreamOptions, pickStageInput, type StageInput, type UpstreamOptions } from '../../pieceProbe/stageInput'
import { matchQuote, quotables, renderNonRuleCell, type NonRuleCellInputs } from '../nonRuleCell'
import { fitsCurrentContract } from './rebuttal'
import { rulingOutcome, TRIAL_OUTCOMES, TRIAL_RULINGS, trialCases, type TrialArgument, type TrialCase, type TrialOutcome, type TrialRuling } from './trialCases'
import { NO_PLAN_VIEW } from '../../oracleLoop/actionPlan'

/** A ruling cell's inputs: the non-rule cell's, and the argument whose question is asked, from either source. */
export type TrialRulingInputs = NonRuleCellInputs & { against: StageInput<TrialArgument> }

/** What the ruling stage reads: the non-rule cell's inputs and the question. */
export type TrialRulingInput = NonRuleCellInputs & { question: string }

/** The question line: sceneReading's, since no argument is shown for the question to belong to. */
const QUESTION_LINE = 'The question: '

/**
 * The stage's contract: the reply's trailing JSON block parses and its `answer` is `yes` or `no` (trimmed, any case). The description
 * before the block is read, not checked.
 */
export const rulingContract: StageContract<TrialRulingInput, TrialRuling> = {
    name: 'trial ruling',
    parse: (reply) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { answer } = parsed.object
        if (typeof answer !== 'string') {
            return { problems: ['has no string "answer"'] }
        }
        const ruling = answer.trim().toLowerCase()
        return (TRIAL_RULINGS as readonly string[]).includes(ruling)
            ? { value: ruling as TrialRuling }
            : { problems: [`"${answer}" is not one of ${TRIAL_RULINGS.join(', ')}`] }
    },
}

/**
 * The question a cell asks and the answer the argument says blocks, from the payload's source. Throws when the cell has no value from
 * that source, when it doesn't fit the current contract (no question or no blocking answer: an older contract), or when its step quotes
 * none of the plan's steps, as the rebuttal's render does.
 */
export const ruledQuestion = (cell: PieceCell<TrialRulingInputs>, { upstream }: UpstreamOptions): { question: string; blocking: TrialRuling } => {
    const against = pickStageInput(cell.inputs.against, upstream, fitsCurrentContract)
    const quote = matchQuote(against.step, quotables(cell.inputs.steps, false))
    if ('malformed' in quote) {
        throw new Error(`The argument's step: ${quote.malformed}`)
    }
    return { question: against.question as string, blocking: against.blocking as TrialRuling }
}

/** The non-rule cell's render in the explicit scene, the securing omitted, then the question. Nothing argued is shown. */
export const renderTrialRuling = async (cell: PieceCell<TrialRulingInputs>, options: UpstreamOptions): Promise<string> => {
    const { question } = ruledQuestion(cell, options)
    const scene = await renderNonRuleCell(cell, { securing: 'omitted', scene: 'explicit' })
    return `${scene}\n\n${QUESTION_LINE}${question}`
}

/** The probe's grade: the contract's answer read through the argument's `blocking` into the plan's outcome, or the parse's problems. */
export const gradeTrialRuling = (reply: string, cell: PieceCell<TrialRulingInputs>, rendered: string, options: UpstreamOptions): PieceGrade => {
    const { question, blocking } = ruledQuestion(cell, options)
    const parsed = rulingContract.parse(reply, { input: { ...cell.inputs, question }, rendered })
    return 'value' in parsed ? { answer: rulingOutcome(parsed.value, blocking) } : { malformed: parseProblems(parsed).join('; ') }
}

/**
 * A cell's expected outcome: QS-1's expected answer to the golden question, read through the golden's `blocking`. It holds for any
 * question, since it is the plan's outcome, not an answer. Absent where open (OC-9).
 */
export const expectedOutcome = ({ against, expected }: Pick<TrialCase, 'against' | 'expected'>): TrialOutcome | undefined => {
    const blocking = against.golden?.value.blocking
    return expected.ruling === undefined || blocking === undefined ? undefined : rulingOutcome(expected.ruling, blocking)
}

/** The trial's cells, each with the argument whose question is asked, the expected outcome (absent where open) and the ruling's look-for. */
export const trialRulingCells: Record<string, PieceCell<TrialRulingInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, against, expected, lookFor, notes }]) => [id, {
        inputs: { ...inputs, against },
        source: `the question, golden: ${against.golden?.note}; lifted: ${against.lifted?.source}`,
        ...(expectedOutcome({ against, expected }) !== undefined ? { expected: expectedOutcome({ against, expected }) } : {}),
        lookFor: lookFor.ruling,
        ...(notes?.ruling !== undefined ? { note: notes.ruling } : {}),
    }]),
)

export const trialRuling: OraclePiece<TrialRulingInputs, UpstreamOptions> = {
    name: 'trial ruling',
    view: { plan: NO_PLAN_VIEW },
    answers: TRIAL_OUTCOMES,
    cells: trialRulingCells,
    parseOptions: parseUpstreamOptions,
    render: renderTrialRuling,
    grade: gradeTrialRuling,
    maxTokens: 400,
}

export const registeredRuling = registerPiece(trialRuling)
