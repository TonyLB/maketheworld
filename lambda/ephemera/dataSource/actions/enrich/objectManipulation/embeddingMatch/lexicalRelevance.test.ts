import { lexicalRelevance } from './lexicalRelevance'

describe('lexicalRelevance', () => {
    it('scores exact match at ~1.0', () => {
        expect(lexicalRelevance('broom', 'broom')).toBeCloseTo(1, 2)
    })

    it('scores wrapper / token-boundary containment highly even on long catalog names', () => {
        expect(lexicalRelevance('broom', 'the broom')).toBeGreaterThan(0.9)
        expect(lexicalRelevance('the broom', 'broom')).toBeGreaterThan(0.9)
        expect(lexicalRelevance('broom', 'the extraordinarily detailed antique wooden broom')).toBeGreaterThan(0.9)
    })

    it('tolerates typos on short names with moderate non-zero score', () => {
        const score = lexicalRelevance('sord', 'sword')
        expect(score).toBeGreaterThan(0)
        expect(score).toBeLessThan(1)
    })

    it('is less punitive for typos on long names than short names (L_min floor)', () => {
        const shortTypo = lexicalRelevance('sord', 'sword')
        const longTypo = lexicalRelevance('hyper-maceratr', 'hyper-macerator')
        expect(longTypo).toBeGreaterThan(shortTypo)
    })

    it('ranks ax vs rusty ax above axle above unrelated', () => {
        const rustyAx = lexicalRelevance('ax', 'rusty ax')
        const axle = lexicalRelevance('ax', 'axle')
        const unrelated = lexicalRelevance('ax', 'sword')

        expect(rustyAx).toBeGreaterThan(axle)
        expect(axle).toBeGreaterThan(unrelated)
    })

    it('scores paraphrase near zero', () => {
        expect(lexicalRelevance('sweeping tool', 'broom')).toBeLessThan(0.15)
    })

    it('scores absent object near zero', () => {
        expect(lexicalRelevance('sword', 'anvil')).toBeLessThan(0.15)
    })

    it('returns identical scores for duplicate normalized shortNames', () => {
        const scoreA = lexicalRelevance('broom', 'broom')
        const scoreB = lexicalRelevance('broom', 'broom')
        expect(scoreA).toBe(scoreB)
        expect(scoreA).toBeCloseTo(1, 2)
    })

    it('scores unary catalog exact match at ~1.0', () => {
        expect(lexicalRelevance('sword', 'sword')).toBeCloseTo(1, 2)
    })
})
