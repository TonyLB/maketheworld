//
// The verdict (AGENT.nonRuleCell.planning.md, step 3, the trial proposal, stage 3; Slice B's design): the trial family's third stage,
// `verdict`, an answered piece, the last of three small biased calls. Given the non-rule cell's inputs, the argument that the plan can't
// happen with the question it answers, and the rebuttal of it, it says which of the two is right about that question: `argument` or
// `rebuttal`. It is the trial's one unbiased call, choosing between two short concrete arguments rather than weighing openly.
// The argument and the rebuttal come as a pair (`pickPaired`): `lifted` is a real rebuttal shown with the very argument it answered,
// checked by the hash of what the rebuttal read of the argument (`arguedAsRebutted`); `golden` is hand-written all the way up, and no golden rebuttals are written yet. It sees the scene the two were
// argued in, with the securing omitted, and the two sides each in a tag naming its stance on the plan (draft 5). Code grades each reply against the cell's expected answer, through the stage's contract.
//
import { parseProblems, replyJsonObject, type StageContract } from '../../../llm/stageContract'
import { joinParts, registerPiece, type OraclePiece, type PieceCell, type RenderedParts } from '../../pieceProbe/oraclePiece'
import type { PieceGrade } from '../../pieceProbe/pieceAnswer'
import { parseUpstreamOptions, pickPaired, type StageInput, type UpstreamOptions } from '../../pieceProbe/stageInput'
import { isSceneRender, SCENE_RENDERS, type NonRuleCellInputs, type SceneRender } from '../nonRuleCell'
import { fitsCurrentContract, renderArguedParts } from './rebuttal'
import { arguedAsRebutted, TRIAL_VERDICTS, trialCases, type TrialArgument, type TrialRebuttalReply, type TrialVerdict } from './trialCases'

/** What the verdict stage reads: the non-rule cell's inputs, the argument, and the rebuttal of it. */
export type TrialVerdictInput = NonRuleCellInputs & { argument: TrialArgument; rebuttal: TrialRebuttalReply }

/** A verdict cell's inputs: the non-rule cell's, and both upstream stages from either source. */
export type TrialVerdictInputs = NonRuleCellInputs & { against: StageInput<TrialArgument>; rebuttal: StageInput<TrialRebuttalReply> }

const REBUTTAL_LINE = 'The rebuttal: '

/**
 * The stage's contract: the reply's trailing JSON block parses and its `answer` is `argument` or `rebuttal` (trimmed, any case). The
 * description before the block is read, not checked.
 */
export const verdictContract: StageContract<TrialVerdictInput, TrialVerdict> = {
    name: 'trial verdict',
    parse: (reply) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { answer } = parsed.object
        if (typeof answer !== 'string') {
            return { problems: ['has no string "answer"'] }
        }
        const verdict = answer.trim().toLowerCase()
        return (TRIAL_VERDICTS as readonly string[]).includes(verdict)
            ? { value: verdict as TrialVerdict }
            : { problems: [`"${answer}" is not one of ${TRIAL_VERDICTS.join(', ')}`] }
    },
}

/** The verdict's options: the upstream source, and which render the scene takes, the judge render when absent (step 1.5's retest). */
export type TrialVerdictOptions = UpstreamOptions & { scene?: SceneRender }

/** `{ upstream: 'golden' | 'lifted', scene?: 'judge' | 'explicit' }`. */
export const parseVerdictOptions = (value: unknown): TrialVerdictOptions | string => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return parseUpstreamOptions(value)
    }
    const { scene, ...rest } = value as Record<string, unknown>
    if (scene !== undefined && !isSceneRender(scene)) {
        return `the verdict's scene must be one of ${SCENE_RENDERS.join(', ')}`
    }
    const upstream = parseUpstreamOptions(rest)
    return typeof upstream === 'string' || scene === undefined ? upstream : { ...upstream, scene }
}

/** The argument and the rebuttal a cell shows, from the payload's source. Throws on a missing source, a misfit, or a broken pair. */
export const judgedPair = (cell: PieceCell<TrialVerdictInputs>, { upstream }: UpstreamOptions): { argument: TrialArgument; rebuttal: TrialRebuttalReply } => {
    const { earlier, later } = pickPaired(cell.inputs.against, cell.inputs.rebuttal, upstream, { earlier: fitsCurrentContract, read: arguedAsRebutted })
    return { argument: earlier, rebuttal: later }
}

/** The probe's grade: the contract's value as the answer, or its problems as the reason a reply is malformed. */
export const gradeTrialVerdict = (reply: string, cell: PieceCell<TrialVerdictInputs>, rendered: string, options: UpstreamOptions): PieceGrade => {
    const parsed = verdictContract.parse(reply, { input: { ...cell.inputs, ...judgedPair(cell, options) }, rendered })
    return 'value' in parsed ? { answer: parsed.value } : { malformed: parseProblems(parsed).join('; ') }
}

/** The tags marking each side as a voice with a stance on the plan (verdict draft 5; the user's idea and names, 2026-11-16). */
export const ARGUES_CANNOT = 'argues-plan-cannot-happen'
export const ARGUES_CAN = 'argues-plan-can-happen'

const tagged = (tag: string, text: string): string => `<${tag}>\n${text}\n</${tag}>`

/**
 * The render's two parts (AGENT.trialQuestion.planning.md, step 0.5). The system part is the scene with the securing omitted, with the
 * request and its steps: the system's own record, not argued material. The user part is the question, then the two sides, each in its
 * own tag (draft 5): the argument naming its step in `<argues-plan-cannot-happen>`, the rebuttal in `<argues-plan-can-happen>`. The
 * question stays outside both, the neutral yardstick, and goes with the argued text since a later stage writes it.
 */
export const renderTrialVerdictParts = async (cell: PieceCell<TrialVerdictInputs>, options: TrialVerdictOptions): Promise<RenderedParts> => {
    const { argument, rebuttal } = judgedPair(cell, options)
    const parts = await renderArguedParts(cell, argument, options.scene === undefined ? {} : { scene: options.scene })
    return {
        system: parts.scene,
        user: [parts.question, `${tagged(ARGUES_CANNOT, parts.argument)}\n${tagged(ARGUES_CAN, `${REBUTTAL_LINE}${rebuttal.rebuttal}`)}`].join('\n\n'),
    }
}

/** The whole render: its two parts joined, the scene, the question and the two sides, each in its own section. */
export const renderTrialVerdict = async (cell: PieceCell<TrialVerdictInputs>, options: TrialVerdictOptions): Promise<string> => (
    joinParts(await renderTrialVerdictParts(cell, options))
)

/** The trial's cells, each with both upstream stages, the verdict's expected answer (absent where open) and its look-for. */
export const trialVerdictCells: Record<string, PieceCell<TrialVerdictInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, against, rebuttal, expected, lookFor, notes }]) => [id, {
        inputs: { ...inputs, against, rebuttal },
        source: `the argument, golden: ${against.golden?.note}; the rebuttal, lifted: ${rebuttal.lifted?.source}`,
        ...(expected.verdict !== undefined ? { expected: expected.verdict } : {}),
        lookFor: lookFor.verdict,
        ...(notes?.verdict !== undefined ? { note: notes.verdict } : {}),
    }]),
)

export const trialVerdict: OraclePiece<TrialVerdictInputs, TrialVerdictOptions> = {
    name: 'trial verdict',
    answers: TRIAL_VERDICTS,
    cells: trialVerdictCells,
    parseOptions: parseVerdictOptions,
    render: renderTrialVerdict,
    renderParts: renderTrialVerdictParts,
    grade: gradeTrialVerdict,
    maxTokens: 400,
}

export const registeredVerdict = registerPiece(trialVerdict)
