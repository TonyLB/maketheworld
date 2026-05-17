jest.mock('@tonylb/mtw-gateways/ts/ephemera/thinking', () => ({
    buildThinkingCompletedJobsSnapshot: jest.fn(),
}))

import { buildThinkingCompletedJobsSnapshot } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { generateThinkingCompletedJobsSnapshot } from './generateThinkingCompletedJobsSnapshot'

describe('generateThinkingCompletedJobsSnapshot', () => {
    it('delegates to buildThinkingCompletedJobsSnapshot', async () => {
        const mockBuild = buildThinkingCompletedJobsSnapshot as jest.Mock
        mockBuild.mockResolvedValue({
            completedJobs: [],
            replayAt: 0,
        })
        const result = await generateThinkingCompletedJobsSnapshot('global')
        expect(mockBuild).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ completedJobs: [], replayAt: 0 })
    })
})
