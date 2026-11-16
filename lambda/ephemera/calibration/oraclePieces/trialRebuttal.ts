//
// The rebuttal (AGENT.nonRuleCell.planning.md, step 3, the trial proposal, stage 2; the triad is the user's, 2026-11-14): a read piece,
// the second of three small biased calls. Given the non-rule cell's inputs, one argument that the plan can't happen and the question the
// argument answers, it rebuts the argument in one sentence (draft 5, the user's shape): "Incoming argues '<the argument's answer,
// briefly>', but" a source that something else is so (the scene says, the steps say, common sense indicates), or the only facts the scene
// and the steps establish about the thing in question. It has no way to concede: a judgment between the two follows in its own call.
// Each cell's argument has two sources (`stageInput.ts`): `golden`, in the case against's current contract (with its question), and
// `lifted`, a real `trialAgainst` output. A payload names which. It sees the scene the argument was made in, with the securing omitted,
// since the rule cell judges the securing. There is no answer set: code checks each reply's form, and a reader reads the replies against
// each cell's `lookFor`.
//
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { replyJsonObject } from '../pieceProbe/pieceAnswer'
import { parseUpstreamOptions, pickStageInput, type StageInput, type UpstreamOptions } from '../pieceProbe/stageInput'
import { matchQuote, nonRuleCellCells, normalizeStep, quotables, renderNonRuleCell, type NonRuleCellInputs } from './nonRuleCell'

/**
 * An argument against the plan: the step it turns on, quoted, the argument, and the question it answers. The question is the case
 * against's current contract (draft 3's test); `trialAgainst` doesn't give it yet, so a lifted argument has none and doesn't fit.
 */
export type TrialArgument = { step: string; argument: string; question?: string }

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
    | { source: 'the only facts'; handle: string; facts: string[] }
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
 * Parses `[Incoming argues '<summary>',] but <rest>`, the quote characters read leniently (single or double, straight or curly). The rest
 * is one of: one or more of `the scene says '<line>'` and `the steps say '<step>'`, `common sense indicates that '<claim>' is actually
 * true`, or `the only facts the scene and the steps establish about <[handle]> are: '<line>', '<line>', …`. A malformed reason otherwise.
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
        const list = unquoted(facts[2])
        return list === undefined
            ? { malformed: '"the only facts" has no quoted list' }
            : withSummary({ source: 'the only facts' as const, handle: facts[1], facts: list.split(/['"]\s*[,;]\s*(?:and\s+)?['"]|['"]\s+and\s+['"]/).map((fact) => fact.trim()) })
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

const AGAINST_OMITTED = 'trialAgainst batch 2 (draft 1, the securing omitted), repeat 1'
const ADOPTED = 'an interim golden (the user, 2026-11-15): the lifted argument adopted verbatim, with a hand-written question'

/**
 * A non-rule cell's inputs with the argument from both sources, and what a good rebuttal does, written before the batch (the rubric).
 * The golden is the lifted argument adopted verbatim with its question, so draft 3's test changes only the question against batch 4.
 * The lifted value has no question, the older contract, so a `lifted` payload refuses it.
 */
const cell = (
    id: keyof typeof nonRuleCellCells, step: string, argument: string, question: string, lookFor: string, source = AGAINST_OMITTED,
): ReadPieceCell<TrialRebuttalInputs> => ({
    inputs: {
        ...nonRuleCellCells[id].inputs,
        against: { golden: { value: { step, argument, question }, note: ADOPTED }, lifted: { value: { step, argument }, source: `${source}, cell ${id}` } },
    },
    source: `golden: ${ADOPTED}; lifted: ${source}, cell ${id}`,
    lookFor,
})

const TABLE_IN_CUP = 'put [table1] in [cup1]'
const TOO_LARGE = 'The table is too large to fit inside the cup.'
const TOO_LARGE_Q = 'Is [table1] too large to fit inside [cup1]?'
const TOO_HEAVY = 'The table is too large and heavy to be picked up by a single person.'
const TOO_HEAVY_Q = 'Is [table1] too large and heavy to be picked up by a single person?'
const AT_THE_POUR = 'By the time of "[teapot1] pours [tea2] into [cup1]",'
const CUP_REACHABLE_Q = `${AT_THE_POUR} is [cup1] still where [teapot1] can pour into it?`
const SOUND = 'the argument is sound: nothing true refutes it, so read what the rebuttal claims (over-refuting)'

export const trialRebuttalCells: Record<string, ReadPieceCell<TrialRebuttalInputs>> = {
    'OC-11': cell('OC-11', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q, `${SOUND}; an invented smallness or a "not established" size`),
    'OC-18': cell('OC-18', 'hammer [table1] into [cup1]', 'The table is too large and structurally unsuited to fit into the cup.', 'Is [table1] too large and structurally unsuited to fit into [cup1]?', `${SOUND}; hammering offered as changing the size`),
    'OC-3': cell('OC-3', TABLE_IN_CUP, TOO_LARGE, TOO_LARGE_Q, `${SOUND}; an invented smallness or a "not established" size`),
    'OC-1': cell('OC-1', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q, '"wrong": the scene says [table1] is a small round tea table, so the premise is false (premise, not weight)'),
    'OC-2': cell('OC-2', 'pick up [cup1]', 'The cup is on a saucer, which is on the table, and the player is not holding anything to lift the cup directly.', 'Does holding nothing keep the player from lifting [cup1] directly?', '"wrong": empty hands are what picking up needs, and a cup on a saucer is within reach'),
    'OC-20': cell('OC-20', 'pick up [table1]', TOO_HEAVY, TOO_HEAVY_Q, '"wrong": the scene says [table1] is a small round tea table'),
    'OC-6': cell('OC-6', 'pour [tea2] from [teapot1] into [cup1]', 'The tea in the teapot cannot be directly poured into the cup without first being transferred to a container that can be poured, such as a cup.', 'Must [tea2] be transferred to another container before it can be poured into [cup1]?', '"wrong": a teapot is the container tea is poured from'),
    'OC-9': cell('OC-9', 'pick up [table1]', 'A table is too large and heavy to be picked up by a single person, especially considering the physical constraints of the scene.', TOO_HEAVY_Q, 'open (JF-2): a long oak trestle is heavy for one person; read the kind, and whether "not established" (strength, how heavy) is given', 'trialAgainst batch 1 (draft 1), repeat 1'),
    'OC-30/h5': {
        ...cell('OC-30/h5', 'tip [table1]', 'Tipping the table would cause the teapot to fall off and spill its contents.', `${AT_THE_POUR} is [teapot1] still where it can pour into [cup1]?`, `consequences-dependent (TR-P3): ${SOUND} in the scene shown, where [teapot1] is loose`),
        note: 'Read apart from the tallies: the argument is sound only because the scene omits the glue that tilts the teapot with the table.',
    },
    'OC-30/h7': cell('OC-30/h7', 'tip [table1]', 'The first step would cause the cup to fall off the table, making it impossible to pour tea into it.', CUP_REACHABLE_Q, `${SOUND}: the consequence line puts [cup1] on the floor`),
    'OC-30/h10': {
        ...cell('OC-30/h10', 'tip [table1]', 'Tipping the table would cause the saucer, cup, and tea to fall off, making it impossible to pour tea from the teapot into the cup.', CUP_REACHABLE_Q, 'consequences-dependent (TR-P3, NR-P5): "wrong": step 1 has taken [saucer1], with [cup1] on it, off the table; the loose teapot is not raised'),
        note: 'Read apart from the tallies: the argument errs on state, and the sound one (the loose teapot) exists only because the scene omits the glue.',
    },
}

export const trialRebuttal: ReadPiece<TrialRebuttalInputs, UpstreamOptions> = {
    kind: 'read',
    name: 'trialRebuttal',
    cells: trialRebuttalCells,
    check: checkTrialRebuttal,
    parseOptions: parseUpstreamOptions,
    render: renderTrialRebuttal,
    maxTokens: 600,
}

export const registeredTrialRebuttal = registerPiece(trialRebuttal)
