import {
    Perspective,
    PerspectiveMatcher,
    perspectiveMatches,
    isPerspective,
    isPerspectiveMatcher
} from './perspective'

const A = 'ASSET#a' as const
const B = 'ASSET#b' as const
const C = 'ASSET#c' as const
const D = 'ASSET#d' as const
const E = 'ASSET#e' as const

describe('Perspective shape', () => {
    it('has assetStack array', () => {
        const p: Perspective = { assetStack: [A, B, C] }
        expect(p.assetStack).toEqual([A, B, C])
    })

    it('isPerspective accepts valid object with valid asset ids', () => {
        expect(isPerspective({ assetStack: [A, B, C] })).toBe(true)
    })

    it('isPerspective rejects non-object', () => {
        expect(isPerspective(null)).toBe(false)
        expect(isPerspective(undefined)).toBe(false)
        expect(isPerspective('string')).toBe(false)
    })

    it('isPerspective rejects missing or invalid assetStack', () => {
        expect(isPerspective({})).toBe(false)
        expect(isPerspective({ assetStack: 'not-array' })).toBe(false)
    })

    it('isPerspective rejects non-ASSET# elements', () => {
        expect(isPerspective({ assetStack: [A, 'ROOM#x', C] })).toBe(false)
        expect(isPerspective({ assetStack: [A, 'invalid', C] })).toBe(false)
    })
})

describe('PerspectiveMatcher shape', () => {
    it('has requiredAssetIds and optional forbiddenAssetIds', () => {
        const m: PerspectiveMatcher = { requiredAssetIds: [A, B], forbiddenAssetIds: [E] }
        expect(m.requiredAssetIds).toEqual([A, B])
        expect(m.forbiddenAssetIds).toEqual([E])
    })

    it('isPerspectiveMatcher accepts valid matcher', () => {
        expect(isPerspectiveMatcher({ requiredAssetIds: [A, B] })).toBe(true)
        expect(isPerspectiveMatcher({ requiredAssetIds: [A], forbiddenAssetIds: [E] })).toBe(true)
    })

    it('isPerspectiveMatcher rejects non-object', () => {
        expect(isPerspectiveMatcher(null)).toBe(false)
    })

    it('isPerspectiveMatcher rejects missing or invalid requiredAssetIds', () => {
        expect(isPerspectiveMatcher({})).toBe(false)
        expect(isPerspectiveMatcher({ requiredAssetIds: 'not-array' })).toBe(false)
    })

    it('isPerspectiveMatcher rejects invalid ids in required or forbidden', () => {
        expect(isPerspectiveMatcher({ requiredAssetIds: [A, 'ROOM#x'] })).toBe(false)
        expect(isPerspectiveMatcher({ requiredAssetIds: [A], forbiddenAssetIds: ['bad'] })).toBe(false)
    })
})

describe('perspectiveMatches', () => {
    it('required only: [A,B,C] matches { requiredAssetIds: [A,B,C] }', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A, B, C] },
            { assetStack: [A, B, C] }
        )).toBe(true)
    })

    it('required only: [A,B,C,D] matches { requiredAssetIds: [A,B,C] }', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A, B, C] },
            { assetStack: [A, B, C, D] }
        )).toBe(true)
    })

    it('required only: [A,B] does not match { requiredAssetIds: [A,B,C] }', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A, B, C] },
            { assetStack: [A, B] }
        )).toBe(false)
    })

    it('forbidden: [A,B,C] does not match { requiredAssetIds: [A,B], forbiddenAssetIds: [C] }', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A, B], forbiddenAssetIds: [C] },
            { assetStack: [A, B, C] }
        )).toBe(false)
    })

    it('forbidden: [A,B] matches { requiredAssetIds: [A,B], forbiddenAssetIds: [C] }', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A, B], forbiddenAssetIds: [C] },
            { assetStack: [A, B] }
        )).toBe(true)
    })

    it('combined: [A,B,C] and [A,B,D] match required [A,B], forbidden [E]', () => {
        const matcher: PerspectiveMatcher = { requiredAssetIds: [A, B], forbiddenAssetIds: [E] }
        expect(perspectiveMatches(matcher, { assetStack: [A, B, C] })).toBe(true)
        expect(perspectiveMatches(matcher, { assetStack: [A, B, D] })).toBe(true)
    })

    it('combined: [A,B,E] and [A] do not match required [A,B], forbidden [E]', () => {
        const matcher: PerspectiveMatcher = { requiredAssetIds: [A, B], forbiddenAssetIds: [E] }
        expect(perspectiveMatches(matcher, { assetStack: [A, B, E] })).toBe(false)
        expect(perspectiveMatches(matcher, { assetStack: [A] })).toBe(false)
    })

    it('empty required and undefined forbidden: any perspective matches', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [] },
            { assetStack: [A, B, C] }
        )).toBe(true)
        expect(perspectiveMatches(
            { requiredAssetIds: [], forbiddenAssetIds: [] },
            { assetStack: [] }
        )).toBe(true)
    })

    it('undefined forbiddenAssetIds treated as empty', () => {
        expect(perspectiveMatches(
            { requiredAssetIds: [A] },
            { assetStack: [A, B, C] }
        )).toBe(true)
    })
})
