import type { ParseSkeleton } from '../parse/parseToken'
import { groupSkeleton, matchQualifierPreposition, QUALIFIER_PHRASES } from './groupSkeleton'

const flat = (verb: string, head: string, preposition: string, host: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: head, stableRefKey: 'headRef' },
    { type: 'text', text: preposition },
    { type: 'objectSpan', span: host, stableRefKey: 'hostRef' },
]

describe('matchQualifierPreposition', () => {
    it.each([
        ['on', 'on'],
        ['on top of', 'on top of'],
        ['off', 'off'],
        ['in', 'in'],
        ['inside', 'inside'],
        ['out of', 'out of'],
        ['out', 'out of'],
        ['from', 'from'],
        ['  On   Top  OF ', 'on top of'],
    ])('reads "%s" as %s', (text, expected) => {
        expect(matchQualifierPreposition(text)).toBe(expected)
    })

    it.each(['onto', 'into', 'under', 'of', 'with', 'hurriedly from'])('reads "%s" as no qualifier', (text) => {
        expect(matchQualifierPreposition(text)).toBeUndefined()
    })

    it('lists multi-word phrases first, for a split inside free text', () => {
        expect(QUALIFIER_PHRASES.slice(0, 2)).toEqual(['on top of', 'out of'])
    })
})

describe('groupSkeleton', () => {
    it.each([
        ['take', 'on', 'on'],
        ['get', 'from', 'from'],
        ['Get', 'out', 'out of'],
        ['take', 'inside', 'inside'],
    ])('groups "%s cup %s table" into one reading: the table qualifies the cup', (verb, preposition, canonical) => {
        const skeleton = flat(verb, 'cup', preposition, 'table')

        expect(groupSkeleton(skeleton)).toEqual([[
            { type: 'text', text: verb },
            {
                type: 'objectSpan',
                span: 'cup',
                stableRefKey: 'headRef',
                qualifier: { preposition: canonical, span: { type: 'objectSpan', span: 'table', stableRefKey: 'hostRef' } },
            },
        ]])
    })

    it.each<[string, ParseSkeleton]>([
        ['a drop\'s tail, which is not read', flat('drop', 'cup', 'in', 'box')],
        ['a destination after put', flat('put', 'cup', 'on', 'table')],
        ['a preposition outside the set', flat('get', 'cup', 'under', 'table')],
        ['a motion word', flat('get', 'cup', 'onto', 'table')],
        ['a two-qualifier tail', [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]],
        ['the fast path\'s single span', [{ type: 'text', text: 'take' }, { type: 'objectSpan', span: 'cup on the table', stableRefKey: 'cupOnTheTableRef' }]],
    ])('leaves %s flat, as its one reading', (_label, skeleton) => {
        expect(groupSkeleton(skeleton)).toEqual([skeleton])
    })
})
