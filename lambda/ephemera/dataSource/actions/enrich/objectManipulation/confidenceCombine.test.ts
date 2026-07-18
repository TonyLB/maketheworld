import { combineConfidenceNaive } from './confidenceCombine'

describe('combineConfidenceNaive', () => {
    it('returns 1 when both inputs are 1', () => {
        expect(combineConfidenceNaive(1, 1)).toBe(1)
    })

    it('returns 0 when both inputs are 0', () => {
        expect(combineConfidenceNaive(0, 0)).toBe(0)
    })

    it('returns the midpoint for a symmetric pair', () => {
        expect(combineConfidenceNaive(0.4, 0.6)).toBeCloseTo(0.5)
    })

    it('returns the arithmetic mean for an asymmetric pair', () => {
        expect(combineConfidenceNaive(0.2, 0.9)).toBeCloseTo(0.55)
    })
})
