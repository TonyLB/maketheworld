import { lexicalRelevance } from './lexicalRelevance'

describe('lexicalRelevance', () => {
    it('scores exact match near 1.0', () => {
        expect(lexicalRelevance('broom', 'broom')).toBeGreaterThan(0.97)
    })

    it('scores wrapper / token-boundary containment highly even on long catalog names', () => {
        expect(lexicalRelevance('broom', 'the broom')).toBeGreaterThan(0.85)
        expect(lexicalRelevance('the broom', 'broom')).toBeGreaterThan(0.85)
        expect(lexicalRelevance('broom', 'the extraordinarily detailed antique wooden broom')).toBeGreaterThan(0.65)
    })

    it('tolerates typos on short names with moderate non-zero score', () => {
        const score = lexicalRelevance('sord', 'sword')
        expect(score).toBeGreaterThan(0)
        expect(score).toBeLessThan(1)
    })

    it('is less punitive for typos on long names than short names', () => {
        const shortTypo = lexicalRelevance('sord', 'sword')
        const longTypo = lexicalRelevance('hyper-maceratr', 'hyper-macerator')
        expect(longTypo).toBeGreaterThan(shortTypo)
    })

    it('ranks ax vs rusty ax and axle above unrelated (coverage bias can still favor infix axle)', () => {
        const rustyAx = lexicalRelevance('ax', 'rusty ax')
        const axle = lexicalRelevance('ax', 'axle')
        const unrelated = lexicalRelevance('ax', 'sword')

        expect(rustyAx).toBeGreaterThan(unrelated)
        expect(axle).toBeGreaterThan(unrelated)
    })

    it('ranks prefix-anchored axolotl above infix-embedded coaxial', () => {
        const axolotl = lexicalRelevance('ax', 'axolotl')
        const coaxial = lexicalRelevance('ax', 'coaxial')
        expect(axolotl).toBeGreaterThan(coaxial)
    })

    it('scores paraphrase well below exact match (calibration-owned absolute floor)', () => {
        expect(lexicalRelevance('sweeping tool', 'broom')).toBeLessThan(0.4)
        expect(lexicalRelevance('sweeping tool', 'broom')).toBeLessThan(lexicalRelevance('broom', 'broom'))
    })

    it('scores absent object near zero', () => {
        expect(lexicalRelevance('sword', 'anvil')).toBeLessThan(0.15)
    })

    it('returns identical scores for duplicate normalized shortNames', () => {
        const scoreA = lexicalRelevance('broom', 'broom')
        const scoreB = lexicalRelevance('broom', 'broom')
        expect(scoreA).toBe(scoreB)
        expect(scoreA).toBeGreaterThan(0.97)
    })

    it('scores unary catalog exact match near 1.0', () => {
        expect(lexicalRelevance('sword', 'sword')).toBeGreaterThan(0.97)
    })
})
