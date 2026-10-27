import { lexicalRelevance } from './lexicalRelevance'

describe('lexicalRelevance', () => {
    it('scores exact match near 1.0', () => {
        expect(lexicalRelevance('broom', 'broom')).toBeGreaterThan(0.97)
    })

    it('scores wrapper / token-boundary containment highly even on long catalog names', () => {
        expect(lexicalRelevance('broom', 'the broom')).toBeGreaterThan(0.85)
        expect(lexicalRelevance('broom', 'the extraordinarily detailed antique wooden broom')).toBeGreaterThan(0.65)
    })

    // Identify peels a leading article before scoring (`resolveCatalogSpanToPool`); unpeeled, the
    // article is the span's own surplus.
    it('charges a span\'s own extra words more than a name\'s', () => {
        expect(lexicalRelevance('the broom', 'broom')).toBeLessThan(lexicalRelevance('broom', 'the broom'))
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

    it('scores 0 when either string normalizes to empty', () => {
        expect(lexicalRelevance('  ', 'cup')).toBe(0)
        expect(lexicalRelevance('cup', '')).toBe(0)
    })
})

describe('lexicalRelevance on a span\'s surplus (SM-4)', () => {
    it('scores a span with extra words well below its name alone', () => {
        expect(lexicalRelevance('cup on saucer on table', 'cup')).toBeLessThan(lexicalRelevance('cup', 'cup') / 2)
        expect(lexicalRelevance('cup from table', 'cup')).toBeLessThan(lexicalRelevance('cup', 'cup') / 2)
    })

    it('scores a span with extra words below a span that is part of the name', () => {
        expect(lexicalRelevance('cup on saucer on kitchen table', 'kitchen table')).toBeLessThan(lexicalRelevance('table', 'kitchen table'))
    })

    it('keeps the catalog side\'s forgiveness: `ax` against "rusty old ax" scores as before the span-side cost', () => {
        // read from the pre-4d scoring (`legacyLexicalRelevance`, retired with Sellers in 4d)
        expect(lexicalRelevance('ax', 'rusty old ax')).toBe(0.8598623420545417)
    })

    it('forgives a name\'s words the span leaves out from inside it', () => {
        expect(lexicalRelevance('rusty ax', 'rusty old ax')).toBeGreaterThan(0.95)
        expect(lexicalRelevance('pig blanket', 'pig in a blanket')).toBeGreaterThan(0.95)
    })

    it('scores an exact name the span holds above a name its words merely resemble', () => {
        expect(lexicalRelevance('cup , then look', 'cup')).toBeGreaterThan(lexicalRelevance('cup , then look', 'man in the moon'))
    })

    it('scores 0 when no word of the span pairs with a word of the name', () => {
        expect(lexicalRelevance('sweeping tool', 'broom')).toBe(0)
        expect(lexicalRelevance('sword', 'anvil')).toBe(0)
    })
})
