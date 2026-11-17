//
// The ruling (AGENT.trialQuestion.planning.md, step 1; the framing the user's, 2026-11-16, the probe mine): a trial stage, `ruling`, an
// answered piece. The judge answers the case against's question alone, with nothing argued in view: no argument, no rebuttal. It sees the
// non-rule cell's scene in the explicit render, with the securing omitted, the player's request, the plan's steps, then the question, and
// answers `yes` or `no`. The question is the golden one: a lifted argument has none (the older contract), so `lifted` is refused as
// missing until the case against gives its question (step 2). Code grades each reply against the cell's expected answer (QS-1).
//
import { parseProblems, replyJsonObject, type StageContract } from '../../../llm/stageContract'
import { registerPiece, type OraclePiece, type PieceCell } from '../../pieceProbe/oraclePiece'
import type { PieceGrade } from '../../pieceProbe/pieceAnswer'
import { parseUpstreamOptions, pickStageInput, type StageInput, type UpstreamOptions } from '../../pieceProbe/stageInput'
import { matchQuote, quotables, renderNonRuleCell, type NonRuleCellInputs } from '../nonRuleCell'
import { fitsCurrentContract } from './rebuttal'
import { TRIAL_RULINGS, trialCases, type TrialArgument, type TrialRuling } from './trialCases'

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
 * The question a cell asks, from the payload's source. Throws when the cell has no value from that source, when it has no question (a
 * lifted argument, the older contract), or when its step quotes none of the plan's steps, as the rebuttal's render does.
 */
export const ruledQuestion = (cell: PieceCell<TrialRulingInputs>, { upstream }: UpstreamOptions): string => {
    const against = pickStageInput(cell.inputs.against, upstream, fitsCurrentContract)
    const quote = matchQuote(against.step, quotables(cell.inputs.steps, false))
    if ('malformed' in quote) {
        throw new Error(`The argument's step: ${quote.malformed}`)
    }
    return against.question as string
}

/** The non-rule cell's render in the explicit scene, the securing omitted, then the question. Nothing argued is shown. */
export const renderTrialRuling = async (cell: PieceCell<TrialRulingInputs>, options: UpstreamOptions): Promise<string> => {
    const question = ruledQuestion(cell, options)
    const scene = await renderNonRuleCell(cell, { securing: 'omitted', scene: 'explicit' })
    return `${scene}\n\n${QUESTION_LINE}${question}`
}

/** The probe's grade: the contract's value as the answer, or its problems as the reason a reply is malformed. */
export const gradeTrialRuling = (reply: string, cell: PieceCell<TrialRulingInputs>, rendered: string, options: UpstreamOptions): PieceGrade => {
    const parsed = rulingContract.parse(reply, { input: { ...cell.inputs, question: ruledQuestion(cell, options) }, rendered })
    return 'value' in parsed ? { answer: parsed.value } : { malformed: parseProblems(parsed).join('; ') }
}

/** The trial's cells, each with the argument whose question is asked, the ruling's expected answer (absent where open) and its look-for. */
export const trialRulingCells: Record<string, PieceCell<TrialRulingInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, against, expected, lookFor, notes }]) => [id, {
        inputs: { ...inputs, against },
        source: `the question, golden: ${against.golden?.note}`,
        ...(expected.ruling !== undefined ? { expected: expected.ruling } : {}),
        lookFor: lookFor.ruling,
        ...(notes?.ruling !== undefined ? { note: notes.ruling } : {}),
    }]),
)

export const trialRuling: OraclePiece<TrialRulingInputs, UpstreamOptions> = {
    name: 'trial ruling',
    answers: TRIAL_RULINGS,
    cells: trialRulingCells,
    parseOptions: parseUpstreamOptions,
    render: renderTrialRuling,
    grade: gradeTrialRuling,
    maxTokens: 400,
}

export const registeredRuling = registerPiece(trialRuling)
