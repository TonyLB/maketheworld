import type { ParseSkeleton } from '../parse/parseToken'
import { matchLookTemplate } from './matchLookTemplate'
import type { LookTemplateMatchResult } from './matchLookTemplate'

/** The narration's referent, so the expectations below read the template's referent shape. */
const summarize = (result: LookTemplateMatchResult) => {
    if (result.type !== 'matched') {
        return result
    }
    return { type: 'matched' as const, referent: result.attempt.actions()[0].referents()[0] }
}

describe('matchLookTemplate', () => {
    it('matches "look" plus an object span', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        ]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({
            type: 'matched',
            referent: { referentType: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        })
    })

    it('matches "examine" plus an object span', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'examine' },
            { type: 'objectSpan', span: 'lantern', stableRefKey: 'lanternRef' },
        ]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({
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

        expect(summarize(matchLookTemplate(lSkeleton, 'test command')).type).toBe('matched')
        expect(summarize(matchLookTemplate(xSkeleton, 'test command')).type).toBe('matched')
    })

    it('returns noMatch for an unrecognized verb', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'throw' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 4-token (relational-shaped) skeleton', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a bare 1-token skeleton', () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })
})
