import type { ParseSkeleton } from '../parse/parseToken'
import { matchRelationalTemplate } from './matchRelationalTemplate'
import type { Change } from './planStep'
import type { RelationalTemplateMatchResult } from './matchRelationalTemplate'

/** The attempt's step, so the expectations below read the plan's shape, not the attempt's. */
const summarize = (result: RelationalTemplateMatchResult) => {
    if (result.type !== 'matched') {
        return result
    }
    return { type: 'matched' as const, change: result.attempt.actions()[0].desiredResult as Change }
}

describe('matchRelationalTemplate', () => {
    it('matches an establishRelation template with an enum relation ("put broom under table")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'under' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({
            type: 'matched',
            change: {
                kind: 'change',
                primitive: 'establishRelation',
                subject: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                target: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
                relationKind: 'Under',
            },
        })
    })

    it('plans "on" as the containment transfer, same as In (Channel D CD2: On joins In/PartOf) ("put broom on table")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({
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

    it('matches a dissolveRelation template, falling to Custom for a non-enum, non-containment prep ("take rope off crate")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            { type: 'text', text: 'off' },
            { type: 'objectSpan', span: 'crate', stableRefKey: 'crateRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({
            type: 'matched',
            change: {
                kind: 'change',
                primitive: 'dissolveRelation',
                subject: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
                target: { referentType: 'objectSpan', span: 'crate', stableRefKey: 'crateRef' },
                relationKind: 'Custom',
                relationLabel: 'off',
            },
        })
    })

    it('matches an establishRelation template with an Against relation ("lean ladder against wall")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'lean' },
            { type: 'objectSpan', span: 'ladder', stableRefKey: 'ladderRef' },
            { type: 'text', text: 'against' },
            { type: 'objectSpan', span: 'wall', stableRefKey: 'wallRef' },
        ]

        const result = summarize(matchRelationalTemplate(skeleton, 'test command'))
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive === 'transferMembership') return
        expect(result.change.relationKind).toBe('Against')
    })

    it('plans containment language ("put coin in jar") as the containment transfer', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({
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

    it('matches an establishRelation Custom template ("tie rope to cup")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'tie' },
            { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            { type: 'text', text: 'to' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({
            type: 'matched',
            change: {
                kind: 'change',
                primitive: 'establishRelation',
                subject: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
                target: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
                relationKind: 'Custom',
                relationLabel: 'to',
            },
        })
    })

    it('returns noMatch for an unrecognized verb', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'throw' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 2-token (membership-shaped) skeleton', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 6-token skeleton (a modifier-bearing shape, out of scope for this slice)', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'candle', stableRefKey: 'candleRef' },
            { type: 'text', text: 'from' },
            { type: 'objectSpan', span: 'bookshelf', stableRefKey: 'bookshelfRef' },
            { type: 'text', text: 'into' },
            { type: 'objectSpan', span: 'bag', stableRefKey: 'bagRef' },
        ]

        expect(summarize(matchRelationalTemplate(skeleton, 'test command'))).toEqual({ type: 'noMatch' })
    })

    it('builds two distinct Referents by stableRefKey even when span text is identical ("put bench under bench")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef1' },
            { type: 'text', text: 'under' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef2' },
        ]

        const result = summarize(matchRelationalTemplate(skeleton, 'test command'))
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive === 'transferMembership') return
        expect(result.change.subject).toEqual({ referentType: 'objectSpan', span: 'bench', stableRefKey: 'benchRef1' })
        expect(result.change.target).toEqual({ referentType: 'objectSpan', span: 'bench', stableRefKey: 'benchRef2' })
    })
})
