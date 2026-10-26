/**
 * The finest tokenization of a command (`actions/AGENT.contract.md` "Qualifier"): the command is cut
 * at every fixed word a template reads, and grouping is left to the matcher (`patternTemplate.ts`),
 * which re-joins runs of tokens as it needs.
 *
 * The fixed-word options are first cut into granules: two adjacent words of an option stay joined
 * only if they are adjacent in every option where either appears. So each fixed word belongs to
 * exactly one granule, and a boundary exists wherever some option begins or ends. A command is then
 * scanned into granule tokens, runs of span material between them, and punctuation marks.
 */

/**
 * A word is a run of letters and digits, holding an apostrophe or hyphen only between two of them
 * (`don't`, `jack-in-the-box`); any other character that is not whitespace is a punctuation mark of
 * its own, spaced or not.
 */
const LEXEME = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu
const WORD_START = /^[\p{L}\p{N}]/u

type Lexeme = { kind: 'word'; text: string } | { kind: 'punctuation'; text: string }

function lexemesOf(text: string): Lexeme[] {
    return (text.match(LEXEME) ?? []).map((lexeme): Lexeme => ({ kind: WORD_START.test(lexeme) ? 'word' : 'punctuation', text: lexeme }))
}

/** The granules of a set of options, each its lower-cased words, and each keyed by its first word. */
export type Granules = {
    granules: readonly (readonly string[])[]
    byFirstWord: ReadonlyMap<string, readonly string[]>
}

/**
 * One token of a command, its text as typed. A granule token names the granule it matched; a span
 * token is a maximal run of words outside every granule token; each punctuation mark is a token.
 */
export type GranuleToken =
    | { kind: 'granule'; words: string[]; granule: readonly string[] }
    | { kind: 'span'; words: string[] }
    | { kind: 'punctuation'; text: string }

const START = Symbol('start')
const END = Symbol('end')

/** A fixed-word option's words, lower-cased; throws on an option `granulesOf` rejects. */
export function optionWords(option: string): string[] {
    const lexemes = lexemesOf(option)
    const mark = lexemes.find(({ kind }) => kind === 'punctuation')
    if (mark) {
        throw new Error(`Fixed-word option "${option}" holds the punctuation mark "${mark.text}"; a punctuation mark is never part of a granule`)
    }
    if (lexemes.length === 0) {
        throw new Error('A fixed-word option must hold at least one word')
    }
    const words = lexemes.map(({ text }) => text.toLowerCase())
    const repeated = words.find((word, index) => words.indexOf(word) !== index)
    if (repeated) {
        throw new Error(`Fixed-word option "${option}" repeats the word "${repeated}"; a repeated word has no granule rule yet`)
    }
    return words
}

/**
 * The granules of a set of fixed-word options, matched case-insensitively. A pair of adjacent words
 * is joined when every occurrence of the first is followed by the second and every occurrence of the
 * second is preceded by the first; granules are the joined chains. One pass over adjacent pairs:
 * `on top of` with `of both` gives `on top` | `of` | `both`. Throws on an option that repeats a word
 * or holds a punctuation mark.
 */
export function granulesOf(options: readonly string[]): Granules {
    const wordLists = options.map(optionWords)
    const neighbours = (pairs: [string, string | symbol][]) => pairs.reduce<Map<string, Set<string | symbol>>>(
        (map, [word, neighbour]) => map.set(word, new Set([...(map.get(word) ?? []), neighbour])),
        new Map()
    )
    const following = neighbours(wordLists.flatMap((words) => words.map((word, index): [string, string | symbol] => [word, words[index + 1] ?? END])))
    const preceding = neighbours(wordLists.flatMap((words) => words.map((word, index): [string, string | symbol] => [word, index === 0 ? START : words[index - 1]])))
    const joined = (left: string, right: string) => (
        following.get(left)?.size === 1 && following.get(left)?.has(right) && preceding.get(right)?.size === 1 && preceding.get(right)?.has(left)
    )
    const byFirstWord = new Map(wordLists.flatMap((words) => (
        words.reduce<string[][]>((chains, word, index) => (
            index > 0 && joined(words[index - 1], word)
                ? [...chains.slice(0, -1), [...chains[chains.length - 1], word]]
                : [...chains, [word]]
        ), [])
    )).map((granule): [string, readonly string[]] => [granule[0], granule]))
    return { granules: [...byFirstWord.values()], byFirstWord }
}

/**
 * The tokens of a command, left to right: a granule token wherever a granule's whole word sequence
 * appears (case-insensitively), each punctuation mark on its own, and every other run of words one
 * span token. A word of a granule appearing without the rest of it is span material (`top` in
 * `spinning top`), and a granule never matches inside a longer word (`on` in `onto`). Greedy
 * matching is unambiguous: each fixed word is in one granule and no granule repeats a word, so two
 * granule matches can never overlap.
 */
export function tokenize({ byFirstWord }: Granules, command: string): GranuleToken[] {
    const lexemes = lexemesOf(command)
    const tokensFrom = (index: number): GranuleToken[] => {
        if (index >= lexemes.length) {
            return []
        }
        const lexeme = lexemes[index]
        if (lexeme.kind === 'punctuation') {
            return [lexeme, ...tokensFrom(index + 1)]
        }
        const granule = byFirstWord.get(lexeme.text.toLowerCase())
        const candidate = granule ? lexemes.slice(index, index + granule.length) : []
        if (granule && candidate.length === granule.length && candidate.every(({ kind, text }, offset) => kind === 'word' && text.toLowerCase() === granule[offset])) {
            return [{ kind: 'granule', words: candidate.map(({ text }) => text), granule }, ...tokensFrom(index + granule.length)]
        }
        return [{ kind: 'span', words: [lexeme.text] }, ...tokensFrom(index + 1)]
    }
    return tokensFrom(0).reduce<GranuleToken[]>((tokens, token) => {
        const last = tokens[tokens.length - 1]
        return token.kind === 'span' && last?.kind === 'span'
            ? [...tokens.slice(0, -1), { kind: 'span', words: [...last.words, ...token.words] }]
            : [...tokens, token]
    }, [])
}
