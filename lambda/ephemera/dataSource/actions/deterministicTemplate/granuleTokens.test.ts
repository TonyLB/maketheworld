import type { AttemptTemplate } from './deterministicTemplate'
import { type GranuleToken, type Granules, granulesOf, tokenize } from './granuleTokens'
import { fixedWordsOf } from './patternTemplate'
import { containmentTemplate } from '../enrich/objectManipulation/plan/matchContainmentTemplate'
import { lookAtTemplate, lookTemplate } from '../enrich/objectManipulation/plan/matchLookTemplate'
import { membershipTemplate } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { spreadTemplate } from '../enrich/objectManipulation/plan/matchSpreadTemplate'

/** The tokens as text: `|` between tokens, each token's words as typed. */
const render = (tokens: GranuleToken[]): string => tokens.map((token) => (token.kind === 'punctuation' ? token.text : token.words.join(' '))).join(' | ')

const granuleText = ({ granules }: Granules): string[] => granules.map((granule) => granule.join(' ')).sort()

const liveTemplates: readonly AttemptTemplate[] = [containmentTemplate, spreadTemplate, lookTemplate, lookAtTemplate, membershipTemplate]
const liveOptions = [...new Set(liveTemplates.flatMap(({ pattern }) => fixedWordsOf(pattern)))]

describe('granulesOf', () => {
    it('keeps two words joined only where they are adjacent in every option holding either', () => {
        expect(granuleText(granulesOf(['on top of', 'of both']))).toEqual(['both', 'of', 'on top'])
        expect(granuleText(granulesOf(['on top of', 'of both', 'on']))).toEqual(['both', 'of', 'on', 'top'])
        expect(granuleText(granulesOf(['a b c', 'b c d']))).toEqual(['a', 'b c', 'd'])
    })

    it('collapses duplicate options and case variants', () => {
        expect(granuleText(granulesOf(['On Top', 'on top', 'on top']))).toEqual(['on top'])
    })

    it('has no granules for no options', () => {
        expect(granulesOf([]).granules).toEqual([])
    })

    it('rejects an option that repeats a word', () => {
        expect(() => granulesOf(['a b a'])).toThrow('repeats the word "a"')
        expect(() => granulesOf(['A b a'])).toThrow('repeats the word "a"')
    })

    it('rejects an option holding a punctuation mark', () => {
        expect(() => granulesOf(['on,'])).toThrow('punctuation mark ","')
    })

    it('rejects an option with no words', () => {
        expect(() => granulesOf(['  '])).toThrow('at least one word')
    })

    it('cuts the live templates\' fixed words into single words', () => {
        const granules = granulesOf(liveOptions)
        expect(granules.granules.every((granule) => granule.length === 1)).toBe(true)
        expect(granuleText(granules)).toEqual(expect.arrayContaining(['on', 'top', 'of', 'out']))
    })
})

describe('tokenize', () => {
    const cases: { name: string; options: readonly string[]; command: string; expected: string }[] = [
        { name: 'a span, a granule and the words it split from', options: ['on top of', 'of both'], command: 'get the book on top of both', expected: 'get the book | on top | of | both' },
        { name: 'a granule split by an option alone', options: ['on top of', 'of both', 'on'], command: 'get the book on top of both', expected: 'get the book | on | top | of | both' },
        { name: 'overlapping options', options: ['a b c', 'b c d'], command: 'x a b c d y', expected: 'x | a | b c | d | y' },
        { name: 'a granule word without the rest of its granule', options: ['on top of', 'of both'], command: 'spin the spinning top', expected: 'spin the spinning top' },
        { name: 'case and spacing', options: ['get'], command: '  GET  the CUP  ', expected: 'GET | the CUP' },
        { name: 'a granule never inside a longer word', options: ['on'], command: 'onto the box', expected: 'onto the box' },
        { name: 'no options', options: [], command: 'take the cup', expected: 'take the cup' },
        { name: 'an empty command', options: ['on'], command: '   ', expected: '' },
        { name: 'a comma between orders', options: ['order'], command: 'order anvil, rocket', expected: 'order | anvil | , | rocket' },
        { name: 'a comma before another clause', options: ['take', 'look'], command: 'take cup, then look', expected: 'take | cup | , | then | look' },
        { name: 'a comma with no spaces', options: ['order'], command: 'order anvil,rocket', expected: 'order | anvil | , | rocket' },
        { name: 'a punctuation mark breaking a granule', options: ['on top'], command: 'put cup on, top', expected: 'put cup on | , | top' },
        { name: 'apostrophes and hyphens inside words', options: ['in'], command: "don't put the jack-in-the-box in it", expected: "don't put the jack-in-the-box | in | it" },
        { name: 'a trailing full stop', options: ['take'], command: 'take cup.', expected: 'take | cup | .' },
        { name: 'span material stays one token', options: liveOptions, command: 'take super laser death ray gun', expected: 'take | super laser death ray gun' },
        { name: 'the payoff command', options: liveOptions, command: 'put pig in a blanket on the plate on the table', expected: 'put | pig | in | a blanket | on | the plate | on | the table' },
    ]

    it.each(cases.map((testCase) => [testCase.name, testCase] as const))('%s', (_name, { options, command, expected }) => {
        expect(render(tokenize(granulesOf(options), command))).toEqual(expected)
    })

    it('keeps the matched granule canonical and the typed words as typed', () => {
        expect(tokenize(granulesOf(['on top']), 'put it ON Top')).toEqual([
            { kind: 'span', words: ['put', 'it'] },
            { kind: 'granule', words: ['ON', 'Top'], granule: ['on', 'top'] },
        ])
    })

    describe('properties', () => {
        const lexemes = (tokens: GranuleToken[]): string[] => tokens.flatMap((token) => (token.kind === 'punctuation' ? [token.text] : token.words))

        it.each(cases.map((testCase) => [testCase.name, testCase] as const))('%s: each fixed word in one granule; tokens re-join to the command', (_name, { options, command }) => {
            const granules = granulesOf(options)
            const words = granules.granules.flat()
            expect(new Set(words).size).toEqual(words.length)
            expect(new Set(words)).toEqual(new Set(options.flatMap((option) => option.toLowerCase().split(/\s+/).filter(Boolean))))
            const tokens = tokenize(granules, command)
            expect(lexemes(tokens).join('')).toEqual(command.replace(/\s+/g, ''))
            expect(tokenize(granules, lexemes(tokens).join(' '))).toEqual(tokens)
        })
    })
})
