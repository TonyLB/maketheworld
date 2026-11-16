//
// The rebuttal's sentence (draft 5, the user's shape), parsed apart from any render: the summary, when given, and what follows the
// pivot, by branch. Kept apart from the rebuttal stage so the trial's records can parse a lifted rebuttal at load (`trialCases.ts`).
// Whether a quote is a line the prompt showed is the stage's check (`rebuttal.ts`), which needs the render.
//
export const TRIAL_REBUTTAL_SOURCES = ['the scene says', 'the steps say', 'common sense indicates', 'the only facts'] as const
export type TrialRebuttalSource = typeof TRIAL_REBUTTAL_SOURCES[number]

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
