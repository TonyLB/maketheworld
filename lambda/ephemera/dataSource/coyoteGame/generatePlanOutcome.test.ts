import { generatePlanOutcome } from './generatePlanOutcome'

describe('generatePlanOutcome', () => {
    it('returns stub RenderTree', async () => {
        await expect(generatePlanOutcome()).resolves.toEqual(['Outcome: Stubbed'])
    })
})
