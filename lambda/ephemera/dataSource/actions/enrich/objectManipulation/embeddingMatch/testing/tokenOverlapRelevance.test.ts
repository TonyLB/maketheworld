import { tokenOverlapRelevance } from './tokenOverlapRelevance'

describe('tokenOverlapRelevance', () => {
    it('scores exact token overlap at 1.0', () => {
        expect(tokenOverlapRelevance('broom', 'broom')).toBe(1)
    })

    it('scores partial overlap by span token fraction', () => {
        expect(tokenOverlapRelevance('rusty ax', 'ax')).toBeCloseTo(0.5, 2)
    })

    it('scores paraphrase with no shared tokens at 0', () => {
        expect(tokenOverlapRelevance('sweeping tool', 'broom')).toBe(0)
    })
})
