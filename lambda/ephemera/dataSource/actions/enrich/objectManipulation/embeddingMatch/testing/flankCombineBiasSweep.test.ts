import {
    LEX_FLANK_COMBINE_BIAS,
    T_JOINT_ABS,
} from '../thresholds'
import {
    MORPHOLOGY_SYMMETRY_EPSILON,
    pickBestFlankCombineBiasSweepRow,
    runFlankCombineBiasSweep,
    scoreFlankCombineBiasSweepRow,
} from './flankCombineBiasSweep'

describe('FT-1.3.6 flank combine biasMax sweep', () => {
    it('gem/gemstones and don/wimbledon are lexically symmetric at every grid point', () => {
        for (const row of runFlankCombineBiasSweep()) {
            expect(Math.abs(row.gemDonLexDelta)).toBeLessThanOrEqual(MORPHOLOGY_SYMMETRY_EPSILON)
        }
    })

    it('logs bias sweep grid', () => {
        const rows = runFlankCombineBiasSweep()
        const best = pickBestFlankCombineBiasSweepRow(rows)
        const baseline = scoreFlankCombineBiasSweepRow(LEX_FLANK_COMBINE_BIAS)
        expect(best).toEqual(baseline)
    })

    it('locks calibrated biasMax from sweep', () => {
        const best = pickBestFlankCombineBiasSweepRow()
        expect(best).toBeDefined()
        expect(best!.lexFlankCombineBias).toBe(LEX_FLANK_COMBINE_BIAS)
        expect(best!.identityOk).toBe(true)
        expect(best!.axolotl).toBeGreaterThan(best!.coaxial)
        expect(best!.gemMinusA).toBeGreaterThan(0)
        expect(best!.rustyMinusAxle).toBeGreaterThan(0)
        expect(Math.abs(best!.gemDonLexDelta)).toBeLessThanOrEqual(MORPHOLOGY_SYMMETRY_EPSILON)
        expect(best!.aAxe).toBeLessThan(T_JOINT_ABS)
    })
})
