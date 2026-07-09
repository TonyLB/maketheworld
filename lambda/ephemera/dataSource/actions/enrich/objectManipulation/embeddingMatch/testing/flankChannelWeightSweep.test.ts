import {
    LEX_ADJOINED_FLANK_WEIGHT,
    LEX_REMOTE_FLANK_WEIGHT,
} from '../thresholds'
import {
    pickBestFlankWeightSweepRow,
    runFlankWeightSweep,
    scoreFlankWeightSweepRow,
} from './flankChannelWeightSweep'

describe('FT-1.3.5 flank channel weight sweep', () => {
    it('locks calibrated flank weights from sweep', () => {
        const best = pickBestFlankWeightSweepRow()
        expect(best).toBeDefined()
        expect(best!.lexAdjoinedFlankWeight).toBe(LEX_ADJOINED_FLANK_WEIGHT)
        expect(best!.lexRemoteFlankWeight).toBe(LEX_REMOTE_FLANK_WEIGHT)
        expect(best!.identityOk).toBe(true)
        expect(best!.axolotl).toBeGreaterThan(best!.coaxial)
        expect(best!.gemMinusA).toBeGreaterThan(0.05)
        expect(best!.rustyMinusAxle).toBeGreaterThan(0)
        expect(best!.aAxe).toBeLessThan(0.7)
    })

    it('baseline weight pair matches locked production constants', () => {
        const baseline = scoreFlankWeightSweepRow(
            LEX_ADJOINED_FLANK_WEIGHT,
            LEX_REMOTE_FLANK_WEIGHT
        )
        const best = pickBestFlankWeightSweepRow(runFlankWeightSweep())
        expect(best).toEqual(baseline)
    })
})
