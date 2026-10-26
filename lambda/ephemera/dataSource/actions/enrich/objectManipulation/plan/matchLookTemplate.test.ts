import type { ParseSkeleton } from '../parse/parseToken'
import { matchTemplate, type TemplateMatchResult } from './attemptTemplateFixture'
import { lookAtTemplate, lookTemplate } from './matchLookTemplate'
import { planFillOf } from './attemptTemplateFixture'

const matchLookTemplate = matchTemplate(lookTemplate)

/** The narration's referent, so the expectations below read the template's referent shape. */
const summarize = (result: TemplateMatchResult) => {
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

    it('reads a qualifier on the looked-at object: the look checks the cup is on the table before it describes', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        const [attempt] = planFillOf(skeleton, 'look broom on table').attempts
        expect(attempt?.actions().map((action) => action.toJSON().kind)).toEqual(['position', 'narrate'])
        expect(attempt?.actions()[0]?.desiredResult).toMatchObject({
            kind: 'assertion',
            predicate: 'containedBy',
            subject: { stableRefKey: 'broomRef' },
            object: { stableRefKey: 'tableRef' },
        })
    })

    it('returns noMatch for a bare 1-token skeleton', () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }]

        expect(summarize(matchLookTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })
})

describe('lookAtTemplate', () => {
    const matchLookAtTemplate = matchTemplate(lookAtTemplate)

    it.each(['look', 'l'])('matches "%s at" plus an object span, the model\'s `at` its own token', (verb) => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: verb },
            { type: 'text', text: 'at' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(summarize(matchLookAtTemplate(skeleton, 'test command'))).toEqual({
            type: 'matched',
            referent: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        })
    })

    it('reads "look at the cup on the table" as a look at the cup, qualified by the table', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'text', text: 'at' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        const { attempts } = planFillOf(skeleton, 'look at cup on table')
        expect(attempts).toHaveLength(1)
        expect(attempts[0]!.actions().map((action) => action.toJSON().kind)).toEqual(['position', 'narrate'])
        expect(attempts[0]!.actions()[1]!.referents()[0]).toMatchObject({ stableRefKey: 'cupRef' })
    })

    it('returns noMatch for "look at" with no object', () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }, { type: 'text', text: 'at' }]

        expect(summarize(matchLookAtTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })
})
