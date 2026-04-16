import { generateHypothesis } from './generateHypothesis'

describe('generateHypothesis', () => {
    it('returns stub RenderTree', async () => {
        await expect(generateHypothesis()).resolves.toEqual(['Hypothesis: Stubbed'])
    })
})
