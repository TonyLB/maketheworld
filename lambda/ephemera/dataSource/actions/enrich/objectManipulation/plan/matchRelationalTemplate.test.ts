import type { ParseSkeleton } from '../parse/parseToken'
import { matchRelationalTemplate } from './matchRelationalTemplate'

describe('matchRelationalTemplate', () => {
    it('matches an establishRelation template with an enum relation ("put broom under table")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'under' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({
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

    it('returns nestingDefer for "on" too, same as containment (Channel D CD2: On joins In/PartOf) ("put broom on table")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({ type: 'nestingDefer' })
    })

    it('matches a dissolveRelation template, falling to Custom for a non-enum, non-containment prep ("take rope off crate")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            { type: 'text', text: 'off' },
            { type: 'objectSpan', span: 'crate', stableRefKey: 'crateRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({
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

        const result = matchRelationalTemplate(skeleton)
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive === 'transferMembership') return
        expect(result.change.relationKind).toBe('Against')
    })

    it('returns nestingDefer for containment language ("put coin in jar")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({ type: 'nestingDefer' })
    })

    it('returns noMatch for an unrecognized verb', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'throw' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({ type: 'noMatch' })
    })

    it('returns noMatch for a 2-token (membership-shaped) skeleton', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(matchRelationalTemplate(skeleton)).toEqual({ type: 'noMatch' })
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

        expect(matchRelationalTemplate(skeleton)).toEqual({ type: 'noMatch' })
    })

    it('builds two distinct Referents by stableRefKey even when span text is identical ("put bench under bench")', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef1' },
            { type: 'text', text: 'under' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef2' },
        ]

        const result = matchRelationalTemplate(skeleton)
        expect(result.type).toBe('matched')
        if (result.type !== 'matched' || result.change.primitive === 'transferMembership') return
        expect(result.change.subject).toEqual({ referentType: 'objectSpan', span: 'bench', stableRefKey: 'benchRef1' })
        expect(result.change.target).toEqual({ referentType: 'objectSpan', span: 'bench', stableRefKey: 'benchRef2' })
    })
})
