import type { ParseSkeleton } from '../parse/parseToken'
import { matchLookTemplate } from './matchLookTemplate'

describe('matchLookTemplate', () => {
    it('matches "look" plus an object span', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        ]

        expect(matchLookTemplate(skeleton)).toEqual({
            type: 'matched',
            referent: { referentType: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        })
    })

    it('matches "examine" plus an object span', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'examine' },
            { type: 'objectSpan', span: 'lantern', stableRefKey: 'lanternRef' },
        ]

        expect(matchLookTemplate(skeleton)).toEqual({
            type: 'matched',
            referent: { referentType: 'objectSpan', span: 'lantern', stableRefKey: 'lanternRef' },
        })
    })

    it('matches the abbreviated verbs "l" and "x"', () => {
        const lSkeleton: ParseSkeleton = [
            { type: 'text', text: 'l' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]
        const xSkeleton: ParseSkeleton = [
            { type: 'text', text: 'x' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(matchLookTemplate(lSkeleton).type).toBe('matched')
        expect(matchLookTemplate(xSkeleton).type).toBe('matched')
    })

    it('returns noMatch for an unrecognized verb', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'throw' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(matchLookTemplate(skeleton)).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 4-token (relational-shaped) skeleton', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(matchLookTemplate(skeleton)).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a bare 1-token skeleton', () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }]

        expect(matchLookTemplate(skeleton)).toEqual({ type: 'noMatch' })
    })
})
