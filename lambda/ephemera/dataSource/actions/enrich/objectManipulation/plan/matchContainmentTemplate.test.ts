import type { ParseSkeleton } from '../parse/parseToken'
import { matchTemplate, type TemplateMatchResult } from './attemptTemplateFixture'
import { containmentTemplate } from './matchContainmentTemplate'
import type { Change } from './planStep'

const matchContainmentTemplate = matchTemplate(containmentTemplate)

/** The attempt's step, so the expectations below read the plan's shape, not the attempt's. */
const summarize = (result: TemplateMatchResult) => {
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
        ['place', 'on top of', 'On'],
        ['place', 'onto', 'On'],
        ['put', 'inside', 'In'],
        ['put', 'into', 'In'],
        ['put', 'ON', 'On'],
    ] as const)('plans "%s X %s Y" as containment (RD-1 verbs, closed prepositions), kind %s', (verb, prep, containment) => {
        const result = summarize(matchContainmentTemplate(containmentSkeleton(verb, 'coin', prep, 'jar'), 'test command'))
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive !== 'transferMembership') return
        expect(result.change.containment).toBe(containment)
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

    it('matches a qualified object: the candle from the bookshelf, moved into the bag', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'candle', stableRefKey: 'candleRef' },
            { type: 'text', text: 'from' },
            { type: 'objectSpan', span: 'bookshelf', stableRefKey: 'bookshelfRef' },
            { type: 'text', text: 'into' },
            { type: 'objectSpan', span: 'bag', stableRefKey: 'bagRef' },
        ]

        expect(summarize(matchContainmentTemplate(skeleton, 'test command'))).toMatchObject({
            type: 'matched',
            change: { object: { span: 'candle' }, to: { span: 'bag' }, containment: 'In' },
        })
    })
})

describe('matchContainmentTemplate narration (the template authors its unit)', () => {
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

    it('narrates the phrase as the template writes it, not as typed', () => {
        const [{ variants: [{ parts }] }] = unitOf('PUT', 'Into').units
        expect(parts).toEqual([{ slot: 'actor' }, { text: ' puts ' }, { ref: 'coinRef' }, { text: ' into ' }, { ref: 'jarRef' }])
    })

    it('does not match a fixed word inside a longer text token: "put coin hurriedly into box" is no containment', () => {
        expect(matchContainmentTemplate(containmentSkeleton('put', 'coin', 'hurriedly into', 'box'), 'test command')).toEqual({ type: 'noMatch' })
    })
})
