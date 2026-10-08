import type { ParseSkeleton } from '../parse/parseToken'
import { matchContainmentPreposition, matchContainmentTemplate } from './matchContainmentTemplate'
import type { ContainmentTemplateMatchResult } from './matchContainmentTemplate'
import type { Change } from './planStep'

/** The attempt's step, so the expectations below read the plan's shape, not the attempt's. */
const summarize = (result: ContainmentTemplateMatchResult) => {
    if (result.type !== 'matched') {
        return result
    }
    return { type: 'matched' as const, change: result.attempt.actions()[0].desiredResult as Change }
}

const containmentSkeleton = (verb: string, subjectSpan: string, prep: string, targetSpan: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: `${subjectSpan}Ref` },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: `${targetSpan}Ref` },
]

describe('matchContainmentTemplate', () => {
    it('plans "put coin in jar" as the containment transfer, kind In', () => {
        expect(summarize(matchContainmentTemplate(containmentSkeleton('put', 'coin', 'in', 'jar'), 'test command'))).toEqual({
            type: 'matched',
            change: {
                kind: 'change',
                primitive: 'transferMembership',
                object: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
                from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' } },
                to: { referentType: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
                containment: 'In',
            },
        })
    })

    it('plans "put broom on table" as the containment transfer, kind On (AB-54: On is a hosting kind)', () => {
        expect(summarize(matchContainmentTemplate(containmentSkeleton('put', 'broom', 'on', 'table'), 'test command'))).toEqual({
            type: 'matched',
            change: {
                kind: 'change',
                primitive: 'transferMembership',
                object: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' } },
                to: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
                containment: 'On',
            },
        })
    })

    it.each([
        ['place', 'on top of'],
        ['place', 'onto'],
        ['put', 'inside'],
        ['put', 'into'],
    ] as const)('plans "%s X %s Y" as containment (RD-1 verbs, closed prepositions)', (verb, prep) => {
        const result = summarize(matchContainmentTemplate(containmentSkeleton(verb, 'coin', prep, 'jar'), 'test command'))
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive !== 'transferMembership') return
        expect(result.change.containment).toBe(matchContainmentPreposition(prep))
    })

    it.each([
        ['take', 'in'],
        ['tie', 'in'],
        ['lean', 'on'],
        ['remove', 'in'],
    ] as const)('returns noMatch for verb "%s" outside RD-1 ("%s")', (verb, prep) => {
        expect(summarize(matchContainmentTemplate(containmentSkeleton(verb, 'coin', prep, 'jar'), 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a peer preposition ("put broom under table"): that is the relational template', () => {
        expect(summarize(matchContainmentTemplate(containmentSkeleton('put', 'broom', 'under', 'table'), 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 2-token skeleton', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(summarize(matchContainmentTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 6-token skeleton (modifier-bearing shape, out of scope)', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'candle', stableRefKey: 'candleRef' },
            { type: 'text', text: 'from' },
            { type: 'objectSpan', span: 'bookshelf', stableRefKey: 'bookshelfRef' },
            { type: 'text', text: 'into' },
            { type: 'objectSpan', span: 'bag', stableRefKey: 'bagRef' },
        ]

        expect(summarize(matchContainmentTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })
})

describe('matchContainmentTemplate narration (AN-3: the template authors its unit)', () => {
    const unitOf = (verb: string, prep: string) => {
        const result = matchContainmentTemplate(containmentSkeleton(verb, 'coin', prep, 'jar'), 'test command')
        if (result.type !== 'matched') {
            throw new Error('expected a match')
        }
        return { attempt: result.attempt, units: result.attempt.narrationUnits() }
    }

    it('authors one unit covering its action: the player\'s verb and the matched phrase, one audience over the actor and both objects, before', () => {
        const { attempt, units } = unitOf('put', 'into')
        expect(units).toEqual([{
            covers: [attempt.actions()[0].id],
            variants: [{
                audience: { refs: ['actor', 'coinRef', 'jarRef'], phase: 'before' },
                parts: [{ slot: 'actor' }, { text: ' puts ' }, { ref: 'coinRef' }, { text: ' into ' }, { ref: 'jarRef' }],
            }],
        }])
    })

    it('conjugates place, and keeps a multi-word phrase', () => {
        const [{ variants: [{ parts }] }] = unitOf('place', 'on top of').units
        expect(parts).toEqual([{ slot: 'actor' }, { text: ' places ' }, { ref: 'coinRef' }, { text: ' on top of ' }, { ref: 'jarRef' }])
    })

    it('narrates only the matched phrase, never the raw text run: a stray word does not reach the line', () => {
        const [{ variants: [{ parts }] }] = unitOf('put', 'hurriedly into').units
        expect(parts).toContainEqual({ text: ' into ' })
        expect(JSON.stringify(parts)).not.toContain('hurriedly')
    })
})

describe('matchContainmentPreposition', () => {
    it.each(['in', 'inside', 'into'] as const)('names %s as kind In', (prep) => {
        expect(matchContainmentPreposition(prep)).toBe('In')
    })

    it.each(['on', 'onto', 'ON', 'on top of'] as const)('names %s as kind On', (prep) => {
        expect(matchContainmentPreposition(prep)).toBe('On')
    })

    it.each(['under', 'against', 'tied to', 'around'] as const)('returns undefined for peer preposition %s', (prep) => {
        expect(matchContainmentPreposition(prep)).toBeUndefined()
    })
})
