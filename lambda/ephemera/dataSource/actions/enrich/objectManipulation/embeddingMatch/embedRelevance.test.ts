import { embedRelevance } from './embedRelevance'
import { C_MIN } from './thresholds'

describe('embedRelevance', () => {
    it('maps c_min to 0 and c_max to 1', () => {
        expect(embedRelevance(C_MIN)).toBe(0)
        expect(embedRelevance(1)).toBe(1)
    })

    it('clamps non-positive cosine to 0', () => {
        expect(embedRelevance(0)).toBe(0)
        expect(embedRelevance(-0.1)).toBe(0)
    })

    it('clamps below-floor values to 0', () => {
        expect(embedRelevance(0.03)).toBe(0)
    })

    it('maps corpus-representative cosines at c_min=0.05', () => {
        expect(embedRelevance(0.158)).toBeCloseTo(0.384, 2)
        expect(embedRelevance(0.253)).toBeCloseTo(0.541, 2)
    })

    it('is monotonic across a grid', () => {
        const grid = [0.05, 0.08, 0.12, 0.158, 0.2, 0.253, 0.5, 0.9, 1]
        for (let i = 1; i < grid.length; i += 1) {
            expect(embedRelevance(grid[i])).toBeGreaterThanOrEqual(embedRelevance(grid[i - 1]))
        }
    })

    it('respects param overrides', () => {
        expect(embedRelevance(0.1, { cMin: 0.1, cMax: 1 })).toBe(0)
        expect(embedRelevance(0.5, { cMin: 0.1, cMax: 1 })).toBeCloseTo(0.699, 2)
    })
})
