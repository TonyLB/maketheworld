import type { ParseSkeleton } from '../parse/parseToken'
import { classifySkeletonFamily } from './classifySkeletonFamily'

describe('classifySkeletonFamily', () => {
    it('classifies a 4-token relational template as relational', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'under' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'relational' })
    })

    it('classifies a containment relational template as relationalDefer, kind In', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({
            type: 'relationalDefer',
            kind: 'In',
            operationKind: 'establishRelation',
            subject: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            target: { referentType: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
        })
    })

    it('classifies a hosting relational template as relationalDefer, kind On (PV1-2)', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'tray', stableRefKey: 'trayRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({
            type: 'relationalDefer',
            kind: 'On',
            operationKind: 'establishRelation',
            subject: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            target: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'trayRef' },
        })
    })

    it('classifies "take <object>" as membership acquire', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'membership', verbClass: 'acquire' })
    })

    it('classifies "drop <object>" as membership release', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'drop' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'membership', verbClass: 'release' })
    })

    it('classifies "look <object>" as look', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'look' })
    })

    it('classifies "examine <object>" as look', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'examine' },
            { type: 'objectSpan', span: 'lantern', stableRefKey: 'lanternRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'look' })
    })

    it('classifies an unrecognized 2-token skeleton as none', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'throw' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        expect(classifySkeletonFamily(skeleton)).toEqual({ type: 'none' })
    })
})
