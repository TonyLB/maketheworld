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
import { replyJsonObject } from '../../pieceProbe/pieceAnswer'
import { parseUpstreamOptions, pickStageInput, type StageInput, type UpstreamOptions } from '../../pieceProbe/stageInput'
import { matchQuote, normalizeStep, quotables, renderNonRuleCell, type NonRuleCellInputs } from '../nonRuleCell'
import { trialCases, type TrialArgument } from './trialCases'

export type { TrialArgument } from './trialCases'

export type TrialRebuttalInputs = NonRuleCellInputs & { against: StageInput<TrialArgument> }

export const TRIAL_REBUTTAL_SOURCES = ['the scene says', 'the steps say', 'common sense indicates', 'the only facts'] as const
export type TrialRebuttalSource = typeof TRIAL_REBUTTAL_SOURCES[number]

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

/**
 * The sentence, parsed (draft 5, the user's shape): the summary, when given, and what follows the pivot, by branch. The summary is
 * optional (TR-P12): the render ends on the argument, so a reply opening at the pivot, "But the scene says …", answers it in place.
 */
export type ParsedRebuttal = { summary?: string } & (
    | { source: 'the scene says' | 'the steps say'; quotes: { source: 'the scene says' | 'the steps say'; quote: string }[] }
    | { source: 'common sense indicates'; claim: string }
    | { source: 'the only facts'; handle: string; facts: string[]; claim?: string }
)

const QUOTE_CHARS = /[‘’“”]/g
const straightQuotes = (text: string): string => text.replace(QUOTE_CHARS, (char) => ('‘’'.includes(char) ? "'" : '"'))

/** The text inside one pair of quotes around the whole, the end punctuation outside them aside. Undefined when it isn't quoted. */
const unquoted = (text: string): string | undefined => {
    const match = /^(['"])([\s\S]*)\1[\s.,;:!]*$/.exec(text.trim())
    return match && match[2].trim() !== '' ? match[2].trim() : undefined
}

/**
 * One or more joined sources from the start of the text: `the scene says '<line>'`, `the steps say '<step>'`, each after the first
 * joined by "and" or a comma (OC-6, batch 7: "the scene says '…', and the steps say '…'"). A quote closes at its quote character before
 * a space, punctuation or the end, so an apostrophe inside ("the table's") stays inside. Whatever follows ("which implies …") is the
 * claim, read, not checked. Undefined when the text opens with no source, a source's quote is missing, or nothing is quoted.
 */
const saidSources = (text: string): { source: 'the scene says' | 'the steps say'; quote: string }[] | undefined => {
    const quotes: { source: 'the scene says' | 'the steps say'; quote: string }[] = []
    let rest = text
    for (;;) {
        const match = /^the (scene says|steps? says?)\s+(?:that\s+)?(['"])([\s\S]*?)\2(?=[\s.,;:!]|$)/i.exec(rest)
        if (!match) {
            return quotes.length > 0 && !/^the (scene says|steps? says?)\b/i.test(rest) ? quotes : undefined
        }
        if (match[3].trim() === '') {
            return undefined
        }
        quotes.push({ source: /^scene/i.test(match[1]) ? 'the scene says' : 'the steps say', quote: match[3].trim() })
        const joined = /^[\s.,;:!]*(?:,\s*)?(?:and\s+)?(?=the (?:scene says|steps? says?)\b)/i.exec(rest.slice(match[0].length))
        if (!joined) {
            return quotes
        }
        rest = rest.slice(match[0].length + joined[0].length)
    }
}

/**
 * A facts list: quoted items from the start of the text, joined by a comma, a semicolon or "and", each closing as `saidSources`' quotes
 * close. Whatever follows the last item ("…, which do not indicate any size constraints") is the claim, read, not checked (TR-P13).
 * Undefined when the text opens with no quoted item.
 */
const quotedList = (text: string): { facts: string[]; claim?: string } | undefined => {
    const facts: string[] = []
    let rest = text
    for (;;) {
        const match = /^(['"])([\s\S]*?)\1(?=[\s.,;:!]|$)/.exec(rest)
        if (!match || match[2].trim() === '') {
            break
        }
        facts.push(match[2].trim())
        rest = rest.slice(match[0].length)
        const joined = /^\s*(?:[,;]\s*)?(?:and\s+)?(?=['"])/i.exec(rest)
        if (!joined) {
            break
        }
        rest = rest.slice(joined[0].length)
    }
    const claim = rest.replace(/^[\s.,;:!]+/, '').trim()
    return facts.length === 0 ? undefined : { facts, ...(claim !== '' ? { claim } : {}) }
}

/**
 * Parses `[Incoming argues '<summary>',] but <rest>`, the quote characters read leniently (single or double, straight or curly). The rest
 * is one of: one or more of `the scene says '<line>'` and `the steps say '<step>'`, `common sense indicates that '<claim>' is actually
 * true`, or `the only facts the scene and the steps establish about <[handle]> are: '<line>', '<line>', …`, either of the quoting
 * branches perhaps followed by a claim. A malformed reason otherwise.
 */
export const parseRebuttal = (sentence: string): ParsedRebuttal | { malformed: string } => {
    const text = straightQuotes(sentence).trim()
    const opening = /^(?:incoming argues\s+(?:that\s+)?(['"])([\s\S]*?)\1\s*,?\s*)?but\s+([\s\S]*)$/i.exec(text)
    if (!opening || (opening[1] !== undefined && opening[2].trim() === '')) {
        return { malformed: '"rebuttal" doesn\'t open "But" or "Incoming argues \'…\', but"' }
    }
    const summary = opening[2]?.trim()
    const withSummary = <T extends object>(branch: T) => (summary === undefined ? branch : { summary, ...branch })
    const rest = opening[3].trim()
    if (/^the (scene says|steps? says?)\b/i.test(rest)) {
        const quotes = saidSources(rest)
        return quotes === undefined ? { malformed: `"${/^the scene/i.test(rest) ? 'the scene says' : 'the steps say'}" is not followed by a quoted line` } : withSummary({ source: quotes[0].source, quotes })
    }
    const sense = /^common sense indicates\s+(?:that\s+)?([\s\S]*?)(?:\s+is actually true)?[\s.]*$/i.exec(rest)
    if (sense) {
        const claim = unquoted(sense[1]) ?? sense[1].trim()
        return claim === '' ? { malformed: '"common sense indicates" has no claim' } : withSummary({ source: 'common sense indicates' as const, claim })
    }
    const facts = /^the only facts\b[\s\S]*?\babout\s+(\[[^\]]+\])[^:]*?\bare\b\s*:?\s*([\s\S]*)$/i.exec(rest)
    if (facts) {
        const list = quotedList(facts[2].trim())
        return list === undefined
            ? { malformed: '"the only facts" has no quoted list' }
            : withSummary({ source: 'the only facts' as const, handle: facts[1], ...list })
    }
    return { malformed: `"rebuttal" continues with none of ${TRIAL_REBUTTAL_SOURCES.map((source) => `"${source}"`).join(', ')}` }
}

/** Whether a fact names the handle, by words: "[table1]" in "on [table1]". */
const namesHandle = (fact: string, handle: string): boolean => ` ${words(fact)} `.includes(` ${words(handle)} `)

/**
 * The form (draft 5): the block parses, `rebuttal` is a string that parses (`parseRebuttal`), and the branch holds. A scene or steps
 * source quotes a rendered line (`quotesALine`); the facts branch names a handle in the scene and lists facts that each quote a rendered
 * line naming it. A common-sense claim is read, not checked. Every problem is listed. Whether the facts are all of them is a rubric
 * measure, not a form problem.
 */
export const checkTrialRebuttal = (reply: string, _cell: ReadPieceCell<TrialRebuttalInputs>, rendered: string): string[] => {
    const parsed = replyJsonObject(reply)
    if ('malformed' in parsed) {
        return [parsed.malformed]
    }
    const { rebuttal } = parsed.object
    if (!isNonEmptyString(rebuttal)) {
        return ['has no non-empty string "rebuttal"']
    }
    const sentence = parseRebuttal(rebuttal)
    if ('malformed' in sentence) {
        return [sentence.malformed]
    }
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

/** The current contract: an argument with its question (draft 3). A value without one was recorded under the older contract. */
const fitsCurrentContract = ({ question }: TrialArgument): string | undefined => (isNonEmptyString(question) ? undefined : 'it has no question')

/**
 * The non-rule cell's render with the securing omitted, then the question and the argument, each in its own section, the argument naming
 * its step. The argument is the payload's `upstream` source. Throws when the cell has no value from that source or it doesn't fit the
 * current contract, and when the argument's step quotes none of the plan's steps, so a cell can't carry a step the plan doesn't have.
 */
export const renderTrialRebuttal = async (cell: ReadPieceCell<TrialRebuttalInputs>, { upstream }: UpstreamOptions): Promise<string> => {
    const { inputs: { steps } } = cell
    const against = pickStageInput(cell.inputs.against, upstream, fitsCurrentContract)
    if (!isNonEmptyString(against.argument)) {
        throw new Error('No argument')
    }
    const quote = matchQuote(against.step, quotables(steps, false))
    if ('malformed' in quote) {
        throw new Error(`The argument's step: ${quote.malformed}`)
    }
    return [
        await renderNonRuleCell(cell, { securing: 'omitted' }),
        `${QUESTION_LINE}${against.question}`,
        `${ARGUMENT_LINE}"${against.step}": ${against.argument}`,
    ].join('\n\n')
}

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
