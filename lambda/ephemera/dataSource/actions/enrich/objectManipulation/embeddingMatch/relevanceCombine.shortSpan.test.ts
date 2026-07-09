import { lexicalRelevance } from './lexicalRelevance'
import {
    centeredTanhEvidence,
    centeredTanhEvidenceAdjoinedPositiveDamped,
    coverageLiftFromEmbed,
    effectiveFlankCombineBias,
} from './relevanceCombine'
import {
    LEX_ADJOINED_POS_DAMP_SCALE,
    LEX_FLANK_COMBINE_BIAS,
    T_JOINT_ABS,
} from './thresholds'
import {
    compareFlankCombineLegacyRows,
    KEY_SHORT_SPAN_FIXTURES,
    PROPORTIONATE_COVERAGE_FIXTURES,
} from './testing/compareFlankCombineLegacy'

describe('coverageLiftFromEmbed', () => {
    it('returns ~1 at full coverage', () => {
        expect(coverageLiftFromEmbed(1)).toBeCloseTo(1, 2)
    })

    it('returns materially below 1 at one-third coverage', () => {
        const lift = coverageLiftFromEmbed(1 / 3)
        expect(lift).toBeLessThan(1)
        expect(lift).toBeCloseTo(0.87, 1)
    })
})

describe('effectiveFlankCombineBias', () => {
    it('returns biasMax at full coverage', () => {
        expect(effectiveFlankCombineBias(5, 5)).toBeCloseTo(LEX_FLANK_COMBINE_BIAS, 2)
    })

    it('returns reduced bias below biasMax at one-third coverage', () => {
        const bias = effectiveFlankCombineBias(1, 3)
        expect(bias).toBeLessThan(LEX_FLANK_COMBINE_BIAS)
        expect(bias).toBeCloseTo(1.31, 1)
    })
})

describe('centeredTanhEvidenceAdjoinedPositiveDamped', () => {
    it('scales down positive adjoined evidence for short patterns', () => {
        const input = { value: 0, midpoint: 0.5, scale: 1.5, weight: 1 }
        const damped = centeredTanhEvidenceAdjoinedPositiveDamped(input, 1)
        const raw = centeredTanhEvidence(input)
        expect(damped).toBeGreaterThan(0)
        expect(damped).toBeLessThan(raw)
    })

    it('leaves negative adjoined evidence at full weight', () => {
        const input = { value: 4, midpoint: 0.5, scale: 1.5, weight: 1 }
        const damped = centeredTanhEvidenceAdjoinedPositiveDamped(input, 1)
        const raw = centeredTanhEvidence(input)
        expect(damped).toBeCloseTo(raw)
        expect(damped).toBeLessThan(0)
    })

    it('approaches full positive weight as pattern length grows', () => {
        const input = { value: 0, midpoint: 0.5, scale: 1.5, weight: 1 }
        const shortDamp = centeredTanhEvidenceAdjoinedPositiveDamped(input, 1)
        const longDamp = centeredTanhEvidenceAdjoinedPositiveDamped(input, LEX_ADJOINED_POS_DAMP_SCALE * 3)
        const raw = centeredTanhEvidence(input)
        expect(longDamp).toBeGreaterThan(shortDamp)
        expect(longDamp).toBeCloseTo(raw, 1)
    })
})

describe('short-span lexical mitigations end-to-end', () => {
    const legacyRows = compareFlankCombineLegacyRows(KEY_SHORT_SPAN_FIXTURES)

    it('lowers a/axe flank and lexical vs legacy', () => {
        const row = legacyRows.find((entry) => entry.span === 'a' && entry.shortName === 'axe')
        expect(row).toBeDefined()
        expect(row!.mitigatedFlankScore).toBeLessThan(row!.legacyFlankScore)
        expect(lexicalRelevance('a', 'axe')).toBeLessThan(row!.legacyFlankScore)
    })

    it('keeps ax/axolotl above ax/coaxial', () => {
        expect(lexicalRelevance('ax', 'axolotl')).toBeGreaterThan(lexicalRelevance('ax', 'coaxial'))
    })

    it('keeps exact broom/broom high', () => {
        expect(lexicalRelevance('broom', 'broom')).toBeGreaterThan(0.97)
    })

    it('does not collapse broom in long wrapper vs exact', () => {
        const exact = lexicalRelevance('broom', 'broom')
        const wrapped = lexicalRelevance('broom', 'the ancient wrought iron broom')
        expect(wrapped).toBeGreaterThan(0.5)
        expect(wrapped).toBeGreaterThan(exact * 0.5)
    })

    it('materially lowers a/axe vs legacy; bias sweep pulls score below T_JOINT_ABS', () => {
        const row = legacyRows.find((entry) => entry.span === 'a' && entry.shortName === 'axe')
        expect(row).toBeDefined()
        expect(row!.mitigatedLex).toBeLessThan(row!.legacyFlankScore)
        expect(row!.mitigatedLex).toBeLessThan(T_JOINT_ABS)
    })

    it('gem/gemstones shares embed coverage with a/axe but scores higher (legitimate stem)', () => {
        const rows = compareFlankCombineLegacyRows([...PROPORTIONATE_COVERAGE_FIXTURES])
        const aAxe = rows.find((entry) => entry.span === 'a' && entry.shortName === 'axe')
        const gemStones = rows.find((entry) => entry.span === 'gem' && entry.shortName === 'gemstones')
        const gemExact = rows.find((entry) => entry.span === 'gem' && entry.shortName === 'gem')
        expect(aAxe).toBeDefined()
        expect(gemStones).toBeDefined()
        expect(gemExact).toBeDefined()
        expect(gemStones!.mitigatedLex).toBeGreaterThan(aAxe!.mitigatedLex)
        expect(gemExact!.mitigatedLex).toBeGreaterThan(gemStones!.mitigatedLex)
    })

    it('gem/gemstones and don/wimbledon share morphology; lexical scores match', () => {
        const gemStones = lexicalRelevance('gem', 'gemstones')
        const donWimbledon = lexicalRelevance('don', 'wimbledon')
        expect(gemStones).toBeCloseTo(donWimbledon, 10)
    })

    it('ratio-invariant remote + flank weights widen gem vs a at equal embed coverage', () => {
        const aAxe = lexicalRelevance('a', 'axe')
        const gemStones = lexicalRelevance('gem', 'gemstones')
        expect(gemStones).toBeGreaterThan(aAxe)
        expect(gemStones - aAxe).toBeGreaterThan(0.05)
    })

    it('higher adjoined weight ranks rusty ax above infix axle', () => {
        const rustyAx = lexicalRelevance('ax', 'rusty ax')
        const axle = lexicalRelevance('ax', 'axle')
        expect(rustyAx).toBeGreaterThan(axle)
    })

    it('unary a/axe shorthand may score moderately (not held to diverse-catalog spurious bound)', () => {
        const shorthand = lexicalRelevance('a', 'axe')
        expect(shorthand).toBeGreaterThan(0.3)
        expect(shorthand).toBeLessThan(T_JOINT_ABS)
        expect(shorthand).toBeLessThan(lexicalRelevance('gem', 'gem'))
    })
})
