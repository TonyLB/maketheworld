import {
    editDistanceRelevance,
    flankLengthRelevance,
} from './lexicalMatchMetrics'

describe('flankLengthRelevance', () => {
    const maxDamage = 0.25
    const k = 1

    it('returns 1 at zero flank length', () => {
        expect(flankLengthRelevance(0, 5, maxDamage, k)).toBe(1)
    })

    it('approaches 1 - maxDamage as flank length grows relative to span', () => {
        expect(flankLengthRelevance(50, 5, maxDamage, k)).toBeCloseTo(1 - maxDamage, 3)
    })

    it('decays faster with larger k', () => {
        const slow = flankLengthRelevance(5, 5, maxDamage, 0.5)
        const fast = flankLengthRelevance(5, 5, maxDamage, 2)
        expect(fast).toBeLessThan(slow)
    })

    it('scales flank length by match span length', () => {
        const oneSpan = flankLengthRelevance(5, 5, maxDamage, k)
        const twoSpansSameRatio = flankLengthRelevance(10, 10, maxDamage, k)
        expect(oneSpan).toBeCloseTo(twoSpansSameRatio)
    })

    it('rejects non-finite or negative flank length', () => {
        expect(() => flankLengthRelevance(-1, 5, maxDamage, k)).toThrow(/flankLength/)
        expect(() => flankLengthRelevance(Number.NaN, 5, maxDamage, k)).toThrow(/flankLength/)
    })

    it('rejects match span length below 1', () => {
        expect(() => flankLengthRelevance(0, 0, maxDamage, k)).toThrow(/matchSpanLength/)
        expect(() => flankLengthRelevance(0, 0.5, maxDamage, k)).toThrow(/matchSpanLength/)
    })

    it('rejects maxDamage outside (0, 1)', () => {
        expect(() => flankLengthRelevance(0, 5, 0, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, 1, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, 1.5, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, -0.1, k)).toThrow(/maxDamage/)
    })

    it('rejects non-positive k', () => {
        expect(() => flankLengthRelevance(0, 5, maxDamage, 0)).toThrow(/\bk\b/)
        expect(() => flankLengthRelevance(0, 5, maxDamage, -1)).toThrow(/\bk\b/)
    })
})

describe('editDistanceRelevance', () => {
    it('returns 1 for zero edit distance', () => {
        expect(editDistanceRelevance(0, 5, 4)).toBe(1)
    })

    it('returns 0 when edit distance reaches the max of span and pattern length', () => {
        expect(editDistanceRelevance(5, 5, 3)).toBe(0)
        expect(editDistanceRelevance(4, 3, 4)).toBe(0)
    })

    it('linearly interpolates between zero edits and the veto threshold', () => {
        expect(editDistanceRelevance(1, 5, 5)).toBeCloseTo(0.8)
    })

    it('returns 0 when both span and pattern length are zero', () => {
        expect(editDistanceRelevance(0, 0, 0)).toBe(0)
    })
})
