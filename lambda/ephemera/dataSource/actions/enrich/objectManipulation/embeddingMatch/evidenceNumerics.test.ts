import { clampUnitInterval, sigmoid, tanh } from './evidenceNumerics'

describe('evidenceNumerics', () => {
    describe('sigmoid', () => {
        it('returns 0.5 at zero', () => {
            expect(sigmoid(0)).toBeCloseTo(0.5)
        })

        it('approaches 1 for large positive inputs without overflow', () => {
            expect(sigmoid(100)).toBeCloseTo(1)
            expect(sigmoid(1000)).toBeCloseTo(1)
        })

        it('approaches 0 for large negative inputs without overflow', () => {
            expect(sigmoid(-100)).toBeCloseTo(0)
            expect(sigmoid(-1000)).toBeCloseTo(0)
        })

        it('maps positive infinity to 1 and negative infinity to 0', () => {
            expect(sigmoid(Number.POSITIVE_INFINITY)).toBe(1)
            expect(sigmoid(Number.NEGATIVE_INFINITY)).toBe(0)
        })
    })

    describe('tanh', () => {
        it('returns 0 at zero', () => {
            expect(tanh(0)).toBe(0)
        })

        it('saturates toward +/-1 for large magnitudes', () => {
            expect(tanh(10)).toBeCloseTo(1)
            expect(tanh(-10)).toBeCloseTo(-1)
        })
    })

    describe('clampUnitInterval', () => {
        it('passes through values in [0, 1]', () => {
            expect(clampUnitInterval(0)).toBe(0)
            expect(clampUnitInterval(0.5)).toBe(0.5)
            expect(clampUnitInterval(1)).toBe(1)
        })

        it('clamps below 0 and above 1', () => {
            expect(clampUnitInterval(-0.1)).toBe(0)
            expect(clampUnitInterval(1.2)).toBe(1)
        })
    })
})
