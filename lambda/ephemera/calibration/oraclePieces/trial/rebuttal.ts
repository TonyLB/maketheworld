//
// The rebuttal (AGENT.nonRuleCell.planning.md, step 3, the trial proposal, stage 2; the triad is the user's, 2026-11-14): the trial
// family's second stage, `rebuttal`, a read piece, the second of three small biased calls. Given the non-rule cell's inputs, one argument that the plan can't happen and the question the
// argument answers, it rebuts the argument in one sentence (draft 5, the user's shape): "Incoming argues '<the argument's answer,
// briefly>', but" a source that something else is so (the scene says, the steps say, common sense indicates), or the only facts the scene
// and the steps establish about the thing in question. It has no way to concede: a judgment between the two follows in its own call.
// Each cell's argument has two sources (`stageInput.ts`): `golden`, in the case against's current contract (with its question), and
// `lifted`, a real output of the against stage, both on the trial's records (`trialCases.ts`). A payload names which. It sees the scene the argument was made in, with the securing omitted,
// since the rule cell judges the securing. There is no answer set: code checks each reply's form, and a reader reads the replies against
// each cell's `lookFor`.
//
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../../pieceProbe/oraclePiece'
import { parseProblems, replyJsonObject, type StageContract } from '../../../llm/stageContract'
import { parseUpstreamOptions, pickStageInput, type StageInput, type UpstreamOptions } from '../../pieceProbe/stageInput'
import { matchQuote, normalizeStep, quotables, renderNonRuleCell, type NonRuleCellInputs } from '../nonRuleCell'
import type { SceneRender } from '../../pieceProbe/sceneRenders'
import { parseRebuttal, type ParsedRebuttal } from './rebuttalSentence'
import { TRIAL_RULINGS, trialCases, type TrialArgument, type TrialRebuttalReply } from './trialCases'

export type { TrialArgument, TrialRebuttalReply } from './trialCases'
export { parseRebuttal, TRIAL_REBUTTAL_SOURCES, type ParsedRebuttal, type TrialRebuttalSource } from './rebuttalSentence'

export type TrialRebuttalInputs = NonRuleCellInputs & { against: StageInput<TrialArgument> }

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const QUESTION_LINE = 'The question the argument answers: '
const ARGUMENT_LINE = 'The argument against the plan, turning on the step '

const ROLES = '(?:intended|method|consequence)'

/**
 * A quote without the render's furniture: a list marker, a `Fiction:` or `Graph:` section prefix, or a role label as the prompt shows it
 * (`(consequence) …`, TR-P5) or respelled (`consequence : …`, TR-P11).
 */
const withoutLabel = (quote: string): string => quote.trim()
    .replace(/^(?:Fiction|Graph)\s*:\s*/i, '')
    .replace(/^- /, '')
    .replace(new RegExp(`^\\(${ROLES}\\) `, 'i'), '')
    .replace(new RegExp(`^"?${ROLES}"?\\s*:\\s*"?`, 'i'), '')
    .replace(/"$/, '')
    .trim()

/** A text as words only: the non-rule cell's normalizing, then any run of punctuation read as a space. */
const words = (text: string): string => normalizeStep(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Whether a quote falls inside a text, whole or on word boundaries, punctuation aside ("(a small round tea table)", "table, making"). */
const quotedIn = (quote: string, text: string): boolean => {
    const wanted = words(quote)
    return wanted !== '' && ` ${words(text)} `.includes(` ${wanted} `)
}

/**
 * The lines a reply can quote as evidence, from the render itself: the scene's Fiction sentences and Graph rows, and the steps with their
 * consequence lines, each without its list marker and role label. Not the headings, the request, the question or the argument.
 */
export const evidenceLines = (rendered: string): string[] => {
    const [scene = '', ...rest] = rendered.split('End of scene.')
    const steps = rest.join('End of scene.').split('\n\n').find((section) => section.startsWith('The steps, in order:')) ?? ''
    return [
        ...scene.split('\n').filter((line) => line.trim() !== '' && !/^(Scene:|Fiction:|Graph:|```|Contents of )/.test(line.trim())),
        ...steps.split('\n').slice(1),
    ].map((line) => line.trim().replace(/^- /, '').replace(/^\((?:intended|method|consequence)\) /, ''))
}

/** A Graph section's header, quoted along with its rows: furniture, not a fact. An elided header ("Contents of the Tavern:...") is not one. */
const isGraphHeader = (piece: string): boolean => /^Contents of [^.:]*:$/i.test(piece.trim())

/**
 * Whether a quote is a rendered line, with or without its furniture (`withoutLabel`). A quote spanning several Graph rows (one per line,
 * or run together on " - "), or several Fiction sentences, passes when each does, a section header aside (TR-P11). An elision is a misquote.
 */
export const quotesALine = (quote: string, lines: readonly string[]): boolean => {
    const matches = (piece: string) => lines.some((line) => quotedIn(withoutLabel(piece), line))
    if (matches(quote)) {
        return true
    }
    const pieces = withoutLabel(quote).split(/\n|\s+-\s+|(?<=\.)\s+/).map((piece) => piece.trim()).filter((piece) => piece !== '' && !isGraphHeader(piece))
    return pieces.length > 1 && pieces.every(matches)
}

/** Whether a fact names the handle, by words: "[table1]" in "on [table1]". */
const namesHandle = (fact: string, handle: string): boolean => ` ${words(fact)} `.includes(` ${words(handle)} `)

/** What the rebuttal stage reads: the non-rule cell's inputs and the argument it rebuts. */
export type TrialRebuttalInput = NonRuleCellInputs & { argument: TrialArgument }

/**
 * The stage's contract (draft 5): it gives the rebuttal's sentence and its parse (`TrialRebuttalReply`). The parse is the form: the
 * block parses, `rebuttal` is a string that parses (`parseRebuttal`), and the branch holds against what the call was shown. A scene or
 * steps source quotes a rendered line (`quotesALine`); the facts branch names a handle in the scene and lists facts that each quote a
 * rendered line naming it. A common-sense claim is read, not checked. Every problem is listed. Whether the facts are all of them is a
 * rubric measure, not a form problem.
 */
export const rebuttalContract: StageContract<TrialRebuttalInput, TrialRebuttalReply> = {
    name: 'trial rebuttal',
    parse: (reply, { rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { rebuttal } = parsed.object
        if (!isNonEmptyString(rebuttal)) {
            return { problems: ['has no non-empty string "rebuttal"'] }
        }
        const sentence = parseRebuttal(rebuttal)
        if ('malformed' in sentence) {
            return { problems: [sentence.malformed] }
        }
        const problems = branchProblems(sentence, rendered)
        return problems.length > 0 ? { problems } : { value: { rebuttal, parsed: sentence } }
    },
}

/** Whether the sentence's branch holds against the render: its quotes are rendered lines, and a facts list's facts name its handle. */
const branchProblems = (sentence: ParsedRebuttal, rendered: string): string[] => {
    const lines = evidenceLines(rendered)
    const misquote = (quote: string) => `${JSON.stringify(quote)} quotes no line of the scene or the steps`
    switch (sentence.source) {
        case 'the scene says':
        case 'the steps say':
            return sentence.quotes.flatMap(({ quote }) => (quotesALine(quote, lines) ? [] : [misquote(quote)]))
        case 'common sense indicates':
            return []
        case 'the only facts': {
            const scene = rendered.split('End of scene.')[0]
            return [
                ...(scene.includes(sentence.handle) ? [] : [`the facts are about ${sentence.handle}, which is not in the scene`]),
                ...sentence.facts.flatMap((fact) => [
                    ...(quotesALine(fact, lines) ? [] : [misquote(fact)]),
                    ...(namesHandle(fact, sentence.handle) ? [] : [`${JSON.stringify(fact)} doesn't name ${sentence.handle}`]),
                ]),
            ]
        }
    }
}

/**
 * The current contract: an argument with its question (draft 3) and the answer to it that blocks (AGENT.trialQuestion.planning.md,
 * step 2). A value without them was recorded under an older contract.
 */
export const fitsCurrentContract = ({ question, blocking }: TrialArgument): string | undefined => (
    !isNonEmptyString(question) ? 'it has no question'
        : blocking === undefined || !(TRIAL_RULINGS as readonly string[]).includes(blocking) ? 'it names no blocking answer'
            : undefined
)

/** The argument a cell's rebuttal answers, from the payload's source. Throws as the render does. */
export const rebuttedArgument = (cell: ReadPieceCell<TrialRebuttalInputs>, { upstream }: UpstreamOptions): TrialArgument => (
    pickStageInput(cell.inputs.against, upstream, fitsCurrentContract)
)

/** The probe's form check: the contract's parse problems, given the argument the payload's source names and the render. */
export const checkTrialRebuttal = (reply: string, cell: ReadPieceCell<TrialRebuttalInputs>, rendered: string, options: UpstreamOptions): string[] => (
    parseProblems(rebuttalContract.parse(reply, { input: { ...cell.inputs, argument: rebuttedArgument(cell, options) }, rendered }))
)

/**
 * The non-rule cell's render with the securing omitted, the question, and the argument naming its step, as three sections. Throws when
 * there is no argument, or its step quotes none of the plan's steps, so a cell can't carry a step the plan doesn't have. The rebuttal's
 * render joins them; the verdict's tags the argument as one side's voice. The scene takes the judge render unless `scene` names the
 * explicit one (the verdict's retest, AGENT.trialQuestion.planning.md, step 1.5).
 */
export const renderArguedParts = async (
    cell: { inputs: NonRuleCellInputs; source: string },
    against: TrialArgument,
    { scene = 'judge' }: { scene?: SceneRender } = {},
): Promise<{ scene: string; question: string; argument: string }> => {
    const { inputs: { steps } } = cell
    if (!isNonEmptyString(against.argument)) {
        throw new Error('No argument')
    }
    const quote = matchQuote(against.step, quotables(steps, false))
    if ('malformed' in quote) {
        throw new Error(`The argument's step: ${quote.malformed}`)
    }
    return {
        scene: await renderNonRuleCell(cell, { securing: 'omitted', scene }),
        question: `${QUESTION_LINE}${against.question}`,
        argument: `${ARGUMENT_LINE}"${against.step}": ${against.argument}`,
    }
}

/** The three sections of `renderArguedParts`, each in its own paragraph: the rebuttal's render. */
export const renderArgued = async (cell: { inputs: NonRuleCellInputs; source: string }, against: TrialArgument): Promise<string> => {
    const { scene, question, argument } = await renderArguedParts(cell, against)
    return [scene, question, argument].join('\n\n')
}

/**
 * The rebuttal's render (`renderArgued`), on the argument from the payload's `upstream` source. Throws when the cell has no value from
 * that source or it doesn't fit the current contract.
 */
export const renderTrialRebuttal = async (cell: ReadPieceCell<TrialRebuttalInputs>, options: UpstreamOptions): Promise<string> => (
    renderArgued(cell, rebuttedArgument(cell, options))
)

/**
 * The trial's cells, each with the argument from both sources and what a good rebuttal does, written before the batch (the rubric). The
 * source names both of the argument's; the note is the rebuttal's own, where it has one (the consequences-dependent hops).
 */
export const trialRebuttalCells: Record<string, ReadPieceCell<TrialRebuttalInputs>> = Object.fromEntries(
    Object.entries(trialCases).map(([id, { inputs, against, lookFor, notes }]) => [id, {
        inputs: { ...inputs, against },
        source: `golden: ${against.golden?.note}; lifted: ${against.lifted?.source}`,
        lookFor: lookFor.rebuttal,
        ...(notes?.rebuttal !== undefined ? { note: notes.rebuttal } : {}),
    }]),
)

export const trialRebuttal: ReadPiece<TrialRebuttalInputs, UpstreamOptions> = {
    kind: 'read',
    name: 'trial rebuttal',
    cells: trialRebuttalCells,
    check: checkTrialRebuttal,
    parseOptions: parseUpstreamOptions,
    render: renderTrialRebuttal,
    maxTokens: 600,
}

export const registeredRebuttal = registerPiece(trialRebuttal)
